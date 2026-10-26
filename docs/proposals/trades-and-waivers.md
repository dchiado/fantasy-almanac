# Proposal: Trade and waiver results

**Status:** Proposed, not scoped.

## Idea

- **Trade winners:** points each side got from the players it received, for the rest of the season after the trade.
- **FAAB value:** points per FAAB dollar spent, by owner and season.
- **Best pickups:** waiver and free-agent adds that scored the most for their new team.

## Data

`mTransactions2`: trades, waiver claims (with `bidAmount`), adds and drops. Points after a transaction need weekly player points, the same data as [lineup efficiency](lineup-efficiency.md).

## Before starting

Check what `mTransactions2` returns for a finished season. The saved sample only has current-season pending waiver claims, so it's unknown whether ESPN keeps full transaction history for past seasons.
