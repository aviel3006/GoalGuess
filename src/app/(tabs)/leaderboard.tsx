
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../supabase';
const GREEN = '#00E676';

// Returned by the get_global_leaderboard() database function
type LeaderboardEntry = {
  rank: number;
  display_name: string | null;
  points: number;
  exact_count: number;
  is_me: boolean;
};

const LEADERBOARD_SIZE = 50;

function entryName(entry: LeaderboardEntry) {
  if (entry.is_me) return 'אתה';
  return entry.display_name ?? 'שחקן';
}

export default function LeaderboardScreen() {
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'global' | 'friends'>(
  initialTab === 'friends' ? 'friends' : 'global'
);
const [myLeagues, setMyLeagues] = useState<
  {
    id: number;
    name: string;
    image_url: string | null;
    invite_code: string;
    member_count: number;
  }[]
>([]);
const [joinVisible, setJoinVisible] = useState(false);
const [joinCode, setJoinCode] = useState('');
const [isJoining, setIsJoining] = useState(false);
const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);

  const loadLeaderboard = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_global_leaderboard', {
      p_limit: LEADERBOARD_SIZE,
    });

    if (error) {
      console.error('Load leaderboard error:', error);
      setLeaderboard((current) => current ?? []);
      return;
    }

    setLeaderboard((data ?? []) as LeaderboardEntry[]);
  }, []);

  const loadLeagues = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    // RLS returns only leagues the user created or joined
    const { data, error } = await supabase
      .from('leagues')
      .select('id, name, image_url, invite_code')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Load leagues error:', error);
      return;
    }

    const leaguesWithCounts = await Promise.all(
  (data ?? []).map(async (league) => {
    const { count, error: countError } = await supabase
      .from('league_members')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', league.id);

    if (countError) {
      console.error('Member count error:', countError);
    }

    return {
      ...league,
      member_count: count ?? 0,
    };
  })
);

setMyLeagues(leaguesWithCounts);
  }, []);

useFocusEffect(
  useCallback(() => {
    loadLeagues();
    loadLeaderboard();
  }, [loadLeagues, loadLeaderboard])
);

const closeJoin = () => {
  setJoinVisible(false);
  setJoinCode('');
};

const joinLeague = async () => {
  const code = joinCode.trim();
  if (!code || isJoining) return;

  setIsJoining(true);
  try {
    const { data, error } = await supabase.rpc('join_league', { p_invite_code: code });

    if (error) {
      if (error.message.includes('invalid_invite_code')) {
        Alert.alert('קוד שגוי', 'לא מצאנו ליגה עם הקוד הזה. בדוק אותו ונסה שוב.');
      } else {
        throw error;
      }
      return;
    }

    const joined = (data as { league_name: string; already_member: boolean }[])[0];
    closeJoin();
    Alert.alert(
      joined.already_member ? 'כבר בליגה' : 'הצטרפת לליגה!',
      joined.already_member
        ? `אתה כבר חבר בליגה "${joined.league_name}"`
        : `ברוך הבא לליגה "${joined.league_name}" 🎉`
    );
    loadLeagues();
  } catch (error) {
    console.error('Join league error:', error);
    Alert.alert('שגיאה', 'לא הצלחנו להצטרף לליגה. נסה שוב.');
  } finally {
    setIsJoining(false);
  }
};

// The RPC appends the caller's own row when they are outside the top
const topPlayers = (leaderboard ?? []).slice(0, LEADERBOARD_SIZE);
const me = leaderboard?.find((entry) => entry.is_me) ?? null;

