---
phase: quick-261023-fw6
plan: 01
status: complete
completed: 2026-10-23
requirements: [VET-02, VET-06]
commits:
  - 395ebef
  - 53e80c1
---

# Quick 261023-fw6: Harden WHOIS integration after review

Fixes review findings H-1, H-2, M-2, M-3, M-5, L-1, L-4 for Phase 9.

## What changed

- Registrant text no longer reaches the browser: `registrant_organization` removed from `WhoisRecord`, mapper and fixtures; route test asserts sentinels absent.
- `canonicalWhoisDomain` strips `www.` so cache keys, previews and purchases are shared; history purchases limited to 10 per rolling 24h (`history_budget_exceeded`, 429), charged only on real purchases (not cache hits, over-cap or empty previews).
- Purchase body validated (502 `whois_error`, never cached); records above the cap raise `too_many_records` before compaction.
- `computeAgeDays` keeps `age_days`/`age_years` on the same source; future created date nulls both and the verdict.
- Stricter privacy phrases plus redacted-fragment detection; "Privacy Matters Ltd" and "Proxy Engineering Inc" are public.
- `HistorySection` aborts on unmount/domain change and ignores late responses; `?TIMEOUT_MESSAGE` fixed.
- ROADMAP/REQUIREMENTS wording updated; `09-REVIEW-RESOLUTION.md` lists accepted limitations (M-1, M-4, L-2, L-3, preview TTL).

## Commits

- 395ebef fix: lib/types/insights hardening with tests
- 53e80c1 fix: route proofs, fixtures, abortable panel history
- docs commit: ROADMAP, REQUIREMENTS, 09-REVIEW-RESOLUTION

## Deviations

- Stale test expectations updated: `Registrant State/Province` is now private, `"Registration Private proxy"` replaced by `"Registration Private"` (added `registration private` phrase), 200 purchase without `records` and count 5 now 502, realistic-sample privacy counts now 1 change / 2 total.

## Verification

- `npx vitest run`: 21 files, 251 tests passed
- `npx tsc --noEmit`: clean
- `npm run lint`: clean
