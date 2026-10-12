import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { TeamLogo } from '../../components/team-logo';
import { supabase } from '../../supabase';

type Match = {
  id: number;
  round: number;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  home_score: number | null;
  away_score: number | null;
  home_badge: string | null;
  away_badge: string | null;
};

type Side = 'home' | 'away';

// Shapes written by the sync-match-stats edge function
type Stat = {
  name: string;
  category: string | null;
  home: string;
  away: string;
  homeShare: number;
  awayShare: number;
  leader: Side | null;
  primary: boolean;
  top: boolean;
};

type MatchEvent = {
  minute: string;
  side: Side;
  type: 'goal' | 'yellow' | 'red';
  detail: string | null;
  player: string | null;
  assist: string | null;
};

type MatchStats = {
  venue: string | null;
  stats: Stat[];
  events: MatchEvent[];
};

type LoadState = 'loading' | 'error' | 'ready';

const EVENT_ICON: Record<MatchEvent['type'], string> = {
  goal: '⚽',
  yellow: '🟨',
  red: '🟥',
};

const pad = (n: number) => String(n).padStart(2, '0');

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export default function MatchStatsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [match, setMatch] = useState<Match | null>(null);
  const [details, setDetails] = useState<MatchStats | null>(null);

  const load = useCallback(async () => {
    const [matchRes, statsRes] = await Promise.all([
      supabase
        .from('matches')
        .select('id, round, home_team, away_team, kickoff_time, home_score, away_score, home_badge, away_badge')
        .eq('id', id)
        .single(),
      supabase.from('match_stats').select('venue, stats, events').eq('match_id', id).maybeSingle(),
    ]);

    const error = matchRes.error ?? statsRes.error;
    if (error) {
      console.error('Load match stats error:', error);
      setLoadState('error');
      return;
    }

    setMatch(matchRes.data as Match);
    setDetails(statsRes.data as MatchStats | null);
    setLoadState('ready');
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const sections = useMemo(() => {
    const stats = details?.stats ?? [];
    const possession = stats.find((s) => s.primary) ?? null;
    const top = stats.filter((s) => s.top && !s.primary);

    // The rest grouped by category, in the order 365Scores lists them
    const groups = new Map<string, Stat[]>();
    for (const s of stats) {
      if (s.top || s.primary) continue;
      const title = s.category ?? 'כללי';
      groups.set(title, [...(groups.get(title) ?? []), s]);
    }

    return { possession, top, groups: [...groups.entries()] };
  }, [details]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.title}>סטטיסטיקה</Text>

          <View style={styles.headerSpace} />
        </View>

        {loadState === 'loading' && (
          <ActivityIndicator size="large" color="limegreen" style={styles.loader} />
        )}

        {loadState === 'error' && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>לא הצלחנו לטעון את נתוני המשחק</Text>
            <TouchableOpacity
              onPress={() => {
                setLoadState('loading');
                load();
              }}
            >
              <Text style={styles.retryText}>נסה שוב</Text>
            </TouchableOpacity>
          </View>
        )}

        {loadState === 'ready' && match && (
          <>
            <View style={styles.card}>
              <Text style={styles.matchInfo}>
                מחזור {match.round} | {formatDate(match.kickoff_time)}
                {details?.venue ? ` | ${details.venue}` : ''}
              </Text>

              <View style={styles.scoreRow}>
                <View style={styles.team}>
                  <TeamLogo badge={match.home_badge} />
                  <Text style={styles.teamName}>{match.home_team}</Text>
                </View>

                <Text style={styles.finalScore}>
                  {match.home_score ?? '–'} : {match.away_score ?? '–'}
                </Text>

                <View style={styles.team}>
                  <TeamLogo badge={match.away_badge} />
                  <Text style={styles.teamName}>{match.away_team}</Text>
                </View>
              </View>
            </View>

            {!details || details.stats.length === 0 ? (
              <Text style={[styles.emptyText, styles.emptyState]}>
                הנתונים של המשחק הזה עוד לא זמינים, נסו שוב מאוחר יותר
              </Text>
            ) : (
              <>
                {details.events.length > 0 && (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>מהלך המשחק</Text>
                    {details.events.map((event, index) => (
                      <EventRow key={index} event={event} />
                    ))}
                  </View>
                )}

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>נתונים עיקריים</Text>
                  {sections.possession && <PossessionBar stat={sections.possession} />}
                  {sections.top.map((stat) => (
                    <StatRow key={stat.name} stat={stat} />
                  ))}
                </View>

                {sections.groups.map(([title, stats]) => (
                  <View key={title} style={styles.card}>
                    <Text style={styles.sectionTitle}>{title}</Text>
                    {stats.map((stat) => (
                      <StatRow key={stat.name} stat={stat} />
                    ))}
                  </View>
                ))}

                <Text style={styles.source}>הנתונים באדיבות 365Scores</Text>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function EventRow({ event }: { event: MatchEvent }) {
  const content = (
    <View style={styles.eventContent}>
      <Text style={styles.eventPlayer}>
        {EVENT_ICON[event.type]} {event.player ?? ''}
      </Text>
      {(event.assist || event.detail) && (
        <Text style={styles.eventSub}>
          {[event.detail, event.assist && `בישול: ${event.assist}`].filter(Boolean).join(' · ')}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.eventRow}>
      <View style={styles.eventSide}>{event.side === 'home' && content}</View>
      <Text style={styles.eventMinute}>{event.minute}</Text>
      <View style={styles.eventSide}>{event.side === 'away' && content}</View>
    </View>
  );
}

function PossessionBar({ stat }: { stat: Stat }) {
  // Keep a sliver of each color visible even at extreme splits
  const home = Math.max(stat.homeShare, 0.08);
  const away = Math.max(stat.awayShare, 0.08);

  return (
    <View style={styles.possession}>
      <Text style={styles.statName}>{stat.name}</Text>
      <View style={styles.possessionBar}>
        <View style={[styles.possessionPart, styles.homeFill, { flex: home }]}>
          <Text style={styles.possessionHomeText}>{stat.home}</Text>
        </View>
        <View style={[styles.possessionPart, styles.awayFill, { flex: away }]}>
          <Text style={styles.possessionAwayText}>{stat.away}</Text>
        </View>
      </View>
    </View>
  );
}

function StatRow({ stat }: { stat: Stat }) {
  return (
    <View style={styles.statRow}>
      <View style={styles.statLine}>
        <StatValue value={stat.home} leading={stat.leader === 'home'} />
        <Text style={styles.statName}>{stat.name}</Text>
        <StatValue value={stat.away} leading={stat.leader === 'away'} />
      </View>

      {/* Each team's bar grows outward from the middle */}
      <View style={styles.bars}>
        <View style={[styles.barHalf, styles.barHalfHome]}>
          <View
            style={[
              styles.barFill,
              stat.leader === 'home' ? styles.barLeading : styles.barTrailing,
              { width: `${Math.round(stat.homeShare * 100)}%` },
            ]}
          />
        </View>
        <View style={styles.barHalf}>
          <View
            style={[
              styles.barFill,
              stat.leader === 'away' ? styles.barLeading : styles.barTrailing,
              { width: `${Math.round(stat.awayShare * 100)}%` },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

function StatValue({ value, leading }: { value: string; leading: boolean }) {
  return (
    <View style={[styles.valuePill, leading && styles.valuePillLeading]}>
      <Text style={[styles.valueText, leading && styles.valueTextLeading]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'black',
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
    marginBottom: 15,
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

  loader: {
    marginTop: 60,
  },

  emptyState: {
    marginTop: 40,
    alignItems: 'center',
  },

  emptyText: {
    color: 'gray',
    textAlign: 'center',
    marginBottom: 10,
  },

  retryText: {
    color: 'limegreen',
    fontSize: 15,
    fontWeight: '800',
  },

  card: {
    backgroundColor: '#151515',
    borderRadius: 20,
    padding: 16,
    marginTop: 13,
    borderWidth: 1,
    borderColor: '#303030',
  },

  matchInfo: {
    color: 'gray',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 15,
  },

  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  team: {
    flex: 1,
    alignItems: 'center',
  },

  teamName: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },

  // As tall as the logo so the score sits level with it
  finalScore: {
    color: 'white',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 54,
  },

  sectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 14,
  },

  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },

  eventSide: {
    flex: 1,
  },

  eventContent: {
    alignItems: 'center',
  },

  eventPlayer: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },

  eventSub: {
    color: 'gray',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },

  eventMinute: {
    width: 46,
    color: 'limegreen',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },

  possession: {
    marginBottom: 16,
  },

  possessionBar: {
    flexDirection: 'row',
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    marginTop: 8,
    gap: 3,
  },

  possessionPart: {
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  homeFill: {
    backgroundColor: 'limegreen',
    alignItems: 'flex-start',
  },

  awayFill: {
    backgroundColor: '#3A3A3A',
    alignItems: 'flex-end',
  },

  possessionHomeText: {
    color: 'black',
    fontSize: 13,
    fontWeight: '900',
  },

  possessionAwayText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '900',
  },

  statRow: {
    marginBottom: 14,
  },

  statLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  statName: {
    flex: 1,
    color: '#CFCFCF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: 6,
  },

  valuePill: {
    minWidth: 44,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#252525',
    alignItems: 'center',
  },

  valuePillLeading: {
    backgroundColor: 'limegreen',
  },

  valueText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },

  valueTextLeading: {
    color: 'black',
  },

  bars: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 7,
  },

  barHalf: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#222',
    flexDirection: 'row',
    overflow: 'hidden',
  },

  barHalfHome: {
    justifyContent: 'flex-end',
  },

  barFill: {
    height: '100%',
    borderRadius: 3,
  },

  barLeading: {
    backgroundColor: 'limegreen',
  },

  barTrailing: {
    backgroundColor: '#5A5A5A',
  },

  source: {
    color: '#555',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 16,
  },
});
