# Proposal: All-time highlights

**Status:** Proposed, not scoped. Follows on from the per-season playoff odds and luck (see [season engine](../season-engine.md)).

## Idea

The season report already computes collapses, comebacks, the bubble and luck for one season. Rank them across every season in a league's history, on a History page:

- **Biggest collapses and comebacks** in league history: "biggest collapse in Gridiron history".
- **Luckiest and unluckiest seasons**, and each owner's luck over their career.
- **Wire-to-wire:** teams that led the odds (or stayed above some line) all season.
- **Clinch and elimination marks** on the odds chart: the week each team clinched or was eliminated.

## Data

No new ESPN calls. Each final season's report is already stored at `derived/{league}/{year}/season-report-v{n}.json`. An all-time result reads every final season's report and is stored at `derived/{league}/all-time/{artifact}-v{n}-thru-{year}.json`, so a new final season is a cache miss, not an invalidation.

## Notes

- Track people across seasons by owner ID (SWID), not team ID.
- The first request for a league with no stored reports would compute every season (about 2 seconds each). Consider computing them one at a time, or capping how many are computed in one request.
- Clinch and elimination weeks need the scenario logic run for every week, not just the last three, which may be too slow for early weeks. Odds of exactly 0 or 1 from the simulation aren't proof.
