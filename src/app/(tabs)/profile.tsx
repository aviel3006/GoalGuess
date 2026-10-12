import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ACHIEVEMENT_TIERS,
  useProfile,
  type Achievement,
  type AchievementId,
  type AchievementTier,
  type ProfileData,
  type ProfileLeague,
} from '../../hooks/use-profile';
import { flagEmoji } from '../../utils/countries';
import { confirmSignOut } from '../../utils/sign-out';

const GREEN = '#00E676';
const GOLD = '#F5C542';
const BG = '#040A07';
const CARD = 'rgba(12, 22, 16, 0.94)';
const CARD_BORDER = '#1B3626';
const MUTED = '#8FA398';
const LEAGUES_PREVIEW = 2;

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type McIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const ACHIEVEMENT_ICONS: Record<AchievementId, McIconName> = {
  'first-prediction': 'soccer',
  'first-correct': 'check-decagram',
  'join-league': 'account-group',
  'first-exact': 'bullseye',
  'streak-3': 'fire',
  'points-50': 'star',
  'predictions-50': 'clipboard-check',
  'streak-5': 'fire',
  'points-100': 'chart-bar',
  'exact-10': 'target',
  'round-20': 'lightning-bolt',
  'streak-10': 'fire',
  'points-250': 'chart-line',
  'exact-25': 'target-account',
  'league-champion': 'trophy',
  'global-top-10': 'earth',
  'exact-expert': 'crosshairs-gps',
  'points-500': 'crown',
  'perfect-round': 'diamond-stone',
  'global-first': 'medal',
};

// Difficulty colors, checked with the dataviz palette validator on the badge background.
// Blue and purple are close for some colorblind users, so every badge also names its tier.
const TIER_STYLE: Record<AchievementTier, { label: string; color: string }> = {
  easy: { label: 'קל', color: '#8E9A94' },
  medium: { label: 'בינוני', color: '#16A34A' },
  hard: { label: 'קשה', color: '#1E56E0' },
  epic: { label: 'אפי', color: '#B95CF0' },
  legendary: { label: 'אגדי', color: '#D97706' },
};

const MEDALS = ['🥇', '🥈', '🥉'];

function openEditProfile() {
  router.push('/edit-profile');
}

function openMyStats() {
  router.push('/my-stats');
}

