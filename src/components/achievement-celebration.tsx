import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  AppState,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { useSession } from '../hooks/use-session';
import { ACHIEVEMENT_TIERS, loadProfile, type Achievement } from '../hooks/use-profile';
import { supabase } from '../supabase';
import { ACHIEVEMENT_ICONS, TIER_STYLE } from '../utils/achievements';

const GREEN = '#00E676';
const GOLD = '#F5C542';

// Achievement ids already celebrated, kept in auth user_metadata so they follow the user across devices
const SEEN_KEY = 'seen_achievements';

const CONFETTI_COUNT = 36;
const RAY_COUNT = 12;

type CelebrationContextValue = {
  // Celebrate any unlocked achievement not celebrated yet (cheap: uses data already loaded)
  report: (achievements: Achievement[]) => void;
  // Load the user's achievements, then report them (after saving predictions, on app open)
  check: () => void;
};

const CelebrationContext = createContext<CelebrationContextValue>({
  report: () => {},
  check: () => {},
});

export function useAchievementCelebration() {
  return useContext(CelebrationContext);
}

function seenFromMetadata(value: unknown) {
  return new Set(Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []);
}

export function AchievementCelebrationProvider({ children }: { children: ReactNode }) {
  const { session, username, favoriteLeagues, favoriteTeams, isRecovering } = useSession();
  const userId = session?.user.id ?? null;
  // Only once the user is fully inside the app, not during onboarding
  const enabled = !!userId && !!username && !!favoriteLeagues && !!favoriteTeams && !isRecovering;

  // Tagged with the user, so a queue left from someone who signed out is never shown
  const [queue, setQueue] = useState<{ userId: string | null; items: Achievement[] }>({
    userId: null,
    items: [],
  });
  const seenRef = useRef<{ userId: string; ids: Set<string> } | null>(null);
  const checkingRef = useRef(false);
  const seenMetadata = session?.user.user_metadata?.[SEEN_KEY];

  const report = useCallback(
    (achievements: Achievement[]) => {
      if (!enabled || !userId) return;

      if (seenRef.current?.userId !== userId) {
        seenRef.current = { userId, ids: seenFromMetadata(seenMetadata) };
      }
      const seen = seenRef.current.ids;

      const fresh = achievements.filter((a) => a.unlocked && !seen.has(a.id));
      if (fresh.length === 0) return;

      // Marked right away so overlapping checks never celebrate the same badge twice
      for (const a of fresh) seen.add(a.id);
      fresh.sort((a, b) => ACHIEVEMENT_TIERS.indexOf(a.tier) - ACHIEVEMENT_TIERS.indexOf(b.tier));
      setQueue((q) => ({ userId, items: q.userId === userId ? [...q.items, ...fresh] : fresh }));

      supabase.auth.updateUser({ data: { [SEEN_KEY]: [...seen] } }).then(({ error }) => {
        if (error) console.warn('Save seen achievements error:', error);
      });
    },
    [enabled, userId, seenMetadata]
  );

  const check = useCallback(() => {
    if (!enabled || checkingRef.current) return;
    checkingRef.current = true;
    loadProfile()
      .then((state) => {
        if (state.status === 'ready') report(state.data.achievements);
      })
      .catch((error) => console.warn('Check achievements error:', error))
      .finally(() => {
        checkingRef.current = false;
      });
  }, [enabled, report]);

  // Through a ref so session refreshes (which recreate check) don't trigger extra loads
  const checkRef = useRef(check);
  useEffect(() => {
    checkRef.current = check;
  }, [check]);

  // On entering the app, and whenever it comes back to the foreground (matches may have been graded)
  useEffect(() => {
    if (!enabled) return;
    checkRef.current();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') checkRef.current();
    });
    return () => subscription.remove();
  }, [enabled]);

  const value = useMemo(() => ({ report, check }), [report, check]);
  const items = enabled && queue.userId === userId ? queue.items : [];
  const current = items[0];

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {current && (
        <CelebrationModal
          key={current.id}
          achievement={current}
          remaining={items.length - 1}
          onNext={() => setQueue((q) => ({ ...q, items: q.items.slice(1) }))}
        />
      )}
    </CelebrationContext.Provider>
  );
}

