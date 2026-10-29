# ESPN Fantasy API reference

> **This is not Fantasy Almanac's API.** It's a reference for ESPN's unofficial, undocumented Fantasy API, which this app consumes. Everything here was learned by observation and may change without notice.

The JSON files in this folder are **real ESPN responses, trimmed and anonymized**:
- Arrays of objects are cut to two entries; long arrays of values are cut to ten. The shape is accurate, but counts are not.
- League member names and SWIDs are replaced with placeholders (`member1`, `{00000000-0000-0000-0000-000000000001}`).
- Samples come from different leagues and seasons, so IDs don't line up across files.

## Endpoints

**Football, 2020 and later**
```
https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{year}/segments/0/leagues/{leagueId}?view={view}
```

**Football, 2019 and earlier**
```
https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/leagueHistory/{leagueId}?seasonId={year}&view={view}
```
`leagueHistory` returns a **JSON array** holding the season object, not the object itself.

**Baseball:** same as football, with game code `flb` in place of `ffl`.

### Query parameters

| Param | Purpose |
| --- | --- |
| `view` | Which slice of league data to return (see below). Repeat it to combine views: `?view=mTeam&view=mRoster`. |
| `scoringPeriodId` | A specific week (football) or day (baseball). Defaults to the current one. |
| `seasonId` | Season year, for `leagueHistory` only. |

### Headers

- **`x-fantasy-filter`**: a JSON filter used to page and sort player lists, e.g. for `kona_player_info`:
  ```json
  {"players": {"limit": 1500, "sortDraftRanks": {"sortPriority": 100, "sortAsc": true, "value": "STANDARD"}}}
  ```

## Authentication

Public leagues need no auth. **Private leagues** need ESPN's login cookies:

```
Cookie: espn_s2=<token>; SWID=<{GUID}>
```

`espn_s2` is the token that matters; in practice it's often enough on its own. Users copy it from their browser's cookies on espn.com. It lasts months, but eventually expires and has to be copied again. ESPN offers no OAuth or other third-party login.

**Privacy is per season.** For a private league, ESPN may still serve past seasons with no cookie. Observed October 2026 for league 166975: 2019–2025 through `/seasons/{year}` were public; 2026, and 2018 and earlier, needed the cookie. `/seasons/2019` worked without a cookie even though `leagueHistory` for 2019 didn't.

## Errors

Failures return a non-2xx status with a `details` array:

```json
{"details": [{"type": "AUTH_LEAGUE_NOT_VISIBLE", "message": "..."}]}
```

| `type` | Meaning |
| --- | --- |
| `AUTH_LEAGUE_NOT_VISIBLE` | League is private and no valid cookie was sent (or the cookie expired). |
| `GENERAL_NOT_FOUND` | No such league, or no such season. Also returned for the new season's year until ESPN rolls the league over, so early in the calendar year, ask for the previous year. `leagueHistory` also returns it, instead of `AUTH_LEAGUE_NOT_VISIBLE`, for a private league's season when no cookie is sent. |

## Views

Every view also includes the league envelope: `id`, `gameId`, `seasonId`, `segmentId`, `scoringPeriodId`, `status`, and usually `draftDetail`.

### League and settings

| View | Contains | Sample |
| --- | --- | --- |
| `mStatus` | Season state: `currentMatchupPeriod`, `latestScoringPeriod`, `finalScoringPeriod`, `previousSeasons` (all past years), `teamsJoined`, `isActive`. | [football](football/mStatus.json) |
| `mSettings` | League rules: `name`, `scheduleSettings` (regular-season length, playoff team count), `scoringSettings`, `rosterSettings`, `tradeSettings` (`deadlineDate`), `draftSettings`, `acquisitionSettings`. | [football](football/mSettings.json) · [baseball](baseball/mSettings.json) |
| `mNav` | Lightweight league overview: `settings.name`, `members`, `teams` with `owners`. Good for "who's in this league". | [football](football/mNav.json) |
| `kona_game_state` | Minimal league, team and member snapshot. | [football](football/kona_game_state.json) |

### Teams and rosters

| View | Contains | Sample |
| --- | --- | --- |
| `mTeam` | Teams with `record` (overall, home, away), `playoffSeed`, `rankCalculatedFinal`, `points`, `owners`/`primaryOwner`, `logo`, transaction counts; plus `members` (names and IDs). | [football](football/mTeam.json) · [baseball](baseball/mTeam.json) |
| `mRoster` | Each team's `roster.entries`: player, `lineupSlotId`, `acquisitionType`, `acquisitionDate`, injury status, stats. | [football](football/mRoster.json) |
| `mDraftDetail` | `draftDetail.picks`: `roundId`, `roundPickNumber`, `overallPickNumber`, `playerId`, `teamId`, `keeper`, `bidAmount`. | [football](football/mDraftDetail.json) |
| `mTransactions2` | `transactions`: trades, adds, drops and waivers, with `items`, `type`, `status`, `bidAmount`, `proposedDate`. | [football](football/mTransactions2.json) |

### Matchups and scoring