function openSettings() {
  router.push('/settings');
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { state, refreshing, load } = useProfile();

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <Image
        source={require('../../../assets/images/stadium.png')}
        style={styles.heroImage}
        resizeMode="cover"
      />
      <View style={styles.heroFade} />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.logoRow}>
          <Ionicons name="football" size={22} color={GREEN} />
          <Text style={styles.logo}>
            Goal<Text style={styles.logoGreen}>Guess</Text>
          </Text>
        </View>

        <TouchableOpacity onPress={openSettings} hitSlop={10} accessibilityLabel="הגדרות">
          <Ionicons name="settings-sharp" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {state.status === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      )}

      {state.status === 'error' && (
        <View style={styles.centered}>
          <EmptyState
            icon="cloud-offline-outline"
            title="לא הצלחנו לטעון את הפרופיל"
            subtitle="בדוק את החיבור לאינטרנט ונסה שוב"
            actionLabel="נסה שוב"
            onAction={() => load()}
          />
        </View>
      )}

      {state.status === 'signed-out' && (
        <View style={styles.centered}>
          <EmptyState
            icon="person-circle-outline"
            title="אינך מחובר"
            subtitle="התחבר כדי לראות את הפרופיל, הנקודות והליגות שלך"
            actionLabel="להתחברות"
            onAction={() => router.replace('/login')}
          />
        </View>
      )}

      {state.status === 'ready' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load('refresh')}
              tintColor={GREEN}
              colors={[GREEN]}
            />
          }
        >
          <ProfileHeader data={state.data} />
          <StatsCard data={state.data} />
          <AchievementsSection achievements={state.data.achievements} />
          <LeaguesSection leagues={state.data.leagues} />

          <View style={[styles.card, styles.menuCard]}>
            <MenuRow icon="person" label="עריכת פרופיל" onPress={openEditProfile} />
            <MenuRow icon="stats-chart" label="הסטטיסטיקות שלי" onPress={openMyStats} />
            <MenuRow icon="settings-sharp" label="הגדרות" onPress={openSettings} />
            <MenuRow icon="log-out-outline" label="התנתקות" onPress={confirmSignOut} danger last />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function ProfileHeader({ data }: { data: ProfileData }) {
  const flag = data.countryCode ? flagEmoji(data.countryCode) : null;
  const { globalRank } = data.stats;

  return (
    <View style={styles.profileRow}>
      <View style={styles.avatarWrap}>
        <View style={styles.avatarRing}>
          {data.avatarUrl ? (
            <Image source={{ uri: data.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={58} color="#5E8A6F" />
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.editBadge} onPress={openEditProfile} hitSlop={6}>
          <Ionicons name="pencil" size={16} color="#03210F" />
        </TouchableOpacity>
      </View>

      <View style={styles.profileInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {data.displayName}
          </Text>
          {flag && <Text style={styles.flag}>{flag}</Text>}
        </View>

        <Text style={styles.handle} numberOfLines={1}>
          {data.handle}
        </Text>

        {globalRank !== null ? (
          <View style={styles.rankChip}>
            <Text style={styles.rankChipText}>מקום {globalRank.toLocaleString()} בעולם</Text>
            <Text style={styles.rankChipMedal}>🥇</Text>
          </View>
        ) : (
          <View style={[styles.rankChip, styles.rankChipEmpty]}>
            <Text style={[styles.rankChipText, styles.rankChipTextEmpty]}>
              עדיין ללא דירוג עולמי
            </Text>
            <Ionicons name="globe-outline" size={14} color={MUTED} />
          </View>
        )}
      </View>
    </View>
  );
}

function StatsCard({ data }: { data: ProfileData }) {
  const { stats } = data;

  if (stats.gradedPredictions === 0) {
    const waiting = stats.totalPredictions > 0;
    return (
      <View style={[styles.card, styles.statsCard]}>
        <EmptyState
          compact
          icon={waiting ? 'hourglass-outline' : 'stats-chart-outline'}
          title={waiting ? 'הניחושים שלך ממתינים לתוצאות' : 'עדיין אין סטטיסטיקות'}
          subtitle={
            waiting
              ? 'הנקודות, אחוז ההצלחה והדיוקים יופיעו כאן בסיום המשחקים'
              : 'שלח את הניחוש הראשון שלך כדי להתחיל לצבור נקודות'
          }
          actionLabel={waiting ? undefined : 'לניחושים'}
          onAction={waiting ? undefined : () => router.push('/predictions')}
        />
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, styles.statsCard, styles.statsRow]}
      activeOpacity={0.8}
      onPress={openMyStats}
      accessibilityLabel="פתח את הסטטיסטיקות שלי"
    >
      <StatItem
        icon={<Ionicons name="trophy" size={26} color={GOLD} />}
        value={stats.bestLeagueRank !== null ? String(stats.bestLeagueRank) : '—'}
        label="מקום בליגה"
      />
      <View style={styles.statDivider} />
      <StatItem
        icon={<MaterialCommunityIcons name="crown" size={28} color={GOLD} />}
        value={stats.totalPoints.toLocaleString()}
        label='סה"כ נקודות'
        valueColor="#FFFFFF"
      />
      <View style={styles.statDivider} />
      <StatItem
        icon={<Ionicons name="stats-chart" size={24} color={GREEN} />}
        value={stats.successRate !== null ? `${stats.successRate}%` : '—'}
        label="אחוז הצלחה"
      />
      <View style={styles.statDivider} />
      <StatItem
        icon={<MaterialCommunityIcons name="bullseye-arrow" size={27} color={GREEN} />}
        value={stats.exactPredictions.toLocaleString()}
        label="ניחושים מדויקים"
      />
    </TouchableOpacity>
  );
}

function StatItem({
  icon,
  value,
  label,
  valueColor = GREEN,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.statItem}>
      {icon}
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function SectionHeader({
  icon,
  title,
  onShowAll,
  showAllLabel = 'הצג הכל',
}: {
  icon: ReactNode;
  title: string;
  onShowAll?: () => void;
  showAllLabel?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      {onShowAll && (
        <TouchableOpacity style={styles.showAll} onPress={onShowAll} hitSlop={8}>
          <Text style={styles.showAllText}>{showAllLabel}</Text>
          <Ionicons name="chevron-back" size={15} color={GREEN} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const tierIndex = (tier: AchievementTier) => ACHIEVEMENT_TIERS.indexOf(tier);

// Collapsed row: earned badges first (hardest first), then the next ones to chase (easiest first)
function previewOrder(achievements: Achievement[]) {
  const unlocked = achievements
    .filter((a) => a.unlocked)
    .sort((a, b) => tierIndex(b.tier) - tierIndex(a.tier));
  const locked = achievements
    .filter((a) => !a.unlocked)
    .sort((a, b) => tierIndex(a.tier) - tierIndex(b.tier) || b.progress / b.goal - a.progress / a.goal);
  return [...unlocked, ...locked];
}

function AchievementsSection({ achievements }: { achievements: Achievement[] }) {
  const [expanded, setExpanded] = useState(false);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <View style={styles.section}>
      <SectionHeader
        icon={<Ionicons name="trophy" size={20} color={GOLD} />}
        title={`הישגים · ${unlockedCount}/${achievements.length}`}
        onShowAll={() => setExpanded((v) => !v)}
        showAllLabel={expanded ? 'הצג פחות' : 'הצג הכל'}
      />

      <View style={styles.tierLegend}>
        {ACHIEVEMENT_TIERS.map((tier) => (
          <View key={tier} style={styles.tierLegendItem}>
            <View style={[styles.tierDot, { backgroundColor: TIER_STYLE[tier].color }]} />
            <Text style={styles.tierLegendText}>{TIER_STYLE[tier].label}</Text>
          </View>
        ))}
      </View>

      {expanded ? (
        ACHIEVEMENT_TIERS.map((tier) => {
          const inTier = achievements.filter((a) => a.tier === tier);
          if (inTier.length === 0) return null;
          const earned = inTier.filter((a) => a.unlocked).length;
          return (
            <View key={tier} style={styles.tierGroup}>
              <View style={styles.tierHeader}>
                <View style={[styles.tierBar, { backgroundColor: TIER_STYLE[tier].color }]} />
                <Text style={styles.tierTitle}>{TIER_STYLE[tier].label}</Text>
                <Text style={styles.tierCount}>
                  {earned}/{inTier.length}
                </Text>
              </View>
              <View style={styles.achievementsGrid}>
                {inTier.map((a) => (
                  <AchievementBadge key={a.id} achievement={a} />
                ))}
              </View>
            </View>
          );
        })
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.achievementsRow}
        >
          {previewOrder(achievements).map((a) => (
            <AchievementBadge key={a.id} achievement={a} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function AchievementBadge({ achievement }: { achievement: Achievement }) {
  const icon = ACHIEVEMENT_ICONS[achievement.id];
  const tier = TIER_STYLE[achievement.tier];
  const { unlocked } = achievement;
  const showProgress = !unlocked && achievement.goal > 1 && achievement.progress > 0;

  return (
    <View
      style={[
        styles.badge,
        unlocked
          ? { backgroundColor: `${tier.color}1F`, borderColor: `${tier.color}99` }
          : { ...styles.badgeLocked, borderColor: `${tier.color}40` },
      ]}
      accessible
      accessibilityLabel={`${achievement.title}, ${tier.label}, ${unlocked ? 'הושג' : 'נעול'}. ${achievement.description}`}
    >
      <View style={styles.hexWrap}>
        <MaterialCommunityIcons
          name="hexagon"
          size={60}
          color={unlocked ? `${tier.color}40` : '#141D19'}
          style={StyleSheet.absoluteFill}
        />
        <MaterialCommunityIcons
          name="hexagon-outline"
          size={60}
          color={unlocked ? tier.color : `${tier.color}66`}
          style={StyleSheet.absoluteFill}
        />
        <MaterialCommunityIcons
          name={unlocked ? icon : 'lock'}
          size={24}
          color={unlocked ? tier.color : '#7B8781'}
        />
      </View>

      <Text style={[styles.badgeTitle, !unlocked && styles.badgeTitleLocked]} numberOfLines={1}>
        {achievement.title}
      </Text>
      <Text style={styles.badgeDescription} numberOfLines={2}>
        {showProgress
          ? `${achievement.progress}/${achievement.goal} · ${achievement.description}`
          : achievement.description}
      </Text>

      <View style={styles.tierChip}>
        <View style={[styles.tierDot, { backgroundColor: tier.color }]} />
        <Text style={styles.tierChipText}>{tier.label}</Text>
      </View>
    </View>
  );
}

function LeaguesSection({ leagues }: { leagues: ProfileLeague[] }) {
  return (
    <View style={styles.section}>
      <SectionHeader
        icon={<Ionicons name="people" size={21} color={GREEN} />}
        title="הליגות שלי"
        onShowAll={
          leagues.length > 0
            ? () => router.push({ pathname: '/leaderboard', params: { tab: 'friends' } })
            : undefined
        }
      />

      {leagues.length === 0 ? (
        <View style={styles.card}>
          <EmptyState
            compact
            icon="people-outline"
            title="עדיין לא הצטרפת לליגות"
            subtitle="צור ליגה פרטית, הזמן חברים והתחילו להתחרות"
            actionLabel="צור ליגה"
            onAction={() => router.push('/create-league')}
          />
        </View>
      ) : (
        leagues
          .slice(0, LEAGUES_PREVIEW)
          .map((league) => <LeagueRow key={league.id} league={league} />)
      )}
    </View>
  );
}

function LeagueRow({ league }: { league: ProfileLeague }) {
  const medal = league.rank !== null && league.rank <= 3 ? MEDALS[league.rank - 1] : null;

  return (
    <TouchableOpacity
      style={[styles.card, styles.leagueRow]}
      activeOpacity={0.8}
      onPress={() => router.push({ pathname: '/league/[id]', params: { id: String(league.id) } })}
    >
      <View style={styles.leagueIcon}>
        {league.imageUrl ? (
          <Image source={{ uri: league.imageUrl }} style={styles.leagueImage} />
        ) : league.isOwner ? (
          <MaterialCommunityIcons name="crown" size={20} color={GOLD} />
        ) : (
          <Ionicons name="people" size={19} color="#E6EEE9" />
        )}
      </View>

      <View style={styles.leagueInfo}>
        <Text style={styles.leagueName} numberOfLines={1}>
          {league.name}
        </Text>
        <Text style={styles.leagueMeta}>
          {league.memberCount} {league.memberCount === 1 ? 'משתתף' : 'משתתפים'}
        </Text>
      </View>

      {medal && <Text style={styles.leagueMedal}>{medal}</Text>}

      <View style={styles.leagueRank}>
        {league.rank !== null ? (
          <Text style={styles.leagueRankText}>מקום {league.rank}</Text>
        ) : (
          <Text style={[styles.leagueRankText, styles.leagueRankEmpty]}>טרם דורג</Text>
        )}
        <Text style={styles.leagueMeta}>{league.points.toLocaleString()} נקודות</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#C9D4CE" />
    </TouchableOpacity>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  danger = false,
  last = false,
}: {
  icon: IoniconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const color = danger ? '#FF5A5F' : '#FFFFFF';

  return (
    <TouchableOpacity
      style={[styles.menuRow, !last && styles.menuRowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={21} color={color} />
      <Text style={[styles.menuLabel, { color }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#C9D4CE" />
    </TouchableOpacity>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  compact = false,
}: {
  icon: IoniconName;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.empty, compact && styles.emptyCompact]}>
      <Ionicons name={icon} size={compact ? 34 : 52} color="#42624D" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.emptyButton} onPress={onAction}>
          <Text style={styles.emptyButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 340,
    width: '100%',
    opacity: 0.55,
  },
  heroFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 340,
    experimental_backgroundImage: `linear-gradient(180deg, rgba(4,10,7,0.15) 0%, rgba(4,10,7,0.55) 55%, ${BG} 100%)`,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logo: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  logoGreen: {
    color: GREEN,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 28,
  },

  // Profile header
  profileRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  avatarWrap: {
    width: 116,
    height: 116,
  },
  avatarRing: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 3,
    borderColor: GREEN,
    padding: 3,
    boxShadow: '0 0 18px rgba(0, 230, 118, 0.55)',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 55,
  },
  avatarPlaceholder: {
    backgroundColor: '#13281C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GREEN,
    borderWidth: 3,
    borderColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  nameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    flexShrink: 1,
  },
  flag: {
    fontSize: 22,
  },
  handle: {
    color: '#A9B8AF',
    fontSize: 14,
    marginTop: 2,
  },
  rankChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(20, 30, 24, 0.9)',
    borderWidth: 1,
    borderColor: '#2E4237',
  },
  rankChipEmpty: {
    borderStyle: 'dashed',
  },
  rankChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  rankChipTextEmpty: {
    color: MUTED,
    fontWeight: '600',
  },
  rankChipMedal: {
    fontSize: 14,
  },

  // Cards
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  statsCard: {
    borderColor: '#1F5A37',
    boxShadow: '0 0 14px rgba(0, 230, 118, 0.12)',
  },
  statsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },
  statLabel: {
    color: '#B8C6BE',
    fontSize: 11,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 58,
    backgroundColor: '#1E3427',
  },

  // Sections
  section: {
    marginTop: 22,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  showAll: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
  },
  showAllText: {
    color: GREEN,
    fontSize: 13,
    fontWeight: '700',
  },

  // Achievements
  achievementsRow: {
    gap: 8,
  },
  achievementsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    width: 104,
    minHeight: 150,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 6,
  },
  badgeLocked: {
    backgroundColor: '#0C1410',
    borderColor: '#22302A',
  },
  hexWrap: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
    textAlign: 'center',
  },
  badgeTitleLocked: {
    color: '#A5B1AB',
  },
  badgeDescription: {
    color: MUTED,
    fontSize: 10,
    marginTop: 3,
    textAlign: 'center',
  },
  tierChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: 'auto',
    paddingTop: 6,
  },
  tierChipText: {
    color: '#C9D4CE',
    fontSize: 10,
    fontWeight: '800',
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tierLegend: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: -2,
    marginBottom: 10,
  },
  tierLegendItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  tierLegendText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
  },
  tierGroup: {
    marginBottom: 14,
  },
  tierHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tierBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  tierTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  tierCount: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },

  // Leagues
  leagueRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  leagueIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#18241D',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  leagueImage: {
    width: '100%',
    height: '100%',
  },
  leagueInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  leagueName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  leagueMeta: {
    color: MUTED,
    fontSize: 12,
    marginTop: 3,
  },
  leagueMedal: {
    fontSize: 20,
  },
  leagueRank: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  leagueRankText: {
    color: GREEN,
    fontSize: 15,
    fontWeight: '900',
  },
  leagueRankEmpty: {
    color: MUTED,
    fontWeight: '700',
  },

  // Menu
  menuCard: {
    marginTop: 14,
    paddingHorizontal: 14,
  },
  menuRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 15,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#17271E',
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },

  // Empty states
  empty: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyCompact: {
    paddingVertical: 20,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 10,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: MUTED,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyButton: {
    marginTop: 14,
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  emptyButtonText: {
    color: '#002710',
    fontSize: 14,
    fontWeight: '900',
  },
});
