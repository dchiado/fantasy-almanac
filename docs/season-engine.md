# Season engine

How the season features work: the season model, seeding, playoff odds, playoff scenarios and luck. The rules they follow are in the README under "Core rules"; how to run the tests and checks is under "Season engine".

All of it is in `utils_layer/python/engine/`, served as one report by `GET /season?leagueId=&year=` (`lambdas/season/`, `engine/report.py`).

## Final data

A season is **final** when its ESPN data can't change any more:

- Seasons before the league's current one (per ESPN) are final.
- The current season is final `FINAL_GRACE_PERIOD` (7 days) after it was first seen with every week played (`latestScoringPeriod > finalScoringPeriod` in `mStatus`). The first sighting is recorded in `espn-cache/{league}/{year}/_finality.json`. The grace period covers stat corrections.

A week (one scoring period's views, such as `mRoster`) is final by the same idea: once ESPN is two scoring periods past it, so the following week has been played too, about 7 days. No marker is needed: `week_is_final` reads `latestScoringPeriod` from the live `mStatus`. Until then a weekly recap is computed from live data and stored by a hash of the week's scores, so it can show the morning after the week ends.

The phase uses "every week played", not "final", so the recap is available as soon as the champion is known. It fills in with corrected numbers once the season is final.

## Season model

`engine/season.py`: `parse_season` turns `mSettings`, `mMatchupScore` and `mTeam` into `Settings`, `Team`s (with owner SWID and name) and `Game`s (week, tier, both sides, points, winner). `records(season, through_week)` builds regular-season records from ESPN's `winner`, not by comparing points, because some leagues break equal scores.

**Weekly bonus win.** With `scoringEnhancementType` `WIN_BONUS_TOP_HALF`, each team also gets a win for every week it scores in the top half of the league, and a loss otherwise, so a 17-week season has 34 results. `records` includes it, as ESPN's standings do; this matches ESPN's records exactly for league 9003602 (2024–2026). We haven't seen a tie on the halfway line, so teams level there get a tie as a guess. The simulation hands out the bonus each simulated week. Luck counts head-to-head games only, and there are no scenarios (below). Any other `scoringEnhancementType` is unsupported, like an unsupported seeding rule.

**No playoffs.** A league with `playoffTeamCount` 0 has no bracket: first place wins the title (ESPN's final rank matched the seed order in 9003602's seasons). `Settings.spots` is then 1, so the playoff odds, clinches and scenarios are all about finishing first, and the report's `has_playoffs: false` tells the frontend to call them title odds. There's no bubble highlight.

Engine functions take a `through_week`, so stretch-run and playoff screens can be tested on a past season stopped at any week. That isn't a user-facing feature: past seasons show as an end-of-season recap.

## Seeding

`engine/seeding.py`, `seed_teams(records, rule)`. Observed from Gridiron's 2005–2025 seasons (8 to 12 teams, one to four divisions); all 21 seasons match ESPN's `playoffSeed` for every team:

1. Each division's winner is seeded first, best record first.
2. Every other team follows, best record first.
3. Ties, including ties for a division, go to `playoffSeedingRule`.

Tiebreakers implemented:

- `TOTAL_POINTS_SCORED`: more points for.
- `H2H_RECORD`: with **two** tied teams, the better record in games between them, then more points for. With **three or more**, ESPN doesn't compare head-to-head across the group. The team with the most points goes first, and the rest are compared again, so head-to-head only decides the last two. Gridiron used this rule in 2005, 2006 and 2012–2014.

Any other rule raises `UnsupportedSeedingRule`; the report then has `playoff_odds: null` and `unsupported_rule` naming the rule, and the rest still works. Add a rule when a league that uses it can be checked with `scripts/check_seeding.py`.

## Playoff odds

`engine/simulation.py`. ESPN's own odds (`currentSimulationResults` in `mStandings`) only exist for "now": requesting earlier scoring periods returns the same numbers. So we compute our own from final data.

**Score model.** Each team's weekly score is a bell curve:

- **Average:** the team's average so far, pulled toward the league average: `(k·league_avg + n·team_avg) / (k + n)`, where `n` is games played and `k` is `PRIOR_GAMES` = **10**. Weekly scores vary about three times as much as true team strength does (Gridiron 2019–2025: weekly SD about 22, team-strength SD about 7), which puts `k` near 10.
- **Spread:** the spread of all weekly scores across the league, since one team's spread over a few games is too noisy.
- **Week 0:** all teams equal, so the odds reflect only the schedule and divisions.

**Simulation.** For each week N, games through week N are final. Scores for every unplayed game are drawn 2,000 times (`SIMULATIONS`), with a random seed fixed per league, season and week, so results don't change between page loads. Each simulated season is seeded with `seed_teams`, giving playoff %, division-win %, seed distribution and average wins. Simulating scores rather than wins handles a total-points tiebreaker automatically; `H2H_RECORD` leagues also pass the simulated games to `seed_teams`. Plain Python, about 2 seconds for a whole season.

**Highlights** (once the regular season is over):

| Highlight | Definition |
| --- | --- |
| Biggest collapse | Highest odds reached from week 1 on by a team that missed the playoffs |
| Biggest comeback | Lowest odds reached from week 1 on by a team that made the playoffs |
| The bubble | The last team in and the first team out, and what separated them |

Biggest single-week rises and drops were tried and dropped: they almost always land in week 1 or the last week.

**Calibration.** `scripts/check_odds.py` compares every team's odds after every week (except the last) with whether it made the playoffs. `k` was picked on Gridiron 2019–2025 (`k` = 3 was overconfident: Brier 0.132 vs 0.128). Across all 21 Gridiron seasons (3,064 predictions), the Brier score is **0.127** (always guessing 50% scores 0.25):

| Band | Teams | Predicted | Made it |
| --- | --- | --- | --- |
| 0–10% | 677 | 3% | 3% |
| 10–20% | 256 | 15% | 14% |
| 20–30% | 245 | 25% | 24% |
| 30–40% | 256 | 35% | 38% |
| 40–50% | 230 | 45% | 37% |
| 50–60% | 236 | 55% | 56% |
| 60–70% | 232 | 65% | 65% |
| 70–80% | 227 | 75% | 78% |
| 80–90% | 188 | 85% | 89% |
| 90–100% | 517 | 97% | 97% |

40–50% is 8 points under, about two standard errors with correlated predictions, so probably noise. Recheck as seasons are added.

## Playoff scenarios

`engine/scenarios.py`, `playoff_scenarios(season, through_week)`; `null` outside the last 3 regular-season weeks, and in leagues with a weekly bonus win, where who's in depends on every team's score and not just who wins.

- Each team gets a status (*Clinched*, *Eliminated*, *In if they win out*, *Needs help*) and, when short enough, this week's conditions: "Clinches with win AND Team X loss". Conditions only cover this week's games. When no one- or two-clause statement is exact, the one covering the most results is shown as "…, among other ways"; failing that, "Can clinch this week with help".
- **Clinched and eliminated mean certain**, however the points fall, matching ESPN's clinch markers.
- Every combination of results for the remaining games is checked: 2¹⁸ = 262,144 with 3 weeks left in a 12-team league, about 4.5 seconds. A team is "in for sure" if it makes it while losing every tie on record, and "still alive" if it makes it while winning every tie. Under division-winners-first seeding, this can be counted from records alone (`_Bounds`). It's exact when ties go to total points and conservative for head-to-head: it may miss a clinch, never claim a false one.
- `scripts/check_scenarios.py` replays past seasons with 3, 2 and 1 weeks left and checks each claim against what happened. Gridiron 2019–2025: 159 claims, all correct.

## Luck and schedule

`engine/luck.py`:

- `luck(season, through_week)`: per team, all-play record, expected wins (the sum of its weekly all-play win percentage), luck (actual minus expected wins) and close-game record (`CLOSE_GAME_MARGIN` = 5). Across a season, luck sums to zero.
- `schedule_swap(season, through_week)`: each team's record on every other team's schedule. When B's opponent was A, A plays B instead.

## Weekly recap

`engine/recap.py`: one week's stories, for every week of every season. Playoff weeks use winners-bracket games only, and a matchup spanning two scoring periods adds both.

- **High and low score** always show. A score gets its all-time rank only in the top or bottom 5% of league history (`NOTEWORTHY_SHARE`; at 10% the week's high score made it about 72% of weeks), and other scores that week in that 5% are listed too. Ranks count only games up to that week, so a stored recap never goes stale.
- **Biggest and closest win** by margin.
- **Luckiest win and unluckiest loss** by place among the week's scores: the lowest-scoring winner if it was in the bottom half, the highest-scoring loser if in the top half. If the top half all won, neither shows.
- **You had who and still lost:** the highest-scoring starter on a losing team.
- **Best pickup:** among adds made that week (one `mTransactions2` per week), one that started and outscored the margin of a win "won it for them"; otherwise the highest-scoring add, started or not. The FAAB bid is shown, but there's no points-per-dollar: that's a season-long measure.
- **Bench blunders and most points left on the bench:** see [Lineup efficiency](#lineup-efficiency).
- **Odds movers** (regular season): the biggest rise and fall in playoff odds, and who clinched or was eliminated. Clinches come from the scenarios (last 3 weeks) or the final standings, never from a simulated 100%.
- **Game of the week** (stretch run only): next week's game whose result moves the two teams' odds the most, from the simulation's odds with a win and with a loss, plus the owners' head-to-head record.

Left out: live scores and projections (ESPN shows them, and projections only exist "now"), the full odds table (on Playoff race), power rankings movers (on Power rankings, and only computed for the current week), and AI writeups.

## Lineup efficiency

`engine/lineups.py` compares each team's lineup with the best one it could have started. The weekly recap lists its bench blunders and the most points left on the bench; `GET /lineups` gives the regular-season totals on Standings and the past-season recap.

- **Best lineup:** every starting slot in `rosterSettings.lineupSlotCounts` is filled from that scoring period's roster, by each player's `eligibleSlots`. Slots, not positions, so RB/WR, FLEX, OP (superflex) and IDP slots need no special cases. Every slot that can be filled is, whatever its player scored: a D/ST at −2 starts unless the roster had a better one. IR players are left out. A matchup spanning two scoring periods is the best lineup of each, added up.
- **Algorithm:** take players by points, highest first, and keep each one if everyone kept so far can still get a slot (an augmenting-path check). The lineups form a transversal matroid, so this greedy choice is optimal, with overlapping flex slots and negative scores. On equal points the actual starter is kept, so a tie is never a swap.
- **Points left on the bench** = best lineup − actual starters, both from `mRoster`, never the matchup score (see the data check).
- **Bench blunder:** a team that didn't win, whose score plus its points left beats the opponent's **actual** score. It asks whether a team's own choices cost it the game, so two teams can both blunder in different games, and the "best lineups" records add up to more wins than games. Season records are head-to-head, regular season only, without the top-half bonus.
- **Hindsight:** lineup locks (Thursday against Monday players) are ignored.
- **Storage:** like the report, under a hash of the decided regular-season games (`lineups_inputs`). Rosters aren't in it, so a stat correction to a bench player shows once the week or season is final.

Checked on every week of Gridiron 2019–2025 (October 2026): `eligibleSlots` and `lineupSlotCounts` are always there, slot counts never change mid-season, and the best lineup is never below the actual one. Starters' points match the final score in every game but the 2022 championship: the cancelled Bills–Bengals game (Damar Hamlin) is gone from `mRoster` but its partial points are in the matchup scores, which is why points left come from rosters alone. About 30–40 bench blunders a season, 0–6 a week. 2018 and earlier, which need a cookie, aren't checked.

## Open questions

- Whether the seven-day grace period is long enough for ESPN's stat corrections.
- What `playoffSeedingRuleBy` means (always 0 for Gridiron).
- Comparing our current-week odds with ESPN's `currentSimulationResults`. They won't match exactly, but a big gap would mean a bug. Not built.
