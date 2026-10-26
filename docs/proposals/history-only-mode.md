# Proposal: History-only mode for private leagues

**Status:** Proposed, not started
**Motivating league:** 166975 (Gridiron, private)

## Problem

When a league is private and the visitor has no valid `espn_s2` cookie, the app shows nothing, even though most of the league's history may already be cached in S3 (`ffalmanac-data/espn-cache/{league_id}/{year}/{view}.json`).

The cache isn't what's blocking it. `load_data` in `utils_layer/python/utils/__init__.py` already reads S3 before calling ESPN, for every year. The failure comes earlier: every lambda first works out the league's year range from a **live, current-season** ESPN call:

| Helper | Live call | Used by |
| --- | --- | --- |
| `season_status` | `mStatus` for this year | `leagueInfo`, `latest_season` |
| `latest_season` | (via `season_status`) | `standings`, `headToHead`, `headToHeadForm`, `powerRankings`, `keepers`, `check_end_year` |
| `check_start_year` | `mNav` for this year | `individualWeeks`, `individualSeasons`, `matchups` |

The current season is never written to S3 (`should_cache = year != current_year`), so without a token these calls return `AUTH_LEAGUE_NOT_VISIBLE` and the request fails before any cached data is read.

## Goal

When ESPN rejects the current-season call for an opted-in league, serve everything that can be computed from cached past seasons, and tell the visitor that's what they're seeing.

**Not in scope:** current-season features (power rankings, keepers) without a token.

## Design

### Backend (`utils_layer`)

1. **Find the newest cached season.**
   ```python
   def latest_cached_season(league_id):
       resp = s3.list_objects_v2(Bucket=CACHE_BUCKET,
                                 Prefix=f'espn-cache/{league_id}/',
                                 Delimiter='/')
       years = [int(p['Prefix'].rstrip('/').split('/')[-1])
                for p in resp.get('CommonPrefixes', [])]
       return max(years) if years else None
   ```

2. **Add a `_history_only` ContextVar** next to `_espn_s2`. `espn_handler` resets it on every request.

3. **Fall back in the helpers that make the live call.** If the live call returns an auth error (`AUTH_LEAGUE_NOT_VISIBLE`, or any non-`GENERAL_NOT_FOUND` error), and the league is allowed to fall back:
   - `season_status`: load the cached `mStatus` for `latest_cached_season(...)`, compute status from it as usual, and set `_history_only` to True.
   - `check_start_year`: read `previousSeasons[0]` from the cached `mNav` for the latest cached year.
   - `latest_season` and `check_end_year` then work unchanged through `season_status`.

4. **Allowlist.** Use a `HISTORY_ONLY_LEAGUES` env var (comma-separated IDs, set in `template.yaml` Globals). Only those leagues may fall back.
   > **Why:** S3 reads skip authentication. Today the live current-season call is the only thing stopping a private league's cached history from being served to anyone who knows its ID. Without an allowlist, history-only mode would expose every private league that was ever cached.

### Lambdas

| Lambda | Change |
| --- | --- |
| `leagueInfo` | Add `"history_only": bool` to the response. In history-only mode, `year` is the newest cached season. |
| `standings`, `headToHead`, `headToHeadForm`, `individualWeeks`, `individualSeasons`, `matchups` | No logic changes; they work through the helper fallbacks. |
| `powerRankings`, `keepers` | In history-only mode, return `{"error": {"type": "HISTORY_ONLY", "message": "Requires current-season access"}}` instead of computing from last season. |

Edge case: `headToHead` and `headToHeadForm` take team names and owner IDs from the latest season's `mNav`. In history-only mode that is last season's roster. That's acceptable, but owners who joined this season won't appear.

### Frontend

- **`App.jsx` `fetchLeagueInfo`:** if `data.history_only`, store `historyOnly: true` in `leagueInfo` (Redux) and **don't** set `needsPrivateAuth`. The visitor goes straight to the dashboard.
- **Banner:** show a small, dismissible notice on the dashboard: *"Showing league history through {year}. Unlock the current season →"*. The link opens the existing `EspnS2Prompt`.
- **Navigation:** hide or disable Power Rankings and Keepers in `Header`, `FooterMobile` and `MobileDataLinks` when `historyOnly` is set.
- **`api.js`:** handle `HISTORY_ONLY` errors with a friendly message (if a user lands on `/power-rankings` from a bookmark, for example).
- **Mobile:** check the banner and nav at ~375px; most traffic is on phones.

## Prerequisites

> **Update (October 2026):** ESPN serves some of a private league's past seasons without a cookie (Gridiron's 2019–2025, through `/seasons/{year}`; see [ESPN API: authentication](../espn-api/README.md#authentication)). For those seasons, history-only mode doesn't depend on what's in S3. The current season, and 2018 and earlier, still need the cookie or the cache. Since step 1 of [season phases](season-phases.md), a season is only archived once it's final, and archived seasons are only served after the live `mStatus` call succeeds. This proposal would relax that for allowlisted leagues.

The feature is only as good as what's in S3. Check coverage before building:

- `GET /cache/status?leagueId=166975&startYear=<established>` reports which years have all 17 views.
- The **most recent finished season** is the likeliest gap: it's only cached if someone browsed it with a token after Jan 1 of the next year. The `cached` flag from `/info` is no help here; it only checks that *any* key exists.
- Fill gaps with a single `POST /cache` using a valid token.

Longer term, consider a scheduled job that caches the season that just finished each January, so history-only mode always reaches the latest finished season.

## Related: server-side owner token

A complementary option (not part of this proposal) is to store the league owner's `espn_s2` in SSM for allowlisted leagues, and use it when a request has no token. Visitors would get full current-season data with no prompt while the token is valid. History-only mode then becomes the fallback when that token expires.

## Testing

- Private league, no token: dashboard, standings, head-to-head and records load from cache; the banner shows; power rankings and keepers are hidden.
- Private league, valid token: no change from today's behavior.
- Private league, expired token: falls back to history-only mode instead of an error.
- Private league **not** on the allowlist, no token: still shows the private-league prompt.
- Public league: no change.
- Allowlisted league with nothing cached (`latest_cached_season` returns `None`): shows the private-league prompt.
