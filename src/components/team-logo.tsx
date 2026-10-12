import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

export const LOGO_SIZE = 54;

export function TeamLogo({ badge }: { badge: string | null }) {
  return (
    <View style={styles.logoCircle}>
      {badge ? (
        // TheSportsDB serves a 250px version at /small, plenty for a 54px circle
        <Image
          source={{ uri: `${badge}/small` }}
          style={styles.badge}
          contentFit="contain"
          transition={150}
        />
      ) : (
        <Text style={styles.ball}>⚽</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  logoCircle: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    backgroundColor: '#252525',
    alignItems: 'center',
    justifyContent: 'center',
  },

  ball: {
    fontSize: 25,
  },

  badge: {
    width: 42,
    height: 42,
  },
});
