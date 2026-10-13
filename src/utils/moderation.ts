import { supabase } from '../supabase';

// Matches the reason check on public.content_reports
export type ReportReason = 'name' | 'picture' | 'other';

// Reports land in public.content_reports and are reviewed from the dashboard
export async function reportUser(userId: string, reason: ReportReason) {
  const { error } = await supabase.rpc('report_user', { p_user_id: userId, p_reason: reason });
  if (error) throw error;
}

export async function reportLeague(leagueId: number, reason: ReportReason) {
  const { error } = await supabase.rpc('report_league', { p_league_id: leagueId, p_reason: reason });
  if (error) throw error;
}

// The leaderboard functions hide a blocked player's name and picture from the blocker
export async function blockUser(userId: string) {
  const { error } = await supabase.from('user_blocks').insert({ blocked_id: userId });
  // Already blocked (primary key) is fine
  if (error && error.code !== '23505') throw error;
}

export async function unblockUser(userId: string) {
  const { error } = await supabase.from('user_blocks').delete().eq('blocked_id', userId);
  if (error) throw error;
}

export async function getBlockedUsers() {
  const { data, error } = await supabase.rpc('get_my_blocked_users');
  if (error) throw error;
  return (data ?? []) as { user_id: string; username: string | null }[];
}
