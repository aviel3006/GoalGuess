import type { User } from '@supabase/supabase-js';
import { useCallback, useState } from 'react';

import { supabase } from '../supabase';

export type ProfileLeague = {
  id: number;
  name: string;
  imageUrl: string | null;
  isOwner: boolean;
  memberCount: number;
  points: number;
  // null when nobody in the league has scored yet
  rank: number | null;
};

export type AchievementId =
  // Easy
  | 'first-prediction'
  | 'first-correct'
  | 'join-league'
  // Medium
  | 'first-exact'
  | 'streak-3'
  | 'points-50'
  | 'predictions-50'
  // Hard
  | 'streak-5'
  | 'points-100'
  | 'exact-10'
  | 'round-20'
  // Epic
  | 'streak-10'
  | 'points-250'
  | 'exact-25'
  | 'league-champion'
  | 'global-top-10'
  // Legendary
  | 'exact-expert'
  | 'points-500'
  | 'perfect-round'
  | 'global-first';

// Easiest first
export type AchievementTier = 'easy' | 'medium' | 'hard' | 'epic' | 'legendary';
export const ACHIEVEMENT_TIERS: AchievementTier[] = ['easy', 'medium', 'hard', 'epic', 'legendary'];

export type Achievement = {
  id: AchievementId;
  tier: AchievementTier;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
  goal: number;
};

export type ProfileStats = {
  totalPredictions: number;
  gradedPredictions: number;
  totalPoints: number;
  // Graded predictions that earned points
  correctPredictions: number;
  exactPredictions: number;
  // null when no prediction has been graded yet
  successRate: number | null;
  bestLeagueRank: number | null;
  globalRank: number | null;
};

export type ProfileData = {
  user: User;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  countryCode: string | null;
  stats: ProfileStats;
  achievements: Achievement[];
  leagues: ProfileLeague[];
};

type State =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ProfileData };

type MyPrediction = {
  match_id: number;
  predicted_home_score: number;
  predicted_away_score: number;
  // 0 until the match is finished and graded
  points: number;
  created_at: string;
};

type Match = {
  id: number;
  season: string;
  round: number;
  home_score: number | null;
  away_score: number | null;
  kickoff_time: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
};

type LeagueRow = {
  id: number;
  name: string;
  image_url: string | null;
  created_by: string | null;
};

// Returned by the get_my_league_standings() database function
type LeagueStanding = {
  league_id: number;
  member_count: number;
  points: number;
  rank: number | null;
};

function isGraded(match: Match | undefined): match is Match & { home_score: number; away_score: number } {
  return match?.status === 'finished' && match.home_score !== null && match.away_score !== null;
}

