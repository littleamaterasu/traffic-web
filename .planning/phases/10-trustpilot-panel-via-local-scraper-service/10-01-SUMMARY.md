---
phase: 10-trustpilot-panel-via-local-scraper-service
plan: 01
subsystem: trustpilot-data-layer
status: complete
tags: [trustpilot, scraper, cache, normalization]
requires: []
provides:
  - TrustpilotApiError, normalizeTrustpilotBody, fetchTrustpilotProfile, getTrustpilotProfile, clearTrustpilotCache
  - Trustpilot types and typed fixtures
affects: [10-02, 10-03]
tech-stack:
  added: []
  patterns: [createCachedStore 24h cache with in-flight dedup, injected fetchImpl, field-by-field whitelist]
key-files:
  created:
    - src/types/trustpilot.ts
    - src/test/trustpilot-fixture.ts
    - src/lib/trustpilot.ts
    - src/lib/trustpilot.test.ts
  modified: []
key-decisions:
  - "Over-long URLs (>500 chars) are rejected (null) rather than truncated, to avoid broken links"
  - "Request path fixed to /api/reviews on the base URL origin only; redirect: error; 45s timeout; 1,000,000-char response cap"
metrics:
  tasks: 2
  files: 4
---

# Phase 10 Plan 01: Trustpilot data layer Summary

Server-side Trustpilot scraper client with strict whitelist normalization, fixed request shape ({domain, max_pages:1, limit:5} to /api/reviews), typed errors with Vietnamese messages, and 24h cached/deduped access.

## Commits
- 929b4cf feat(10-01): types and fixtures
- 96b4a34 test(10-01): failing tests (RED)
- 0298a88 feat(10-01): client implementation (GREEN)

## Verification
- `npx vitest run src/lib/trustpilot.test.ts`: 21 passed; full suite 272 passed
- `npx tsc --noEmit`: clean; `npm run lint`: clean
- No `127.0.0.1` in source; tests use stubbed fetch with `http://scraper.test:5000` only

## Deviations from Plan
None - plan executed as written.

## Notes
Optional business fields (logo_url, claimed_since, categories, rating_distribution) are typed and normalized but the current scraper does not return them; the scraper owner must add them to match the Trustpilot header exactly.

## Known Stubs
None.

## Self-Check: PASSED
