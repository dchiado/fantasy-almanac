# Proposal: Pick 'em

**Status:** Proposed, not scoped. Split out of the weekly recap proposal, where it was a stretch goal.

## Idea

League members pick the winner of each of next week's fantasy matchups, with standings across the season. It replaces the Google Form the Gridiron Gazette used.

It would be the app's first stored **user input**, an exception to "everything is a function of ESPN data" (README, "Core rules"). If it's built, add a rule saying so.

## Sketch

- **Storage:** one DynamoDB table, because picks need conditional writes. `pk` = `{leagueId}#{year}`, `sk` = `{week:02}#{ownerSwid}`, holding `{ matchupId: teamId }`. One query returns a season's picks.
- **Who's picking:** there's no auth, so the visitor chooses their name from the league's owners and the browser remembers it. It runs on the honor system, like the Google Form.
- **Guards:**
  - Picks are write-once, using a conditional put.
  - Picks lock at the week's first kickoff.
  - Reading and writing picks goes through the usual live `mStatus` check, so a private league's picks need a valid cookie.
  - Only leagues in a `PICKEM_LEAGUES` allowlist can store picks.
- **Scoring:** computed on read against each game's `winner` in the season model, counting decided games only. No end-of-week job. Picks stay hidden until the week locks.

## Open questions

- Kickoff time: ESPN's pro schedule (`proTeamSchedules_wl`) probably has game times, but that's unchecked. A fixed Thursday-night lock is wrong in weeks with Wednesday or international games.
- Owners only, or guests too? The Gazette had a non-owner.
- Does a forgotten week count as 0 wins, or is it left out of the percentage?
