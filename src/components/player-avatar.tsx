import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

// A player's profile picture in the leaderboards, or a person icon when they have none
export function PlayerAvatar({
  uri,
  size,
  style,
}: {
  uri: string | null;
  size: number;
  // Background and border overrides, e.g. the podium medal ring
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />
      ) : (
        <Ionicons name="person" size={Math.round(size * 0.6)} color="#B8DCC3" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: '#20432D',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
