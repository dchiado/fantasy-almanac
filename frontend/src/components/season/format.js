// Simulated odds are never exactly certain, so 0 and 1 show as "<1%" and ">99%"
// unless the result is actually decided (e.g. after the last regular-season week)
export const formatPct = (p, certain = false) => {
  if (!certain && p < 0.005) return '<1%';
  if (!certain && p >= 0.995) return '>99%';
  return `${Math.round(p * 100)}%`;
};

// In a league without playoffs, first place wins the title, so the odds
// (engine/report.py) are title odds: "Playoff odds" or "Title odds"
export const oddsName = (report) => (report.has_playoffs ? 'Playoff' : 'Title');

// How many top seeds the odds are about: the playoff teams, or first place
export const spots = (report) => (report.has_playoffs ? report.playoff_team_count : 1);

export const formatRecord = ({ wins, losses, ties }) => `${wins}-${losses}${ties ? `-${ties}` : ''}`;

export const formatSigned = (n, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}`;

export const STATUS_LABELS = {
  clinched: 'Clinched',
  eliminated: 'Eliminated',
  win_out: 'In if they win out',
  needs_help: 'Needs help',
};

// One scenario condition (engine/scenarios.py) as text: the team's own result
// reads "win"/"loss", anyone else's reads "Team X loss"
const conditionPart = ({ team_id: id, result }, teamId, names) => (id === teamId ? result : `${names[id]} ${result}`);

/**
 * "Clinches with win AND Team X loss", "Eliminated with loss OR Team X win".
 * verb is "Clinches" or "Eliminated"; returns null when it can't happen this week.
 */
export const conditionText = (condition, verb, teamId, names) => {
  if (!condition) return null;
  if (condition.complex) return verb === 'Clinches' ? 'Can clinch this week with help' : 'Can be eliminated this week';
  const all = condition.all;
  // The team's own result first: "win AND Team X loss"
  const parts = [...(all ?? condition.any)]
    .sort((a, b) => (b.team_id === teamId) - (a.team_id === teamId))
    .map((c) => conditionPart(c, teamId, names));
  const text = `${verb} with ${parts.join(all ? ' AND ' : ' OR ')}`;
  return condition.partial ? `${text}, among other ways` : text;
};
