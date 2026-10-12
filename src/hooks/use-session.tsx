import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '../supabase';

type SessionState = {
  session: Session | null;
  // The leaderboard name, stored in the auth user's metadata
  username: string | null;
  isLoading: boolean;
};

const SessionContext = createContext<SessionState>({
  session: null,
  username: null,
  isLoading: true,
});

function usernameOf(session: Session | null): string | null {
  const value = session?.user.user_metadata?.username;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <SessionContext.Provider value={{ session, username: usernameOf(session), isLoading }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
