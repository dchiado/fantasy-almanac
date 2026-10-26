# Proposal: Luck and schedule analysis

**Status:** Proposed, not scoped.

## Idea

Show how much of each team's record came from luck and the schedule rather than scoring:

- **All-play record:** a team's record if it played every other team every week.
- **Expected wins vs. actual wins**, by season and by owner: the luckiest and unluckiest seasons in league history.
- **Schedule swap:** each team's record if it had played another team's schedule, as a grid.
- **Close games:** record in games decided by under 5 points.

## Data

Only `mMatchupScore`, which is already cached for every past season. No new ESPN calls.

Power rankings already counts all-play wins for the current season (`update_overall_wins` in `lambdas/powerRankings/lambda_function.py`). This extends that to every season.

## Notes

- Expected wins can come from all-play win % or from the score model in the [playoff odds](playoff-odds.md) proposal. Build them together.
- Track people across seasons by owner ID (SWID), not team ID.
