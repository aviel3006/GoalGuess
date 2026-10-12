// Pulls post-match stats (possession, xG, corners, ...) and goals/cards from 365Scores into
// public.match_stats. TheSportsDB has no stats for the Israeli league, 365Scores does.
// Runs every 15 minutes from the "sync-match-stats" pg_cron job.
import { createClient } from 'npm:@supabase/supabase-js@2';

// The public endpoints the 365Scores website itself uses; no key needed
const API = 'https://webws.365scores.com';
const QUERY = 'appTypeId=5&langId=2&timezoneName=Asia/Jerusalem&userCountryId=6';
const COMPETITION_ID = 42; // ליגת העל
const MAX_MATCHES_PER_RUN = 15;
const MAX_RESULT_PAGES = 6;
const REQUEST_TIMEOUT_MS = 10_000;
// Stats keep being corrected for a few hours after the final whistle
const REFRESH_UNTIL_HOURS_AFTER_KICKOFF = 6;
const REFRESH_EVERY_MINUTES = 30;

type Competitor = { id: number; name: string; score?: number };

type ApiGame = {
  id: number;
  startTime: string;
  homeCompetitor: Competitor;
  awayCompetitor: Competitor;
};

type ApiStat = {
  id: number;
  name: string;
  competitorId: number;
  categoryName?: string;
  value: string;
  valuePercentage?: number;
  markedTeam?: number;
  isPrimary?: boolean;
  isTop?: boolean;
  order: number;
};

type ApiEvent = {
  competitorId: number;
  gameTimeDisplay: string;
  order: number;
  playerId?: number;
  extraPlayers?: number[];
  eventType: { id: number; subTypeId?: number; subTypeName?: string };
};

type ApiGameDetails = ApiGame & {
  events?: ApiEvent[];
  members?: { id: number; name: string }[];
  venue?: { name: string };
};

type StoredMatch = {
  id: number;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  match_stats: { fetched_at: string } | { fetched_at: string }[] | null;
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function get<T>(path: string, retries = 1): Promise<T> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      // A hanging request would otherwise hold the whole run
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`365Scores ${path} returned ${res.status}`);
    return await res.json();
  } catch (error) {
    // Timeouts, network errors and 502/504s are usually fine on the next try
    if (retries === 0) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return get(path, retries - 1);
  }
}

// 365Scores games that have both teams; anything else can't be matched to ours
const isGame = (g: ApiGame) =>
  typeof g?.id === 'number' &&
  typeof g.homeCompetitor?.name === 'string' &&
  typeof g.awayCompetitor?.name === 'string';

