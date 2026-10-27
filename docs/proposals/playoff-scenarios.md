# Proposal: Playoff scenarios

**Status:** Built (October 2026, step 4 of [season phases](season-phases.md)), not yet deployed.

## Idea

In the stretch run (the last 3 regular-season weeks), show each team its path to the playoffs. ESPN marks teams that have clinched or been eliminated (`playoffClinchType`), but doesn't show what anyone needs.

Current season only. Past seasons show as an end-of-season recap without scenarios.

## What each team gets

- **A status every week:** *Clinched*, *Eliminated*, *In if they win out*, or *Needs help*, next to its playoff odds.
- **This week's conditions**, when they're short: "Clinches with win AND Team X loss", "Eliminated with loss OR Team X win". Conditions only ever cover this week's games, so they stay readable however many weeks are left. The team's own result comes first; other games name the rival that loses (clinching) or wins (elimination).
- When no one- or two-clause statement is exact, the one covering the most results that's still enough on its own is shown as "…, among other ways"; failing that, "Can clinch this week with help".

**Clinched and eliminated mean certain.** A team has clinched only if it's in under every possible result of the remaining games, however the points fall when a record tie goes to total points. Anything less certain shows as odds. That matches ESPN's clinch markers.

## How it works

`utils_layer/python/engine/scenarios.py`, `playoff_scenarios(season, through_week)`, part of the season report (`GET /season`, `scenarios`; `null` outside the stretch run). Shown at the top of the season page and as Home's first card during the stretch run (`frontend/src/components/season/PlayoffPicture.jsx`).

- **Every combination of results** for the remaining games: 2¹⁸ = 262,144 with 3 weeks left in a 12-team league. About 4.5 seconds in plain Python.
- **Certain, whatever the points:** for each combination, a team is "in for sure" if it makes it while losing every tie on record, and "still alive" if it makes it while winning every tie. Under division-winners-first seeding, how other teams' ties break doesn't change how many finish ahead of a team, so this can be counted from records alone (`_Bounds`) instead of running the seeding function. It's exact when ties go to total points (tested against `seed_teams` on random leagues) and conservative for head-to-head: it may miss a clinch head-to-head guarantees, never claim a false one.
- **Stored per set of decided games**, like the rest of the report, so it's computed once per week.

## Checking it

`python3 scripts/check_scenarios.py <leagueId>` replays every past season with 3, 2 and 1 weeks left and checks each claim against what happened: clinched teams made it, eliminated teams didn't, teams "in if they win out" that did made it, and teams whose condition came true got that outcome. Gridiron 2019–2025: 159 claims, all correct. Tests are in `tests/test_scenarios.py`.
