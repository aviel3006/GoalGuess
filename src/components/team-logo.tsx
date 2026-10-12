import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

export const LOGO_SIZE = 54;

export function TeamLogo({ badge, size = LOGO_SIZE }: { badge: string | null; size?: number }) {
  const badgeSize = Math.round(size * 0.78);

  return (
    <View style={[styles.logoCircle, { width: size, height: size, borderRadius: size / 2 }]}>
      {badge ? (
        // TheSportsDB serves a 250px version at /small, plenty for a 54px circle
        <Image
          source={{ uri: `${badge}/small` }}
          style={{ width: badgeSize, height: badgeSize }}
          contentFit="contain"
          transition={150}
        />
      ) : (
        <Text style={{ fontSize: Math.round(size * 0.46) }}>⚽</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  logoCircle: {
    backgroundColor: '#252525',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
