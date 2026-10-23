---
phase: quick-261023-duc
plan: 01
status: complete
requirements: [SERK-01, SERK-02, SERK-05]
completed: 2026-10-23
commits: [71984a5, 4b1198a]
---

# Quick 261023-duc: SE Ranking overview removed, ad copy on demand

**One-liner:** Removed the SE Ranking overview panel/route end to end and added an on-demand ad-copy panel (`/api/seranking/ads`) that never exposes volume, CPC, traffic or price to the browser.

## Changes

- `src/types/seranking.ts`: removed overview types; added `SeRankingAdKeyword` (7 fields only) and `SeRankingAdsResponse`.
- `src/lib/seranking.ts`: removed overview fetch/cache; added `fetchSeRankingKeywords` / `getSeRankingKeywords` (`/domain/keywords`, `type=adv`, 24h cached store keyed by domain:source:limit); normalizer drops volume, cpc, competition, traffic, price, difficulty, block_position.
- `src/app/api/seranking/ads/route.ts` (new, modeled on competitors); `src/app/api/seranking/route.ts` and its test deleted.
- `src/lib/seranking-ad-title.ts`: `cleanAdTitle` strips glued trailing URL / breadcrumb.
- `src/components/seranking-panel.tsx`: no request on mount; `AdsPanel` ("Tải mẫu quảng cáo", up to 10 cards, http(s)-only landing links with `rel="noopener noreferrer"`); competitors and backlinks code untouched.
- Fixtures/tests updated; competitors and backlinks tests kept (only the mount-fetch setup was removed, call counts adjusted from 2 to 1).
- Docs: REQUIREMENTS.md, ROADMAP.md, PROJECT.md updated (SERK-01 dropped, SERK-02 complete). Coverage counts unchanged (dropped items stay mapped).

## Verification

- `npx vitest run`: 16 files, 136 tests passed.
- `npx tsc --noEmit`: clean (after removing stale generated `.next/types`, which referenced the deleted route; gitignored).
- `npm run lint`: clean.
- Greps: no overview code outside tests; no volume/cpc in ads route; `SE_RANKING_API_KEY` read only in ads, backlinks and competitors routes.

## Deviations from Plan

None in behavior. Plan reference to `ROADMAP.md` line numbers was adapted to the current text.

## Self-Check: PASSED
