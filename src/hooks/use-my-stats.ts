import { useCallback, useState } from 'react';

import { supabase } from '../supabase';

export type Outcome = 'exact' | 'direction' | 'wrong';

export type GradedPrediction = {
  matchId: number;
  round: number;
  kickoffTime: string;
  homeTeam: string;
  awayTeam: string;
  homeBadge: string | null;
  awayBadge: string | null;
  homeScore: number;
  awayScore: number;
  predictedHome: number;
  predictedAway: number;
  points: number;
  outcome: Outcome;
};

export type RoundStat = {
  round: number;
  points: number;
  games: number;
};

export type TeamStat = {
  name: string;
  badge: string | null;
  points: number;
  games: number;
};

export type SeasonStats = {
  season: string;
  totalPoints: number;
  graded: number;
  // Sent but the match isn't finished yet
  pending: number;
  exact: number;
  direction: number;
  wrong: number;
  successRate: number | null;
  averagePoints: number | null;
  currentStreak: number;
  bestStreak: number;
  rounds: RoundStat[];
  bestRound: RoundStat | null;
  topTeams: TeamStat[];
  // Newest first
  history: GradedPrediction[];
};

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; seasons: SeasonStats[] };

type PredictionRow = {
  match_id: number;
  predicted_home_score: number;
  predicted_away_score: number;
  points: number;
};

type MatchRow = {
  id: number;
  season: string;
  round: number;
  home_team: string;
  away_team: string;
  home_badge: string | null;
  away_badge: string | null;
  home_score: number | null;
  away_score: number | null;
  kickoff_time: string;
  status: string;
};

const TOP_TEAMS = 3;

function outcomeOf(p: PredictionRow, homeScore: number, awayScore: number): Outcome {
  if (p.predicted_home_score === homeScore && p.predicted_away_score === awayScore) return 'exact';
  return p.points > 0 ? 'direction' : 'wrong';
}

function buildSeasonStats(season: string, rows: { p: PredictionRow; m: MatchRow }[]): SeasonStats {
  const graded: GradedPrediction[] = [];
  let pending = 0;

  for (const { p, m } of rows) {
    if (m.status !== 'finished' || m.home_score === null || m.away_score === null) {
      if (m.status !== 'cancelled') pending++;
      continue;
    }
    graded.push({
      matchId: m.id,
      round: m.round,
      kickoffTime: m.kickoff_time,
      homeTeam: m.home_team,
      awayTeam: m.away_team,
      homeBadge: m.home_badge,
      awayBadge: m.away_badge,
      homeScore: m.home_score,
      awayScore: m.away_score,
      predictedHome: p.predicted_home_score,
      predictedAway: p.predicted_away_score,
      points: p.points,
      outcome: outcomeOf(p, m.home_score, m.away_score),
    });
  }

  // Oldest first for streaks
  graded.sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime));

  let bestStreak = 0;
  let currentStreak = 0;
  for (const g of graded) {
    currentStreak = g.points > 0 ? currentStreak + 1 : 0;
    bestStreak = Math.max(bestStreak, currentStreak);
  }

  const roundMap = new Map<number, RoundStat>();
  const teamMap = new Map<string, TeamStat>();
  for (const g of graded) {
    const round = roundMap.get(g.round) ?? { round: g.round, points: 0, games: 0 };
    round.points += g.points;
    round.games += 1;
    roundMap.set(g.round, round);

    for (const [name, badge] of [
      [g.homeTeam, g.homeBadge],
      [g.awayTeam, g.awayBadge],
    ] as const) {
      const team = teamMap.get(name) ?? { name, badge, points: 0, games: 0 };
      team.points += g.points;
      team.games += 1;
      teamMap.set(name, team);
    }
  }

  const rounds = [...roundMap.values()].sort((a, b) => a.round - b.round);
  const bestRound = rounds.reduce<RoundStat | null>(
    (best, r) => (best === null || r.points > best.points ? r : best),
    null
  );
  const topTeams = [...teamMap.values()]
    .filter((t) => t.points > 0)
    .sort((a, b) => b.points - a.points || b.points / b.games - a.points / a.games)
    .slice(0, TOP_TEAMS);

  const exact = graded.filter((g) => g.outcome === 'exact').length;
  const direction = graded.filter((g) => g.outcome === 'direction').length;
  const totalPoints = graded.reduce((sum, g) => sum + g.points, 0);

  return {
    season,
    totalPoints,
    graded: graded.length,
    pending,
    exact,
    direction,
    wrong: graded.length - exact - direction,
    successRate:
      graded.length > 0 ? Math.round(((exact + direction) / graded.length) * 100) : null,
    averagePoints: graded.length > 0 ? Math.round((totalPoints / graded.length) * 10) / 10 : null,
    currentStreak,
    bestStreak,
    rounds,
    bestRound: bestRound && bestRound.points > 0 ? bestRound : null,
    topTeams,
    history: [...graded].reverse(),
  };
}

async function loadStats(): Promise<State> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error' };

  const { data: predictions, error } = await supabase
    .from('predictions')
    .select('match_id, predicted_home_score, predicted_away_score, points')
    .eq('user_id', user.id);
  if (error) throw error;

  const rows = (predictions ?? []) as PredictionRow[];
  const matchIds = [...new Set(rows.map((p) => p.match_id))];
  if (matchIds.length === 0) return { status: 'ready', seasons: [] };

  const { data: matchData, error: matchError } = await supabase
    .from('matches')
    .select(
      'id, season, round, home_team, away_team, home_badge, away_badge, home_score, away_score, kickoff_time, status'
    )
    .in('id', matchIds);
  if (matchError) throw matchError;

  const matches = new Map(((matchData ?? []) as MatchRow[]).map((m) => [m.id, m]));

  // Round numbers restart every season, so everything is grouped by season
  const bySeason = new Map<string, { p: PredictionRow; m: MatchRow }[]>();
  const latestKickoff = new Map<string, string>();
  for (const p of rows) {
    const m = matches.get(p.match_id);
    if (!m) continue;
    bySeason.set(m.season, [...(bySeason.get(m.season) ?? []), { p, m }]);
    if (m.kickoff_time > (latestKickoff.get(m.season) ?? '')) {
      latestKickoff.set(m.season, m.kickoff_time);
    }
  }

  // Newest season first
  const seasons = [...bySeason.entries()]
    .sort(([a], [b]) => (latestKickoff.get(b) ?? '').localeCompare(latestKickoff.get(a) ?? ''))
    .map(([season, seasonRows]) => buildSeasonStats(season, seasonRows));

  return { status: 'ready', seasons };
}

export function useMyStats() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    try {
      setState(await loadStats());
    } catch (error) {
      console.error('Load my stats error:', error);
      setState({ status: 'error' });
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { state, refreshing, load };
}
