---
phase: 10-trustpilot-panel-via-local-scraper-service
plan: 02
subsystem: trustpilot-bff-route
status: complete
tags: [trustpilot, route, bff]
requires: [10-01]
provides:
  - GET /api/trustpilot?domain= returning {domain, trustpilot:{data,error}}
affects: [10-03]
tech-stack:
  added: []
  patterns: [mirrors whois route, slice error mapping]
key-files:
  created:
    - src/app/api/trustpilot/route.ts
    - src/app/api/trustpilot/route.test.ts
  modified: []
key-decisions:
  - "Validation order normalizeDomain -> TRUSTPILOT_SCRAPER_URL (trimmed) -> cached upstream call"
metrics:
  tasks: 1
  files: 2
---

# Phase 10 Plan 02: Trustpilot BFF route Summary

Server-only `GET /api/trustpilot` that validates the domain, reads `TRUSTPILOT_SCRAPER_URL` server-side (500 `missing_scraper_url` if unset), calls the cached lib and maps failures to a non-fatal slice error; unknown errors become a generic Vietnamese message and the scraper URL is never echoed.

## Commits
- feat(10-02): add GET /api/trustpilot route with tests

## Verification
- `npx vitest run`: 280 passed (8 new route tests); `npx tsc --noEmit` clean; `npm run lint` clean
- Tests use stubbed fetch with `http://scraper.test:5000`; no real network

## Deviations from Plan
None - plan executed as written.

## Known Stubs
None.

## Self-Check: PASSED
