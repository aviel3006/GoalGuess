import { supabase } from '../supabase';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

// Same cleanup as normalize_username() in the database: trim and collapse inner whitespace
export function cleanName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

// Reserves the name in public.usernames, which the leaderboards read and which is unique
// ignoring case. Call it before saving the name to user_metadata. The database also refuses
// offensive names (public.blocked_words).
export async function claimUsername(name: string): Promise<'claimed' | 'taken' | 'inappropriate'> {
  const { error } = await supabase.rpc('claim_username', { p_username: name });
  if (error?.message.includes('username_taken')) return 'taken';
  if (error?.message.includes('inappropriate_username')) return 'inappropriate';
  if (error) throw error;
  return 'claimed';
}

export async function isUsernameAvailable(name: string) {
  const { data, error } = await supabase.rpc('is_username_available', { p_username: name });
  if (error) throw error;
  return data as boolean;
}
