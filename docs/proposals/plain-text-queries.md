# Proposal: Plain-text queries

**Status:** Proposed, not scoped.

## Idea

A text box where a visitor asks a question about league history in plain English, such as "how many times has this team won by 70 points?", and gets an answer.

## Approach

Claude only turns the question into a query; our code finds the answer. Claude never calls ESPN or computes a number.

1. **Games table.** Build one table of every game in league history from the cached `mMatchupScore` and `mNav` data: year, week, both teams and owners (by SWID), both scores, margin, winner, and whether it was the regular season or playoffs. The `matchups` lambda already does most of this work. Twenty seasons is about 2,000 rows.
2. **Question to query.** Send Claude the question, the league's team and owner names, and the query format. Claude fills in a query using structured outputs, which guarantee the response matches the format exactly:
   ```json
   {
     "team": "<owner id or null>",
     "opponent": "<owner id or null>",
     "seasons": { "from": 2015, "to": 2026 },
     "result": "win",
     "minMargin": 70,
     "playoffs": false,
     "output": "count"
   }
   ```
   `output` is one of `count`, `list` or `max`. If the question doesn't fit the format, Claude returns `unsupported` instead of guessing.
3. **Run the query.** Our lambda filters the games table in plain Python and returns the matching rows.
4. **Answer.** A second short Claude call turns the rows into a sentence. The page shows the matching games underneath, so every answer can be checked.

## Private leagues

They work the same as every other page. The frontend already sends `espnS2` to the lambdas; Claude never sees it. Claude does see the league's team names and scores, so add a line in the UI saying questions are sent to Anthropic.

## Open questions

- Which filters and outputs to support first. Questions that come back `unsupported` show what to add next.
- Rate limiting: the site is public, so it needs a per-league limit, a cap on response length, and caching for repeat questions.
- Whether to log questions, to learn what people ask.

## Later

If the query format proves too limiting, Claude could instead write code against the games table using Anthropic's code-execution tool. That handles open-ended questions, but it's slower, costs more per question, and its answers are harder to check.
