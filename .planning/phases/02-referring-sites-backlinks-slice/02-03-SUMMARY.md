---
phase: 02-referring-sites-backlinks-slice
plan: 03
subsystem: api
tags: [tabapi, backlinks, route, bff]
status: complete
requires: [02-01]
provides:
  - GET /api/referring-sites BFF route
key-files:
  created:
    - src/app/api/referring-sites/route.ts
    - src/app/api/referring-sites/route.test.ts
key-decisions:
  - "Upstream failures returned as error slice with HTTP 200; unknown errors masked as unexpected_error"
requirements-completed: []
duration: 5min
completed: 2026-10-26
---

# Phase 2 Plan 03: Referring Sites Route Summary

`GET /api/referring-sites?domain=` validates the domain, reads TABAPI_KEY server-side, calls the cached `getReferringSites`, and returns `{domain, referring_sites:{data,error}}` with private Cache-Control.

## Deviations from Plan

Task committed as a single feat commit (tests and implementation together).

## Verification

- route tests: 10 passed
- `npx vitest run`: 372 passed
- `npx tsc --noEmit`: clean
- `npm run lint`: 0 errors, 1 accepted `no-img-element` warning
- `/api/traffic` and `.env.example` untouched

## Known Stubs

None.

## Self-Check: PASSED
