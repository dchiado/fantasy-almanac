# Proposal: Playoff scenarios

**Status:** Proposed, not scoped. Depends on [playoff odds](playoff-odds.md).

## Idea

In the last few weeks of the regular season, show each team its path to the playoffs:

- Clinched or eliminated.
- "In if you win out."
- "You need a win and a loss by Team X."
- "Likely in, but it depends on points."

ESPN marks teams that have clinched or been eliminated (`playoffClinchType`), but doesn't show what anyone needs.

## Approach

- **Every combination:** with 2 weeks left in a 12-team league, there are 2¹² = 4,096 possible combinations of results. Run each through the seeding function from the playoff odds proposal and group the results for each team.
- **Points tiebreakers:** if ties are broken by total points, wins and losses can't settle every case. Use the playoff odds simulation to give those cases a probability.
- **Past seasons too:** "what everyone needed going into Week 12 of 2019" makes it useful all year, not just in December.

## Open questions

- How many weeks out is it still readable? Three weeks is 2¹⁸ = 262,144 combinations: fine to compute, but hard to summarize.
- How to phrase the conditions so they're short enough for a phone.
