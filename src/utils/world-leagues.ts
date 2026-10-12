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