function longestWinningStreak(predictions: MyPrediction[], matches: Map<number, Match>) {
  const graded = predictions
    .filter((p) => isGraded(matches.get(p.match_id)))
    .sort((a, b) =>
      matches.get(a.match_id)!.kickoff_time.localeCompare(matches.get(b.match_id)!.kickoff_time)
    );

  let best = 0;
  let current = 0;
  for (const p of graded) {
    current = p.points > 0 ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

const CHAMPION_MIN_MEMBERS = 3;
const PERFECT_ROUND_MIN_GAMES = 5;

// Points and correct guesses per round. Round numbers restart every season.
function roundResults(graded: MyPrediction[], matches: Map<number, Match>) {
  const rounds = new Map<string, { points: number; games: number; correct: number }>();
  for (const p of graded) {
    const match = matches.get(p.match_id)!;
    const key = `${match.season}:${match.round}`;
    const round = rounds.get(key) ?? { points: 0, games: 0, correct: 0 };
    round.points += p.points;
    round.games += 1;
    if (p.points > 0) round.correct += 1;
    rounds.set(key, round);
  }
  return [...rounds.values()];
}

export async function loadProfile(): Promise<State> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: 'signed-out' };

  // Other users' predictions are hidden by RLS, so ranks come from database functions
  // that return only aggregates. RLS limits leagues to ones the user created or joined.
  const [myPredictionsRes, leaguesRes, standingsRes, globalRankRes] = await Promise.all([
    supabase
      .from('predictions')
      .select('match_id, predicted_home_score, predicted_away_score, points, created_at')
      .eq('user_id', user.id),
    supabase.from('leagues').select('id, name, image_url, created_by'),
    supabase.rpc('get_my_league_standings'),
    supabase.rpc('get_my_global_rank'),
  ]);

  const firstError =
    myPredictionsRes.error ?? leaguesRes.error ?? standingsRes.error ?? globalRankRes.error;
  if (firstError) throw firstError;

  const myPredictions = (myPredictionsRes.data ?? []) as MyPrediction[];
  const leagueRows = (leaguesRes.data ?? []) as LeagueRow[];
  const standings = new Map(
    ((standingsRes.data ?? []) as LeagueStanding[]).map((s) => [s.league_id, s])
  );
  const globalRank = (globalRankRes.data as number | null) ?? null;

  const matchIds = [...new Set(myPredictions.map((p) => p.match_id))];
  let matches = new Map<number, Match>();
  if (matchIds.length > 0) {
    const { data, error } = await supabase
      .from('matches')
      .select('id, season, round, home_score, away_score, kickoff_time, status')
      .in('id', matchIds);
    if (error) throw error;
    matches = new Map(((data ?? []) as Match[]).map((m) => [m.id, m]));
  }

  // --- Personal stats ---
  const myGraded = myPredictions.filter((p) => isGraded(matches.get(p.match_id)));
  const totalPoints = myGraded.reduce((sum, p) => sum + p.points, 0);
  const successful = myGraded.filter((p) => p.points > 0).length;
  const exactPredictions = myGraded.filter((p) => {
    const match = matches.get(p.match_id)!;
    return (
      p.predicted_home_score === match.home_score && p.predicted_away_score === match.away_score
    );
  }).length;

  // --- Leagues: points earned since joining, ranked among participants ---
  const leagues: ProfileLeague[] = leagueRows.map((league) => {
    const standing = standings.get(league.id);
    return {
      id: league.id,
      name: league.name,
      imageUrl: league.image_url,
      isOwner: league.created_by === user.id,
      memberCount: standing?.member_count ?? 1,
      points: standing?.points ?? 0,
      rank: standing?.rank ?? null,
    };
  });
  leagues.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));

  const leagueRanks = leagues.map((l) => l.rank).filter((r): r is number => r !== null);
  const bestLeagueRank = leagueRanks.length > 0 ? Math.min(...leagueRanks) : null;

  // --- Achievements (derived from real activity) ---
  const streak = longestWinningStreak(myPredictions, matches);
  const rounds = roundResults(myGraded, matches);
  const bestRoundPoints = Math.max(0, ...rounds.map((r) => r.points));
  const hasPerfectRound = rounds.some(
    (r) => r.games >= PERFECT_ROUND_MIN_GAMES && r.correct === r.games
  );
  // A league of one (or two) is too easy to top
  const isChampion = leagues.some(
    (l) => l.rank === 1 && l.points > 0 && l.memberCount >= CHAMPION_MIN_MEMBERS
  );
  const ranked = globalRank !== null && totalPoints > 0;

  const counter = (
    id: AchievementId,
    tier: AchievementTier,
    title: string,
    description: string,
    value: number,
    goal: number
  ): Achievement => ({
    id,
    tier,
    title,
    description,
    progress: Math.min(value, goal),
    goal,
    unlocked: value >= goal,
  });
  const flag = (
    id: AchievementId,
    tier: AchievementTier,
    title: string,
    description: string,
    unlocked: boolean
  ): Achievement => counter(id, tier, title, description, unlocked ? 1 : 0, 1);

  const achievements: Achievement[] = [
    flag('first-prediction', 'easy', 'ניחוש ראשון', 'שליחת ניחוש ראשון', myPredictions.length > 0),
    flag('first-correct', 'easy', 'בכיוון', 'ניחוש נכון ראשון', successful > 0),
    flag('join-league', 'easy', 'שחקן קבוצתי', 'הצטרפות לליגה', leagues.length > 0),

    flag('first-exact', 'medium', 'בול!', 'תוצאה מדויקת ראשונה', exactPredictions > 0),
    counter('streak-3', 'medium', 'רצף 3', '3 ניחושים נכונים ברצף', streak, 3),
    counter('points-50', 'medium', '50 נקודות', 'צבירת 50 נקודות', totalPoints, 50),
    counter('predictions-50', 'medium', 'מתמיד', '50 ניחושים', myPredictions.length, 50),

    counter('streak-5', 'hard', 'רצף 5', '5 ניחושים נכונים ברצף', streak, 5),
    counter('points-100', 'hard', '100 נקודות', 'צבירת 100 נקודות', totalPoints, 100),
    counter('exact-10', 'hard', 'צלף', '10 תוצאות מדויקות', exactPredictions, 10),
    counter('round-20', 'hard', 'מחזור חם', '20 נקודות במחזור אחד', bestRoundPoints, 20),

    counter('streak-10', 'epic', 'בלתי עציר', '10 ניחושים נכונים ברצף', streak, 10),
    counter('points-250', 'epic', '250 נקודות', 'צבירת 250 נקודות', totalPoints, 250),
    counter('exact-25', 'epic', 'צלף על', '25 תוצאות מדויקות', exactPredictions, 25),
    flag(
      'league-champion',
      'epic',
      'אלוף הליגה',
      `מקום ראשון בליגה של ${CHAMPION_MIN_MEMBERS}+ משתתפים`,
      isChampion
    ),
    flag('global-top-10', 'epic', 'טופ 10', 'עשרת הראשונים בדירוג העולמי', ranked && globalRank <= 10),

    counter('exact-expert', 'legendary', 'מומחה ניחושים', '50 תוצאות מדויקות', exactPredictions, 50),
    counter('points-500', 'legendary', '500 נקודות', 'צבירת 500 נקודות', totalPoints, 500),
    flag(
      'perfect-round',
      'legendary',
      'מחזור מושלם',
      `כל הניחושים נכונים במחזור (${PERFECT_ROUND_MIN_GAMES}+ משחקים)`,
      hasPerfectRound
    ),
    flag('global-first', 'legendary', 'מספר 1', 'מקום ראשון בדירוג העולמי', ranked && globalRank === 1),
  ];

  const meta = user.user_metadata ?? {};
  const username: string | undefined = meta.username ?? meta.user_name;
  const emailName = user.email?.split('@')[0] ?? '';

  return {
    status: 'ready',
    data: {
      user,
      displayName: meta.display_name ?? meta.full_name ?? meta.name ?? username ?? emailName,
      handle: username ? `@${username}` : user.email ?? '',
      avatarUrl: meta.avatar_url ?? meta.picture ?? null,
      countryCode: typeof meta.country === 'string' ? meta.country : null,
      stats: {
        totalPredictions: myPredictions.length,
        gradedPredictions: myGraded.length,
        totalPoints,
        correctPredictions: successful,
        exactPredictions,
        successRate:
          myGraded.length > 0 ? Math.round((successful / myGraded.length) * 100) : null,
        bestLeagueRank,
        globalRank,
      },
      achievements,
      leagues,
    },
  };
}

export function useProfile() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    try {
      setState(await loadProfile());
    } catch (error) {
      console.error('Load profile error:', error);
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { state, refreshing, load };
}
