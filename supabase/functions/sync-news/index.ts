// Pulls Israeli Premier League news from 365Scores into public.news_articles, tagging each
// article with the teams it's about, and keeps public.news_teams in step with the league table.
// Runs every 15 minutes from the "sync-news" pg_cron job.
import { createClient } from 'npm:@supabase/supabase-js@2';

// The public endpoints the 365Scores website itself uses; no key needed
const API = 'https://webws.365scores.com';
const QUERY = 'appTypeId=5&langId=2&timezoneName=Asia/Jerusalem&userCountryId=6';
const COMPETITION_ID = 42; // ליגת העל
const KEEP_DAYS = 30;

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
  const res = await fetch(`${API}${path}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  // 365Scores occasionally answers 502/504 and is fine on the next try
  if (res.status >= 500 && retries > 0) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return get(path, retries - 1);
  }
  if (!res.ok) throw new Error(`365Scores ${path} returned ${res.status}`);
  return res.json();
}

// Without isPreview=false the feed returns only the 3 newest articles
function fetchNews(filter: string) {
  return get<ApiNews>(`/web/news/?${QUERY}&isPreview=false&${filter}`);
}

async function syncTeams() {
  const data = await get<ApiStandings>(`/web/standings/?${QUERY}&competitions=${COMPETITION_ID}`);
  const rows = (data.standings ?? []).flatMap((s) => s.rows ?? []).filter((r) => r.competitor);
  if (rows.length === 0) throw new Error('no teams in the league table');

  const teams = rows.map((r) => ({
    id: r.competitor.id,
    name: r.competitor.name,
    image_version: r.competitor.imageVersion ?? 1,
    sort_order: r.position,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('news_teams').upsert(teams);
  if (error) throw error;

  // Relegated teams leave the picker
  const { error: deleteError } = await supabase
    .from('news_teams')
    .delete()
    .not('id', 'in', `(${teams.map((t) => t.id).join(',')})`);
  if (deleteError) throw deleteError;

  return teams.map((t) => t.id);
}

Deno.serve(async (req) => {
  // Only the cron job knows the secret stored in Vault
  const { data: authorized } = await supabase.rpc('check_match_sync_secret', {
    p_secret: req.headers.get('x-sync-secret') ?? '',
  });
  if (!authorized) return new Response('Unauthorized', { status: 401 });

  try {
    const teamIds = await syncTeams();
    const articles = new Map<number, Article>();

    const collect = (data: ApiNews, teamId: number | null) => {
      const sources = new Map((data.newsSources ?? []).map((s) => [s.id, s.name]));
      for (const item of data.news ?? []) {
        const article = articles.get(item.id) ?? {
          id: item.id,
          title: item.title.trim(),
          image: item.image || null,
          url: item.url,
          source_name: sources.get(item.sourceId) ?? null,
          published_at: item.publishDate,
          team_ids: new Set<number>(),
        };
        if (teamId !== null) article.team_ids.add(teamId);
        articles.set(item.id, article);
      }
    };

    // The league feed has general news; each team's feed tells us who an article is about
    const feeds = await Promise.allSettled([
      fetchNews(`competitions=${COMPETITION_ID}`).then((data) => collect(data, null)),
      ...teamIds.map((id) => fetchNews(`competitors=${id}`).then((data) => collect(data, id))),
    ]);
    const failed = feeds.filter((f) => f.status === 'rejected').map((f) => String(f.reason));
    if (failed.length) console.error('Failed feeds', failed);

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

    const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { error: pruneError } = await supabase
      .from('news_articles')
      .delete()
      .lt('published_at', cutoff);
    if (pruneError) throw pruneError;

    return Response.json({ articles: ids.length, teams: teamIds.length, failed });
  } catch (error) {
    console.error(error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
});
