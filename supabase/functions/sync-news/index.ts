// Pulls Israeli Premier League news from 365Scores into public.news_articles, tagging each
// article with the teams it's about, and keeps public.news_teams in step with the league table.
// Runs every 15 minutes from the "sync-news" pg_cron job.
import { createClient } from 'npm:@supabase/supabase-js@2';

// The public endpoints the 365Scores website itself uses; no key needed
const API = 'https://webws.365scores.com';
const QUERY = 'appTypeId=5&langId=2&timezoneName=Asia/Jerusalem&userCountryId=6';
const COMPETITION_ID = 42; // ליגת העל
const KEEP_DAYS = 30;
const KEEP_AT_LEAST = 60;
const REQUEST_TIMEOUT_MS = 10_000;
// A league table with fewer teams than this is a broken answer, not the real table
const MIN_TEAMS = 10;
// Teams missing from the table this long were relegated
const DROP_TEAM_AFTER_DAYS = 30;

type ApiNews = {
  news?: {
    id: number;
    publishDate: string;
    sourceId: number;
    title: string;
    image?: string;
    url: string;
  }[];
  newsSources?: { id: number; name: string }[];
};

type ApiStandings = {
  standings?: {
    rows: { position: number; competitor: { id: number; name: string; imageVersion?: number } }[];
  }[];
};

