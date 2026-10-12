import { SplashScreen, Stack } from 'expo-router';

import { SessionProvider, useSession } from '../hooks/use-session';

// If anything below throws, show a retry screen instead of crashing the app
export { RootErrorBoundary as ErrorBoundary } from '../components/screen-error';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, username, favoriteLeagues, favoriteTeams, isLoading, isRecovering } =
    useSession();

  if (isLoading) return null;
  SplashScreen.hide();

  // Onboarding steps after signing in: username, then world leagues, then teams for the news
  const isSignedIn = !isRecovering && !!session && !!username;

  // Screens outside the active guard redirect to the first screen available to the user
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Opened from a password reset email: choose a new password before anything else */}
      <Stack.Protected guard={isRecovering}>
        <Stack.Screen name="reset-password" />
      </Stack.Protected>

      <Stack.Protected guard={isSignedIn && !!favoriteLeagues && !!favoriteTeams}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="predictions" />
        <Stack.Screen name="match/[id]" />
        <Stack.Screen name="create-league" />
        <Stack.Screen name="league/[id]" />
        <Stack.Screen name="explore" />
        <Stack.Screen name="world-tables" />
        <Stack.Screen name="edit-leagues" />
        <Stack.Screen name="news" />
        <Stack.Screen name="edit-teams" />
      </Stack.Protected>

      {/* Has a username but hasn't picked leagues for the world tables yet */}
      <Stack.Protected guard={isSignedIn && !favoriteLeagues}>
        <Stack.Screen name="choose-leagues" />
      </Stack.Protected>

      {/* Picked leagues but not the Israeli league teams to follow in the news yet */}
      <Stack.Protected guard={isSignedIn && !!favoriteLeagues && !favoriteTeams}>
        <Stack.Screen name="choose-teams" />
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
