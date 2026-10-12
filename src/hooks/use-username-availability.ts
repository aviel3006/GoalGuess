import { useEffect, useState } from 'react';

import { cleanName, isUsernameAvailable, USERNAME_MIN } from '../utils/username';

const DEBOUNCE_MS = 400;

export type UsernameAvailability = 'checking' | 'available' | 'taken' | null;

// Live "is this name free?" check while typing. null when there's nothing to check
// (too short, unchanged, or the lookup failed: saving checks again anyway).
export function useUsernameAvailability(value: string, currentName?: string) {
  const name = cleanName(value);
  const skip = name.length < USERNAME_MIN || name.toLowerCase() === currentName?.toLowerCase();
  const [result, setResult] = useState<{ name: string; available: boolean | null } | null>(null);

  useEffect(() => {
    if (skip) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      isUsernameAvailable(name)
        .then((available) => !cancelled && setResult({ name, available }))
        .catch((error) => {
          console.warn('Username availability error:', error);
          if (!cancelled) setResult({ name, available: null });
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, skip]);

  if (skip) return null;
  if (result?.name !== name) return 'checking';
  if (result.available === null) return null;
  return result.available ? 'available' : 'taken';
}
