// Pulls the standings of every league in public.world_leagues from 365Scores and stores
// them in world_leagues.standings. The app gets the changes over Realtime.
// Runs every 5 minutes from the "sync-world-standings" pg_cron job.
import { createClient } from 'npm:@supabase/supabase-js@2';

// The public endpoints the 365Scores website itself uses; no key needed
const API = 'https://webws.365scores.com';
const QUERY = 'appTypeId=5&langId=2&timezoneName=Asia/Jerusalem&userCountryId=6';
const REQUEST_TIMEOUT_MS = 10_000;

type ApiRow = {
  competitor: { id: number; name: string; shortName?: string; imageVersion?: number };
  position: number;
  groupNum?: number;
  gamePlayed: number;
  gamesWon: number;
  gamesEven: number;
  gamesLost: number;
  for: number;
  against: number;
  points: number;
  recentForm?: number[];
  destinationNum?: number;
};

type ApiStandings = {
  displayName?: string;
  isCurrentStage?: boolean;
  groups?: { num: number; name: string }[];
  rows: ApiRow[];
  destinations?: { num: number; name: string; color: string }[];
};

type SavedStandings = { groups?: { rows?: unknown[] }[] };

type ApiResponse = {
  standings?: ApiStandings[];
  competitions?: { id: number; imageVersion?: number }[];
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

const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

// 365Scores encodes recent results as 1 = win, 2 = draw, 0 = loss, newest first
const FORM: Record<number, string> = { 1: 'W', 2: 'D', 0: 'L' };

function toStandings(data: ApiResponse) {
  // Anything off-shape is dropped so one odd answer can't fail the league or store junk
  const all = (Array.isArray(data?.standings) ? data.standings : []).filter(Boolean);
  const tables = all.filter((s) => s.isCurrentStage !== false);

  const groups = (tables.length ? tables : all).flatMap((table) => {
    // Some leagues occasionally send placeholder rows without a team
    const rows = (Array.isArray(table.rows) ? table.rows : [])
      .filter((r) => typeof r?.competitor?.id === 'number' && typeof r.competitor.name === 'string')
      .map((r) => ({
        position: num(r.position),
        group: r.groupNum ?? null,
        team_id: r.competitor.id,
        name: r.competitor.name,
        short_name: typeof r.competitor.shortName === 'string' ? r.competitor.shortName : null,
        image_version: num(r.competitor.imageVersion) || 1,
        played: num(r.gamePlayed),
        won: num(r.gamesWon),
        drawn: num(r.gamesEven),
        lost: num(r.gamesLost),
        goals_for: num(r.for),
        goals_against: num(r.against),
        points: num(r.points),
        form: (Array.isArray(r.recentForm) ? r.recentForm : []).map((f) => FORM[f]).filter(Boolean),
        destination: typeof r.destinationNum === 'number' ? r.destinationNum : null,
      }));

    // Leagues split into conferences/groups (MLS, ...) come as one table with groupNum per row
    const tableGroups = (Array.isArray(table.groups) ? table.groups : []).filter(Boolean);
    if (tableGroups.length > 1) {
      return tableGroups.map((g) => ({
        name: typeof g.name === 'string' ? g.name : null,
        rows: rows.filter((r) => r.group === g.num),
      }));
    }
    return [{ name: tables.length > 1 ? table.displayName ?? null : null, rows }];
  });

  const rawDestinations = (tables[0] ?? all[0])?.destinations;
  const destinations = (Array.isArray(rawDestinations) ? rawDestinations : [])
    .filter((d) => typeof d?.num === 'number')
    .map((d) => ({
      num: d.num,
      name: typeof d.name === 'string' ? d.name : '',
      color: typeof d.color === 'string' ? d.color : '#8A8F8C',
    }));

  return { groups: groups.filter((g) => g.rows.length > 0), destinations };
}

Deno.serve(async (req) => {
  // Only the cron job knows the secret stored in Vault
  const { data: authorized } = await supabase.rpc('check_match_sync_secret', {
    p_secret: req.headers.get('x-sync-secret') ?? '',
  });
  if (!authorized) return new Response('Unauthorized', { status: 401 });

  try {
    const { data: leagues, error } = await supabase.from('world_leagues').select('id, standings');
    if (error) throw error;

    const results = await Promise.allSettled(
      leagues.map(async ({ id, standings: saved }: { id: number; standings: SavedStandings | null }) => {
        const data = await get<ApiResponse>(`/web/standings/?${QUERY}&competitions=${id}`);
        const standings = toStandings(data);
        if (standings.groups.length === 0) throw new Error(`no standings for ${id}`);

        // A table that suddenly lost most of its teams is a broken answer; keep the saved one
        const rowCount = (s: SavedStandings | null) =>
          (Array.isArray(s?.groups) ? s.groups : []).reduce(
            (sum, g) => sum + (Array.isArray(g?.rows) ? g.rows.length : 0),
            0,
          );
        if (rowCount(standings) < rowCount(saved) / 2) {
          throw new Error(`standings for ${id} shrank from ${rowCount(saved)} to ${rowCount(standings)} rows`);
        }

        const competitions = Array.isArray(data?.competitions) ? data.competitions : [];
        const imageVersion = num(competitions.find((c) => c?.id === id)?.imageVersion);
        const { error: updateError } = await supabase
          .from('world_leagues')
          .update({
            standings,
            updated_at: new Date().toISOString(),
            ...(imageVersion ? { image_version: imageVersion } : {}),
          })
          .eq('id', id);
        if (updateError) throw updateError;
      }),
    );

    const failed = results.flatMap((r, i) =>
      r.status === 'rejected' ? [{ id: leagues[i].id, error: String(r.reason) }] : [],
    );
    if (failed.length) console.error('Failed leagues', failed);
    return Response.json({ synced: results.length - failed.length, failed });
  } catch (error) {
    console.error(error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
});
