import { SplashScreen, Stack } from 'expo-router';

import { SessionProvider, useSession } from '../hooks/use-session';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, username, isLoading } = useSession();

  if (isLoading) return null;
  SplashScreen.hide();

  // Screens outside the active guard redirect to the first screen available to the user
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session && !!username}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="predictions" />
        <Stack.Screen name="create-league" />
        <Stack.Screen name="explore" />
      </Stack.Protected>

      {/* Signed in but no leaderboard name yet: new accounts land here after verifying */}
      <Stack.Protected guard={!!session && !username}>
        <Stack.Screen name="username" />
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="verify" />
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