type Article = {
  id: number;
  title: string;
  image: string | null;
  url: string;
  source_name: string | null;
  published_at: string;
  team_ids: Set<number>;
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

const isHttpUrl = (value: unknown): value is string =>
  typeof value === 'string' && /^https?:\/\//.test(value);

// Without isPreview=false the feed returns only the 3 newest articles
function fetchNews(filter: string) {
  return get<ApiNews>(`/web/news/?${QUERY}&isPreview=false&${filter}`);
}

// Refreshes the team list from the league table. Never removes a team because of one bad
// answer: teams only leave after being missing from the table for weeks.
async function syncTeams() {
  const data = await get<ApiStandings>(`/web/standings/?${QUERY}&competitions=${COMPETITION_ID}`);
  const rows = (data?.standings ?? [])
    .flatMap((s) => (Array.isArray(s?.rows) ? s.rows : []))
    .filter(
      (r) =>
        typeof r?.competitor?.id === 'number' &&
        typeof r.competitor.name === 'string' &&
        r.competitor.name.trim() !== '',
    );

  const unique = new Map(rows.map((r) => [r.competitor.id, r]));
  if (unique.size < MIN_TEAMS) {
    throw new Error(`league table has only ${unique.size} teams`);
  }

  const teams = [...unique.values()].map((r) => ({
    id: r.competitor.id,
    name: r.competitor.name.trim(),
    image_version: r.competitor.imageVersion ?? 1,
    sort_order: typeof r.position === 'number' ? r.position : 0,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('news_teams').upsert(teams);
  if (error) throw error;

  const staleBefore = new Date(Date.now() - DROP_TEAM_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const { error: deleteError } = await supabase
    .from('news_teams')
    .delete()
    .lt('updated_at', staleBefore.toISOString());
  if (deleteError) throw deleteError;
}

// The teams to pull news for: the saved list, refreshed first when 365Scores cooperates
async function loadTeams() {
  try {
    await syncTeams();
  } catch (error) {
    console.warn('sync-news: keeping the saved teams, league table failed:', error);
  }

  const { data, error } = await supabase.from('news_teams').select('id');
  if (error) throw error;
  return (data ?? []).map((t: { id: number }) => t.id);
}

Deno.serve(async (req) => {
  // Only the cron job knows the secret stored in Vault
  const { data: authorized } = await supabase.rpc('check_match_sync_secret', {
    p_secret: req.headers.get('x-sync-secret') ?? '',
  });
  if (!authorized) return new Response('Unauthorized', { status: 401 });

  try {
    const teamIds = await loadTeams();
    const articles = new Map<number, Article>();

    const collect = (data: ApiNews, teamId: number | null) => {
      const sources = new Map(
        (Array.isArray(data?.newsSources) ? data.newsSources : []).map((s) => [s?.id, s?.name]),
      );
      for (const item of Array.isArray(data?.news) ? data.news : []) {
        // Skip anything malformed instead of failing the whole feed over one item
        const published = Date.parse(item?.publishDate);
        if (
          typeof item?.id !== 'number' ||
          typeof item.title !== 'string' ||
          item.title.trim() === '' ||
          !isHttpUrl(item.url) ||
          Number.isNaN(published) ||
          published > Date.now() + 24 * 60 * 60 * 1000
        ) {
          continue;
        }

        const source = sources.get(item.sourceId);
        const article = articles.get(item.id) ?? {
          id: item.id,
          title: item.title.trim(),
          image: isHttpUrl(item.image) ? item.image : null,
          url: item.url,
          source_name: typeof source === 'string' ? source : null,
          published_at: new Date(published).toISOString(),
          team_ids: new Set<number>(),
        };
        if (teamId !== null) article.team_ids.add(teamId);
        articles.set(item.id, article);
      }
    };

    // The league feed has general news; each team's feed tells us who an article is about
    const [leagueFeed, ...teamFeeds] = await Promise.allSettled([
      fetchNews(`competitions=${COMPETITION_ID}`),
      ...teamIds.map((id) => fetchNews(`competitors=${id}`)),
    ]);
    const failed = [leagueFeed, ...teamFeeds]
      .filter((f) => f.status === 'rejected')
      .map((f) => String((f as PromiseRejectedResult).reason));
    if (failed.length) console.error('Failed feeds', failed);

    const idsOf = (data: ApiNews) =>
      (Array.isArray(data?.news) ? data.news : []).map((n) => n?.id).sort().join(',');
    const leagueIds = leagueFeed.status === 'fulfilled' ? idsOf(leagueFeed.value) : '';
    if (leagueFeed.status === 'fulfilled') collect(leagueFeed.value, null);

    teamFeeds.forEach((feed, i) => {
      if (feed.status !== 'fulfilled') return;
      // If 365Scores ever ignores the team filter, every team would get every article
      if (leagueIds !== '' && idsOf(feed.value) === leagueIds) {
        console.warn(`sync-news: team ${teamIds[i]} feed matches the league feed, not tagging it`);
        return;
      }
      collect(feed.value, teamIds[i]);
    });

    const ids = [...articles.keys()];
    if (ids.length > 0) {
      // An article can drop out of one team's feed while still in another's, so keep earlier tags
      const { data: existing, error: existingError } = await supabase
        .from('news_articles')
        .select('id, team_ids')
        .in('id', ids);
      if (existingError) throw existingError;
      for (const row of existing ?? []) {
        for (const id of row.team_ids) articles.get(row.id)?.team_ids.add(id);
      }

      const { error } = await supabase
        .from('news_articles')
        .upsert([...articles.values()].map((a) => ({ ...a, team_ids: [...a.team_ids] })));
      if (error) throw error;
    }

    // Old articles go, but the newest few always stay so a long outage never empties the screen
    const { data: newest, error: newestError } = await supabase
      .from('news_articles')
      .select('published_at')
      .order('published_at', { ascending: false })
      .range(KEEP_AT_LEAST - 1, KEEP_AT_LEAST - 1);
    if (newestError) throw newestError;

    const floor = newest?.[0]?.published_at;
    if (floor) {
      const cutoff = Math.min(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000, Date.parse(floor));
      const { error: pruneError } = await supabase
        .from('news_articles')
        .delete()
        .lt('published_at', new Date(cutoff).toISOString());
      if (pruneError) throw pruneError;
    }

    return Response.json({ articles: ids.length, teams: teamIds.length, failed });
  } catch (error) {
    console.error(error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
});
