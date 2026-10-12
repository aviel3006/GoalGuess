import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '../supabase';

// Signup confirmation and password reset emails send the user back here.
// Must be listed under Authentication > URL Configuration > Redirect URLs in Supabase.
export const authRedirectUrl = Linking.createURL('/');

type SessionState = {
  session: Session | null;
  // The leaderboard name, stored in the auth user's metadata
  username: string | null;
  isLoading: boolean;
  // Signed in from a password reset link and still has to choose a new password
  isRecovering: boolean;
  finishRecovery: () => void;
};

const SessionContext = createContext<SessionState>({
  session: null,
  username: null,
  isLoading: true,
  isRecovering: false,
  finishRecovery: () => {},
});

function usernameOf(session: Session | null): string | null {
  const value = session?.user.user_metadata?.username;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    // Fires on sign-in, sign-out, token refresh and updateUser() (e.g. saving a username)
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setIsLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Email links land here with the new session in the URL fragment:
    // #access_token=...&refresh_token=...&type=signup|recovery
    const handleUrl = async (url: string | null) => {
      const params = new URLSearchParams(url?.split('#')[1] ?? '');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (!accessToken || !refreshToken) return;

      // Set before the session arrives so the reset screen opens instead of the app
      const isRecoveryLink = params.get('type') === 'recovery';
      if (isRecoveryLink) setIsRecovering(true);

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        setIsRecovering(false);
        alert('הקישור לא תקין או שפג תוקפו. בקש קישור חדש.');
      }
    };

    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    return () => subscription.remove();
  }, []);

  return (
    <SessionContext.Provider
      value={{
        session,
        username: usernameOf(session),
        isLoading,
        isRecovering,
        finishRecovery: () => setIsRecovering(false),
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
