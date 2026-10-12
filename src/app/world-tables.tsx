import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { useSession } from '../hooks/use-session';
import { supabase } from '../supabase';
import {
  leagueLogoUrl,
  teamLogoUrl,
  type StandingRow,
  type WorldLeague,
} from '../utils/world-leagues';

const GREEN = '#00E676';
const BG = '#040A07';
const MUTED = '#8FA398';

const FORM_COLORS = { W: '#00C853', D: '#8A8F8C', L: '#E53935' };

type LoadState = 'loading' | 'error' | 'ready';

function updatedAgo(iso: string | null, now: number) {
  if (!iso) return 'ממתין לעדכון ראשון';
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'עודכן עכשיו';
  if (minutes < 60) return `עודכן לפני ${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  return `עודכן לפני ${hours} שע׳`;
}

export default function WorldTablesScreen() {
  const insets = useSafeAreaInsets();
  const { favoriteLeagues } = useSession();
  // A new array on every render, so effects key on this string instead
  const favoritesKey = (favoriteLeagues ?? []).join(',');

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [leagues, setLeagues] = useState<WorldLeague[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const chipsRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    const ids = favoritesKey ? favoritesKey.split(',').map(Number) : [];
    const { data, error } = await supabase
      .from('world_leagues')
      .select('id, name, country, image_version, standings, updated_at')
      .in('id', ids)
      .order('sort_order');

    if (error) {
      console.error('Load world tables error:', error);
      setLoadState((current) => (current === 'ready' ? current : 'error'));
      return;
    }

    const loaded = (data ?? []) as WorldLeague[];
    setLeagues(loaded);
    setSelectedId((current) =>
      current !== null && loaded.some((l) => l.id === current) ? current : loaded[0]?.id ?? null
    );
    setNow(Date.now());
    setLoadState('ready');
  }, [favoritesKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // The sync job rewrites the standings every few minutes; take them as they land
  useEffect(() => {
    if (!favoritesKey) return;
    const channel = supabase
      .channel('world-standings')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'world_leagues',
          filter: `id=in.(${favoritesKey})`,
        },
        (payload) => {
          const updated = payload.new as WorldLeague;
          setLeagues((current) =>
            current.map((l) => (l.id === updated.id ? { ...l, ...updated } : l))
          );
          setNow(Date.now());
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [favoritesKey]);

  // Keeps "updated X minutes ago" current
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const league = useMemo(
    () => leagues.find((l) => l.id === selectedId) ?? null,
    [leagues, selectedId]
  );

  const destinationColors = useMemo(() => {
    const colors = new Map<number, string>();
    for (const d of league?.standings?.destinations ?? []) colors.set(d.num, d.color);
    return colors;
  }, [league]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const renderRow = (row: StandingRow, index: number) => {
    const zoneColor = row.destination !== null ? destinationColors.get(row.destination) : undefined;
    return (
      <View key={row.team_id} style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
        <View style={[styles.zone, zoneColor ? { backgroundColor: zoneColor } : null]} />
        <Text style={[styles.cell, styles.positionColumn, styles.position]}>{row.position}</Text>
        <View style={[styles.teamColumn, styles.team]}>
          <Image
            source={{ uri: teamLogoUrl(row.team_id, row.image_version) }}
            style={styles.teamLogo}
            contentFit="contain"
          />
          <View style={styles.teamText}>
            <Text style={styles.teamName} numberOfLines={1}>
              {row.short_name ?? row.name}
            </Text>
            {row.form.length > 0 && (
              <View style={styles.form}>
                {/* Newest result first, read right to left */}
                {row.form.map((result, i) => (
                  <View key={i} style={[styles.formDot, { backgroundColor: FORM_COLORS[result] }]} />
                ))}
              </View>
            )}
          </View>
        </View>
        <Text style={[styles.cell, styles.numberColumn]}>{row.played}</Text>
        <Text style={[styles.cell, styles.numberColumn]}>{row.won}</Text>
        <Text style={[styles.cell, styles.numberColumn]}>{row.drawn}</Text>
        <Text style={[styles.cell, styles.numberColumn]}>{row.lost}</Text>
        <Text style={[styles.cell, styles.diffColumn]}>
          {row.goals_for - row.goals_against > 0 ? '+' : ''}
          {row.goals_for - row.goals_against}
        </Text>
        <Text style={[styles.cell, styles.pointsColumn, styles.points]}>{row.points}</Text>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={goBack} hitSlop={10}>
          <Ionicons name="arrow-forward" size={25} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.title}>טבלאות מהעולם 🌍</Text>

        <TouchableOpacity
          onPress={() => router.push('/edit-leagues')}
          hitSlop={10}
          accessibilityLabel="בחירת ליגות"
        >
          <Ionicons name="options-outline" size={24} color={GREEN} />
        </TouchableOpacity>
      </View>

      {loadState === 'loading' && (
        <ActivityIndicator size="large" color={GREEN} style={styles.loader} />
      )}

      {loadState === 'error' && (
        <View style={styles.empty}>
          <Ionicons name="cloud-offline-outline" size={52} color="#42624D" />
          <Text style={styles.emptyTitle}>לא הצלחנו לטעון את הטבלאות</Text>
          <Text style={styles.emptySubtitle}>בדוק את החיבור לאינטרנט ונסה שוב</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>נסה שוב</Text>
          </TouchableOpacity>
        </View>
      )}

      {loadState === 'ready' && (
        <>
          <ScrollView
            ref={chipsRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chips}
            // Chips run right to left, so start scrolled to the right edge
            onContentSizeChange={() => chipsRef.current?.scrollToEnd({ animated: false })}
          >
            {leagues.map((l) => {
              const isSelected = l.id === selectedId;
              return (
                <TouchableOpacity
                  key={l.id}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => setSelectedId(l.id)}
                >
                  <Image
                    source={{ uri: leagueLogoUrl(l.id, l.image_version) }}
                    style={styles.chipLogo}
                    contentFit="contain"
                  />
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {l.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor={GREEN}
                colors={[GREEN]}
              />
            }
          >
            {league && (
              <View style={styles.leagueHeader}>
                <Image
                  source={{ uri: leagueLogoUrl(league.id, league.image_version) }}
                  style={styles.leagueLogo}
                  contentFit="contain"
                />
                <View style={styles.leagueHeaderText}>
                  <Text style={styles.leagueName}>{league.name}</Text>
                  <Text style={styles.leagueCountry}>{league.country}</Text>
                </View>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>{updatedAgo(league.updated_at, now)}</Text>
                </View>
              </View>
            )}

            {league && !league.standings && (
              <Text style={styles.noTable}>הטבלה של הליגה הזו עוד לא זמינה. נסו שוב בעוד כמה דקות.</Text>
            )}

            {league?.standings?.groups.map((group, groupIndex) => (
              <View key={groupIndex} style={styles.table}>
                {group.name && <Text style={styles.groupName}>{group.name}</Text>}

                <View style={styles.tableHeader}>
                  <View style={styles.zone} />
                  <Text style={[styles.headerText, styles.positionColumn]}>#</Text>
                  <Text style={[styles.headerText, styles.teamColumn, styles.teamHeader]}>קבוצה</Text>
                  <Text style={[styles.headerText, styles.numberColumn]}>מש׳</Text>
                  <Text style={[styles.headerText, styles.numberColumn]}>נ</Text>
                  <Text style={[styles.headerText, styles.numberColumn]}>ת</Text>
                  <Text style={[styles.headerText, styles.numberColumn]}>ה</Text>
                  <Text style={[styles.headerText, styles.diffColumn]}>הפרש</Text>
                  <Text style={[styles.headerText, styles.pointsColumn]}>נק׳</Text>
                </View>

                {group.rows.map(renderRow)}
              </View>
            ))}

            {league?.standings && league.standings.destinations.length > 0 && (
              <View style={styles.legend}>
                {league.standings.destinations.map((d) => (
                  <View key={d.num} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                    <Text style={styles.legendText}>{d.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },

  topBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },

  loader: {
    marginTop: 80,
  },

  chipsScroll: {
    flexGrow: 0,
  },

  chips: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },

  chip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#101814',
    borderWidth: 1,
    borderColor: '#1E2A23',
  },

  chipSelected: {
    backgroundColor: '#0E2117',
    borderColor: GREEN,
  },

  chipLogo: {
    width: 20,
    height: 20,
  },

  chipText: {
    color: '#C9D3CD',
    fontSize: 13,
    fontWeight: '700',
  },

  chipTextSelected: {
    color: GREEN,
  },

  content: {
    paddingHorizontal: 12,
    paddingTop: 10,
  },

  leagueHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
    marginBottom: 12,
  },

  leagueLogo: {
    width: 46,
    height: 46,
  },

  leagueHeaderText: {
    flex: 1,
  },

  leagueName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'right',
  },

  leagueCountry: {
    color: MUTED,
    fontSize: 13,
    textAlign: 'right',
  },

  liveBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#0E1A13',
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: GREEN,
  },

  liveText: {
    color: '#A8C3B3',
    fontSize: 11,
    fontWeight: '600',
  },

  noTable: {
    color: MUTED,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },

  table: {
    backgroundColor: '#0B120E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#18231D',
    overflow: 'hidden',
    marginBottom: 14,
  },

  groupName: {
    color: GREEN,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },

  tableHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#18231D',
  },

  headerText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },

  teamHeader: {
    textAlign: 'right',
  },

  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    minHeight: 46,
    paddingLeft: 6,
  },

  rowAlt: {
    backgroundColor: '#0E1712',
  },

  zone: {
    width: 3,
    alignSelf: 'stretch',
    marginLeft: 4,
  },

  cell: {
    color: '#DDE5E0',
    fontSize: 13,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  positionColumn: {
    width: 24,
  },

  position: {
    color: MUTED,
    fontWeight: '700',
  },

  teamColumn: {
    flex: 1,
    paddingHorizontal: 6,
  },

  team: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },

  teamLogo: {
    width: 22,
    height: 22,
  },

  teamText: {
    flex: 1,
  },

  teamName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },

  form: {
    flexDirection: 'row-reverse',
    gap: 3,
    marginTop: 4,
  },

  formDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  numberColumn: {
    width: 24,
  },

  diffColumn: {
    width: 36,
  },

  pointsColumn: {
    width: 32,
  },

  points: {
    color: GREEN,
    fontWeight: '900',
  },

  legend: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 14,
    paddingHorizontal: 6,
    marginTop: 2,
  },

  legendItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },

  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },

  legendText: {
    color: MUTED,
    fontSize: 12,
  },

  empty: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 30,
    gap: 8,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },

  emptySubtitle: {
    color: MUTED,
    fontSize: 14,
  },

  retryButton: {
    marginTop: 10,
    backgroundColor: GREEN,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 26,
  },

  retryText: {
    color: '#04150B',
    fontWeight: '800',
  },
});
