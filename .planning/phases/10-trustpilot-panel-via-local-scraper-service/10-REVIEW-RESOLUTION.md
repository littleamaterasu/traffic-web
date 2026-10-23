# Phase 10: Review Resolution

Source: `10-REVIEW.md`. Applied by quick task 261023-mp3.

## Resolved

| ID | Finding | Resolution |
|----|---------|------------|
| HI-01 | Response size cap enforced after full buffering, test could not fail | `content-length` precheck plus streamed byte counting with reader cancel at 1,000,000 bytes; error `response_too_large` (502). Tests use valid JSON over the cap, a multi-byte body, and a body just under the cap |
| ME-01 | Empty profile cached 24 h, no retry | Empty results cached for `EMPTY_PROFILE_TTL_MS` (10 min) only; panel shows "Thử lại" in the empty state |
| ME-02 | No bound on concurrent scrapes | `MAX_CONCURRENT_SCRAPES = 2`; extra distinct-domain scrapes fail with 429 `scraper_busy` before any upstream call; slot released in `finally`; cached and deduped calls use no slot |
| ME-03 | Inconsistent config error | Route validates `TRUSTPILOT_SCRAPER_URL` up front and returns HTTP 500 `invalid_scraper_url`, same convention as `missing_scraper_url` |
| ME-04 | Header stars misleading when `stars` is 0 | `computeStarFills(score, fallbackScore)` treats non-positive scores as invalid and falls back to `trust_score`; aria label derived from the same source |
| LO-01 | Review rating 0 clamped to 1 | Ratings below 1 or non-numeric become null; no star group rendered for null |

## Accepted / not fixed

| ID | Finding | Rationale |
|----|---------|-----------|
| LO-02 | Host restrictions on URLs, `TRUSTPILOT_SCRAPER_URL` host | Scraper URL is operator-controlled env on a local service; scheme is validated. Scraped URL hosts left unrestricted, mitigated by scheme allow-list and `no-referrer` |
| LO-03 | `normalizeDate` does not validate calendar dates | Invalid dates render as a dash; no safety impact |
| LO-04 | DOMException-based timeout detection | Only our own signal aborts the fetch; behavior is correct on the supported Node versions |
| LO-05 | Client 60 s vs server 45 s timeout relation | Kept deliberately: client always outlasts the server |
| LO-06 | Broad `aria-live` wrapper | Cosmetic accessibility refinement, deferred |
| LO-07 | Literal 5 vs `TRUSTPILOT_REVIEW_LIMIT` in the client panel | The constant lives in server-side `src/lib/trustpilot.ts`, not a client-safe module |
| LO-08 | Test-quality gaps (vacuous tests, StrictMode, stale response) | Partly addressed by replacing try/catch assertions and the sync-throw mock; the rest deferred |