// Both sources spell some names differently ("קריית"/"קרית", "תקווה"/"תקוה"),
// so compare without vav, yod, punctuation and spaces
function normalize(name: string) {
  return name.replace(/[וי"'׳״\s\-.]/g, '');
}

function findGame(match: StoredMatch, games: ApiGame[]) {
  const home = normalize(match.home_team);
  const away = normalize(match.away_team);
  const kickoff = Date.parse(match.kickoff_time);

  return games.find((g) => {
    const homeMatches = normalize(g.homeCompetitor.name) === home;
    const awayMatches = normalize(g.awayCompetitor.name) === away;
    const sameTime = Math.abs(Date.parse(g.startTime) - kickoff) <= 3 * 60 * 60 * 1000;
    return (homeMatches && awayMatches) || (sameTime && (homeMatches || awayMatches));
  });
}

function needsFetch(match: StoredMatch) {
  const stats = Array.isArray(match.match_stats) ? match.match_stats[0] : match.match_stats;
  if (!stats) return true;
  const fetchedAt = Date.parse(stats.fetched_at);
  const refreshUntil = Date.parse(match.kickoff_time) + REFRESH_UNTIL_HOURS_AFTER_KICKOFF * 3600_000;
  return fetchedAt < refreshUntil && Date.now() - fetchedAt > REFRESH_EVERY_MINUTES * 60_000;
}

function toStats(stats: ApiStat[], homeId: number) {
  const byId = new Map<number, { home?: ApiStat; away?: ApiStat }>();
  const valid = stats.filter(
    (s) => typeof s?.id === 'number' && typeof s.name === 'string' && s.value !== undefined,
  );
  for (const s of valid) {
    const pair = byId.get(s.id) ?? {};
    if (s.competitorId === homeId) pair.home = s;
    else pair.away = s;
    byId.set(s.id, pair);
  }

  return [...byId.values()]
    .filter((p): p is { home: ApiStat; away: ApiStat } => !!p.home && !!p.away)
    .sort((a, b) => (a.home.order ?? 0) - (b.home.order ?? 0))
    .map(({ home, away }) => ({
      name: home.name,
      category: home.categoryName ?? null,
      home: String(home.value),
      away: String(away.value),
      homeShare: home.valuePercentage ?? 0,
      awayShare: away.valuePercentage ?? 0,
      // 365Scores marks the team that did better: 1 home, 2 away
      leader: home.markedTeam === 1 ? 'home' : home.markedTeam === 2 ? 'away' : null,
      primary: home.isPrimary ?? false,
      // The headline stats 365Scores shows first
      top: home.isTop ?? false,
    }));
}

const GOAL = 1;
const YELLOW = 2;
const RED = 3;
const OWN_GOAL_SUBTYPE = 2;
const PENALTY_SUBTYPE = 3;
const SECOND_YELLOW_SUBTYPE = 21;

function toEvents(game: ApiGameDetails) {
  const members = Array.isArray(game.members) ? game.members : [];
  const players = new Map(members.filter(Boolean).map((m) => [m.id, m.name]));
  const name = (id?: number) => (id ? players.get(id) ?? null : null);

  return (Array.isArray(game.events) ? game.events : [])
    .filter((e) => [GOAL, YELLOW, RED].includes(e?.eventType?.id))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((e) => {
      const sub = e.eventType.subTypeId;
      const type = e.eventType.id === GOAL ? 'goal' : e.eventType.id === RED ? 'red' : 'yellow';
      let detail: string | null = null;
      if (type === 'goal' && sub === PENALTY_SUBTYPE) detail = 'פנדל';
      if (type === 'goal' && sub === OWN_GOAL_SUBTYPE) detail = 'שער עצמי';
      if (type === 'red' && sub === SECOND_YELLOW_SUBTYPE) detail = 'צהוב שני';

      return {
        minute: String(e.gameTimeDisplay ?? ''),
        // For own goals competitorId is the team the goal counts for
        side: e.competitorId === game.homeCompetitor.id ? 'home' : 'away',
        type,
        detail,
        player: name(e.playerId),
        assist: type === 'goal' ? name(e.extraPlayers?.[0]) : null,
      };
    });
}

// Recent results first, then older pages until every wanted match is found
async function findGames(wanted: StoredMatch[]) {
  const found = new Map<number, ApiGame>();
  let games: ApiGame[] = [];
  let path: string | null = `/web/games/results/?${QUERY}&competitions=${COMPETITION_ID}`;

  for (let page = 0; path && page < MAX_RESULT_PAGES; page++) {
    const body: { games?: ApiGame[]; paging?: { previousPage?: string } } = await get(path);
    games = games.concat((Array.isArray(body?.games) ? body.games : []).filter(isGame));
    for (const m of wanted) {
      const game = found.has(m.id) ? undefined : findGame(m, games);
      if (game) found.set(m.id, game);
    }
    if (found.size === wanted.length) break;
    path = typeof body?.paging?.previousPage === 'string' ? body.paging.previousPage : null;
  }

  return found;
}

Deno.serve(async (req) => {
  // Only the cron job knows the secret stored in Vault
  const { data: authorized } = await supabase.rpc('check_match_sync_secret', {
    p_secret: req.headers.get('x-sync-secret') ?? '',
  });
  if (!authorized) return new Response('Unauthorized', { status: 401 });

  try {
    const { data, error } = await supabase
      .from('matches')
      .select('id, home_team, away_team, kickoff_time, match_stats(fetched_at)')
      .eq('status', 'finished')
      .order('kickoff_time', { ascending: false });
    if (error) throw error;

    const wanted = (data as StoredMatch[]).filter(needsFetch).slice(0, MAX_MATCHES_PER_RUN);
    if (wanted.length === 0) return Response.json({ synced: 0 });

    const games = await findGames(wanted);
    const rows = [];
    const missing: number[] = [];
    const failed: number[] = [];

    // One match at a time to stay gentle with an unofficial API
    for (const match of wanted) {
      const game = games.get(match.id);
      if (!game) {
        missing.push(match.id);
        continue;
      }

      try {
        const [statsBody, detailsBody] = await Promise.all([
          get<{ statistics?: ApiStat[] }>(`/web/game/stats/?${QUERY}&games=${game.id}`),
          get<{ game?: ApiGameDetails }>(`/web/game/?${QUERY}&gameId=${game.id}`),
        ]);
        const details = detailsBody?.game;
        if (typeof details?.homeCompetitor?.id !== 'number') throw new Error('game details missing');

        rows.push({
          match_id: match.id,
          source_game_id: game.id,
          venue: typeof details.venue?.name === 'string' ? details.venue.name : null,
          stats: toStats(
            Array.isArray(statsBody?.statistics) ? statsBody.statistics : [],
            details.homeCompetitor.id,
          ),
          events: toEvents(details),
          fetched_at: new Date().toISOString(),
        });
      } catch (error) {
        // Retried on the next run; the other matches still get saved
        console.warn(`sync-match-stats: skipping match ${match.id}:`, error);
        failed.push(match.id);
      }
    }

    if (rows.length > 0) {
      const { error: upsertError } = await supabase.from('match_stats').upsert(rows);
      if (upsertError) throw upsertError;
    }

    if (missing.length > 0) console.warn('sync-match-stats: no 365Scores game for matches', missing);
    return Response.json({ synced: rows.length, missing, failed });
  } catch (error) {
    console.error('sync-match-stats failed:', error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
});
