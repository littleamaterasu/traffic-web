---
phase: quick-261023-ddc
plan: 01
status: complete
requirements: [SERK-02]
completed: 2026-10-23
---

# Quick 261023-ddc: Remove SE Ranking ad-keywords slice

Removed the SE Ranking ad-keywords slice (SERK-02) end to end; overview, competitors and on-demand backlinks are unchanged. TabAPI stays the source of truth for keyword metrics.

## Changes
- `src/lib/seranking.ts`, `src/types/seranking.ts`: removed keywords fetch/get/store, `SeRankingAdKeyword`, and `keywords` from `SeRankingResponse`.
- `src/app/api/seranking/route.ts`: response is `{domain, source, overview, competitors}`.
- `src/components/seranking-panel.tsx`: removed `KeywordsPanel`, `AdCard`, keywords info entry, block labels, list limit and the keywords type-guard check.
- Fixtures and tests pruned; the 402 and cache/dedup/clear tests and the route 500/401 tests were re-pointed at competitors so coverage is not weakened. Panel test now asserts the removed heading is absent and expects three panels/info buttons.
- Docs: SERK-02 marked dropped (REQUIREMENTS, ROADMAP, PROJECT decision row); v1 total 39.

## Commits
- 36d2abf refactor: code, fixtures and tests
- docs commit: planning docs

## Verification
- `npx vitest run`: 14 files, 121 tests passed
- `npx tsc --noEmit`: clean
- `npm run lint`: clean
- Leftover grep: only unrelated TabAPI `topKeywords` UI in traffic-dashboard.tsx (excluded by plan intent)

## Deviations
None of substance. Test count differences are from deleting keyword-only tests.
