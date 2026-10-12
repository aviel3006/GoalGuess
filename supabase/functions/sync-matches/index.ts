// Pulls Israeli Premier League fixtures and results from TheSportsDB into public.matches.
// Runs every 10 minutes from the "sync-matches" pg_cron job. When a match turns
// "finished", the match_finished_update_points trigger grades its predictions, so a bad
// answer from TheSportsDB must never reach the table as a final result.
import { createClient } from 'npm:@supabase/supabase-js@2';

// "123" is TheSportsDB's free key: no signup, 30 requests a minute
const API = 'https://www.thesportsdb.com/api/v1/json/123';
const LEAGUE_ID = '4644'; // Israeli Premier League
const REQUEST_TIMEOUT_MS = 10_000;
// Old rounds fetched per run when filling gaps, to stay under the rate limit
const MAX_BACKFILL_ROUNDS = 5;
// No match can be over sooner than this after kickoff (90 minutes + half time)
const MIN_MATCH_LENGTH_MS = 100 * 60 * 1000;
const MAX_GOALS = 30;

type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';

type ApiEvent = {
  idEvent: string;
  strSeason: string;
  intRound: string | null;
  strHomeTeam: string;
  strAwayTeam: string;
  strHomeTeamBadge: string | null;
  strAwayTeamBadge: string | null;
  strTimestamp: string | null;
  dateEvent: string | null;
  strTime: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strStatus: string | null;
  strPostponed: string | null;
};

type MatchRow = {
  external_id: string;
  season: string;
  round: number;
  home_team: string;
  away_team: string;
  home_badge: string | null;
  away_badge: string | null;
  kickoff_time: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
};

