import { Alert } from 'react-native';

import { supabase } from '../supabase';

// Used by the profile and settings screens
export function confirmSignOut() {
  Alert.alert('התנתקות', 'בטוח שברצונך להתנתק?', [
    { text: 'ביטול', style: 'cancel' },
    {
      text: 'התנתק',
      style: 'destructive',
      onPress: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          Alert.alert('שגיאה', 'לא הצלחנו להתנתק. נסה שוב.');
          return;
        }
        // The root layout's guard sends signed-out users to login
      },
    },
  ]);
}
