// A weekly recap (GET /recap, engine/recap.py) as display text: one item per
// story, each { key, title, name, detail, badge }.
import { formatPct, oddsName } from "../season/format";

// Exact all-time ranks only near the top, where they mean something
const EXACT_RANKS = 25;

// The few items the Home card leads with, in order
const HOME_KEYS = ['high', 'lucky', 'unlucky', 'hadWho', 'pickup', 'blowout'];

// 1st, 2nd, 3rd, 4th, ..., 11th, 12th, 13th, ..., 21st
export const ordinal = (n) => {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) {
    return `${n}th`;
  }

  const suffixes = { 1: 'st', 2: 'nd', 3: 'rd' };
  return `${n}${suffixes[n % 10] ?? 'th'}`;
};

// 120.5, not 120.50
const points = (n) => String(Number(n.toFixed(2)));

// "98.56 to 86.46": with a hyphen, a line can break in the middle of the score
const score = (a, b) => `${points(a)} to ${points(b)}`;

// "The highest score ever", "4th-lowest score since 2019", "Top 2% all-time".
// "Since" when older seasons couldn't be loaded (they can need a cookie).
// Beyond the exact ranks, the percentile is rounded up, so a score never
// reads better than it is.
const allTimeBadge = (recap, teamId, established) => {
  const found = recap.all_time?.scores.find((s) => s.team_id === teamId);
  if (!found) {
    return null;
  }

  const sinceStart = recap.all_time.since <= (established || 0);
  const kind = found.kind === 'high' ? 'highest' : 'lowest';

  if (found.rank === 1) {
    return `The ${kind} score ${sinceStart ? 'ever' : `since ${recap.all_time.since}`}`;
  }

  if (found.rank <= EXACT_RANKS) {
    return `${ordinal(found.rank)}-${kind} score ${sinceStart ? 'ever' : `since ${recap.all_time.since}`}`;
  }

  const percent = Math.ceil((found.rank / recap.all_time.count) * 100);
  const share = found.kind === 'high' ? `Top ${percent}%` : `Bottom ${percent}%`;
  return `${share} ${sinceStart ? 'all-time' : `since ${recap.all_time.since}`}`;
};

// "the lowest score of the week", "the 3rd-lowest score of the week"
const placeText = (place, of, kind) => {
  const n = kind === 'highest' ? place : of - place + 1;

  if (n === 1) {
    return `the ${kind} score of the week`;
  }
  return `the ${ordinal(n)}-${kind} score of the week`;
};

const highScore = (recap, names, established) => ({
  key: 'high',
  title: 'High score',
  name: names[recap.high_score.team_id],
  detail: `${points(recap.high_score.points)} points`,
  badge: allTimeBadge(recap, recap.high_score.team_id, established),
});

const lowScore = (recap, names, established) => ({
  key: 'low',
  title: 'Low score',
  name: names[recap.low_score.team_id],
  detail: `${points(recap.low_score.points)} points`,
  badge: allTimeBadge(recap, recap.low_score.team_id, established),
});

const luckiestWin = (recap, names) => {
  const lucky = recap.luckiest_win;
  if (!lucky) {
    return null;
  }

  const place = placeText(lucky.place, lucky.of, 'lowest');
  return {
    key: 'lucky',
    title: 'Luckiest win',
    name: names[lucky.team_id],
    detail: `Put up ${place} and still beat ${names[lucky.opponent_id]}, ${score(lucky.points, lucky.opponent_points)}`,
  };
};

const unluckiestLoss = (recap, names) => {
  const unlucky = recap.unluckiest_loss;
  if (!unlucky) {
    return null;
  }

  const place = placeText(unlucky.place, unlucky.of, 'highest');
  return {
    key: 'unlucky',
    title: 'Unluckiest loss',
    name: names[unlucky.team_id],
    detail: `Put up ${place} and still lost to ${names[unlucky.opponent_id]}, ${score(unlucky.points, unlucky.opponent_points)}`,
  };
};

const hadWho = (recap, names) => {
  const found = recap.had_who;
  if (!found) {
    return null;
  }

  const { player } = found;
  return {
    key: 'hadWho',
    title: 'You had who and still lost?',
    name: `${player.name}, ${points(player.points)}`,
    detail: `${player.position} for ${names[found.team_id]}, who lost to ${names[found.opponent_id]} anyway`,
  };
};

