// Pulls the standings of every league in public.world_leagues from 365Scores and stores
// them in world_leagues.standings. The app gets the changes over Realtime.
// Runs every 5 minutes from the "sync-world-standings" pg_cron job.
import { createClient } from 'npm:@supabase/supabase-js@2';

// The public endpoints the 365Scores website itself uses; no key needed
const API = 'https://webws.365scores.com';
const QUERY = 'appTypeId=5&langId=2&timezoneName=Asia/Jerusalem&userCountryId=6';

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

type ApiResponse = {
  standings?: ApiStandings[];
  competitions?: { id: number; imageVersion?: number }[];
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

// 365Scores encodes recent results as 1 = win, 2 = draw, 0 = loss, newest first
const FORM: Record<number, string> = { 1: 'W', 2: 'D', 0: 'L' };

function toStandings(data: ApiResponse) {
  const all = data.standings ?? [];
  const tables = all.filter((s) => s.isCurrentStage !== false);

  const groups = (tables.length ? tables : all).flatMap((table) => {
    // Some leagues occasionally send placeholder rows without a team
    const rows = (table.rows ?? []).filter((r) => r.competitor).map((r) => ({
      position: r.position,
      group: r.groupNum ?? null,
      team_id: r.competitor.id,
      name: r.competitor.name,
      short_name: r.competitor.shortName ?? null,
      image_version: r.competitor.imageVersion ?? 1,
      played: r.gamePlayed,
      won: r.gamesWon,
      drawn: r.gamesEven,
      lost: r.gamesLost,
      goals_for: r.for,
      goals_against: r.against,
      points: r.points,
      form: (r.recentForm ?? []).map((f) => FORM[f]).filter(Boolean),
      destination: r.destinationNum ?? null,
    }));

    // Leagues split into conferences/groups (MLS, ...) come as one table with groupNum per row
    if (table.groups && table.groups.length > 1) {
      return table.groups.map((g) => ({
        name: g.name,
        rows: rows.filter((r) => r.group === g.num),
      }));
    }
    return [{ name: tables.length > 1 ? table.displayName ?? null : null, rows }];
  });

  const destinations = (tables[0] ?? all[0])?.destinations?.map((d) => ({
    num: d.num,
    name: d.name,
    color: d.color,
  })) ?? [];

  return { groups: groups.filter((g) => g.rows.length > 0), destinations };
}

Deno.serve(async (req) => {
  // Only the cron job knows the secret stored in Vault
  const { data: authorized } = await supabase.rpc('check_match_sync_secret', {
    p_secret: req.headers.get('x-sync-secret') ?? '',
  });
  if (!authorized) return new Response('Unauthorized', { status: 401 });

  try {
    const { data: leagues, error } = await supabase.from('world_leagues').select('id');
    if (error) throw error;

    const results = await Promise.allSettled(
      leagues.map(async ({ id }: { id: number }) => {
        const data = await get<ApiResponse>(`/web/standings/?${QUERY}&competitions=${id}`);
        const standings = toStandings(data);
        if (standings.groups.length === 0) throw new Error(`no standings for ${id}`);

        const imageVersion = data.competitions?.find((c) => c?.id === id)?.imageVersion;
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
