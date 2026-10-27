# Proposal: Playoff odds by week

**Status:** Built for one season at a time (October 2026, step 3 of [season phases](season-phases.md)), not yet deployed. The "Not built yet" section lists what's left.
**Motivating league:** 166975 (Gridiron)

## Problem

ESPN shows each team's playoff % on its standings page, but only the current value. Nobody can look back and see how a team's odds rose and fell through a season, or compare collapses and comebacks across years.

## Why not use ESPN's numbers

ESPN does return its odds. They're in `mStandings`, on each team:

```json
"currentSimulationResults": {
  "playoffPct": 0.84175,
  "divisionWinPct": 0.64675,
  "modeRecord": { "wins": 8, "losses": 6, ... },
  "rank": 3,
  "playoffClinchType": "UNKNOWN"
}
```

But only the latest values. Requesting `scoringPeriodId=1`, `3`, `5` or `7` returned identical numbers for every team (checked October 2026, Week 7). Getting a history would mean saving ESPN's numbers every week, and a missed week couldn't be recovered. We don't want that maintenance.

Instead, we compute the odds ourselves from data that never changes once a season is over.

## Goal

For any season, show a chart of every team's playoff odds week by week, plus highlights of the biggest moves. It works for every past season and can be run once at the end of the year, with no weekly job.

## Design

### Inputs

All already cached in S3 for past seasons:

- `mMatchupScore`: every regular-season game, with scores and winners for games already played (unplayed ones are `UNDECIDED`).
- `mSettings`: `playoffTeamCount`, `playoffSeedingRule`, divisions, `matchupPeriodCount`.
- `mTeam`: final `playoffSeed`, used only to check the seeding logic.

### Seeding function

Given final records and points, it returns the playoff field, following ESPN's rules: division winners, `playoffSeedingRule` and the tiebreak order. This is the core piece, and the playoff scenarios proposal reuses it.