const bestPickup = (recap, names) => {
  const pickup = recap.best_pickup;
  if (!pickup) {
    return null;
  }

  let how;
  if (pickup.type === 'waiver' && pickup.bid_amount) {
    how = `Waiver claim ($${pickup.bid_amount})`;
  } else if (pickup.type === 'waiver') {
    how = 'Waiver claim';
  } else {
    how = 'Free-agent add';
  }

  let detail = `${how} by ${names[pickup.team_id]}`;
  if (!pickup.player.starter) {
    detail += ', on the bench';
  }

  let badge = null;
  if (pickup.won_it) {
    badge = `Won it for them: the margin was ${points(pickup.margin)}`;
  }

  return {
    key: 'pickup',
    title: 'Best pickup',
    name: `${pickup.player.name}, ${points(pickup.player.points)}`,
    detail,
    badge,
  };
};

const marginItem = (game, key, title, names) => ({
  key,
  title,
  name: names[game.team_id],
  detail: `Beat ${names[game.opponent_id]} by ${points(game.margin)}, ${score(game.points, game.opponent_points)}`,
});

// This week's other scores that made the all-time list, besides the high and low
const otherAllTimeScores = (recap, names, established) => {
  const featured = [recap.high_score.team_id, recap.low_score.team_id];
  const others = (recap.all_time?.scores ?? []).filter((s) => !featured.includes(s.team_id));

  return others.map((s) => ({
    key: `allTime-${s.team_id}`,
    title: s.kind === 'high' ? 'Among the best' : 'Among the worst',
    name: names[s.team_id],
    detail: `${points(s.points)} points`,
    badge: allTimeBadge(recap, s.team_id, established),
  }));
};

const oddsMovers = (recap, names) => {
  const movers = recap.odds_movers;
  if (!movers) {
    return [];
  }

  const items = [];
  const move = (mover, key, title) => ({
    key,
    title,
    name: names[mover.team_id],
    detail: `${oddsName(recap)} odds ${formatPct(mover.before)} → ${formatPct(mover.after)}`,
  });

  if (movers.rise) {
    items.push(move(movers.rise, 'rise', 'Biggest riser'));
  }

  if (movers.fall) {
    items.push(move(movers.fall, 'fall', 'Biggest drop'));
  }

  if (movers.clinched.length > 0) {
    items.push({
      key: 'clinched',
      title: recap.has_playoffs ? 'Clinched a playoff spot' : 'Clinched the title',
      name: movers.clinched.map((t) => names[t]).join(', '),
    });
  }

  if (movers.eliminated.length > 0) {
    items.push({
      key: 'eliminated',
      title: 'Eliminated',
      name: movers.eliminated.map((t) => names[t]).join(', '),
    });
  }

  return items;
};

/**
 * Every item the recap has, in the order the full page shows them.
 * names: team id -> name. established: the league's first season.
 */
export const recapItems = (recap, names, established) => {
  const items = [
    highScore(recap, names, established),
    luckiestWin(recap, names),
    unluckiestLoss(recap, names),
    hadWho(recap, names),
    bestPickup(recap, names),
  ];

  if (recap.biggest_win) {
    items.push(marginItem(recap.biggest_win, 'blowout', 'Biggest blowout', names));
  }

  // With one game (the final), the closest win is the blowout
  if (recap.closest_win && recap.games.length > 1) {
    items.push(marginItem(recap.closest_win, 'close', 'Closest call', names));
  }

  items.push(lowScore(recap, names, established));
  items.push(...otherAllTimeScores(recap, names, established));
  items.push(...oddsMovers(recap, names));

  return items.filter(Boolean);
};

export const homeItems = (items, count = 4) => {
  const leading = HOME_KEYS.map((key) => items.find((item) => item.key === key));
  return leading.filter(Boolean).slice(0, count);
};

// "First meeting", "All-time series tied 3-3", "Team A leads the all-time series 6-3"
const seriesText = (record, homeName, awayName) => {
  if (!record) {
    return null;
  }

  const { home_wins: homeWins, away_wins: awayWins, ties } = record;
  if (homeWins + awayWins + ties === 0) {
    return 'First meeting';
  }

  let text = `${Math.max(homeWins, awayWins)}-${Math.min(homeWins, awayWins)}`;
  if (ties) {
    text += `-${ties}`;
  }

  if (homeWins === awayWins) {
    return `All-time series tied ${text}`;
  }

  const leader = homeWins > awayWins ? homeName : awayName;
  return `${leader} leads the all-time series ${text}`;
};

// Next week's game of the week: per side, its odds now, with a win and with a loss
export const gameOfTheWeek = (recap, names) => {
  const game = recap.game_of_the_week;
  if (!game) {
    return null;
  }

  const pct = (p) => (p == null ? null : formatPct(p));
  const side = (s) => ({
    name: names[s.team_id],
    now: pct(s.pct),
    win: pct(s.if_win),
    loss: pct(s.if_loss),
  });

  return {
    week: game.week,
    odds: oddsName(recap),
    sides: [side(game.home), side(game.away)],
    series: seriesText(game.head_to_head, names[game.home.team_id], names[game.away.team_id]),
  };
};
