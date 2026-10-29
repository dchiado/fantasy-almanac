# Proposal: Trade and waiver results

**Status:** Proposed, not scoped.

## Idea

- **Trade winners:** points each side got from the players it received, for the rest of the season after the trade.
- **FAAB value:** points per FAAB dollar spent, by owner and season.
- **Best pickups:** waiver and free-agent adds that scored the most for their new team.

## Data

`mTransactions2`: trades, waiver claims (with `bidAmount`), adds and drops. Points after a transaction need weekly player points, the same data as [lineup efficiency](../season-engine.md#lineup-efficiency).

## Data check

Done October 2026 for the [weekly recap](../season-engine.md#weekly-recap): ESPN keeps full transaction history for past seasons, but only per week (`mTransactions2` with `scoringPeriodId`; without it, a past season returns nothing). Gridiron 2019 has 16–55 transactions a week, with trades, waiver bids, adds and drops. A season is about 17 calls, archived once it's final. 2018 and earlier aren't checked yet.
