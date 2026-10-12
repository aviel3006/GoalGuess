import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TeamLogo } from '../components/team-logo';
import {
  useMyStats,
  type GradedPrediction,
  type Outcome,
  type RoundStat,
  type SeasonStats,
} from '../hooks/use-my-stats';

export { ScreenErrorBoundary as ErrorBoundary } from '../components/screen-error';

const GREEN = '#00E676';
const GOLD = '#F5C542';
const BG = '#040A07';
const CARD = 'rgba(12, 22, 16, 0.94)';
const CARD_BORDER = '#1B3626';
const MUTED = '#8FA398';
const HISTORY_PREVIEW = 10;

const CHART_HEIGHT = 120;
const BAR_WIDTH = 18;
const BAR_GAP = 8;

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// Checked with the dataviz palette validator against the card surface (dark mode):
// lightness band, colorblind separation and contrast all pass. Same order as the rules screen.
const OUTCOMES: Record<Outcome, { label: string; color: string; icon: IoniconName; points: string }> =
  {
    exact: { label: 'תוצאה מדויקת', color: '#16A34A', icon: 'locate', points: '+5' },
    direction: { label: 'כיוון נכון', color: '#3B82F6', icon: 'checkmark-circle', points: '+3' },
    wrong: { label: 'ניחוש שגוי', color: '#EF4444', icon: 'close-circle', points: '0' },
  };
const OUTCOME_ORDER: Outcome[] = ['exact', 'direction', 'wrong'];

export default function MyStatsScreen() {
  const insets = useSafeAreaInsets();
  const { state, refreshing, load } = useMyStats();
  const [seasonIndex, setSeasonIndex] = useState(0);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const seasons = state.status === 'ready' ? state.seasons : [];
  const stats = seasons[Math.min(seasonIndex, seasons.length - 1)];

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="חזרה">
          <Ionicons name="arrow-forward" size={25} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>הסטטיסטיקות שלי</Text>
        <View style={styles.topBarSpace} />
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
            title="לא הצלחנו לטעון את הסטטיסטיקות"
            subtitle="בדוק את החיבור לאינטרנט ונסה שוב"
            actionLabel="נסה שוב"
            onAction={() => load()}
          />
        </View>
      )}

      {state.status === 'ready' && !stats && (
        <View style={styles.centered}>
          <EmptyState
            icon="stats-chart-outline"
            title="עדיין אין סטטיסטיקות"
            subtitle="שלח את הניחוש הראשון שלך, והנתונים יופיעו כאן בסיום המשחקים"
            actionLabel="לניחושים"
            onAction={() => router.push('/predictions')}
          />
        </View>
      )}

      {state.status === 'ready' && stats && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load('refresh')}
              tintColor={GREEN}
              colors={[GREEN]}
            />
          }
        >
          {seasons.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.seasonChips}
            >
              {seasons.map((s, index) => (
                <TouchableOpacity
                  key={s.season}
                  style={[styles.chip, s === stats && styles.chipSelected]}
                  onPress={() => setSeasonIndex(index)}
                >
                  <Text style={[styles.chipText, s === stats && styles.chipTextSelected]}>
                    עונת {s.season}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <SeasonView key={stats.season} stats={stats} />
        </ScrollView>
      )}
    </View>
  );
}