const HEBREW_TEAM_NAMES: Record<string, string> = {
  'Beitar Jerusalem': 'בית"ר ירושלים',
  'Bnei Sakhnin': 'בני סכנין',
  "Hapoel Be'er Sheva": 'הפועל באר שבע',
  'Hapoel Haifa': 'הפועל חיפה',
  'Hapoel Ironi Kiryat Shmona': 'עירוני קריית שמונה',
  'Hapoel Jerusalem': 'הפועל ירושלים',
  'Hapoel Petah Tikva': 'הפועל פתח תקווה',
  'Hapoel Ramat Gan': 'הפועל רמת גן',
  'Hapoel Tel-Aviv': 'הפועל תל אביב',
  'Ironi Tiberias': 'עירוני טבריה',
  'Maccabi Haifa': 'מכבי חיפה',
  'Maccabi Netanya': 'מכבי נתניה',
  'Maccabi Petah Tikva': 'מכבי פתח תקווה',
  'Maccabi Tel Aviv': 'מכבי תל אביב',
  // Not in the 2026-27 season, kept for promoted teams
  'Maccabi Bnei Reineh': 'מכבי בני ריינה',
  'FC Ashdod': 'מ.ס. אשדוד',
  'Bnei Yehuda': 'בני יהודה',
  'Hapoel Hadera': 'הפועל חדרה',
  'Hapoel Kfar Saba': 'הפועל כפר סבא',
  "Hapoel Ra'anana": 'הפועל רעננה',
  'Sektzia Ness Ziona': 'סקציה נס ציונה',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function fetchEvents(path: string, retries = 1): Promise<ApiEvent[]> {
  try {
    const res = await fetch(`${API}/${path}`, {
      // A hanging request would otherwise hold the whole run
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`TheSportsDB ${path} returned ${res.status}`);
    const body = await res.json();
    return Array.isArray(body?.events) ? body.events : [];
  } catch (error) {
    // Timeouts, network errors and 502/504s are usually fine on the next try
    if (retries === 0) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return fetchEvents(path, retries - 1);
  }
}

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

const isHttpUrl = (value: unknown): value is string =>
  typeof value === 'string' && /^https?:\/\//.test(value);

function toRound(value: unknown) {
  const round = Number(value);
  return Number.isInteger(round) && round > 0 && round < 100 ? round : null;
}

// Anything that isn't a plausible goal count is treated as "no score yet"
function toScore(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const score = Number(value);
  return Number.isInteger(score) && score >= 0 && score <= MAX_GOALS ? score : null;
}

function toStatus(
  e: ApiEvent,
  kickoffMs: number,
  homeScore: number | null,
  awayScore: number | null,
): MatchStatus {
  const status = (e.strStatus ?? '').toUpperCase();
  if (e.strPostponed === 'yes' || status === 'PST') return 'postponed';
  if (['CANC', 'ABD', 'AWD', 'WO'].includes(status)) return 'cancelled';
  if (['FT', 'AET', 'PEN'].includes(status)) {
    // Grading needs both scores, and a "full time" too soon after kickoff is a data
    // error. Until both look right the match stays closed but ungraded.
    const tooEarly = Date.now() < kickoffMs + MIN_MATCH_LENGTH_MS;
    return homeScore === null || awayScore === null || tooEarly ? 'live' : 'finished';
  }
  if (['', 'NS', 'TBD'].includes(status)) return 'scheduled';
  return 'live'; // 1H, HT, 2H, ET, BT, P, ...
}

// Returns null for an event too broken to store
function toMatch(e: ApiEvent, season: string): MatchRow | null {
  const round = toRound(e?.intRound);
  if (!isText(e?.idEvent) || round === null) return null;
  if (!isText(e.strHomeTeam) || !isText(e.strAwayTeam)) return null;

  // TheSportsDB times are UTC without a zone suffix
  const kickoff = e.strTimestamp ?? `${e.dateEvent}T${e.strTime ?? '00:00:00'}`;
  const kickoffMs = Date.parse(`${kickoff.replace(/(Z|[+-]\d\d:?\d\d)$/, '')}Z`);
  if (Number.isNaN(kickoffMs)) return null;

  const homeScore = toScore(e.intHomeScore);
  const awayScore = toScore(e.intAwayScore);
  const status = toStatus(e, kickoffMs, homeScore, awayScore);

  return {
    external_id: e.idEvent,
    season,
    round,
    home_team: HEBREW_TEAM_NAMES[e.strHomeTeam] ?? e.strHomeTeam,
    away_team: HEBREW_TEAM_NAMES[e.strAwayTeam] ?? e.strAwayTeam,
    home_badge: isHttpUrl(e.strHomeTeamBadge) ? e.strHomeTeamBadge : null,
    away_badge: isHttpUrl(e.strAwayTeamBadge) ? e.strAwayTeamBadge : null,
    kickoff_time: new Date(kickoffMs).toISOString(),
    status,
    home_score: status === 'scheduled' ? null : homeScore,
    away_score: status === 'scheduled' ? null : awayScore,
  };
}

Deno.serve(async (req) => {
  // Only the cron job knows the secret stored in Vault
  const { data: authorized } = await supabase.rpc('check_match_sync_secret', {
    p_secret: req.headers.get('x-sync-secret') ?? '',
  });
  if (!authorized) return new Response('Unauthorized', { status: 401 });

  try {
    const [next, past] = await Promise.all([
      fetchEvents(`eventsnextleague.php?id=${LEAGUE_ID}`),
      fetchEvents(`eventspastleague.php?id=${LEAGUE_ID}`),
    ]);
    const latest = [...next, ...past].find(
      (e) => toRound(e?.intRound) !== null && /^\d{4}-\d{4}$/.test(e?.strSeason ?? ''),
    );
    if (!latest) return Response.json({ synced: 0 });

    const season = latest.strSeason;
    const nextRound = toRound(latest.intRound)!;

    // The last round (for its results), the next one and the one after
    const rounds = new Set([nextRound - 1, nextRound, nextRound + 1]);

    const { data: stored, error: storedError } = await supabase
      .from('matches')
      .select('external_id, round, status, kickoff_time, home_score, away_score')
      .eq('season', season);
    if (storedError) throw storedError;

    // Older rounds that still have matches waiting for a result
    for (const m of stored) {
      const started = Date.parse(m.kickoff_time) < Date.now();
      if ((m.status === 'scheduled' || m.status === 'live') && started) rounds.add(m.round);
    }

    // Earlier rounds of the season that were never fetched, so past results stay browsable.
    // A few per run, so a fresh season doesn't burst past the rate limit.
    const storedRounds = new Set(stored.map((m) => m.round));
    let backfill = 0;
    for (let r = 1; r < nextRound && backfill < MAX_BACKFILL_ROUNDS; r++) {
      if (!storedRounds.has(r) && !rounds.has(r)) {
        rounds.add(r);
        backfill++;
      }
    }

    // One round failing to load shouldn't hold back the others
    const fetched = await Promise.allSettled(
      [...rounds]
        .filter((r) => r > 0)
        .map((r) => fetchEvents(`eventsround.php?id=${LEAGUE_ID}&r=${r}&s=${season}`)),
    );
    const failedRounds = fetched.filter((f) => f.status === 'rejected').length;
    if (failedRounds > 0) console.warn(`sync-matches: ${failedRounds} round(s) failed to load`);
    const events = fetched.flatMap((f) => (f.status === 'fulfilled' ? f.value : []));

    const storedById = new Map(stored.map((m) => [m.external_id, m]));
    const matches = new Map<string, MatchRow>();
    let skipped = 0;
    for (const event of events) {
      const match = toMatch(event, season);
      if (!match || event.strSeason !== season) {
        skipped++;
        continue;
      }

      // A graded match never goes back to ungraded: that would leave points awarded for a
      // match the app no longer shows as finished. A changed final score is a correction
      // and is applied, which regrades the predictions.
      const saved = storedById.get(match.external_id);
      if (saved?.status === 'finished' && match.status !== 'finished') continue;
      if (
        saved?.status === 'finished' &&
        (saved.home_score !== match.home_score || saved.away_score !== match.away_score)
      ) {
        console.warn(
          `sync-matches: score correction for ${match.external_id}: ` +
            `${saved.home_score}-${saved.away_score} -> ${match.home_score}-${match.away_score}`,
        );
      }

      matches.set(match.external_id, match);
    }
    if (skipped > 0) console.warn(`sync-matches: skipped ${skipped} invalid event(s)`);

    if (matches.size > 0) {
      const { error } = await supabase
        .from('matches')
        .upsert([...matches.values()], { onConflict: 'external_id' });
      if (error) throw error;
    }

    return Response.json({
      season,
      rounds: [...rounds].sort((a, b) => a - b),
      synced: matches.size,
      skipped,
      failedRounds,
    });
  } catch (error) {
    console.error('sync-matches failed:', error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
});
