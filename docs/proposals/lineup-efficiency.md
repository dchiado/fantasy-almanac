# Proposal: Lineup efficiency

**Status:** Proposed, not scoped.

## Idea

Compare each team's actual lineup with the best lineup it could have started:

- **Points left on the bench**, by week, season and owner.
- **Losses caused by lineup choices:** games a team would have won with its best possible lineup.
- **Best and worst lineup setters** in league history.

ESPN doesn't show any of this.

## Data

Weekly responses are archived under `espn-cache/{league}/{year}/weeks/{week}/{view}.json` (`load_data(..., week=N)`), once the season is final.

`mRoster` (or `mMatchup`) with `scoringPeriodId`, once per week. It gives each player's lineup slot (`lineupSlotId`) and points for that week. The roster rules (`rosterSettings` in `mSettings`) say which slots each position can fill.

That's about 17 ESPN calls per season, so it's the most expensive feature here.

## Before starting

- **How far back it goes.** Checked October 2026 for [weekly recap](weekly-recap.md): weekly `mRoster` works for Gridiron 2019–2025, and starters' points add up exactly to final scores. Not yet checked: 2018 and earlier, which need a cookie and go through `leagueHistory`.
- **Slot eligibility.** The best possible lineup needs each player's `eligibleSlots` and the slot counts in `rosterSettings`. Weekly recap's "bench blunder" needs the same function, so build it once.