function SeasonView({ stats }: { stats: SeasonStats }) {
  if (stats.graded === 0) {
    return (
      <View style={styles.card}>
        <EmptyState
          compact
          icon="hourglass-outline"
          title="הניחושים שלך ממתינים לתוצאות"
          subtitle={`${stats.pending} ${stats.pending === 1 ? 'ניחוש ממתין' : 'ניחושים ממתינים'} לסיום המשחקים. הנתונים יופיעו כאן אחרי שייקבעו התוצאות.`}
        />
      </View>
    );
  }

  return (
    <>
      <View style={[styles.card, styles.hero]}>
        <MaterialCommunityIcons name="crown" size={30} color={GOLD} />
        <Text style={styles.heroValue}>{stats.totalPoints.toLocaleString()}</Text>
        <Text style={styles.heroLabel}>
          נקודות ב-{stats.graded} {stats.graded === 1 ? 'משחק' : 'משחקים'}
        </Text>
        {stats.pending > 0 && (
          <View style={styles.pendingChip}>
            <Ionicons name="hourglass-outline" size={13} color={MUTED} />
            <Text style={styles.pendingText}>
              עוד {stats.pending} {stats.pending === 1 ? 'ניחוש ממתין' : 'ניחושים ממתינים'} לתוצאה
            </Text>
          </View>
        )}
      </View>

      <View style={styles.tiles}>
        <Tile
          icon={<Ionicons name="stats-chart" size={20} color={GREEN} />}
          value={stats.successRate !== null ? `${stats.successRate}%` : '—'}
          label="אחוז הצלחה"
        />
        <Tile
          icon={<Ionicons name="football" size={20} color={GREEN} />}
          value={stats.averagePoints !== null ? stats.averagePoints.toFixed(1) : '—'}
          label="נקודות למשחק"
        />
        <Tile
          icon={<MaterialCommunityIcons name="fire" size={22} color="#FF8A3D" />}
          value={String(stats.currentStreak)}
          label="רצף נוכחי"
        />
        <Tile
          icon={<Ionicons name="ribbon" size={20} color={GOLD} />}
          value={String(stats.bestStreak)}
          label="רצף שיא"
        />
      </View>

      <OutcomeBreakdown stats={stats} />
      <RoundsChart rounds={stats.rounds} bestRound={stats.bestRound} />
      <TopTeams stats={stats} />
      <History history={stats.history} />
    </>
  );
}

