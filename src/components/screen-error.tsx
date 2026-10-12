import { Ionicons } from '@expo/vector-icons';
import { router, type ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const GREEN = '#00E676';
const BG = '#040A07';

// Shown instead of crashing when a screen throws while rendering, e.g. on data in a shape
// it didn't expect. Route files export it as their ErrorBoundary.
function ErrorScreen({ error, retry, canLeave }: ErrorBoundaryProps & { canLeave: boolean }) {
  useEffect(() => {
    console.error('Screen crashed:', error);
  }, [error]);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <Ionicons name="warning-outline" size={56} color="#42624D" />
      <Text style={styles.title}>משהו השתבש</Text>
      <Text style={styles.subtitle}>לא הצלחנו להציג את המסך הזה כרגע. נסו שוב בעוד רגע.</Text>

      <TouchableOpacity style={styles.retryButton} onPress={retry}>
        <Text style={styles.retryText}>נסה שוב</Text>
      </TouchableOpacity>

      {canLeave && (
        <TouchableOpacity style={styles.leaveButton} onPress={leave}>
          <Text style={styles.leaveText}>חזרה</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// For screens inside the app; the user can step back to where they came from
export function ScreenErrorBoundary(props: ErrorBoundaryProps) {
  return <ErrorScreen {...props} canLeave />;
}

// Last resort for the root layout, where there's no navigator left to go back with
export function RootErrorBoundary(props: ErrorBoundaryProps) {
  return <ErrorScreen {...props} canLeave={false} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 6,
  },

  subtitle: {
    color: '#8FA398',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  retryButton: {
    marginTop: 14,
    backgroundColor: GREEN,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 34,
  },

  retryText: {
    color: '#04150B',
    fontSize: 15,
    fontWeight: '900',
  },

  leaveButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },

  leaveText: {
    color: '#C9D3CD',
    fontSize: 14,
    fontWeight: '700',
  },
});