function CelebrationModal({
  achievement,
  remaining,
  onNext,
}: {
  achievement: Achievement;
  remaining: number;
  onNext: () => void;
}) {
  const { height } = useWindowDimensions();
  const tier = TIER_STYLE[achievement.tier];
  const icon = ACHIEVEMENT_ICONS[achievement.id];

  const [pop] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));
  const [fall] = useState(() => new Animated.Value(0));
  const [glow] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );

    Animated.spring(pop, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }).start();
    Animated.timing(fall, {
      toValue: 1,
      duration: 2800,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    spinLoop.start();
    glowLoop.start();

    return () => {
      spinLoop.stop();
      glowLoop.stop();
    };
  }, [pop, spin, fall, glow]);

  const confettiColors = [tier.color, '#FFFFFF', GOLD, GREEN];

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onNext}>
      <View style={styles.backdrop}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.confetti,
                {
                  left: `${(i * 37) % 97}%`,
                  top: -30 - (i % 6) * 40,
                  width: 6 + (i % 3) * 2,
                  backgroundColor: confettiColors[i % confettiColors.length],
                  opacity: fall.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
                  transform: [
                    {
                      translateY: fall.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, height * (0.75 + (i % 4) * 0.1)],
                      }),
                    },
                    {
                      rotate: fall.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', `${300 + i * 23}deg`],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>

        <Animated.View
          style={[
            styles.card,
            { borderColor: `${tier.color}99`, boxShadow: `0 0 32px ${tier.color}55` },
            {
              opacity: pop.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: 'clamp' }),
              transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
            },
          ]}
          accessibilityViewIsModal
          accessibilityLiveRegion="polite"
          accessibilityLabel={`הישג חדש: ${achievement.title}, דרגה ${tier.label}. ${achievement.description}`}
        >
          <Text style={styles.kicker}>הישג חדש!</Text>

          <View style={styles.badgeStage}>
            <Animated.View
              style={[
                styles.rays,
                {
                  transform: [
                    {
                      rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
                    },
                  ],
                },
              ]}
            >
              {Array.from({ length: RAY_COUNT }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.ray,
                    {
                      backgroundColor: `${tier.color}33`,
                      transform: [{ rotate: `${(360 / RAY_COUNT) * i}deg` }],
                    },
                  ]}
                />
              ))}
            </Animated.View>

            <Animated.View
              style={[
                styles.glow,
                {
                  backgroundColor: `${tier.color}40`,
                  opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
                  transform: [
                    { scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] }) },
                  ],
                },
              ]}
            />

            <Animated.View
              style={[
                styles.hex,
                {
                  transform: [
                    { scale: pop },
                    {
                      rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '0deg'] }),
                    },
                  ],
                },
              ]}
            >
              <MaterialCommunityIcons
                name="hexagon"
                size={128}
                color={`${tier.color}55`}
                style={StyleSheet.absoluteFill}
              />
              <MaterialCommunityIcons
                name="hexagon-outline"
                size={128}
                color={tier.color}
                style={StyleSheet.absoluteFill}
              />
              <MaterialCommunityIcons name={icon} size={52} color="#FFFFFF" />
            </Animated.View>
          </View>

          <Text style={styles.title}>{achievement.title}</Text>
          <Text style={styles.description}>{achievement.description}</Text>

          <View style={[styles.tierChip, { borderColor: `${tier.color}99` }]}>
            <View style={[styles.tierDot, { backgroundColor: tier.color }]} />
            <Text style={styles.tierText}>דרגה: {tier.label}</Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={onNext} activeOpacity={0.85}>
            <Text style={styles.buttonText}>
              {remaining > 0 ? `להישג הבא (עוד ${remaining})` : 'מעולה!'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(2, 6, 4, 0.82)',
  },
  confetti: {
    position: 'absolute',
    height: 11,
    borderRadius: 2,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    paddingTop: 22,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderRadius: 28,
    borderWidth: 1.5,
    backgroundColor: '#0B140F',
  },
  kicker: {
    color: GOLD,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  badgeStage: {
    width: 220,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rays: {
    position: 'absolute',
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ray: {
    position: 'absolute',
    width: 14,
    height: 220,
    borderRadius: 7,
  },
  glow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  hex: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  description: {
    color: '#C9D4CE',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 21,
  },
  tierChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  tierDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  tierText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  button: {
    alignSelf: 'stretch',
    height: 52,
    marginTop: 22,
    borderRadius: 16,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#04150B',
    fontSize: 17,
    fontWeight: '900',
  },
});

