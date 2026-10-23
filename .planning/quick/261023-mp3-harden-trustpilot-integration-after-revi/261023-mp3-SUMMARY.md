---
phase: quick-261023-mp3
plan: 01
status: complete
completed: 2026-10-23
requirements: [HI-01, ME-01, ME-02, ME-03, ME-04]
commits:
  - 12f58cc
  - 3473ab6
---

# Quick Task 261023-mp3: Harden Trustpilot integration after review

Fixed HI-01 and ME-01..ME-04 from the Phase 10 code review plus the review-rating low item, and documented resolution.

## Changes

- `src/lib/trustpilot.ts`: streamed byte-count cap (1,000,000 bytes) with `content-length` precheck and reader cancel, error `response_too_large`; empty profiles cached for `EMPTY_PROFILE_TTL_MS` (10 min) via a separate map while non-empty stay 24 h; `MAX_CONCURRENT_SCRAPES = 2` with 429 `scraper_busy`, slot released in `finally`; review rating below 1 or invalid becomes null.
- `src/app/api/trustpilot/route.ts`: invalid `TRUSTPILOT_SCRAPER_URL` returns HTTP 500 `invalid_scraper_url`.
- `src/lib/trustpilot-stars.ts`: `computeStarFills(score, fallbackScore)` ignores non-positive scores and falls back to `trust_score`.
- `src/components/trustpilot-panel.tsx`: header uses the fallback and a matching aria label; empty-profile state shows "Thử lại"; no star group for null ratings.
- Tests updated and added for each behavior; stale assertions (empty state without button, rating 0 clamped to 1, zero-fill arrays for 0/negative scores, try/catch assertions, sync-throw mock) replaced.
- Docs: `10-REVIEW-RESOLUTION.md` and observed failure shapes in `10-SCRAPER-NOTES.md`.

## Deviations

None. Extra route tests added for `scraper_busy` slice and changed the unknown-error mock to a rejected promise (LO-08 partial).

## Verification

- `npx vitest run`: 25 files, 325 tests passed
- `npx tsc --noEmit`: clean
- `npm run lint`: 0 errors, 1 accepted `no-img-element` warning

## Self-Check: PASSED
