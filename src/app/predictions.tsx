import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import { LOGO_SIZE, TeamLogo } from '../components/team-logo';
import { supabase } from '../supabase';
import { getRoundDeadlines, isMatchOpen } from '../utils/round-deadline';

type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';

type Match = {
  id: number;
  round: number;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  home_score: number | null;
  away_score: number | null;
  status: MatchStatus;
  home_badge: string | null;
  away_badge: string | null;
};

type Score = { home: number; away: number };

type SavedPrediction = Score & {
  // 0 until the match is finished and graded
  points: number;
};

type PredictionRow = {
  match_id: number;
  predicted_home_score: number;
  predicted_away_score: number;
  points: number;
};

type LoadState = 'loading' | 'error' | 'ready';

const STATUS_LABEL: Partial<Record<MatchStatus, string>> = {
  live: 'חי',
  postponed: 'נדחה',
  cancelled: 'בוטל',
};

// The logo sits in a slot as tall as the score area so its center lines up with the score digits
const SCORE_BOX_HEIGHT = 116;

const pad = (n: number) => String(n).padStart(2, '0');

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sameScore(a: Score | undefined, b: Score | undefined) {
  return a?.home === b?.home && a?.away === b?.away;
}

export default function PredictionsScreen() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [matches, setMatches] = useState<Match[]>([]);
  const [saved, setSaved] = useState<Record<number, SavedPrediction>>({});
  // Unsaved edits, kept across rounds until the user saves
  const [drafts, setDrafts] = useState<Record<number, Score>>({});
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveMessage, setShowSaveMessage] = useState(false);

  const load = useCallback(async () => {
    // RLS returns only the signed-in user's predictions
    const [matchesRes, predictionsRes] = await Promise.all([
      supabase
        .from('matches')
        .select('id, round, home_team, away_team, kickoff_time, home_score, away_score, status, home_badge, away_badge')
        .order('kickoff_time'),
      supabase
        .from('predictions')
        .select('match_id, predicted_home_score, predicted_away_score, points'),
    ]);

    const error = matchesRes.error ?? predictionsRes.error;
    if (error) {
      console.error('Load predictions error:', error);
      setLoadState((current) => (current === 'ready' ? current : 'error'));
      return;
    }

    const loadedMatches = (matchesRes.data ?? []) as Match[];
    const loadedSaved: Record<number, SavedPrediction> = {};
    for (const p of (predictionsRes.data ?? []) as PredictionRow[]) {
      loadedSaved[p.match_id] = {
        home: p.predicted_home_score,
        away: p.predicted_away_score,
        points: p.points,
      };
    }

    setMatches(loadedMatches);
    setSaved(loadedSaved);
    const loadedDeadlines = getRoundDeadlines(loadedMatches);
    setSelectedRound((current) => {
      if (current !== null && loadedMatches.some((m) => m.round === current)) return current;
      // Default to the round of the next match that can still be predicted
      return (
        loadedMatches.find((m) => isMatchOpen(m, loadedDeadlines))?.round ??
        loadedMatches.reduce<number | null>((max, m) => Math.max(max ?? 0, m.round), null)
      );
    });
    setLoadState('ready');
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const rounds = useMemo(
    () => [...new Set(matches.map((m) => m.round))].sort((a, b) => b - a),
    [matches]
  );

  const deadlines = useMemo(() => getRoundDeadlines(matches), [matches]);
  const isOpen = useCallback((match: Match) => isMatchOpen(match, deadlines), [deadlines]);

  const roundMatches = useMemo(
    () => matches.filter((m) => m.round === selectedRound),
    [matches, selectedRound]
  );

  const roundHasOpenMatches = roundMatches.some(isOpen);

  const pendingRows = useMemo(
    () =>
      matches
        .filter((m) => isOpen(m) && drafts[m.id] && !sameScore(drafts[m.id], saved[m.id]))
        .map((m) => ({ match: m, score: drafts[m.id] })),
    [matches, drafts, saved, isOpen]
  );

  const dateRange = useMemo(() => {
    if (roundMatches.length === 0) return '';
    const first = formatDate(roundMatches[0].kickoff_time);
    const last = formatDate(roundMatches[roundMatches.length - 1].kickoff_time);
    return first === last ? first : `${first} - ${last}`;
  }, [roundMatches]);

  const changeScore = (gameId: number, side: 'home' | 'away', amount: number) => {
    setDrafts((current) => {
      const base = current[gameId] ?? saved[gameId] ?? { home: 0, away: 0 };
      const score = { home: base.home, away: base.away };

      return {
        ...current,
        [gameId]: {
          ...score,
          [side]: Math.max(0, score[side] + amount),
        },
      };
    });
  };

  const savePredictions = async () => {
    if (pendingRows.length === 0 || isSaving) return;

    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      const { error } = await supabase.from('predictions').upsert(
        pendingRows.map(({ match, score }) => ({
          user_id: user.id,
          match_id: match.id,
          predicted_home_score: score.home,
          predicted_away_score: score.away,
        })),
        { onConflict: 'user_id,match_id' }
      );

      if (error) {
        // Raised by the deadline trigger when a match kicked off while the screen was open
        if (error.message.includes('Predictions are closed')) {
          Alert.alert('המשחק כבר התחיל', 'אחד המשחקים כבר התחיל ולא ניתן לשנות את הניחוש שלו.');
          load();
          return;
        }
        throw error;
      }

      const savedIds = new Set(pendingRows.map(({ match }) => match.id));
      setSaved((current) => {
        const next = { ...current };
        for (const { match, score } of pendingRows) {
          next[match.id] = { ...score, points: 0 };
        }
        return next;
      });
      setDrafts((current) =>
        Object.fromEntries(Object.entries(current).filter(([id]) => !savedIds.has(Number(id))))
      );

      setShowSaveMessage(true);
      setTimeout(() => setShowSaveMessage(false), 2000);
    } catch (error) {
      console.error('Save predictions error:', error);
      Alert.alert('שגיאה', 'הייתה בעיה בשמירת הניחושים. נסה שוב.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      {showSaveMessage && (
        <View style={styles.saveToast}>
          <Text style={styles.saveToastCheck}>✓</Text>
          <Text style={styles.saveToastText}>השינויים נשמרו בהצלחה!</Text>
        </View>
      )}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.title}>ניחושים</Text>

          <View style={styles.headerSpace} />
        </View>

        {loadState === 'loading' && (
          <ActivityIndicator size="large" color="limegreen" style={styles.loader} />
        )}

        {loadState === 'error' && (
          <View style={styles.emptyState}>
            <Text style={styles.instructions}>לא הצלחנו לטעון את המשחקים</Text>
            <TouchableOpacity onPress={load}>
              <Text style={styles.retryText}>נסה שוב</Text>
            </TouchableOpacity>
          </View>
        )}

        {loadState === 'ready' && rounds.length === 0 && (
          <Text style={[styles.instructions, styles.emptyState]}>
            עדיין אין משחקים זמינים לניחוש
          </Text>
        )}

        {loadState === 'ready' && rounds.length > 0 && (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.roundTabs}
            >
              {rounds.map((round) => (
                <TouchableOpacity
                  key={round}
                  style={selectedRound === round ? styles.activeRound : styles.round}
                  onPress={() => setSelectedRound(round)}
                >
                  <Text
                    style={
                      selectedRound === round
                        ? styles.activeRoundText
                        : styles.roundText
                    }
                  >
                    מחזור {round}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.dateTitle}>{dateRange}</Text>
            {roundHasOpenMatches && (
              <Text style={styles.instructions}>
                בחרו תוצאה לכל משחק ולחצו שמור ניחושים
              </Text>
            )}

            {roundMatches.map((game) => {
              const open = isOpen(game);
              const mine = saved[game.id];
              const score = drafts[game.id] ?? mine;
              const statusLabel = STATUS_LABEL[game.status];
              const isFinished =
                game.status === 'finished' &&
                game.home_score !== null &&
                game.away_score !== null;

              return (
                <View key={game.id} style={styles.gameCard}>
                  <Text style={styles.gameDate}>
                    {formatDate(game.kickoff_time)} | {formatTime(game.kickoff_time)}
                    {statusLabel ? ` | ${statusLabel}` : ''}
                  </Text>

                  <View style={styles.matchRow}>
                    <View style={styles.team}>
                      <View style={[styles.logoSlot, open && styles.logoSlotOpen]}>
                        <TeamLogo badge={game.home_badge} />
                      </View>

                      <Text style={styles.teamName}>
                        {game.home_team}
                      </Text>
                    </View>

                    {open ? (
                      <View style={styles.scoreSection}>
                        <View style={styles.scoreBox}>
                          <TouchableOpacity
                            style={styles.scoreButton}
                            onPress={() => changeScore(game.id, 'home', 1)}
                          >
                            <Text style={styles.plus}>+</Text>
                          </TouchableOpacity>

                          <Text style={styles.score}>{score ? score.home : '–'}</Text>

                          <TouchableOpacity
                            style={styles.scoreButton}
                            onPress={() => changeScore(game.id, 'home', -1)}
                          >
                            <Text style={styles.minus}>−</Text>
                          </TouchableOpacity>
                        </View>

                        <Text style={styles.colon}>:</Text>

                        <View style={styles.scoreBox}>
                          <TouchableOpacity
                            style={styles.scoreButton}
                            onPress={() => changeScore(game.id, 'away', 1)}
                          >
                            <Text style={styles.plus}>+</Text>
                          </TouchableOpacity>

                          <Text style={styles.score}>{score ? score.away : '–'}</Text>

                          <TouchableOpacity
                            style={styles.scoreButton}
                            onPress={() => changeScore(game.id, 'away', -1)}
                          >
                            <Text style={styles.minus}>−</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.scoreSection}>
                        {isFinished ? (
                          <>
                            <Text style={styles.score}>{game.home_score}</Text>
                            <Text style={styles.colon}>:</Text>
                            <Text style={styles.score}>{game.away_score}</Text>
                          </>
                        ) : (
                          <Text style={styles.lockedText}>🔒 נעול</Text>
                        )}
                      </View>
                    )}

                    <View style={styles.team}>
                      <View style={[styles.logoSlot, open && styles.logoSlotOpen]}>
                        <TeamLogo badge={game.away_badge} />
                      </View>

                      <Text style={styles.teamName}>
                        {game.away_team}
                      </Text>
                    </View>
                  </View>

                  {!open && (
                    <Text style={styles.myPrediction}>
                      {mine ? `הניחוש שלך: ${mine.home}:${mine.away}` : 'לא ניחשת את המשחק הזה'}
                      {mine && isFinished && (
                        <Text style={mine.points > 0 ? styles.pointsEarned : styles.pointsNone}>
                          {'  '}+{mine.points} נק׳
                        </Text>
                      )}
                    </Text>
                  )}

                  {isFinished && (
                    <TouchableOpacity
                      style={styles.statsButton}
                      onPress={() =>
                        router.push({ pathname: '/match/[id]', params: { id: String(game.id) } })
                      }
                    >
                      <Text style={styles.statsButtonText}>📊 סטטיסטיקה</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {roundHasOpenMatches && (
              <TouchableOpacity
                style={[styles.saveButton, pendingRows.length === 0 && styles.saveButtonDisabled]}
                onPress={savePredictions}
                disabled={pendingRows.length === 0 || isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="black" />
                ) : (
                  <Text style={styles.saveText}>
                    שמור ניחושים
                  </Text>
                )}
              </TouchableOpacity>
            )}
            <Text style={styles.bottomText}>
              ניתן לשנות את הניחושים עד תחילת המשחק
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'black',
  },
saveToast: {
  position: 'absolute',
  top: 60,
  left: 18,
  right: 18,
  backgroundColor: '#101512',
  borderWidth: 1.5,
  borderColor: '#00E676',
  borderRadius: 16,
  paddingVertical: 16,
  paddingHorizontal: 18,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  zIndex: 999,
  elevation: 10,
},

saveToastCheck: {
  color: '#00E676',
  fontSize: 24,
  fontWeight: '900',
},

saveToastText: {
  color: 'white',
  fontSize: 16,
  fontWeight: '800',
},
  content: {
    paddingHorizontal: 18,
    paddingTop: 15,
    paddingBottom: 50,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 25,
  },

  backButton: {
    width: 45,
    height: 45,
    justifyContent: 'center',
  },

  backText: {
    color: 'white',
    fontSize: 40,
  },

  headerSpace: {
    width: 45,
  },

  title: {
    color: 'white',
    fontSize: 30,
    fontWeight: '900',
  },

  roundTabs: {
    flexDirection: 'row',
    backgroundColor: '#151515',
    borderRadius: 18,
    padding: 5,
  },

  activeRound: {
    width: 115,
    backgroundColor: 'limegreen',
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: 'center',
  },

  activeRoundText: {
    color: 'white',
    fontWeight: '900',
  },

  round: {
    width: 115,
    paddingVertical: 11,
    alignItems: 'center',
  },

  roundText: {
    color: 'white',
    fontWeight: '700',
  },

  dateTitle: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '800',
    marginTop: 20,
  },

  instructions: {
    color: 'gray',
    textAlign: 'center',
    marginTop: 7,
    marginBottom: 10,
  },

  gameCard: {
    backgroundColor: '#151515',
    borderRadius: 20,
    padding: 16,
    marginTop: 13,
    borderWidth: 1,
    borderColor: '#303030',
  },

  gameDate: {
    color: 'gray',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 15,
  },

  matchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  team: {
    flex: 1,
    alignItems: 'center',
  },

  logoSlot: {
    height: LOGO_SIZE,
    justifyContent: 'center',
  },

  logoSlotOpen: {
    height: SCORE_BOX_HEIGHT,
  },

  teamName: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },

  scoreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: LOGO_SIZE,
    gap: 8,
  },

  scoreBox: {
    width: 48,
    height: SCORE_BOX_HEIGHT,
    backgroundColor: '#292929',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
scoreButton: {
  width: '100%',
  minHeight: 36,
  alignItems: 'center',
  justifyContent: 'center',
},
  plus: {
    color: 'gray',
    fontSize: 18,
    fontWeight: '800',
  },

  score: {
    color: 'white',
    fontSize: 23,
    fontWeight: '900',
    marginVertical: 2,
  },

  minus: {
    color: 'gray',
    fontSize: 18,
    fontWeight: '800',
  },

  colon: {
    color: 'white',
    fontSize: 23,
    fontWeight: '900',
  },

  saveButton: {
    backgroundColor: 'limegreen',
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 22,
  },

  saveText: {
    color: 'black',
    fontSize: 18,
    fontWeight: '900',
  },

  bottomText: {
    color: 'gray',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
  },

  saveButtonDisabled: {
    opacity: 0.45,
  },

  loader: {
    marginTop: 60,
  },

  emptyState: {
    marginTop: 60,
    alignItems: 'center',
  },

  retryText: {
    color: 'limegreen',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
  },

  lockedText: {
    color: 'gray',
    fontSize: 14,
    fontWeight: '800',
  },

  myPrediction: {
    color: 'gray',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
  },

  pointsEarned: {
    color: 'limegreen',
    fontWeight: '900',
  },

  pointsNone: {
    color: '#8A8A8A',
    fontWeight: '900',
  },

  statsButton: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#333',
  },

  statsButtonText: {
    color: 'limegreen',
    fontSize: 13,
    fontWeight: '800',
  },
});
