# Proposal: Lineup efficiency

**Status:** Proposed, not scoped.

## Idea

Compare each team's actual lineup with the best lineup it could have started:

- **Points left on the bench**, by week, season and owner.
- **Losses caused by lineup choices:** games a team would have won with its best possible lineup.
- **Best and worst lineup setters** in league history.

ESPN doesn't show any of this.

## Data

`mRoster` (or `mMatchup`) with `scoringPeriodId`, once per week. It gives each player's lineup slot (`lineupSlotId`) and points for that week. The roster rules (`rosterSettings` in `mSettings`) say which slots each position can fill.

That's about 17 ESPN calls per season, so it's the most expensive feature here.

## Before starting

- **Fix the S3 cache key.** `load_data` saves past seasons to `espn-cache/{league}/{year}/{view}.json`, without the week (`utils_layer/python/utils/__init__.py`). Weekly responses would overwrite each other. The in-memory cache key already includes the week.
- **Check how far back it goes.** Not yet checked: whether `leagueHistory` (2019 and earlier) returns weekly rosters.
