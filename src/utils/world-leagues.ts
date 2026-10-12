// Logos come from the 365Scores image CDN, keyed by their competition/team ids.
// The default variant is drawn for dark backgrounds.
const IMAGE_CDN =
  'https://imagecache.365scores.com/image/upload/f_png,w_96,h_96,c_limit,q_auto:eco,dpr_2';

export function leagueLogoUrl(id: number, imageVersion: number) {
  return `${IMAGE_CDN},d_Competitions:default1.png/v${imageVersion}/Competitions/${id}`;
}

export function teamLogoUrl(id: number, imageVersion: number) {
  return `${IMAGE_CDN},d_Competitors:default1.png/v${imageVersion}/Competitors/${id}`;
}

export type StandingRow = {
  position: number;
  team_id: number;
  name: string;
  short_name: string | null;
  image_version: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
  destination: number | null;
};

export type Standings = {
  groups: { name: string | null; rows: StandingRow[] }[];
  destinations: { num: number; name: string; color: string }[];
};

export type WorldLeague = {
  id: number;
  name: string;
  country: string;
  image_version: number;
  standings: Standings | null;
  updated_at: string | null;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

// The standings come from an unofficial API, so anything off-shape is dropped
// rather than trusted: a half-broken table is better than a crashed screen.
export function cleanStandings(value: unknown): Standings | null {
  if (!isObject(value) || !Array.isArray(value.groups)) return null;

  const groups = value.groups.filter(isObject).map((group) => ({
    name: typeof group.name === 'string' ? group.name : null,
    rows: (Array.isArray(group.rows) ? group.rows : [])
      .filter((row): row is Record<string, unknown> => isObject(row) && typeof row.team_id === 'number')
      .map((row) => ({
        position: toNumber(row.position),
        team_id: row.team_id as number,
        name: typeof row.name === 'string' ? row.name : '',
        short_name: typeof row.short_name === 'string' ? row.short_name : null,
        image_version: toNumber(row.image_version) || 1,
        played: toNumber(row.played),
        won: toNumber(row.won),
        drawn: toNumber(row.drawn),
        lost: toNumber(row.lost),
        goals_for: toNumber(row.goals_for),
        goals_against: toNumber(row.goals_against),
        points: toNumber(row.points),
        form: (Array.isArray(row.form) ? row.form : []).filter(
          (f): f is 'W' | 'D' | 'L' => f === 'W' || f === 'D' || f === 'L'
        ),
        destination: typeof row.destination === 'number' ? row.destination : null,
      })),
  }));

  const destinations = (Array.isArray(value.destinations) ? value.destinations : [])
    .filter(isObject)
    .filter((d) => typeof d.num === 'number')
    .map((d) => ({
      num: d.num as number,
      name: typeof d.name === 'string' ? d.name : '',
      color: typeof d.color === 'string' ? d.color : '#8A8F8C',
    }));

  const nonEmpty = groups.filter((g) => g.rows.length > 0);
  return nonEmpty.length > 0 ? { groups: nonEmpty, destinations } : null;
}
