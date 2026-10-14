// Security audit for the GoalGuess backend.
//
// This attacks YOUR OWN Supabase project with a simulated hostile client to
// confirm the defenses hold before the store release. It creates two
// temporary, obviously-fake test users, then — signed in as user A — tries to
// reach user B's data, write data it shouldn't, and slip bad content past the
// filters. Every "attack" is expected to be BLOCKED; a PASS means the server
// rejected it. The test users and their rows are deleted at the end.
//
// Run:
//   PowerShell:  $env:SUPABASE_SERVICE_ROLE_KEY = "<key>"; npm run audit:security
//   bash:        SUPABASE_SERVICE_ROLE_KEY="<key>" npm run audit:security
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

requireConfig({ needService: true });

const report = new Report('Security audit');

// Admin client (service role) — used ONLY to set up and tear down test data.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// A fresh anon client that behaves exactly like the real app.
function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const created = { users: [], leagues: [], storagePaths: [] };

async function createTestUser(tag) {
  const email = makeTestEmail(tag);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}) failed: ${error.message}`);
  created.users.push(data.user.id);
  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (signInError) throw new Error(`signIn(${tag}) failed: ${signInError.message}`);
  return { id: data.user.id, email, client };
}

async function cleanup() {
  report.section('Cleanup');
  for (const leagueId of created.leagues) {
    await admin.from('league_members').delete().eq('league_id', leagueId);
    await admin.from('leagues').delete().eq('id', leagueId);
  }
  for (const uid of created.users) {
    // FK order: these point at auth.users without ON DELETE CASCADE.
    await admin.from('predictions').delete().eq('user_id', uid);
    await admin.from('league_members').delete().eq('user_id', uid);
    await admin.from('leagues').delete().eq('created_by', uid);
    await admin.from('user_blocks').delete().eq('blocker_id', uid);
    await admin.from('user_blocks').delete().eq('blocked_id', uid);
    await admin.from('content_reports').delete().eq('reporter_id', uid);
    await admin.from('usernames').delete().eq('user_id', uid);
  }
  for (const { bucket, path } of created.storagePaths) {
    await admin.storage.from(bucket).remove([path]);
  }
  let deleted = 0;
  for (const uid of created.users) {
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) report.warn(`delete user ${uid.slice(0, 8)}`, error.message);
    else deleted++;
  }
  report.info('test users removed', `${deleted}/${created.users.length}`);
}

async function main() {
  console.log(`\nTarget: ${SUPABASE_URL}`);
  console.log('Creating two temporary test users (A = attacker, B = victim)...');

  const A = await createTestUser('attacker');
  const B = await createTestUser('victim');

  // ---- Pick a word the filter should reject (read it from the DB) ----
  let blockedWord = null;
  {
    const { data } = await admin
      .from('blocked_words')
      .select('word, anywhere')
      .limit(50);
    // Prefer a whole-word entry to avoid false positives from prefix handling.
    const pick = (data || []).find((w) => !w.anywhere) || (data || [])[0];
    blockedWord = pick?.word ?? null;
  }

  // ===================================================================
  report.section('1. Predictions — cross-user read & write (RLS)');
  // Seed a prediction for victim B on a future (still-open) match.
  let seededMatchId = null;
  {
    const { data: futureMatches } = await admin
      .from('matches')
      .select('id, kickoff_time')
      .gt('kickoff_time', new Date().toISOString())
      .order('kickoff_time')
      .limit(1);
    seededMatchId = futureMatches?.[0]?.id ?? null;
    if (seededMatchId) {
      const { error } = await admin.from('predictions').insert({
        user_id: B.id,
        match_id: seededMatchId,
        predicted_home_score: 2,
        predicted_away_score: 1,
      });
      if (error) {
        report.warn('seed victim prediction', error.message);
        seededMatchId = null;
      }
    } else {
      report.skip('seed victim prediction', 'no future/open match to seed');
    }
  }

  // Attacker reads the predictions table — must see only its own rows.
  {
    const { data, error } = await A.client.from('predictions').select('*');
    const leaked = (data || []).filter((row) => row.user_id === B.id);
    report.expectBlocked(
      "A cannot read B's predictions",
      !error && leaked.length === 0,
      error ? `query errored: ${error.message}` : `saw ${leaked.length} of B's rows`
    );
  }

  // Attacker tries to overwrite B's prediction directly.
  if (seededMatchId) {
    const { data, error } = await A.client
      .from('predictions')
      .update({ predicted_home_score: 9, predicted_away_score: 0 })
      .eq('user_id', B.id)
      .eq('match_id', seededMatchId)
      .select();
    report.expectBlocked(
      "A cannot modify B's prediction",
      (data || []).length === 0,
      error ? error.message : `${(data || []).length} row(s) changed`
    );
    // Confirm with admin that B's value is untouched.
    const { data: check } = await admin
      .from('predictions')
      .select('predicted_home_score')
      .eq('user_id', B.id)
      .eq('match_id', seededMatchId)
      .single();
    report.expectBlocked(
      "B's prediction value unchanged",
      check?.predicted_home_score === 2,
      `home score is now ${check?.predicted_home_score}`
    );
  } else {
    report.skip("A cannot modify B's prediction", 'no seeded prediction');
  }

  // Attacker tries to insert a prediction owned by B.
  if (seededMatchId) {
    const { data, error } = await A.client
      .from('predictions')
      .insert({
        user_id: B.id,
        match_id: seededMatchId,
        predicted_home_score: 0,
        predicted_away_score: 7,
      })
      .select();
    report.expectBlocked(
      'A cannot insert a prediction as B',
      !!error || (data || []).length === 0,
      error ? error.message : 'insert went through'
    );
  }

  // A signed-out client must not read predictions at all.
  {
    const anon = anonClient();
    const { data, error } = await anon.from('predictions').select('*').limit(1);
    report.expectBlocked(
      'Signed-out client cannot read predictions',
      !!error || (data || []).length === 0,
      error ? error.message : `got ${(data || []).length} row(s)`
    );
  }

  // ===================================================================
  report.section('2. Private tables not meant for client reads');
  {
    const { data, error } = await A.client.from('usernames').select('*').limit(5);
    report.expectBlocked(
      'A cannot read the usernames table directly',
      !!error || (data || []).length === 0,
      error ? error.message : `got ${(data || []).length} row(s)`
    );
  }
  {
    const { data, error } = await A.client.from('content_reports').select('*').limit(5);
    report.expectBlocked(
      'A cannot read content_reports',
      !!error || (data || []).length === 0,
      error ? error.message : `got ${(data || []).length} row(s)`
    );
  }
  {
    const { data, error } = await A.client.from('blocked_words').select('*').limit(5);
    report.expectBlocked(
      'A cannot read the blocked-words list',
      !!error || (data || []).length === 0,
      error ? error.message : `got ${(data || []).length} row(s)`
    );
  }

  // ===================================================================
  report.section('3. Leagues & membership (RLS vs. the join RPC)');
  // Victim B creates a private league the normal way.
  let victimLeague = null;
  {
    const code = 'TST' + Math.random().toString(36).slice(2, 7).toUpperCase();
    const { data, error } = await B.client
      .from('leagues')
      .insert({ name: 'Victim League', created_by: B.id, invite_code: code })
      .select('id, invite_code')
      .single();
    if (error) {
      report.warn('seed victim league', error.message);
    } else {
      victimLeague = data;
      created.leagues.push(data.id);
    }
  }

  if (victimLeague) {
    // Attacker tries to rename B's league (there is no UPDATE policy).
    const { data, error } = await A.client
      .from('leagues')
      .update({ name: 'Hacked League' })
      .eq('id', victimLeague.id)
      .select();
    report.expectBlocked(
      "A cannot rename B's league",
      (data || []).length === 0,
      error ? error.message : `${(data || []).length} row(s) changed`
    );

    // Attacker tries to delete B's league.
    const del = await A.client
      .from('leagues')
      .delete()
      .eq('id', victimLeague.id)
      .select();
    report.expectBlocked(
      "A cannot delete B's league",
      (del.data || []).length === 0,
      del.error ? del.error.message : `${(del.data || []).length} row(s) deleted`
    );

    // Attacker tries to add itself to B's league WITHOUT the invite code.
    const join = await A.client
      .from('league_members')
      .insert({ league_id: victimLeague.id, user_id: A.id })
      .select();
    report.expectBlocked(
      'A cannot insert itself into a league directly',
      !!join.error || (join.data || []).length === 0,
      join.error ? join.error.message : 'direct membership insert worked'
    );

    // The legitimate path (join RPC with the real code) should still work.
    const rpc = await A.client.rpc('join_league', {
      p_invite_code: victimLeague.invite_code,
    });
    report.expectOk(
      'join_league with the real code works (control)',
      !rpc.error,
      rpc.error ? rpc.error.message : 'joined'
    );
  } else {
    report.skip('league RLS checks', 'could not seed a victim league');
  }

  // Bad invite code is rejected.
  {
    const { error } = await A.client.rpc('join_league', {
      p_invite_code: 'NOPE-NOPE',
    });
    report.expectBlocked(
      'join_league rejects a bad invite code',
      !!error,
      error ? error.message : 'accepted an invalid code'
    );
  }

  // ===================================================================
  report.section('4. Blocks table ownership');
  {
    // Legit: A blocks B.
    const ok = await A.client.from('user_blocks').insert({ blocked_id: B.id }).select();
    report.expectOk(
      'A can block B (control)',
      !ok.error,
      ok.error ? ok.error.message : undefined
    );
    // Hostile: A forges a block owned by B.
    const forged = await A.client
      .from('user_blocks')
      .insert({ blocker_id: B.id, blocked_id: A.id })
      .select();
    report.expectBlocked(
      "A cannot forge a block owned by B",
      !!forged.error || (forged.data || []).length === 0,
      forged.error ? forged.error.message : 'forged row inserted'
    );
    // A cannot see B's blocks.
    const read = await A.client.from('user_blocks').select('*');
    const others = (read.data || []).filter((r) => r.blocker_id && r.blocker_id !== A.id);
    report.expectBlocked(
      "A cannot read other users' blocks",
      !read.error && others.length === 0,
      read.error ? read.error.message : `saw ${others.length} foreign row(s)`
    );
  }

  // ===================================================================
  report.section('5. Content filter (usernames & league names)');
  if (blockedWord) {
    const u = await A.client.rpc('claim_username', { p_username: blockedWord });
    report.expectBlocked(
      'claim_username rejects a blocked word',
      !!u.error,
      u.error ? u.error.message : 'accepted an offensive username'
    );
    const code = 'TST' + Math.random().toString(36).slice(2, 7).toUpperCase();
    const l = await A.client
      .from('leagues')
      .insert({ name: blockedWord, created_by: A.id, invite_code: code })
      .select('id');
    if (!l.error && l.data?.[0]?.id) created.leagues.push(l.data[0].id);
    report.expectBlocked(
      'league insert rejects a blocked name',
      !!l.error,
      l.error ? l.error.message : 'accepted an offensive league name'
    );
  } else {
    report.skip('content filter checks', 'no blocked word available to test with');
  }

  // ===================================================================
  report.section('6. Storage — folder ownership');
  const fileBody = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], {
    type: 'image/png',
  });
  for (const bucket of ['avatars', 'league-images']) {
    // Hostile: write into B's folder.
    const foreign = await A.client.storage
      .from(bucket)
      .upload(`${B.id}/evil.png`, fileBody, { contentType: 'image/png', upsert: true });
    report.expectBlocked(
      `A cannot upload into B's ${bucket} folder`,
      !!foreign.error,
      foreign.error ? foreign.error.message : 'upload succeeded'
    );
    if (!foreign.error) created.storagePaths.push({ bucket, path: `${B.id}/evil.png` });

    // Control: write into A's own folder.
    const own = await A.client.storage
      .from(bucket)
      .upload(`${A.id}/ok.png`, fileBody, { contentType: 'image/png', upsert: true });
    report.expectOk(
      `A can upload into its own ${bucket} folder (control)`,
      !own.error,
      own.error ? own.error.message : undefined
    );
    if (!own.error) created.storagePaths.push({ bucket, path: `${A.id}/ok.png` });
  }

  // ===================================================================
  report.section('7. Leaderboard masks blocked users');
  {
    // A already blocked B in section 4. Both need a username to appear.
    await A.client.rpc('claim_username', {
      p_username: 'atk' + Math.random().toString(36).slice(2, 7),
    });
    await B.client.rpc('claim_username', {
      p_username: 'vic' + Math.random().toString(36).slice(2, 7),
    });
    const { data, error } = await A.client.rpc('get_global_leaderboard', { p_limit: 100 });
    if (error) {
      report.warn('leaderboard masking', error.message);
    } else {
      const bRow = (data || []).find((r) => r.user_id === B.id);
      if (!bRow) {
        report.info('leaderboard masking', "B not in top 100 — can't verify masking");
      } else {
        report.expectOk(
          'blocked user is flagged in the leaderboard',
          bRow.is_blocked === true,
          `is_blocked=${bRow.is_blocked}`
        );
        report.expectOk(
          "blocked user's name is hidden",
          bRow.username == null && bRow.display_name == null,
          `name=${bRow.username ?? bRow.display_name}`
        );
      }
    }
  }
}

let exitCode = 1;
try {
  await main();
  exitCode = 0;
} catch (err) {
  console.error('\nAudit aborted:', err?.message || err);
} finally {
  try {
    await cleanup();
  } catch (err) {
    report.warn('cleanup', err?.message || String(err));
  }
}

process.exit(report.finish() || exitCode);
