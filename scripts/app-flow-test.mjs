// App flow smoke test for GoalGuess.
//
// Drives the real user journey against your Supabase project using ONLY the
// public anon key — exactly what the installed app uses. It signs up, claims a
// username, reads matches, saves a prediction (if a round is open), creates a
// league, has a second user join by invite code, and reads the leaderboards.
// It reports any step that errors. Service role is used only to delete the two
// temporary test users at the end.
//
// Run:
//   PowerShell:  $env:SUPABASE_SERVICE_ROLE_KEY = "<key>"; npm run test:flow
//   bash:        SUPABASE_SERVICE_ROLE_KEY="<key>" npm run test:flow
import { createClient } from '@supabase/supabase-js';
import {
  SUPABASE_URL,
  ANON_KEY,
  SERVICE_ROLE_KEY,
  TEST_PASSWORD,
  makeTestEmail,
  requireConfig,
} from './lib/test-env.mjs';
import { Report } from './lib/test-report.mjs';

// Service role is only needed for cleanup; warn but continue without it.
requireConfig({ needService: false });

const report = new Report('App flow');
const createdUserIds = [];
const createdLeagueIds = [];

function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function main() {
  console.log(`\nTarget: ${SUPABASE_URL}\n`);

  // ---- 1. Sign up (email confirmation is off → session returned) ----
  report.section('1. Sign up & session');
  const userA = anonClient();
  const emailA = makeTestEmail('flow-a');
  const signUpA = await userA.auth.signUp({ email: emailA, password: TEST_PASSWORD });
  report.expectOk(
    'sign up returns a session',
    !signUpA.error && !!signUpA.data.session,
    signUpA.error ? signUpA.error.message : undefined
  );
  if (signUpA.data.user) createdUserIds.push(signUpA.data.user.id);
  if (!signUpA.data.session) {
    report.warn('flow stopped', 'no session after sign up (is "Confirm email" on?)');
    return;
  }

  // ---- 2. Claim a username ----
  report.section('2. Username');
  const username = 'flow' + Math.random().toString(36).slice(2, 8);
  const avail = await userA.rpc('is_username_available', { p_username: username });
  report.expectOk('is_username_available responds', !avail.error, avail.error?.message);
  const claim = await userA.rpc('claim_username', { p_username: username });
  report.expectOk('claim_username succeeds', !claim.error, claim.error?.message);
  // Claiming the same name again (as a different user) must be rejected.
  const userTmp = anonClient();
  const emailTmp = makeTestEmail('flow-dup');
  const signUpTmp = await userTmp.auth.signUp({ email: emailTmp, password: TEST_PASSWORD });
  if (signUpTmp.data.user) createdUserIds.push(signUpTmp.data.user.id);
  if (signUpTmp.data.session) {
    const dup = await userTmp.rpc('claim_username', { p_username: username });
    report.expectOk(
      'duplicate username is rejected',
      !!dup.error,
      dup.error ? dup.error.message : 'duplicate was accepted!'
    );
  }

  // ---- 3. Matches load ----
  report.section('3. Matches & predictions');
  const matchesRes = await userA
    .from('matches')
    .select('id, season, round, kickoff_time, status')
    .order('kickoff_time');
  report.expectOk('matches load', !matchesRes.error, matchesRes.error?.message);
  const matches = matchesRes.data || [];
  report.info('matches found', String(matches.length));

  const openMatch = matches.find(
    (m) => m.kickoff_time && new Date(m.kickoff_time) > new Date()
  );
  if (openMatch) {
    const upsert = await userA.from('predictions').upsert(
      {
        user_id: signUpA.data.user.id,
        match_id: openMatch.id,
        predicted_home_score: 1,
        predicted_away_score: 1,
      },
      { onConflict: 'user_id,match_id' }
    );
    report.expectOk('save a prediction', !upsert.error, upsert.error?.message);
    const back = await userA
      .from('predictions')
      .select('predicted_home_score, predicted_away_score')
      .eq('match_id', openMatch.id)
      .single();
    report.expectOk(
      'prediction reads back correctly',
      !back.error && back.data?.predicted_home_score === 1,
      back.error?.message
    );
  } else {
    report.skip('save a prediction', 'no upcoming match in an open round');
  }

  // ---- 4. Create a league ----
  report.section('4. Leagues');
  const inviteCode = 'FLW' + Math.random().toString(36).slice(2, 7).toUpperCase();
  const league = await userA
    .from('leagues')
    .insert({
      name: 'Flow Test League',
      created_by: signUpA.data.user.id,
      invite_code: inviteCode,
    })
    .select('id, invite_code')
    .single();
  report.expectOk('create a league', !league.error, league.error?.message);
  if (league.data?.id) createdLeagueIds.push(league.data.id);

  // ---- 5. A second user joins by invite code ----
  if (league.data?.invite_code) {
    const userB = anonClient();
    const emailB = makeTestEmail('flow-b');
    const signUpB = await userB.auth.signUp({ email: emailB, password: TEST_PASSWORD });
    if (signUpB.data.user) createdUserIds.push(signUpB.data.user.id);
    const usernameB = 'flow' + Math.random().toString(36).slice(2, 8);
    await userB.rpc('claim_username', { p_username: usernameB });
    const join = await userB.rpc('join_league', {
      p_invite_code: league.data.invite_code,
    });
    report.expectOk('second user joins by invite code', !join.error, join.error?.message);

    const standings = await userB.rpc('get_league_leaderboard', {
      p_league_id: league.data.id,
    });
    report.expectOk(
      'league leaderboard lists the members',
      !standings.error && (standings.data || []).length >= 2,
      standings.error ? standings.error.message : `${(standings.data || []).length} member(s)`
    );
  }

  // ---- 6. Global leaderboard & rank ----
  report.section('5. Leaderboards & rank');
  const global = await userA.rpc('get_global_leaderboard', { p_limit: 20 });
  report.expectOk(
    'global leaderboard loads',
    !global.error,
    global.error ? global.error.message : `${(global.data || []).length} row(s)`
  );
  const rank = await userA.rpc('get_my_global_rank');
  report.expectOk('get_my_global_rank responds', !rank.error, rank.error?.message);
}

async function cleanup() {
  report.section('Cleanup');
  if (!SERVICE_ROLE_KEY) {
    report.warn(
      'cleanup skipped',
      'set SUPABASE_SERVICE_ROLE_KEY to auto-delete the test users'
    );
    report.info('leftover test users', createdUserIds.join(', ') || '(none)');
    return;
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  for (const id of createdLeagueIds) {
    await admin.from('league_members').delete().eq('league_id', id);
    await admin.from('leagues').delete().eq('id', id);
  }
  for (const uid of createdUserIds) {
    await admin.from('predictions').delete().eq('user_id', uid);
    await admin.from('league_members').delete().eq('user_id', uid);
    await admin.from('leagues').delete().eq('created_by', uid);
    await admin.from('usernames').delete().eq('user_id', uid);
  }
  let deleted = 0;
  for (const uid of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (!error) deleted++;
  }
  report.info('test users removed', `${deleted}/${createdUserIds.length}`);
}

try {
  await main();
} catch (err) {
  console.error('\nFlow test aborted:', err?.message || err);
} finally {
  try {
    await cleanup();
  } catch (err) {
    report.warn('cleanup', err?.message || String(err));
  }
}

process.exit(report.finish());
