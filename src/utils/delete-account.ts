import { Alert } from 'react-native';

import { supabase } from '../supabase';

const AVATAR_BUCKET = 'avatars';

// Profile pictures live under avatars/<uid>/ and the bucket is public, so remove them
// before the account itself. Throws if they can't be removed so nothing is half-deleted.
async function removeAvatars(userId: string) {
  const bucket = supabase.storage.from(AVATAR_BUCKET);
  const { data: files, error } = await bucket.list(userId);
  if (error) throw error;
  if (!files.length) return;

  const { error: removeError } = await bucket.remove(files.map((f) => `${userId}/${f.name}`));
  if (removeError) throw removeError;
}

async function deleteAccount() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  try {
    await removeAvatars(session.user.id);

    // Hands the user's leagues to their earliest member, deletes their predictions,
    // then the auth user (memberships and username cascade)
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
  } catch {
    Alert.alert('שגיאה', 'לא הצלחנו למחוק את החשבון. נסה שוב.');
    return;
  }

  // The user no longer exists on the server, so only clear the local session.
  // The root layout's guard then sends the app to login.
  await supabase.auth.signOut({ scope: 'local' });
}

export function confirmDeleteAccount() {
  Alert.alert(
    'מחיקת חשבון',
    'החשבון, הניחושים, הנקודות ותמונת הפרופיל יימחקו לצמיתות. ליגות שיצרת יעברו לחבר הוותיק ביותר בהן. אי אפשר לבטל את הפעולה.',
    [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק לצמיתות', style: 'destructive', onPress: deleteAccount },
    ],
  );
}
