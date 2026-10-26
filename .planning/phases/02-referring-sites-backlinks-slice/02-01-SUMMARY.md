---
phase: 02-referring-sites-backlinks-slice
plan: 01
subsystem: api
tags: [tabapi, backlinks, sanitizer, cache, typescript]
status: complete
requires: []
provides:
  - ReferringSites contract types (src/types/referring-sites.ts)
  - Pure sanitizers for untrusted backlink data (src/lib/backlink-sanitize.ts)
  - TabAPI backlinks client with 24h cache and dedup (src/lib/referring-sites.ts)
  - Shared fixtures referringSitesUpstreamFixture and referringSitesFixture
affects: [02-02, 02-03, 02-04, 02-05]
tech-stack:
  added: []
  patterns: [createCachedStore per resource, empty-result short TTL map, size-capped body reader]
key-files:
  created:
    - src/types/referring-sites.ts
    - src/lib/backlink-sanitize.ts
    - src/lib/backlink-sanitize.test.ts
    - src/lib/referring-sites.ts
    - src/lib/referring-sites.test.ts
    - src/test/referring-sites-fixture.ts
  modified: []
key-decisions:
  - "Cache store named referringSitesStore, keyed backlinks:{domain}, API key not in key"
  - "Upstream error bodies are discarded; only status-derived Vietnamese messages are returned"
  - "Empty results cached 10 minutes via EmptyReferringSitesSignal"
requirements-completed: []
duration: 15min
completed: 2026-10-26
---

# Phase 2 Plan 01: Referring Sites Lib Summary

Whitelisting TabAPI backlinks client (overview plus 20-item sample) with http/https URL allow-list, clamped numbers, 1 MB body cap, status-mapped Vietnamese errors and a 24h cache with in-flight dedup.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 RED: types + sanitizer tests | 5d4d813 | tests failed (module missing) |
| 1 GREEN: sanitizers | 77cf4f6 | 23 tests pass |
| 2: client, fixtures, tests | f4ac1ff | 27 tests pass |

## Deviations from Plan

- Task 2 was committed as one feat commit (tests and implementation together) rather than a separate failing-test commit.
- Added explicit `vitest` imports to both new test files because `tsc --noEmit` does not see vitest globals (matches trustpilot.test.ts style). Included in the f4ac1ff commit.

## Verification

- `npx vitest run`: 378 passed
- `npx tsc --noEmit`: clean
- `npm run lint`: 0 errors, 1 accepted `no-img-element` warning
- trustpilot.ts, tabapi.ts, cached-store.ts, .env.example untouched

## Known Stubs

None.

## Threat Flags

None beyond the plan threat model.

## Self-Check: PASSED
