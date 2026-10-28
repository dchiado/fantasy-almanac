# Proposal: Weekly recap

**Status:** Version 1 built (October 2026), with these changes from the design below:

- **High and low score** always show; a score gets its all-time rank only in the top or bottom 5% of league history (10% flagged the week's high score about 72% of weeks). Other scores that week in that 5% are listed too. Ranks count only games up to that week, so a stored recap never goes stale.
- **Luckiest win and unluckiest loss** are by place among the week's scores: the lowest-scoring winner if it was in the bottom half, the highest-scoring loser if in the top half. If the top half all won, neither shows.
- **Best pickup** is limited to adds made that week, so it needs one `mTransactions2` per week rather than weeks 1 to N. One that started and outscored the margin "won it for them"; otherwise it's the highest-scoring add, started or not.
- **What's at stake** became **Game of the week**: only in the stretch run (next week is one of the last 3 regular-season weeks), the one game whose result moves the two teams' playoff odds the most, with the owners' head-to-head record.
- **Clinched and eliminated** come from the scenarios (last 3 weeks) or the final standings, never from a simulated 100%.
- **Playoff weeks** use winners-bracket games only. A matchup spanning two scoring periods adds both.
- **Week finality** is stateless: final once ESPN is two scoring periods past it.

AI writeups and pick 'em are still stretch goals.
**Motivating league:** 166975 (Gridiron), which used to get a weekly newsletter, *The Gridiron Gazette*.

## Idea

A page, once a week, with the week's stories: who scored most, who got lucky, who had a monster game and still lost. It's the Gazette's "Week N Recap" section, worked out from the scores.

Because a recap is a pure function of the week's final data, there's one for **every week of every season**, not only the latest. A league's whole history can be browsed week by week.

## What's in a recap

### Version 1

| Item | Definition | Data |
| --- | --- | --- |
| High and low score | Highest and lowest score of the week, with where it ranks in league history ("4th highest ever") | Season model; all-time rank from every final season, as `individualWeeks` does |
| Biggest win, closest win | Largest and smallest margin | Season model |
| Luckiest win | The winner with the fewest all-play wins that week ("would have lost to seven other teams") | Season model, all-play as in `engine/luck.py` |
| Unluckiest loss | The loser with the most all-play wins that week | Same |
| You had who and still lost | The highest-scoring starter on a losing team | Weekly `mRoster` |
| Best pickup | The free-agent or waiver add with the most points as a starter for its new team that week. "Won it for them" when those points were more than the margin of victory | Weekly `mRoster` + `mTransactions2` |
| Odds movers | Biggest rise and fall in playoff odds this week, plus anyone who clinched or was eliminated | Season report (`playoff_odds`, `scenarios`); regular season only |
| What's at stake | For the next week's games: each team's playoff odds with a win vs a loss, and the two owners' head-to-head record | Simulation (see below), `headToHead` |

During the playoffs the odds items drop out and the rest still apply.

### Later

- **Bench blunder:** a team that would have won with its best possible lineup. It needs the best-lineup function from [lineup efficiency](lineup-efficiency.md), so build that once and use it in both.
- **Power rankings movers**, linking to Power rankings. Only possible for the latest week, since `powerRankings` only computes the current week.

### Left out

- **Live scores and projections** (the Gazette's "after Thursday games" preview): ESPN already shows them, and projections only exist "now" (rule 2).
- **The full odds table:** it's on Playoff race. The recap shows movers and links there.

## Data check (October 2026)

Checked against Gridiron 2019 week 10, using the Gazette's own recap as the answer key, and spot-checked on 2025 week 5. Both seasons are served publicly through `/seasons/{year}`.

- **Weekly lineups and points: works.** In `mRoster` with `scoringPeriodId=N`, `lineupSlotId` is that week's slot, and the week's points are in `player.stats` (`scoringPeriodId` N, `statSourceId` 0). For all 12 teams in both weeks, starters' points add up exactly to the final score. The Gazette's numbers match: Derrick Henry 35.1 for AB's Propaganda Video, Kyle Rudolph 19.4 for Gruden Says. A team playing with an empty slot has fewer roster entries ("a tank constantly on Empty").
- **How a player joined a team: needs transactions.** `acquisitionType` and `acquisitionDate` are null in past seasons' `mRoster`. `mTransactions2` keeps the full history, but only per week: without `scoringPeriodId` a past season returns nothing. Rudolph's season: drafted by team 18 (week 1), dropped (week 3), added by team 19 (week 8), dropped (week 9), then a free-agent add by Gruden Says (week 10), matching the Gazette's "best free agent pickup".
- **Not checked:** 2018 and earlier, which need a cookie. Also, `utils._fetch` sends 2019 to `leagueHistory`, which refuses 2019 without a cookie even though `/seasons/2019` serves it.

The gotchas are in [ESPN API: gotchas](../espn-api/README.md#gotchas).

## Design

### Engine

`engine/recap.py`, `weekly_recap(season, week, lineups, acquisitions, report)`: plain data in, plain data out, like the rest of the engine.

- `lineups`: per team, each player's slot and points that week, parsed from weekly `mRoster`. Parsed in `engine/` (say `parse_lineups`) so lineup efficiency can reuse it.
- `acquisitions`: for each starter, how they last joined their current team (draft, free agent, waiver, trade), from `mTransactions2` for weeks 1 to N. Only executed `ADD`/`DRAFT`/`TRADE` items count.
- **What's at stake** comes from the simulation that already produces week N's odds. Each simulated season already plays week N+1's games, so bucket the results by each game's winner: P(playoffs | win) = seasons where the team won and made it ÷ seasons where it won. That adds no extra simulation runs.

### Lambda and storage

- `GET /recap?leagueId=&year=&week=` in `SeasonFunction`, which already loads the season and the report. Without `week`, it returns the latest week whose games are all decided.
- **Final weeks:** stored at `derived/{league}/{year}/weeks/{week}/recap-v{n}.json`.
- **Week finality.** Today only final seasons are archived, so in the current season every recap request would fetch weekly `mRoster` and up to N weeks of `mTransactions2` live. Implement the week finality already described in [season engine](../season-engine.md#final-data): week N is final once week N+1 has been played and corrected. `load_data(..., week=N)` then archives a current-season week once it's final. Until then, the recap is stored by a hash of that week's scores, like an in-progress season report, so stat corrections recompute it.
- Cost: one weekly `mRoster` (about 1 MB) and one `mTransactions2` (about 30 KB) per week, each fetched once.

### Frontend

- **Home:** in `regular_season` and `stretch_run`, the latest recap is the lead card (`CARDS_BY_PHASE`), above the playoff picture or odds. A short version showing the 3–4 best items, linking to the full page.
- **Recap page** (`/seasons/:year/weeks/:week`): every item, with the week's scoreboard underneath and previous/next week links. Past-season recaps (`/seasons/:year`) get a list of their weekly recaps.
- Item names carry the Gazette's tone ("You had who and still lost") even without written jokes.
- Mobile first: one column of item cards at 375px.

## Stretch goal: AI writeups

One Claude call per league-week, turning the recap's JSON into a few lines per item in the Gazette's voice. Same pattern as `writePowerRankings`: invoked asynchronously, stored in S3, and the page shows the plain recap until the writeup is ready.

- Generated only for a decided week, stored under the recap's input hash, so a stat correction or a prompt change (`-v{n}`) produces a new one. It's never regenerated for the same inputs.
- Same guards as power rankings (README, "Claude costs"): only `AI_LEAGUES`, a claimed `status.json` per league-week, and a failure is never retried. Past weeks are generated only on request for allowlisted leagues, never backfilled across a league's history.
- Claude sees team names, owner names and scores, the same as the power rankings writeups.

## Stretch goal: pick 'em

League members pick the winner of each of next week's fantasy matchups, with standings across the season, replacing the Gazette's Google Form.

This is the app's first stored **user input**, an exception to "everything is a function of ESPN data" (README, "Core rules"). Add a rule saying so if it's built.

### Storage

DynamoDB, because it needs conditional writes. One table:

| Key | Value |
| --- | --- |
| `pk` | `{leagueId}#{year}` |
| `sk` | `{week:02}#{ownerSwid}` |
| `picks` | `{ matchupId: teamId }` for that week's games |
| `submittedAt` | timestamp |

One query (`pk` = league and season) returns every pick of the season.

### Who's picking

There's no auth, so the visitor picks their own name from the league's owners (from the season model), and the browser remembers it. Like the Google Form, it's on the honor system. To limit mischief:

- **Write-once:** a conditional put (`attribute_not_exists(sk)`) means a week's picks can't be changed or overwritten once submitted.
- **Locks at kickoff:** no picks for a week after its first NFL game starts, enforced by the lambda. Where the kickoff time comes from is an open question.
- **Access check:** reading and writing picks goes through the same live `mStatus` check as every other request (rule 5), so a private league's picks need a valid cookie.
- **Allowlist:** a `PICKEM_LEAGUES` env var, so the table can't be filled with picks for arbitrary league IDs.

### Scoring

Nothing runs at the end of the week. Standings are computed on read: load the season's picks, compare each with the game's `winner` in the season model, and count only decided games. "Next week, check the previous weeks" happens on its own, whenever someone opens the page. Picks for games not yet decided show as pending.

Each owner's picks stay hidden until the week locks, then everyone's are shown, with "last week" and "overall" records as in the Gazette.

### Open questions

- Kickoff time: ESPN's pro schedule (`proTeamSchedules_wl`) probably has game times, but that's unchecked. A fixed lock (Thursday 8:15 pm ET) is simpler but wrong in weeks with Wednesday or international games.
- Guests: the Gazette had a non-owner ("Ricky Bobby"). Owners only is simpler.
- Whether a forgotten week counts as 0 wins or is left out of the percentage.

## Open questions

- Name: "Weekly recap", or keep "The Gazette" for leagues that want it.
- Whether "best pickup" should also count waiver bids: points per FAAB dollar, from `bidAmount`.
- How the all-time rank of a score is computed cheaply. Load every final season's model (archived, so no ESPN calls), or store an all-time list at `derived/{league}/all-time/` keyed by the last final season.