**Done:** `engine/seeding.py`, checked against `playoffSeed` for Gridiron 2005–2025 with `scripts/check_seeding.py`. The rules are in [season phases](season-phases.md#seeding-rules).

### Score model

Each team's weekly score is a bell curve:

- **Average:** the team's average so far, pulled toward the league average: `(k·league_avg + n·team_avg) / (k + n)`, where `n` is games played and `k` is `PRIOR_GAMES` = **10**. Weekly scores vary about three times as much as true team strength does (Gridiron 2019–2025: weekly SD about 22, team-strength SD about 7), which puts `k` near 10. The first guess, 3, was overconfident; see [Checking the numbers](#checking-the-numbers).
- **Spread:** the spread of all weekly scores across the league, since one team's spread over a few games is too noisy.
- **Week 0:** all teams equal, so the odds reflect only the schedule and divisions. Draft-day projections (`draftDayProjectedRank`) could be added later.

### Simulation

For each week N, from 0 to the end of the regular season:

1. Games through week N are final; everything later is unplayed.
2. Draw scores for every unplayed game, 2,000 times (`SIMULATIONS`), with a random seed fixed per league, season and week, so results don't change between page loads.
3. Add the results to the actual records and run the seeding function on each simulated season.
4. Count playoff %, division-win %, how often each team lands at each seed, and average final wins.

Because we simulate scores, not just wins, a total-points tiebreaker is handled automatically. Ties, byes and multi-week matchups all come down to using the matchup's `totalPoints`.

It's plain Python, with no numpy: a whole season (every week) takes about 2 seconds on a laptop. Head-to-head tiebreakers need the simulated games, so `H2H_RECORD` leagues also pass those to `seed_teams`.

### Code

`utils_layer/python/engine/simulation.py`: `score_model`, `odds_after_week`, `playoff_odds` (every completed week plus highlights) and `completed_weeks`. Records for a simulated game come from simulated points, not ESPN's `winner`. Tests are in `tests/test_odds_and_luck.py`.

### API and storage

- **Endpoint:** odds are part of the season report, `GET /season?leagueId=&year=` (`lambdas/season/`, `engine/report.py`), not their own endpoint. One request loads the whole season page.
- **Final seasons:** computed once and saved to `derived/{leagueId}/{year}/season-report-v{REPORT_VERSION}.json`. Bump `REPORT_VERSION` when the model changes.
- **Current season:** through the last week whose games are all decided, stored under a hash of the decided games (`report_inputs`), so it's recomputed only after a game finishes.
- **Unsupported tiebreakers:** `playoff_odds` is `null` and `unsupported_seeding_rule` names the rule; the rest of the report still works.
- **Response** (`playoff_odds` in the report):
  ```json
  {
    "weeks": [
      { "week": 3, "teams": [
        { "team_id": 1, "playoff_pct": 0.62, "division_pct": 0.41, "seed_dist": [0.1, 0.2, ...], "avg_wins": 7.8 }
      ]}
    ],
    "highlights": [{ "type": "collapse", "team_id": 4, "week": 7, "pct": 0.99 }, ...]
  }
  ```

### Frontend

**Chart:** a line chart with weeks on the x-axis, 0–100% on the y-axis and one line per team.

Built as `frontend/src/components/season/` (`/seasons/:year`):

- Twelve colors would be unreadable, so it uses emphasis: every team is a gray context line, and the selected team (the champion by default) is highlighted and labeled at its line end. Tap a team in the table to highlight it. The colors are `chartHighlight`/`chartContext` in `theme.js`, checked with the dataviz palette validator.
- A crosshair follows the pointer, a drag, or the arrow keys. The table under the chart shows every team for that week (playoff %, change, division %, projected wins), so no value is only in a tooltip. On phones, Change, Division and Projected wins are hidden.
- Mid-season odds of 0 or 1 show as `<1%`/`>99%`; only decided results show as 0% or 100%.
- Season picker in the page header. Checked at 375px and desktop.

**Highlights** for the season, shown as cards above or below the chart:

| Highlight | Definition |
| --- | --- |
| Biggest riser | Largest single-week gain in playoff % |
| Biggest faller | Largest single-week drop |
| Collapse | Highest odds reached by a team that missed the playoffs |
| Comeback | Lowest odds reached by a team that made the playoffs |
| Biggest game | The game whose result moved the two teams' odds the most |

Built: riser, faller, collapse, comeback and biggest game (`highlights` in `engine/simulation.py`). Collapse and comeback only appear once the regular season is over. A team's last-week move often wins "biggest jump" or "drop", since the final week settles everything; that's accurate, if less surprising.

The same highlights can also be ranked across every season, for a league-history page: "biggest collapse in Gridiron history".

## Checking the numbers

- **Seeding:** the past-season test above.
- **Calibration:** `python3 scripts/check_odds.py <leagueId>` compares every team's odds after every week (except the last) with whether it made the playoffs, in 10% bands, plus a Brier score. Gridiron 2019–2025 (1,068 predictions, 300 simulations each):

  | | Brier | Given 0–10%, made it | Given 90–100%, made it |
  | --- | --- | --- | --- |
  | `k` = 3 | 0.132 | 6% (predicted 2%) | 94% (predicted 98%) |
  | `k` = 10 | 0.128 | 3% (predicted 2%) | 95% (predicted 97%) |
  | `k` = 15 | 0.128 | 3% (predicted 3%) | 96% (predicted 98%) |

  Always guessing 50% scores 0.25.

  With `k` = 10 across all 21 Gridiron seasons (2005–2025, 3,064 predictions), the result holds. Seasons 2005–2018 weren't used to pick `k`, and the Brier score is **0.127**:

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

  Every band is within 4 points except 40–50% (8 points under). That's about two standard errors, and the predictions aren't independent (each team appears every week), so it's probably noise. Recheck it as seasons are added.
- **Against ESPN:** for the current week, compare with `currentSimulationResults`. They won't match exactly, but a big gap means a bug.

## Not built yet

- Wire-to-wire highlight, and marks for the week each team clinched or was eliminated.
- Highlights ranked across every season (a league-history page).
- Comparing the current week with ESPN's `currentSimulationResults`.

## Related

- [Playoff scenarios](playoff-scenarios.md) reuses the seeding function and simulation.
- [Luck and schedule analysis](luck-and-schedule.md) uses the same weekly scores.
