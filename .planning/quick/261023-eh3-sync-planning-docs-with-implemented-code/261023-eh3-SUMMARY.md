---
phase: quick-261023-eh3
plan: 01
status: complete
completed: 2026-10-23
commits: [257d178, e255d1f, 4df25c2]
files_modified:
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - .planning/STATE.md
  - .planning/research/DOMAIN-CHECK-FRAMEWORK.md
  - .planning/codebase/INTEGRATIONS.md
  - .planning/codebase/STRUCTURE.md
  - .planning/codebase/ARCHITECTURE.md
  - .planning/codebase/TESTING.md
  - .planning/codebase/CONCERNS.md
---

# Quick Task 261023-eh3: Sync planning docs with implemented code

Documentation-only sync of `.planning/` with the code as verified by reading `src/`; nothing under `src/`, `AGENTS.md` or `.env*` was changed.

## What changed

- **ROADMAP.md**: execution order now includes 8; Phase 3 and 6 rows marked "partially delivered outside GSD (300b113)"; Phase 8 stays "In Progress (human UAT pending)"; success criteria carry verified/partial/absent markers; "Reality check (2026-10-23)" note added.
- **REQUIREMENTS.md**: ADLG-01 Complete (needs re-check), ADLG-02/03 Partial, ADLG-04 Pending (no fallback), ADVR-01/02 and CRTV-01/02 Partial, ADVR-03/04 annotated; SERK-02 text aligned to source db `us`; footer dated 2026-10-23.
- **STATE.md**: body only (Current Position, Roadmap Evolution reality check, Quick Tasks row); frontmatter untouched.
- **DOMAIN-CHECK-FRAMEWORK.md**: "Current coverage (2026-10-23)" 18-row table, total 9/18 answered (8 fully, 1 partial, 9 not), with the code-reading caveat.
- **codebase/**: INTEGRATIONS (three SE Ranking routes, SerpAPI Transparency, env readers, shared cache), STRUCTURE (real file list), ARCHITECTURE (sibling BFF routes, `createCachedStore`), TESTING (16 files, 136 tests via `npx vitest run`), CONCERNS (three new items).

## Verified facts (source reading)

- `/api/ads` takes `domain`, `page_token`; `/api/ads/detail` takes `advertiser_id`, `creative_id`; both return 500 `missing_api_key` without `SERPAPI_KEY`, no fallback.
- `ACTIVE_WINDOW_DAYS` = 7, `LONG_RUNNING_DAYS` = 30; grep for winning/saturation finds nothing, so no Winning Ad Ratio or ASI.
- `ads-panel.tsx`: advertiser count, active count, format mix, longest-running, grouping, timeline, details link, on-demand detail, "Tải thêm creative"; no landing page link.
- `/api/seranking/{ads,competitors,backlinks}` read `SE_RANKING_API_KEY`; `seranking/route.ts` is gone; `seranking-panel.tsx` has no `useEffect`.
- `traffic-dashboard.tsx` renders `AdsPanel` and `SerankingPanel`.

## Unverified / notes

- Exact phase for metrics 2 and 4 (business model, payment gateway) marked unverified.
- `.env.example` lists `WHOIS_API_KEY`, which no `src/` file reads (names only noted, no values).
- Phase 8 human UAT remains pending; SERK statuses reflect code, not UI verification.

## Verification

- Only `.planning/**` files modified (no tracked change outside `.planning/`).
- No `api/seranking?domain=` citation remains in the live docs.
- No 32+ character key-like token in added lines.
- Pre-existing untracked files (08-VERIFICATION.md, 261023-ddc-PLAN.md, root checklist .md) were not staged.

## Deviations from Plan

None. Minor extension: also corrected stale `successCache` references in CONCERNS.md and STRUCTURE.md.