function Tile({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <View style={[styles.card, styles.tile]}>
      {icon}
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      {icon}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function OutcomeBreakdown({ stats }: { stats: SeasonStats }) {
  const counts: Record<Outcome, number> = {
    exact: stats.exact,
    direction: stats.direction,
    wrong: stats.wrong,
  };

  return (
    <View style={styles.section}>
      <SectionTitle
        icon={<MaterialCommunityIcons name="bullseye-arrow" size={21} color={GREEN} />}
        title="פילוח הניחושים"
      />

      <View style={[styles.card, styles.breakdownCard]}>
        <View
          style={styles.stackedBar}
          accessible
          accessibilityLabel={OUTCOME_ORDER.map((o) => `${OUTCOMES[o].label}: ${counts[o]}`).join(', ')}
        >
          {OUTCOME_ORDER.filter((o) => counts[o] > 0).map((o) => (
            <View
              key={o}
              style={[styles.stackedSegment, { flex: counts[o], backgroundColor: OUTCOMES[o].color }]}
            />
          ))}
        </View>

        {OUTCOME_ORDER.map((o) => {
          const percent = Math.round((counts[o] / stats.graded) * 100);
          return (
            <View key={o} style={styles.legendRow}>
              <Ionicons name={OUTCOMES[o].icon} size={18} color={OUTCOMES[o].color} />
              <Text style={styles.legendLabel}>{OUTCOMES[o].label}</Text>
              <Text style={styles.legendPoints}>{OUTCOMES[o].points}</Text>
              <Text style={styles.legendCount}>{counts[o]}</Text>
              <Text style={styles.legendPercent}>{percent}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function RoundsChart({ rounds, bestRound }: { rounds: RoundStat[]; bestRound: RoundStat | null }) {
  const [selected, setSelected] = useState<number>(rounds[rounds.length - 1]?.round ?? 0);
  const selectedRound = rounds.find((r) => r.round === selected) ?? rounds[rounds.length - 1];
  const max = Math.max(1, ...rounds.map((r) => r.points));

  return (
    <View style={styles.section}>
      <SectionTitle
        icon={<Ionicons name="bar-chart" size={20} color={GREEN} />}
        title="נקודות לפי מחזור"
      />

      <View style={[styles.card, styles.chartCard]}>
        {selectedRound && (
          <View style={styles.chartReadout}>
            <Text style={styles.chartReadoutTitle}>מחזור {selectedRound.round}</Text>
            <Text style={styles.chartReadoutValue}>
              {selectedRound.points} נקודות · {selectedRound.games}{' '}
              {selectedRound.games === 1 ? 'משחק' : 'משחקים'}
            </Text>
          </View>
        )}

        <View style={styles.chartArea}>
          <View style={styles.chartScale}>
            <Text style={styles.chartScaleText}>{max}</Text>
            <Text style={styles.chartScaleText}>0</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flex}>
            <View>
              <View style={styles.chartGridTop} />
              {/* Latest round on the left, so it's in view without scrolling */}
              <View style={styles.bars}>
                {rounds.map((r) => {
                  const isSelected = r.round === selectedRound?.round;
                  const height = r.points > 0 ? Math.max(4, (r.points / max) * CHART_HEIGHT) : 2;
                  return (
                    <TouchableOpacity
                      key={r.round}
                      style={styles.barSlot}
                      onPress={() => setSelected(r.round)}
                      hitSlop={{ top: 10, bottom: 10, left: BAR_GAP / 2, right: BAR_GAP / 2 }}
                      accessibilityLabel={`מחזור ${r.round}: ${r.points} נקודות`}
                    >
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.bar,
                            { height, backgroundColor: r.points > 0 ? GREEN : '#2E4237' },
                            !isSelected && styles.barDimmed,
                          ]}
                        />
                      </View>
                      <Text style={[styles.barLabel, isSelected && styles.barLabelSelected]}>
                        {r.round}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </View>

        {bestRound && (
          <View style={styles.bestRound}>
            <Ionicons name="trophy" size={16} color={GOLD} />
            <Text style={styles.bestRoundText}>
              המחזור הכי טוב שלך: מחזור {bestRound.round} עם {bestRound.points} נקודות
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function TopTeams({ stats }: { stats: SeasonStats }) {
  if (stats.topTeams.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionTitle
        icon={<Ionicons name="shield-checkmark" size={20} color={GREEN} />}
        title="הקבוצות שהכי משתלמות לך"
      />

      <View style={[styles.card, styles.listCard]}>
        {stats.topTeams.map((team, index) => (
          <View
            key={team.name}
            style={[styles.teamRow, index < stats.topTeams.length - 1 && styles.rowBorder]}
          >
            <Text style={styles.teamRank}>{index + 1}</Text>
            <TeamLogo badge={team.badge} size={34} />
            <View style={styles.teamInfo}>
              <Text style={styles.teamName} numberOfLines={1}>
                {team.name}
              </Text>
              <Text style={styles.teamMeta}>
                {team.games} {team.games === 1 ? 'משחק' : 'משחקים'}
              </Text>
            </View>
            <Text style={styles.teamPoints}>{team.points} נק׳</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function History({ history }: { history: GradedPrediction[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? history : history.slice(0, HISTORY_PREVIEW);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderSpread}>
        <SectionTitle
          icon={<Ionicons name="time" size={20} color={GREEN} />}
          title="היסטוריית ניחושים"
        />
        {history.length > HISTORY_PREVIEW && (
          <TouchableOpacity onPress={() => setExpanded((v) => !v)} hitSlop={8}>
            <Text style={styles.showAllText}>{expanded ? 'הצג פחות' : 'הצג הכל'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.card, styles.listCard]}>
        {visible.map((g, index) => (
          <HistoryRow key={g.matchId} game={g} last={index === visible.length - 1} />
        ))}
      </View>
    </View>
  );
}

function HistoryRow({ game, last }: { game: GradedPrediction; last: boolean }) {
  const outcome = OUTCOMES[game.outcome];
  const date = new Date(game.kickoffTime).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'numeric',
  });

  return (
    <TouchableOpacity
      style={[styles.historyRow, !last && styles.rowBorder]}
      activeOpacity={0.75}
      onPress={() => router.push({ pathname: '/match/[id]', params: { id: String(game.matchId) } })}
    >
      <View style={styles.historyMatch}>
        <Text style={styles.historyMeta}>
          מחזור {game.round} · {date}
        </Text>

        <View style={styles.historyTeams}>
          <TeamLogo badge={game.homeBadge} size={24} />
          <Text style={styles.historyTeam} numberOfLines={1}>
            {game.homeTeam}
          </Text>
          <Text style={styles.historyScore}>
            {game.homeScore}-{game.awayScore}
          </Text>
          <Text style={styles.historyTeam} numberOfLines={1}>
            {game.awayTeam}
          </Text>
          <TeamLogo badge={game.awayBadge} size={24} />
        </View>

        <Text style={styles.historyGuess}>
          הניחוש שלך: {game.predictedHome}-{game.predictedAway}
        </Text>
      </View>

      <View style={[styles.pointsPill, { borderColor: outcome.color }]}>
        <Ionicons name={outcome.icon} size={14} color={outcome.color} />
        <Text style={styles.pointsPillText}>{game.points > 0 ? `+${game.points}` : '0'}</Text>
      </View>
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
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  topBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  topBarSpace: {
    width: 25,
  },
  topTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },

  // Season chips
  seasonChips: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2E4237',
    backgroundColor: 'rgba(20, 30, 24, 0.9)',
  },
  chipSelected: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: '#03210F',
  },

  // Cards
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 18,
    borderColor: '#1F5A37',
    boxShadow: '0 0 14px rgba(0, 230, 118, 0.12)',
  },
  heroValue: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '900',
    marginTop: 2,
  },
  heroLabel: {
    color: '#B8C6BE',
    fontSize: 14,
    fontWeight: '600',
  },
  pendingChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2E4237',
    borderStyle: 'dashed',
  },
  pendingText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },

  // Tiles
  tiles: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginTop: 10,
  },
  tile: {
    width: '48.5%',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 4,
  },
  tileValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  tileLabel: {
    color: '#B8C6BE',
    fontSize: 12,
    fontWeight: '600',
  },

  // Sections
  section: {
    marginTop: 22,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionHeaderSpread: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  showAllText: {
    color: GREEN,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },

  // Outcome breakdown
  breakdownCard: {
    padding: 14,
  },
  stackedBar: {
    flexDirection: 'row-reverse',
    height: 14,
    gap: 2,
    marginBottom: 8,
  },
  stackedSegment: {
    borderRadius: 4,
  },
  legendRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
  },
  legendLabel: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  legendPoints: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 26,
    textAlign: 'center',
  },
  legendCount: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    minWidth: 30,
    textAlign: 'center',
  },
  legendPercent: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'left',
  },

  // Rounds chart
  chartCard: {
    padding: 14,
  },
  chartReadout: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  chartReadoutTitle: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  chartReadoutValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  chartArea: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  chartScale: {
    height: CHART_HEIGHT,
    justifyContent: 'space-between',
  },
  chartScaleText: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'right',
  },
  chartGridTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#17271E',
  },
  bars: {
    flexDirection: 'row-reverse',
    gap: BAR_GAP,
  },
  barSlot: {
    width: BAR_WIDTH,
    alignItems: 'center',
  },
  barTrack: {
    height: CHART_HEIGHT,
    width: BAR_WIDTH,
    justifyContent: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#2E4237',
  },
  bar: {
    width: BAR_WIDTH,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barDimmed: {
    opacity: 0.45,
  },
  barLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  barLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  bestRound: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#17271E',
  },
  bestRoundText: {
    flex: 1,
    color: '#E6EEE9',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },

  // Lists
  listCard: {
    paddingHorizontal: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#17271E',
  },
  teamRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
  },
  teamRank: {
    color: MUTED,
    fontSize: 15,
    fontWeight: '900',
    width: 16,
    textAlign: 'center',
  },
  teamInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  teamName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  teamMeta: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
  },
  teamPoints: {
    color: GREEN,
    fontSize: 15,
    fontWeight: '900',
  },

  // History
  historyRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  historyMatch: {
    flex: 1,
    alignItems: 'flex-end',
  },
  historyMeta: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '600',
  },
  historyTeams: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    alignSelf: 'stretch',
  },
  historyTeam: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  historyScore: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    paddingHorizontal: 4,
  },
  historyGuess: {
    color: '#B8C6BE',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  pointsPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    minWidth: 54,
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    backgroundColor: '#0C1410',
  },
  pointsPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
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
