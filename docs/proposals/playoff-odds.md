# Proposal: Playoff odds by week

**Status:** Proposed, not started. Likely run after the 2026 season ends.
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

**Check it first:** run it on every finished season and compare with `playoffSeed` from `mTeam`. Any mismatch points to the rule we got wrong.

### Score model

Each team's weekly score is a bell curve:

- **Average:** the team's average so far, pulled toward the league average early in the season: `(k·league_avg + n·team_avg) / (k + n)`, where `n` is games played and `k` is about 3.
- **Spread:** the spread of all weekly scores across the league, since one team's spread over a few games is too noisy.
- **Week 0:** all teams equal, so the odds reflect only the schedule and divisions. Draft-day projections (`draftDayProjectedRank`) could be added later.

### Simulation

For each week N, from 0 to the end of the regular season:

1. Games through week N are final; everything later is unplayed.
2. Draw scores for every unplayed game, 10,000 times, using a fixed random seed so results don't change between page loads.
3. Add the results to the actual records and run the seeding function on each simulated season.
4. Count playoff %, division-win %, how often each team lands at each seed, and average final wins.

Because we simulate scores, not just wins, a total-points tiebreaker is handled automatically. Ties, byes and multi-week matchups all come down to using the matchup's `totalPoints`.

With numpy (AWS's managed Lambda layer), one season takes well under a second. Plain Python takes a few seconds.

### Code

Put pure functions in `utils_layer/python/utils/simulation.py`: `season_state`, `score_model`, `simulate` and `seed_teams`. They take parsed ESPN JSON and return plain data, with no AWS or ESPN calls, so they can be tested locally against saved responses.

### API and storage

- **New lambda:** `GET /playoff-odds?leagueId=&year=`, in Python, to use the utils layer and numpy.
- **Past seasons:** compute once and save to `derived/{leagueId}/{year}/playoff-odds-v1.json`. Bump the version when the model changes.
- **Current season:** compute on each request.
- **Response:**
  ```json
  {
    "weeks": [
      { "week": 3, "teams": [
        { "teamId": 1, "playoffPct": 0.62, "divisionPct": 0.41, "seedDist": [0.1, 0.2, ...], "avgWins": 7.8 }
      ]}
    ],
    "highlights": [ ... ]
  }
  ```

### Frontend

**Chart:** a line chart with weeks on the x-axis, 0–100% on the y-axis and one line per team.

- Twelve lines at once is unreadable, so fade all lines by default and highlight one team at a time. On desktop, highlight the line under the cursor; on phones, tap a team in the legend or table.
- Add a horizontal marker at the playoff cutoff, and mark the week each team clinched or was eliminated.
- Season picker, like the other pages.
- Check at ~375px; most traffic is on phones.

**Highlights** for the season, shown as cards above or below the chart:

| Highlight | Definition |
| --- | --- |
| Biggest riser | Largest single-week gain in playoff % |
| Biggest faller | Largest single-week drop |
| Collapse | Highest odds reached by a team that missed the playoffs |
| Comeback | Lowest odds reached by a team that made the playoffs |
| Wire to wire | Teams that stayed above 90% (or below 10%) all season |
| Biggest game | The game whose result moved the two teams' odds the most |

The same highlights can also be ranked across every season, for a league-history page: "biggest collapse in Gridiron history".

## Checking the numbers

- **Seeding:** the past-season test above.
- **Calibration:** across all past seasons and weeks, teams we gave about 70% should have made it about 70% of the time. Compare in 10% bands.
- **Against ESPN:** for the current week, compare with `currentSimulationResults`. They won't match exactly, but a big gap means a bug.

## First step

Get Gridiron's `mSettings` for one past season and the current one, build the seeding function, and test it against every past season.

## Related

- [Playoff scenarios](playoff-scenarios.md) reuses the seeding function and simulation.
- [Luck and schedule analysis](luck-and-schedule.md) uses the same weekly scores.