| View | Contains | Sample |
| --- | --- | --- |
| `mMatchupScore` | `schedule`: every matchup with `matchupPeriodId`, `playoffTierType`, `winner`, and `home`/`away` `totalPoints` + `pointsByScoringPeriod`. The best view for season-long results. | [football](football/mMatchupScore.json) |
| `mMatchup` | `schedule` (with `gamesPlayed` and `pointsByScoringPeriod` per side) plus `teams[].roster`. | [football](football/mMatchup.json) |
| `mScoreboard` | `schedule`, `teams` and `settings` for a scoreboard: scores, tiebreaks and cumulative points. | [football](football/mScoreboard.json) · [baseball](baseball/mScoreboard.json) |
| `mLiveScoring` | `schedule` with in-progress scoring for the current period. This sample was captured outside a live period, so its matchups are empty stubs. | [football](football/mLiveScoring.json) |
| `mStandings` | `schedule` with each team's `totalPoints` and `gamesPlayed` per matchup period, plus `teams`. | [baseball](baseball/mStandings.json) |

### Players

| View | Contains | Sample |
| --- | --- | --- |
| `kona_player_info` | Player pool: each player's ownership, draft ranks, ratings and stats. Use with `x-fantasy-filter`. | [football](football/kona_player_info.json) |
| `players_wl` | Lightweight player list: name, `defaultPositionId`, `eligibleSlots`, `proTeamId`, ownership %. | [football](football/players_wl.json) |
| `mPositionalRatings` | `positionAgainstOpponent.positionalRatings`: average points each NFL defense allows to each position, with rank. | [football](football/mPositionalRatings.json) |
| `mPositionalRatingsStats` | Same as `mPositionalRatings`, plus the underlying stats. | [football](football/mPositionalRatingsStats.json) |

### Other

| View | Contains | Sample |
| --- | --- | --- |
| `kona_league_communication` | League message board and activity feed (`communication.topics`). | [football](football/kona_league_communication.json) |
| — | `scoresettings.json` is a standalone `scoringItems` list (`statId` → `points`), the same shape as `settings.scoringSettings.scoringItems` in `mSettings`. | [football](football/scoresettings.json) |

## Gotchas

- **Matchups are flat, not grouped by week.** `schedule` is one array; group by `matchupPeriodId`. A matchup missing `away` (or `home`) is a bye.
- **Non-head-to-head leagues** (like the baseball samples) don't use `home`/`away`: each `schedule` entry has a `teams` array with every team's points for that period.
- **`playoffTierType`** is `NONE` for the regular season, `WINNERS_BRACKET` for the playoffs, `WINNERS_CONSOLATION_LADDER` for placement games among playoff teams (e.g. third place), and `LOSERS_CONSOLATION_LADDER` for consolation games.
- **Playoff byes** are `WINNERS_BRACKET` entries with only `home` and `winner: "UNDECIDED"`, even after the season ends. Don't use "every matchup decided" to tell that a season is over.
- **A finished season** has `status.latestScoringPeriod > status.finalScoringPeriod` in `mStatus` (e.g. 18 vs 16 for 2019). During the final week they're equal.
- **Playoff seeding** (`mTeam` `playoffSeed`, for every team): division winners first, then everyone else, each by record, with ties broken by `scheduleSettings.playoffSeedingRule` (`TOTAL_POINTS_SCORED` or `H2H_RECORD` seen so far). With `H2H_RECORD`, head-to-head only settles a two-team tie; in a larger tie, the team with the most points goes first and the rest are compared again. Checked against all 21 seasons (2005–2025) of one league; see `utils_layer/python/engine/seeding.py`. What `playoffSeedingRuleBy` means is unknown.
- **`winner` decides ties, not points.** Use it rather than comparing `totalPoints`; some leagues break equal scores.
- **Scoring periods aren't matchup periods.** A matchup period can cover several scoring periods (always in baseball, sometimes in football playoffs). `pointsByScoringPeriod` breaks them out.
- **Team names:** older responses split names into `location` + `nickname`; newer ones use `name`.
- **Owners vs teams:** team IDs can be handed from one owner to another over the years. To track a person across seasons, use the owner's member ID (SWID), not the team ID.
- **Weekly lineups and player points** come from `mRoster` with `scoringPeriodId=N`, including for past seasons. Each entry's `lineupSlotId` is that week's slot (20 is the bench, 21 IR). A player's points that week are in `player.stats`, in the entry with `scoringPeriodId` N and `statSourceId` 0 (1 is ESPN's projection). For Gridiron 2019 week 10 and 2025 week 5, starters' points added up exactly to every team's final score. A team with an empty slot has fewer entries.
- **Older seasons have no weekly player points.** For Gridiron, 2018–2025 have them (week 5 checked, starters adding up to every score). 2010–2017 return each week's rosters and lineup slots, but each player's only stats entry is the season total (`scoringPeriodId` 0, under the league's scoring). Anything built on weekly player points has to check that starters add up to team scores and leave out seasons where they don't.
- **`acquisitionType` and `acquisitionDate` are null in past seasons' `mRoster`** (2019 and 2025 checked). To tell how a player joined a team, use `mTransactions2`.
- **`mTransactions2` needs `scoringPeriodId`.** Without it, a past season returns no transactions. With `scoringPeriodId=N` it returns that week's transactions, executed and not: drafts (in week 1, as `DRAFT` items), free-agent and waiver adds (`bidAmount`), drops, trades and lineup moves. Checked for Gridiron 2019 (every week) and 2025.
- **Data is in IDs.** Positions, lineup slots, pro teams and stat IDs are all numeric. The [cwendt94/espn-api](https://github.com/cwendt94/espn-api) project maintains the lookup tables (`espn_api/football/constant.py`, `espn_api/baseball/constant.py`).

## Further reading

- [cwendt94/espn-api](https://github.com/cwendt94/espn-api)
