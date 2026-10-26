# Proposal: Draft review

**Status:** Proposed, not scoped.

## Idea

Look back at past drafts with full-season results:

- **Draft value:** points each pick scored compared with where it was taken.
- **Best and worst picks** across league history, by round.
- **Each owner's drafting record** over the years.

ESPN grades drafts before the season starts and never revisits them.

## Data

- `mDraftDetail`: every pick, with round, overall pick number, player, team and whether it was a keeper.
- Season points per player: from `kona_player_info` or the season totals in `mRoster`.

## Open questions

- How far back ESPN keeps draft picks and player season totals for `leagueHistory` seasons.
- Whether to measure value by points, or by points above a replacement-level player at the same position.
- Keepers: leave them out, or score them separately.
