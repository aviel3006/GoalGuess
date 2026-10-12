// Pulls Israeli Premier League fixtures and results from TheSportsDB into public.matches.
// Runs every 10 minutes from the "sync-matches" pg_cron job. When a match turns
// "finished", the match_finished_update_points trigger grades its predictions.
import { createClient } from 'npm:@supabase/supabase-js@2';

// "123" is TheSportsDB's free key: no signup, 30 requests a minute
const API = 'https://www.thesportsdb.com/api/v1/json/123';
const LEAGUE_ID = '4644'; // Israeli Premier League

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

async function fetchEvents(path: string): Promise<ApiEvent[]> {
  const res = await fetch(`${API}/${path}`);
  if (!res.ok) throw new Error(`TheSportsDB ${path} returned ${res.status}`);
  const body = await res.json();
  return body.events ?? [];
}

function toStatus(e: ApiEvent, homeScore: number | null, awayScore: number | null): MatchStatus {
  const status = (e.strStatus ?? '').toUpperCase();
  if (e.strPostponed === 'yes' || status === 'PST') return 'postponed';
  if (['CANC', 'ABD', 'AWD', 'WO'].includes(status)) return 'cancelled';
  if (['FT', 'AET', 'PEN'].includes(status)) {
    // Grading needs both scores; until they arrive the match stays closed
    return homeScore === null || awayScore === null ? 'live' : 'finished';
  }
  if (['', 'NS', 'TBD'].includes(status)) return 'scheduled';
  return 'live'; // 1H, HT, 2H, ET, BT, P, ...
}

function toScore(value: string | null) {
  return value === null || value === '' ? null : Number(value);
}

function toMatch(e: ApiEvent, season: string) {
  const homeScore = toScore(e.intHomeScore);
  const awayScore = toScore(e.intAwayScore);
  const status = toStatus(e, homeScore, awayScore);
  // TheSportsDB times are UTC without a zone suffix
  const kickoff = e.strTimestamp ?? `${e.dateEvent}T${e.strTime ?? '00:00:00'}`;

  return {
    external_id: e.idEvent,
    season,
    round: Number(e.intRound),
    home_team: HEBREW_TEAM_NAMES[e.strHomeTeam] ?? e.strHomeTeam,
    away_team: HEBREW_TEAM_NAMES[e.strAwayTeam] ?? e.strAwayTeam,
    home_badge: e.strHomeTeamBadge,
    away_badge: e.strAwayTeamBadge,
    kickoff_time: new Date(`${kickoff}Z`).toISOString(),
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
    const latest = next[0] ?? past[0];
    if (!latest) return Response.json({ synced: 0 });

    const season = latest.strSeason;
    const nextRound = Number(latest.intRound);

    // The last round (for its results), the next one and the one after
    const rounds = new Set([nextRound - 1, nextRound, nextRound + 1]);

    const { data: stored, error: storedError } = await supabase
      .from('matches')
      .select('round, status, kickoff_time')
      .eq('season', season);
    if (storedError) throw storedError;

    // Earlier rounds of the season that were never fetched, so past results stay browsable
    const storedRounds = new Set(stored.map((m) => m.round));
    for (let r = 1; r < nextRound; r++) {
      if (!storedRounds.has(r)) rounds.add(r);
    }

    // Older rounds that still have matches waiting for a result
    for (const m of stored) {
      const started = Date.parse(m.kickoff_time) < Date.now();
      if ((m.status === 'scheduled' || m.status === 'live') && started) rounds.add(m.round);
    }

    const events = (
      await Promise.all(
        [...rounds]
          .filter((r) => r > 0)
          .map((r) => fetchEvents(`eventsround.php?id=${LEAGUE_ID}&r=${r}&s=${season}`)),
      )
    ).flat();

    const matches = events.filter((e) => Number(e.intRound) > 0).map((e) => toMatch(e, season));
    const { error } = await supabase.from('matches').upsert(matches, { onConflict: 'external_id' });
    if (error) throw error;

    return Response.json({ season, rounds: [...rounds].sort((a, b) => a - b), synced: matches.length });
  } catch (error) {
    console.error('sync-matches failed:', error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
});
