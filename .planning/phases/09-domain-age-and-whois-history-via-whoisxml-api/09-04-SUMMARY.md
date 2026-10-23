---
phase: 09-domain-age-and-whois-history-via-whoisxml-api
plan: 04
status: complete
subsystem: whois
tags: [whois, api-route, vitest]
requires: [09-02]
provides:
  - GET /api/whois (src/app/api/whois/route.ts)
  - GET /api/whois/history (src/app/api/whois/history/route.ts)
affects: [09-05]
tech-stack:
  added: []
  patterns: [BFF route mirroring SE Ranking backlinks route, error slices with HTTP 200, vi.mock wrapping real lib for unexpected-error tests]
key-files:
  created:
    - src/app/api/whois/route.ts
    - src/app/api/whois/route.test.ts
    - src/app/api/whois/history/route.ts
    - src/app/api/whois/history/route.test.ts
key-decisions:
  - "Unexpected errors are tested by wrapping the real lib getters in vi.mock and using mockImplementationOnce to throw"
requirements-completed: []
duration: 10min
completed: 2026-10-23
---

# Phase 9 Plan 04: WHOIS Routes Summary

Two server routes, `/api/whois` and `/api/whois/history`, validate the domain first, then read `WHOIS_API_KEY`, then call the cached lib; upstream and unknown failures become HTTP 200 error slices with fixed Vietnamese messages, and no key, raw text or contact data reaches the response.

## Tasks

| Task | Commit | Files |
| ---- | ------ | ----- |
| 1. GET /api/whois and tests | f267d7e | src/app/api/whois/route.ts, route.test.ts |
| 2. GET /api/whois/history and tests | 4782ab2 | src/app/api/whois/history/route.ts, route.test.ts |

## Verification

- `npx vitest run src/app/api/whois`: 16 passed (stubbed fetch only, no network)
- `npx vitest run`: 219 passed
- `npx tsc --noEmit`: clean
- `npm run lint`: clean
- No `console.` in route files; history tests assert no `mode=purchase` call at 101 records and absence of RAW-SENTINEL / sentinel@example.test / key

## Deviations from Plan

None. VET-02 / VET-06 stay unmarked until plan 09-05 wires the UI.

## Known Stubs

None.

## Self-Check: PASSED
