// Predictions for a whole round close this long before the round's first kickoff.
// Mirrors check_prediction_deadline() in the database.
export const ROUND_LOCK_MS = 5 * 60 * 1000;

type RoundMatch = {
  round: number;
  kickoff_time: string;
  status: string;
};

// Round number -> time (ms) when predictions for that round close
export function getRoundDeadlines(matches: RoundMatch[]) {
  const deadlines = new Map<number, number>();
  for (const m of matches) {
    const deadline = new Date(m.kickoff_time).getTime() - ROUND_LOCK_MS;
    const current = deadlines.get(m.round);
    if (current === undefined || deadline < current) deadlines.set(m.round, deadline);
  }
  return deadlines;
}

export function isMatchOpen(
  match: RoundMatch,
  deadlines: Map<number, number>,
  now = Date.now()
) {
  const deadline = deadlines.get(match.round);
  return match.status === 'scheduled' && deadline !== undefined && deadline > now;
}

// The round to feature on the home screen: the last round that already closed
// while its games are still being played, otherwise the next round to open.
export function getCurrentRound(matches: RoundMatch[], now = Date.now()) {
  const deadlines = getRoundDeadlines(matches);
  const rounds = [...deadlines.keys()].sort((a, b) => a - b);
  const closedRound = rounds.filter((r) => deadlines.get(r)! <= now).pop();
  const openRound = rounds.find((r) => deadlines.get(r)! > now);

  if (closedRound !== undefined) {
    const nextDeadline = openRound !== undefined ? deadlines.get(openRound)! : Infinity;
    // Ignore games postponed past the next round's deadline
    const inProgress = matches.some(
      (m) =>
        m.round === closedRound &&
        (m.status === 'scheduled' || m.status === 'live') &&
        new Date(m.kickoff_time).getTime() < nextDeadline
    );
    if (inProgress || openRound === undefined) {
      return { round: closedRound, isOpen: false, deadline: deadlines.get(closedRound)! };
    }
  }

  if (openRound === undefined) return null;
  return { round: openRound, isOpen: true, deadline: deadlines.get(openRound)! };
}
