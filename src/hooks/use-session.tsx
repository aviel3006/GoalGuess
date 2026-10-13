import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '../supabase';

// Signup confirmation and password reset emails send the user back here.
// Must be listed under Authentication > URL Configuration > Redirect URLs in Supabase.
export const authRedirectUrl = Linking.createURL('/');

if (__DEV__) {
  // In Expo Go this is exp://<computer-ip>:8081/--/ — the allow list needs a pattern that matches it
  console.log('Auth email links redirect to', authRedirectUrl);
}

// Auth redirects (email links, Google sign-in) carry the result in the URL fragment:
// #access_token=...&refresh_token=...&type=signup|recovery, or #error=...&error_description=...
export function authParamsFromUrl(url: string | null) {
  const params = new URLSearchParams(url?.split('#')[1] ?? '');
  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    type: params.get('type'),
    error: params.get('error'),
  };
}

export type FavoriteTeams = number[] | 'all';

type SessionState = {
  session: Session | null;
  // The leaderboard name, stored in the auth user's metadata
  username: string | null;
  // 365Scores competition ids picked on the choose-leagues screen; null until chosen
  favoriteLeagues: number[] | null;
  // Israeli league teams (365Scores ids) whose news the user follows, or every team; null until chosen
  favoriteTeams: FavoriteTeams | null;
  isLoading: boolean;
  // Signed in from a password reset link and still has to choose a new password
  isRecovering: boolean;
  finishRecovery: () => void;
};

const SessionContext = createContext<SessionState>({
  session: null,
  username: null,
  favoriteLeagues: null,
  favoriteTeams: null,
  isLoading: true,
  isRecovering: false,
  finishRecovery: () => {},
});

function usernameOf(session: Session | null): string | null {
  const value = session?.user.user_metadata?.username;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function favoriteLeaguesOf(session: Session | null): number[] | null {
  const value = session?.user.user_metadata?.favorite_leagues;
  return Array.isArray(value) ? value.filter((id) => typeof id === 'number') : null;
}

function favoriteTeamsOf(session: Session | null): FavoriteTeams | null {
  const value = session?.user.user_metadata?.favorite_teams;
  if (value === 'all') return 'all';
  return Array.isArray(value) ? value.filter((id) => typeof id === 'number') : null;
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
    // Email links land here with the new session in the URL fragment
    const handleUrl = async (url: string | null) => {
      const { accessToken, refreshToken, type } = authParamsFromUrl(url);
      if (!accessToken || !refreshToken) return;

      // Set before the session arrives so the reset screen opens instead of the app
      const isRecoveryLink = type === 'recovery';
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
        favoriteLeagues: favoriteLeaguesOf(session),
        favoriteTeams: favoriteTeamsOf(session),
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
