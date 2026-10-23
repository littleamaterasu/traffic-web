---
phase: quick-261023-djq
plan: 01
status: complete
requirements: [SERK-03, SERK-05]
commits: [7cea159, ec2cee7, 17cc39a]
completed: 2026-10-23
---

# Quick 261023-djq: SE Ranking competitors on demand

SE Ranking advertiser competitors now load only when the researcher clicks "Tải đối thủ quảng cáo", mirroring the backlinks flow, to save SE Ranking credits.

## Changes

- `GET /api/seranking` returns only `{domain, source, overview}`; it never requests `/domain/competitors`.
- New `GET /api/seranking/competitors` (validation order: domain, source `^[a-z]{2}$`, key; limit 10; slice error handling with generic Vietnamese message for unknown errors).
- `CompetitorsPanel` in `src/components/seranking-panel.tsx` has idle/loading/error/ready state, retry via "Thử lại", resets to idle on domain change, and hides the button once loaded.
- Types: `SeRankingResponse` lost `competitors`; added `SeRankingCompetitorsResponse`. Fixtures: `serankingCompetitorsFixture`.
- Docs: SERK-03/SERK-05, ROADMAP Phase 8 criterion 2, PROJECT Key Decisions row.

## Verification

- `npx vitest run`: 15 files, 133 tests passed
- `npx tsc --noEmit`: clean
- `npm run lint`: clean
- Grep gates: non-test references to `getSeRankingCompetitors` are only `src/lib/seranking.ts` and the new route; default route has none.

## Deviations

None. `traffic-dashboard.test.tsx` needed no change (the slimmed `serankingFixture` already satisfies it).
