import { leagueLogoUrl } from './world-leagues';

// ליגת העל on 365Scores; the sync-news edge function pulls its news
export const ISRAELI_LEAGUE_LOGO = leagueLogoUrl(42, 9);

// Filled from the league table by the sync-news job
export type NewsTeam = {
  id: number;
  name: string;
  image_version: number;
};

export type NewsArticle = {
  id: number;
  title: string;
  image: string | null;
  url: string;
  source_name: string | null;
  published_at: string;
  // Teams the article is about; empty for general league news
  team_ids: number[];
};

export function publishedAgo(iso: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'עכשיו';
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? 'לפני שעה' : `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'אתמול';
  if (days < 7) return `לפני ${days} ימים`;
  return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}
