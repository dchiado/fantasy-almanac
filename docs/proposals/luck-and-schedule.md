# Proposal: Luck and schedule analysis

**Status:** Built per season (October 2026, step 3 of [season phases](season-phases.md)), not yet deployed: all-play, expected wins, luck, close games and the schedule swap grid are on the season page. Not built: luck by owner across seasons ("luckiest seasons in league history").

## Idea

Show how much of each team's record came from luck and the schedule rather than scoring:

- **All-play record:** a team's record if it played every other team every week.
- **Expected wins vs. actual wins**, by season and by owner: the luckiest and unluckiest seasons in league history.
- **Schedule swap:** each team's record if it had played another team's schedule, as a grid.
- **Close games:** record in games decided by under 5 points.

## Data

Only `mMatchupScore`, which is already cached for every past season. No new ESPN calls.

Power rankings already counts all-play wins for the current season (`update_overall_wins` in `lambdas/powerRankings/lambda_function.py`). This extends that to every season.

## Built

`utils_layer/python/engine/luck.py`:

- `luck(season, through_week)`: per team, all-play record, expected wins (the sum of its weekly all-play win percentage), luck (actual minus expected wins) and close-game record (`CLOSE_GAME_MARGIN` = 5). Sorted luckiest first. Across a season, luck sums to zero.
- `schedule_swap(season, through_week)`: each team's record on every other team's schedule. When B's opponent was A, A plays B instead. The diagonal is the actual record, compared on points.

Both are part of the season report (`GET /season`) and shown on `/seasons/:year`. Tests are in `tests/test_odds_and_luck.py`.

## Notes

- Expected wins can come from all-play win % or from the score model in the [playoff odds](playoff-odds.md) proposal. Build them together.
- Track people across seasons by owner ID (SWID), not team ID.
