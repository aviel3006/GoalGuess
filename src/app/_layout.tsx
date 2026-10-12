import { SplashScreen, Stack } from 'expo-router';

import { SessionProvider, useSession } from '../hooks/use-session';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, username, favoriteLeagues, isLoading, isRecovering } = useSession();

  if (isLoading) return null;
  SplashScreen.hide();

  // Screens outside the active guard redirect to the first screen available to the user
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Opened from a password reset email: choose a new password before anything else */}
      <Stack.Protected guard={isRecovering}>
        <Stack.Screen name="reset-password" />
      </Stack.Protected>

      <Stack.Protected guard={!isRecovering && !!session && !!username && !!favoriteLeagues}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="predictions" />
        <Stack.Screen name="match/[id]" />
        <Stack.Screen name="create-league" />
        <Stack.Screen name="league/[id]" />
        <Stack.Screen name="explore" />
        <Stack.Screen name="world-tables" />
        <Stack.Screen name="edit-leagues" />
      </Stack.Protected>

      {/* Has a username but hasn't picked leagues for the world tables yet */}
      <Stack.Protected guard={!isRecovering && !!session && !!username && !favoriteLeagues}>
        <Stack.Screen name="choose-leagues" />
      </Stack.Protected>

      {/* Signed in but no leaderboard name yet: new accounts land here after verifying */}
      <Stack.Protected guard={!isRecovering && !!session && !username}>
        <Stack.Screen name="username" />
      </Stack.Protected>

      <Stack.Protected guard={!isRecovering && !session}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="verify" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}
