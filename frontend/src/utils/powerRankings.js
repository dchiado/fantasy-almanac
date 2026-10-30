// Mirrors the ranking math in lambdas/powerRankings so the page can re-weight rankings and
// rebuild last week's order from each team's week-by-week results.

export const DEFAULT_WEIGHTS = {
  wins: 3,
  overallWins: 1,
  points: 2,
  lastFive: 1,
  consistency: 1,
};

const round2 = (n) => Math.round(n * 100) / 100;

const pstdev = (values) => {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
};

const lastWeek = (teams) => Math.max(0, ...teams.flatMap((t) => (t.matchups || []).map((m) => m.week)));

/**
 * Season stats for each team using only weeks <= throughWeek. The API's `scores`, `games` and
 * `matchups` arrays are appended together, so they share an index.
 */
const statsThroughWeek = (teams, throughWeek) => {
  const weekScores = {};
  teams.forEach((t) => t.matchups.forEach((m, i) => {
    if (m.week <= throughWeek) (weekScores[m.week] ||= []).push(t.scores[i]);
  }));

  return teams.map((t) => {
    const played = t.matchups.filter((m) => m.week <= throughWeek).length;
    const games = t.games.slice(0, played);
    const bonusWins = t.matchups.slice(0, played).filter((m) => m.bonus === 'win').length;
    const scores = t.scores.slice(0, played);
    const overallWins = t.matchups.slice(0, played).reduce(
      (accu, m, i) => accu + weekScores[m.week].filter((s) => s < scores[i]).length, 0
    );

    return {
      ...t,
      wins: games.filter(Boolean).length + bonusWins,
      l5: games.slice(-5).filter(Boolean).length,
      points: round2(scores.reduce((a, b) => a + b, 0)),
      consistency: round2(pstdev(scores)),
      overall_wins: overallWins,
    };
  });
};

/** Scores and sorts teams (lower PR score is better), matching the original formula. */
export const rankTeams = (teams, weights) => {
  const weightsSum = Object.values(weights).reduce((accu, val) => accu + (val === '' ? 0 : val), 0) || 1;

  const allWins = teams.map((t) => t.wins).sort((a, b) => b - a);
  const allOverallWins = teams.map((t) => t.overall_wins).sort((a, b) => b - a);
  const allPoints = teams.map((t) => t.points).sort((a, b) => b - a);
  const allLastFive = teams.map((t) => t.l5).sort((a, b) => b - a);
  const allConsistency = teams.map((t) => t.consistency).sort((a, b) => a - b);

  return teams
    .map((tm) => {
      const score = (
        (weights.wins * (allWins.indexOf(tm.wins) + 1)) +
        (weights.overallWins * (allOverallWins.indexOf(tm.overall_wins) + 1)) +
        (weights.points * (allPoints.indexOf(tm.points) + 1)) +
        (weights.lastFive * (allLastFive.indexOf(tm.l5) + 1)) +
        (weights.consistency * (allConsistency.indexOf(tm.consistency) + 1))
      ) / weightsSum;
      return { ...tm, power_ranking_score: score.toFixed(2) };
    })
    .sort((a, b) => a.power_ranking_score - b.power_ranking_score);
};

/**
 * Current rankings, each with `movement`: places gained (+) or lost (-) since last week under the
 * same weights. `movement` is null when there's no prior week or the data lacks weekly results.
 */
export const rankWithMovement = (teams, weights) => {
  const current = rankTeams(teams, weights);
  const week = lastWeek(teams);
  const hasWeekly = teams.every((t) => Array.isArray(t.matchups) && Array.isArray(t.scores) && Array.isArray(t.games));

  if (!hasWeekly || week < 2) {
    return current.map((t) => ({ ...t, movement: null }));
  }

  const previous = rankTeams(statsThroughWeek(teams, week - 1), weights);
  const previousPlace = Object.fromEntries(previous.map((t, idx) => [t.name, idx]));

  return current.map((t, idx) => ({
    ...t,
    movement: previousPlace[t.name] === undefined ? null : previousPlace[t.name] - idx,
  }));
};
