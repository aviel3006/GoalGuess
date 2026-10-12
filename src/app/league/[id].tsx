import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlayerAvatar } from '../../components/player-avatar';
import { supabase } from '../../supabase';

const GREEN = '#00E676';
const GOLD = '#F5C542';
const BG = '#040A07';
const MUTED = '#8FA398';
const MEDAL_COLORS = ['#FFD54F', '#C0C0C0', '#CD8B52'];

type League = {
  id: number;
  name: string;
  image_url: string | null;
  invite_code: string;
};

// Returned by the get_league_leaderboard() database function
type Standing = {
  rank: number;
  display_name: string | null;
  points: number;
  exact_count: number;
  is_me: boolean;
  is_owner: boolean;
  avatar_url: string | null;
};

type LoadState = 'loading' | 'error' | 'ready';

function standingName(entry: Standing) {
  if (entry.is_me) return 'אתה';
  return entry.display_name ?? 'שחקן';
}

export default function LeagueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [league, setLeague] = useState<League | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);

  const load = useCallback(async () => {
    // RLS returns the league only to its members
    const [leagueRes, standingsRes] = await Promise.all([
      supabase.from('leagues').select('id, name, image_url, invite_code').eq('id', id).single(),
      supabase.rpc('get_league_leaderboard', { p_league_id: Number(id) }),
    ]);

    const error = leagueRes.error ?? standingsRes.error;
    if (error) {
      console.error('Load league error:', error);
      setLoadState('error');
      return;
    }

    setLeague(leagueRes.data as League);
    setStandings((standingsRes.data ?? []) as Standing[]);
    setLoadState('ready');
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace({ pathname: '/leaderboard', params: { tab: 'friends' } });
    }
  };

  const shareInvite = () => {
    if (!league) return;
    Share.share({
      message: `הצטרפו לליגה "${league.name}" ב-GoalGuess עם הקוד: ${league.invite_code}`,
    });
  };

  // Before the first graded match everyone is tied at 0, so ranks are hidden
  const hasScores = standings.some((entry) => entry.points > 0);

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
        <TouchableOpacity onPress={goBack} hitSlop={10}>
          <Ionicons name="arrow-forward" size={25} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.logo}>
          GOAL<Text style={styles.logoGreen}>GUESS</Text>
        </Text>

        <View style={styles.topBarSpace} />
      </View>

      {loadState === 'loading' && (
        <ActivityIndicator size="large" color={GREEN} style={styles.loader} />
      )}

      {loadState === 'error' && (
        <View style={styles.empty}>
          <Ionicons name="cloud-offline-outline" size={52} color="#42624D" />
          <Text style={styles.emptyTitle}>לא הצלחנו לטעון את הליגה</Text>
          <Text style={styles.emptySubtitle}>בדוק את החיבור לאינטרנט ונסה שוב</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>נסה שוב</Text>
          </TouchableOpacity>
        </View>
      )}

      {loadState === 'ready' && league && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={GREEN}
              colors={[GREEN]}
            />
          }
        >
          <View style={styles.leagueHeader}>
            <View style={styles.leagueImageRing}>
              <Image
                source={
                  league.image_url
                    ? { uri: league.image_url }
                    : require('../../../assets/images/default-league.png')
                }
                style={styles.leagueImage}
              />
            </View>

            <Text style={styles.leagueName}>{league.name}</Text>
            <Text style={styles.leagueMeta}>
              👥 {standings.length} {standings.length === 1 ? 'משתתף' : 'משתתפים'}
            </Text>

            <TouchableOpacity style={styles.inviteChip} onPress={shareInvite}>
              <Ionicons name="share-social" size={16} color={GREEN} />
              <Text style={styles.inviteCode}>{league.invite_code}</Text>
              <Text style={styles.inviteLabel}>הזמן חברים</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionTitleRow}>
            <Ionicons name="podium" size={21} color={GREEN} />
            <Text style={styles.sectionTitle}>טבלת הליגה</Text>
          </View>

          <View style={styles.tableNote}>
            <Ionicons name="time-outline" size={15} color="#8FA99A" />
            <Text style={styles.tableNoteText}>
              {hasScores
                ? 'נספרים ניחושים מרגע ההצטרפות לליגה'
                : 'הניקוד יתעדכן אוטומטית בסוף המשחק הראשון'}
            </Text>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerText, styles.rankColumn]}>מקום</Text>
              <Text style={[styles.headerText, styles.nameColumn]}>שם</Text>
              <Text style={[styles.headerText, styles.exactColumn]}>דיוקים</Text>
              <Text style={[styles.headerText, styles.pointsColumn]}>ניקוד</Text>
            </View>

            {standings.map((entry, index) => (
              <StandingRow key={index} entry={entry} showRank={hasScores} />
            ))}
          </View>

          {standings.length === 1 && (
            <View style={styles.inviteHint}>
              <Text style={styles.inviteHintText}>
                אתה לבד בליגה כרגע — שתף את קוד ההזמנה כדי שחברים יצטרפו
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function StandingRow({ entry, showRank }: { entry: Standing; showRank: boolean }) {
  const medalColor = showRank && entry.rank <= 3 ? MEDAL_COLORS[entry.rank - 1] : null;

  return (
    <View style={[styles.row, entry.is_me && styles.myRow]}>
      <View style={styles.rankColumn}>
        {medalColor ? (
          <Ionicons name="trophy" size={18} color={medalColor} style={styles.rankCell} />
        ) : (
          <Text style={[styles.rowRank, styles.rankCell]}>{showRank ? entry.rank : '–'}</Text>
        )}
      </View>

      <View style={[styles.rowNameWrap, styles.nameColumn]}>
        <PlayerAvatar uri={entry.avatar_url} size={27} />
        <Text style={styles.rowName} numberOfLines={1}>
          {standingName(entry)}
        </Text>
        {entry.is_owner && <MaterialCommunityIcons name="crown" size={15} color={GOLD} />}
      </View>

      <Text style={[styles.rowExact, styles.exactColumn]}>{entry.exact_count}</Text>
      <Text style={[styles.rowPoints, styles.pointsColumn]}>{entry.points.toLocaleString()}</Text>
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
    opacity: 0.45,
  },
  heroFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 340,
    experimental_backgroundImage: `linear-gradient(180deg, rgba(4,10,7,0.15) 0%, rgba(4,10,7,0.6) 55%, ${BG} 100%)`,
  },
  topBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  topBarSpace: {
    width: 25,
  },
  logo: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  logoGreen: {
    color: GREEN,
  },
  loader: {
    marginTop: 80,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 35,
  },

  // League header
  leagueHeader: {
    alignItems: 'center',
    marginBottom: 26,
  },
  leagueImageRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 3,
    borderColor: GREEN,
    padding: 3,
    boxShadow: '0 0 18px rgba(0, 230, 118, 0.5)',
  },
  leagueImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    backgroundColor: '#13281C',
  },
  leagueName: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 14,
  },
  leagueMeta: {
    color: '#A9B8AF',
    fontSize: 13,
    marginTop: 5,
  },
  inviteChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#24A53A',
    backgroundColor: 'rgba(11, 24, 16, 0.92)',
  },
  inviteLabel: {
    color: '#C9D4CE',
    fontSize: 13,
    fontWeight: '700',
  },
  inviteCode: {
    color: GREEN,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
  },

  // Table
  sectionTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
  },
  tableNote: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  tableNoteText: {
    color: '#8FA99A',
    fontSize: 12,
    fontWeight: '600',
  },
  table: {
    borderWidth: 1,
    borderColor: '#254032',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#07100B',
  },
  tableHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: '#112219',
  },
  headerText: {
    color: '#A4B6AA',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  rankColumn: {
    width: '13%',
  },
  nameColumn: {
    width: '43%',
  },
  exactColumn: {
    width: '20%',
  },
  pointsColumn: {
    width: '24%',
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#1B3023',
  },
  myRow: {
    backgroundColor: '#0C3922',
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 12,
  },
  rankCell: {
    textAlign: 'center',
    alignSelf: 'center',
  },
  rowRank: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  rowNameWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
  },
  rowName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  rowExact: {
    color: '#D9E8DC',
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '700',
  },
  rowPoints: {
    color: GREEN,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  inviteHint: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#245A3A',
  },
  inviteHintText: {
    color: MUTED,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },

  // Error state
  empty: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: MUTED,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryText: {
    color: '#002710',
    fontSize: 14,
    fontWeight: '900',
  },
});