const shareInvite = (league: { name: string; invite_code: string }) => {
  Share.share({
    message: `הצטרפו לליגה "${league.name}" ב-GoalGuess עם הקוד: ${league.invite_code}`,
  });
};
  return (
    <ImageBackground
  source={require('../../../assets/images/stadium.png')}
  style={styles.container}
  imageStyle={{ opacity: 0.22 }}
  resizeMode="cover"
>
      <StatusBar barStyle="light-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.logo}>
          GOAL<Text style={styles.logoGreen}>GUESS</Text>
        </Text>

        <View style={styles.titleRow}>
          <Ionicons
            name={tab === 'global' ? 'football' : 'people'}
            size={27}
            color={GREEN}
          />
          <Text style={styles.title}>
            {tab === 'global' ? 'טבלה כללית' : 'ליגות חברים'}
          </Text>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[
              styles.tab,
              tab === 'global' && styles.activeTab,
            ]}
            onPress={() => setTab('global')}
          >
            <Text
              style={[
                styles.tabText,
                tab === 'global' && styles.activeTabText,
              ]}
            >
              טבלה כללית
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              tab === 'friends' && styles.activeTab,
            ]}
            onPress={() => setTab('friends')}
          >
            <Text
              style={[
                styles.tabText,
                tab === 'friends' && styles.activeTabText,
              ]}
            >
              ליגות חברים
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'global' ? (
          leaderboard === null ? (
            <ActivityIndicator size="large" color={GREEN} style={styles.loader} />
          ) : topPlayers.length === 0 ? (
            <View style={styles.emptyLeague}>
              <Ionicons name="podium-outline" size={58} color="#42624D" />
              <Text style={styles.emptyTitle}>הטבלה עדיין ריקה</Text>
              <Text style={styles.emptySubtitle}>
                הניקוד יופיע כאן אחרי שהמשחקים הראשונים יסתיימו
              </Text>
            </View>
          ) : (
          <>
            <View style={styles.podium}>
              <PodiumPlayer
                player={topPlayers[1]}
                color="#C0C0C0"
              />
              <PodiumPlayer
                player={topPlayers[0]}
                color="#FFD54F"
                first
              />
              <PodiumPlayer
                player={topPlayers[2]}
                color="#CD8B52"
              />
            </View>

            {topPlayers.length > 3 && (
            <View style={styles.table}>
              <TableHeader />

              {topPlayers.slice(3).map((player, index) => (
                <PlayerRow
                  key={index}
                  rank={player.rank}
                  name={entryName(player)}
                  exact={player.exact_count}
                  points={player.points}
                  highlighted={player.is_me}
                />
              ))}
            </View>
            )}

            <Text style={styles.myTitle}>הדירוג שלי</Text>

            {me ? (
            <View style={styles.myCard}>
              <PlayerRow
                rank={me.rank}
                name={entryName(me)}
                exact={me.exact_count}
                points={me.points}
                highlighted
              />
            </View>
            ) : (
              <Text style={styles.myEmpty}>
                עדיין אין לך ניקוד — נחש משחקים כדי להיכנס לטבלה
              </Text>
            )}
          </>
          )
        ) : (
          <>
            <Text style={styles.friendsDescription}>
              צרו ליגה פרטית והתחרו עם החברים שלכם!
            </Text>

            <TouchableOpacity
  style={styles.createButton}
  onPress={() => router.push('/create-league')}
>
              <Ionicons
                name="add-circle"
                size={23}
                color="#002710"
              />
              <Text style={styles.createButtonText}>
                צור ליגה חדשה
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.joinButton} onPress={() => setJoinVisible(true)}>
              <Ionicons
                name="enter-outline"
                size={22}
                color={GREEN}
              />
              <Text style={styles.joinButtonText}>
                הצטרף לליגה עם קוד
              </Text>
            </TouchableOpacity>
