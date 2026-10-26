---
phase: 02-referring-sites-backlinks-slice
plan: 05
subsystem: ui
tags: [react, dashboard, integration-test]
status: complete
requires: [02-02, 02-03, 02-04]
provides:
  - ReferringSitesPanel mounted in the report after SerankingPanel
key-files:
  modified:
    - src/components/traffic-dashboard.tsx
    - src/components/traffic-dashboard.test.tsx
key-decisions:
  - "Panel keyed by data.domain so a new search remounts it idle"
requirements-completed: [REFS-01, REFS-02, REFS-03, REFS-04, REFS-05]
duration: 8min
completed: 2026-10-26
---

# Phase 2 Plan 05: Mount ReferringSitesPanel Summary

Mounted `<ReferringSitesPanel key={data.domain} domain={data.domain} />` right after `SerankingPanel` (one import, one JSX line) and added a dashboard test proving no `/api/referring-sites` call before the click and exactly one call after clicking "Tải backlink".

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1: mount panel + integration test | 90588da | dashboard diff vs a6d2e87: +2 / -0 |

## Deviations from Plan

None - plan executed as written.

## Verification

- `npx vitest run`: 387 passed
- `npx tsc --noEmit`: clean
- `npm run lint`: 0 errors, 1 accepted `no-img-element` warning (trustpilot-panel.tsx)
- `npm run build`: success, `/api/referring-sites` listed

## Known Stubs

None.

## Self-Check: PASSED