<View style={{ height: 24 }} />
{myLeagues.map((league) => (
  <TouchableOpacity
    key={league.id}
    onPress={() => shareInvite(league)}
    style={{
      backgroundColor: '#102017',
      borderWidth: 1,
      borderColor: '#245A3A',
      borderRadius: 18,
      paddingVertical: 12,
paddingHorizontal: 18,
      marginBottom: 12,
      flexDirection: 'row-reverse',
      alignItems: 'center',
    }}
  >
    <Image
      source={require('../../../assets/images/default-league.png')}
      style={{
        width: 58,
        height: 58,
        borderRadius: 29,
        marginLeft: 16,
      }}
    />

    <View style={{ flex: 1, alignItems: 'flex-end' }}>
  <Text
    style={{
      color: '#FFFFFF',
      fontSize: 19,
      fontWeight: '800',
      textAlign: 'right',
    }}
  >
    {league.name}
  </Text>

  <Text
    style={{
      color: '#8FA99A',
      fontSize: 12,
      marginTop: 5,
      textAlign: 'right',
    }}
  >
    👥 {league.member_count} {league.member_count === 1 ? 'משתתף' : 'משתתפים'}
  </Text>
</View>

    <View style={styles.inviteChip}>
      <Ionicons name="share-social" size={14} color={GREEN} />
      <Text style={styles.inviteChipText}>{league.invite_code}</Text>
    </View>
  </TouchableOpacity>
))}
            {myLeagues.length === 0 && (
            <View style={styles.emptyLeague}>
              <Ionicons
                name="trophy-outline"
                size={58}
                color="#42624D"
              />
              <Text style={styles.emptyTitle}>
                עדיין אין לך ליגות
              </Text>
              <Text style={styles.emptySubtitle}>
                צור ליגה, הזמן חברים והתחילו להתחרות
              </Text>
            </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={joinVisible}
        transparent
        animationType="fade"
        onRequestClose={closeJoin}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Ionicons name="enter-outline" size={44} color={GREEN} />
            <Text style={styles.modalTitle}>הצטרפות לליגה</Text>
            <Text style={styles.modalSubtitle}>הזן את קוד ההזמנה שקיבלת מחבר</Text>

            <TextInput
              value={joinCode}
              onChangeText={(text) => setJoinCode(text.toUpperCase())}
              placeholder="ABCD1234"
              placeholderTextColor="#4F6B5A"
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              maxLength={12}
              returnKeyType="done"
              onSubmitEditing={joinLeague}
              style={styles.codeInput}
            />

            <TouchableOpacity
              style={[styles.createButton, styles.modalButton, !joinCode.trim() && styles.disabled]}
              onPress={joinLeague}
              disabled={!joinCode.trim() || isJoining}
            >
              {isJoining ? (
                <ActivityIndicator color="#002710" />
              ) : (
                <Text style={styles.createButtonText}>הצטרף</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={closeJoin} hitSlop={10}>
              <Text style={styles.modalCancel}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      
    </ImageBackground>
  );
}

function PodiumPlayer({
  player,
  color,
  first = false,
}: {
  // undefined while fewer than three players have scored
  player: LeaderboardEntry | undefined;
  color: string;
  first?: boolean;
}) {
  if (!player) {
    return <View style={[styles.podiumPlayer, styles.podiumEmpty, first && styles.firstPlayer]} />;
  }

  return (
    
<View style={[styles.podiumPlayer, first && styles.firstPlayer]}>

      <Ionicons
        name="trophy"
        size={first ? 35 : 27}
        color={color}
      />

      <View
        style={[
          styles.podiumAvatar,
          { borderColor: color },
          first && styles.firstAvatar,
        ]}
      >
        <Ionicons
          name="person"
          size={first ? 33 : 27}
          color="#E4EDE7"
        />
      </View>

      <Text style={[styles.podiumRank, { color }]}>
        {player.rank}
      </Text>

      <Text
        style={styles.podiumName}
        numberOfLines={1}
      >
        {entryName(player)}
      </Text>

      <Text style={styles.podiumPoints}>
        {player.points.toLocaleString()}
      </Text>

      <Text style={styles.podiumLabel}>ניקוד</Text>

      <Text style={styles.podiumExact}>
        {player.exact_count} דיוקים
      </Text>
    </View>
  );
}

function TableHeader() {
  return (
    <View style={styles.tableHeader}>
      <Text style={[styles.headerText, styles.rankColumn]}>
        מקום
      </Text>
      <Text style={[styles.headerText, styles.nameColumn]}>
        שם
      </Text>
      <Text style={[styles.headerText, styles.exactColumn]}>
        דיוקים
      </Text>
      <Text style={[styles.headerText, styles.pointsColumn]}>
        ניקוד
      </Text>
    </View>
  );
}

function PlayerRow({
  rank,
  name,
  exact,
  points,
  highlighted = false,
}: {
  rank: number;
  name: string;
  exact: number;
  points: number;
  highlighted?: boolean;
}) {
  return (
    <View
      style={[
        styles.playerRow,
        highlighted && styles.highlightedRow,
      ]}
    >
      <Text style={[styles.rowRank, styles.rankColumn]}>
        {rank}
      </Text>

      <View style={[styles.rowNameWrap, styles.nameColumn]}>
        <View style={styles.smallAvatar}>
          <Ionicons name="person" size={16} color="#B8DCC3" />
        </View>
        <Text
          style={styles.rowName}
          numberOfLines={1}
        >
          {name}
        </Text>
      </View>

      <Text style={[styles.rowExact, styles.exactColumn]}>
        {exact}
      </Text>

      <Text style={[styles.rowPoints, styles.pointsColumn]}>
        {points.toLocaleString()}
      </Text>
    </View>
  );
}

function NavItem({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.navItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <Ionicons
        name={icon}
        size={23}
        color={active ? GREEN : '#858B88'}
      />
      <Text
        style={[
          styles.navText,
          active && styles.activeNavText,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  
container: {
  flex: 1,
  backgroundColor: '#06150D',
},

  content: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 35,
  },
  logo: {
    textAlign: 'center',
    fontSize: 29,
    fontWeight: '900',
    color: '#FFFFFF',
    fontStyle: 'italic',
    marginBottom: 32,
  },
  logoGreen: {
    color: GREEN,
  },
  titleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 22,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 29,
    fontWeight: '900',
  },
  tabs: {
    flexDirection: 'row-reverse',
    backgroundColor: '#101B15',
    borderRadius: 14,
    padding: 5,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#1C3425',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: GREEN,
  },
  tabText: {
    color: '#9EAEA4',
    fontSize: 14,
    fontWeight: '800',
  },
  activeTabText: {
    color: '#002A12',
  },
  
 
podium: {
  flexDirection: 'row',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  marginBottom: 24,
  gap: 6,
},


  
  podiumPlayer: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#0B1710',
    borderWidth: 1,
    borderColor: '#294133',
    borderRadius: 17,
    paddingTop: 8,
paddingBottom: 8,
    minWidth: 0,
  },
  firstPlayer: {
    paddingTop: 12,
paddingBottom: 12,
    backgroundColor: '#18200E',
    borderColor: '#8A742B',
  },
  podiumAvatar: {
    width: 44,
height: 44,
borderRadius: 22,
    borderWidth: 2,
    backgroundColor: '#20382A',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  firstAvatar: {
    width: 54,
height: 54,
borderRadius: 27,
    backgroundColor: '#3A3518',
  },

  podiumRank: {
    fontSize: 26,
    fontWeight: '900',
    marginTop: 7,
  },
  podiumName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 5,
    maxWidth: '94%',
  },
  podiumPoints: {
    color: '#FFD95A',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 12,
  },
  podiumLabel: {
    color: '#91A398',
    fontSize: 11,
    marginTop: 2,
  },
  podiumExact: {
    color: '#DCE9DE',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
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
    paddingVertical: 15,
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
  playerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#1B3023',
  },
  highlightedRow: {
    backgroundColor: '#0C3922',
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 12,
  },
  rowRank: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
  },
  rowNameWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
  },
  smallAvatar: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#20432D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowName: {
    color: '#FFFFFF',
    fontSize: 12,
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
  myTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'right',
    marginTop: 27,
    marginBottom: 12,
  },
  myEmpty: {
    color: '#879B8C',
    fontSize: 13,
    textAlign: 'right',
  },
  loader: {
    marginTop: 40,
  },
  podiumEmpty: {
    alignSelf: 'stretch',
    opacity: 0.35,
  },
  myCard: {
    borderRadius: 13,
    overflow: 'hidden',
  },
  friendsDescription: {
    color: '#A8B6AC',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 25,
  },
  createButton: {
    backgroundColor: GREEN,
    borderRadius: 15,
    paddingVertical: 18,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  createButtonText: {
    color: '#002710',
    fontSize: 17,
    fontWeight: '900',
  },
  joinButton: {
    marginTop: 13,
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 15,
    paddingVertical: 17,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  joinButtonText: {
    color: GREEN,
    fontSize: 16,
    fontWeight: '800',
  },
  inviteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#245A3A',
    marginRight: 10,
  },
  inviteChipText: {
    color: GREEN,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  modalCard: {
    backgroundColor: '#102017',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#24A53A',
    padding: 26,
    alignItems: 'center',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 10,
  },
  modalSubtitle: {
    color: '#AAB8AE',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  codeInput: {
    width: '100%',
    marginTop: 20,
    backgroundColor: '#0B1810',
    borderWidth: 1,
    borderColor: '#245A3A',
    borderRadius: 14,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
  },
  modalButton: {
    width: '100%',
    marginTop: 16,
    paddingVertical: 15,
  },
  disabled: {
    opacity: 0.5,
  },
  modalCancel: {
    color: '#8FA99A',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyLeague: {
    marginTop: 50,
    paddingVertical: 35,
    alignItems: 'center',
    backgroundColor: '#0B1810',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#203B2A',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 16,
  },
  emptySubtitle: {
    color: '#879B8C',
    fontSize: 13,
    marginTop: 9,
    textAlign: 'center',
  },
  bottomBar: {
    flexDirection: 'row-reverse',
    backgroundColor: '#07100B',
    borderTopWidth: 1,
    borderTopColor: '#1A3925',
    paddingTop: 11,
    paddingBottom: 14,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  navText: {
    color: '#858B88',
    fontSize: 11,
    fontWeight: '700',
  },
  activeNavText: {
    color: GREEN,
  },
});
