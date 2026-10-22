---
phase: 08-se-ranking-integration-supplementary-organic-paid-traffic-pa
plan: 02
subsystem: api
tags: [seranking, bff, nextjs, route-handlers, vitest, tdd, vietnamese, partial-failure, promise-allsettled]

# Dependency graph
requires:
  - phase: 08-se-ranking-integration-supplementary-organic-paid-traffic-pa (plan 01)
    provides: src/lib/seranking.ts client — getSeRankingOverview/Keywords/Competitors/Backlinks, SeRankingApiError, clearSeRankingCache(); src/types/seranking.ts envelope DTOs
provides:
  - GET /api/seranking — BFF route returning {domain, source, overview, keywords, competitors} per-slice {data|error} envelope with partial-failure tolerance; never calls the 100-credit backlinks endpoint
  - GET /api/seranking/backlinks — separate on-demand-only BFF route for /backlinks/summary with the same slice-error mapping
affects: [08-03 UI section plan, 08-04 dashboard wiring, any consumer of /api/seranking]

# Actuals (#2632)
actuals:
  tokens: 4948
  tasks: 1
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-slice {data|error} envelope: Promise.allSettled + private toSlice() mapping SeRankingApiError code/message into the slice, unknown errors collapsed to unexpected_error with a fixed Vietnamese message"
    - "On-demand high-cost endpoint isolation: backlinks lives behind its own route so the default report route can never burn the 100-credit call"
    - "Route validation order normalizeDomain -> source pattern -> key read, so bad input never reaches the key check or upstream"

key-files:
  created:
    - src/app/api/seranking/route.ts
    - src/app/api/seranking/route.test.ts
    - src/app/api/seranking/backlinks/route.ts
    - src/app/api/seranking/backlinks/route.test.ts
  modified: []

key-decisions:
  - "errorResponse/toErrorSlice duplicated (~10 lines) across the two routes per the plan's explicit sanction instead of extracting a shared helper outside files_modified"
  - "Backlinks upstream failure returns HTTP 200 with backlinks:{data:null,error:{code,message}} — only invalid_domain (400) and missing_api_key (500) are HTTP errors, keeping the UI rendering path uniform"
  - "Source validated with /^[a-z]{2}$/ before the key check (default 'us'); uppercase is rejected without lowercasing so cache keys and upstream queries stay predictable"

requirements-completed: [SERK-01, SERK-02, SERK-03, SERK-04, SERK-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "GET /api/seranking happy path: 200 envelope {domain, source:'us' default, overview/keywords/competitors each {data,error:null}}, Cache-Control private/no-store-revalidate, keywords URL carries source=us&limit=10, no upstream call contains /backlinks/, body never contains the key"
    requirement: SERK-01
    verification:
      - kind: unit
        ref: "tests/src/app/api/seranking/route.test.ts#trả 200 đủ ba slice khi mọi upstream OK, mặc định source us, không gọi backlinks và không lộ key"
        status: pass
    human_judgment: false
  - id: D2
    description: "Partial-failure isolation: keywords upstream 500 yields keywords {data:null,error:{code:'seranking_error'}} while overview/competitors stay populated; upstream 401 on all three yields 200 with three invalid_api_key error slices (report never hard-fails)"
    requirement: SERK-05
    verification:
      - kind: unit
        ref: "tests/src/app/api/seranking/route.test.ts#trả 200 với slice keywords lỗi khi upstream keywords trả 500, các slice khác vẫn có dữ liệu"
        status: pass
      - kind: unit
        ref: "tests/src/app/api/seranking/route.test.ts#trả 200 với cả ba slice lỗi invalid_api_key khi upstream trả 401 cho mọi endpoint"
        status: pass
    human_judgment: false
  - id: D3
    description: "Input/config validation before any upstream call: missing or invalid domain -> 400 invalid_domain; source not matching /^[a-z]{2}$/ (uppercase 'US', 'usa') -> 400 invalid_source with Vietnamese message; empty SE_RANKING_API_KEY -> 500 missing_api_key 'Chưa cấu hình SE_RANKING_API_KEY trên máy chủ.'; fetch never called in any of these"
    requirement: SERK-05
    verification:
      - kind: unit
        ref: "tests/src/app/api/seranking/route.test.ts#trả lỗi 400 invalid_domain khi thiếu domain và không gọi upstream"
        status: pass
      - kind: unit
        ref: "tests/src/app/api/seranking/route.test.ts#trả lỗi 400 invalid_source khi source viết hoa (không tự chuyển chữ thường)"
        status: pass
      - kind: unit
        ref: "tests/src/app/api/seranking/route.test.ts#trả lỗi 500 missing_api_key khi key rỗng và không gọi upstream"
        status: pass
    human_judgment: false
  - id: D4
    description: "On-demand backlinks route: the only route touching /backlinks/summary — invalid domain -> 400 without fetch, missing key -> 500 without fetch, success -> 200 {domain, backlinks:{data,error:null}} with Cache-Control and no key leak, upstream 500 -> 200 error slice, two consecutive calls hit upstream once (24h slice cache + dedup)"
    requirement: SERK-04
    verification:
      - kind: unit
        ref: "tests/src/app/api/seranking/backlinks/route.test.ts#trả 200 với slice backlinks khi upstream OK, không lộ key và đặt Cache-Control"
        status: pass
      - kind: unit
        ref: "tests/src/app/api/seranking/backlinks/route.test.ts#trả 200 với slice lỗi khi upstream trả 500"
        status: pass
      - kind: unit
        ref: "tests/src/app/api/seranking/backlinks/route.test.ts#gọi upstream chỉ một lần khi gọi route hai lần liên tiếp nhờ cache"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-10-22
status: complete
---

# Phase 8 Plan 2: SE Ranking Routes Summary

**Two SE Ranking BFF routes — `/api/seranking` with a partial-failure-tolerant three-slice envelope and an on-demand-only `/api/seranking/backlinks` — built test-first (RED→GREEN), key read server-side only, the 100-credit backlinks endpoint unreachable from the default report path.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-22T04:58:42Z
- **Completed:** 2026-10-22T05:04:09Z
- **Tasks:** 1 (TDD)
- **Files modified:** 4 (all new)

## Accomplishments
- `src/app/api/seranking/route.ts`: BFF route with `runtime = "nodejs"` — `normalizeDomain` → `source` pattern validation (`/^[a-z]{2}$/`, default `us`, uppercase rejected) → `SE_RANKING_API_KEY` read → `Promise.allSettled` over `getSeRankingOverview/Keywords/Competitors` with `LIST_LIMIT = 10` → private `toSlice()` producing the `SeRankingResponse` envelope; `Cache-Control: private, max-age=0, must-revalidate`; backlinks is never imported here
- `src/app/api/seranking/backlinks/route.ts`: separate on-demand route calling only `getSeRankingBacklinks` — same validation order, headers and error mapping; upstream failure degrades to a 200 error slice so the UI keeps rendering; no `source`/`limit` params
- 13 Vietnamese route tests covering every behavior bullet: invalid domain/source (fetch never called), missing key (exact Vietnamese message), all-OK envelope (no `/backlinks/` call, no key leak), keywords-500 partial failure, all-401 slice errors, backlinks success/error/cache-dedup
- TabAPI surface untouched: `git diff --stat -- src/app/api/traffic src/types/traffic.ts src/lib/tabapi.ts` is empty; full suite 99/99 (86 prior + 13 new), `tsc --noEmit` 0, `npm run lint` 0

## TDD Cycle

| Phase | Commit | Evidence |
|-------|--------|----------|
| RED | `ab5d84f` test(08-02): add failing tests for SE Ranking routes | 13 tests discovered, 13 failed (loadable throwing stubs, so failures are real test failures, not imports); target test = happy-path envelope test; `gsd-tools check tdd-red-evidence` → `RED_EVIDENCE_OK` |
| GREEN | `2c55a1c` feat(08-02): implement SE Ranking routes with per-slice envelope | 13/13 pass; `npx tsc --noEmit` 0; `npm run lint` 0 |
| REFACTOR | — | No changes needed; duplication of ~10 error-mapping lines across the two routes is explicitly sanctioned by the plan and extraction would require files outside `files_modified` |

**RED evidence note:** same mechanism as plan 08-01 — vitest TAP reporters lack the node:test `# tests/# fail` summary counters, so a truth-preserving runner (`C:/Users/PC/AppData/Local/Temp/opencode/red-runner-08-02.cjs`, outside the repo) ran the identical `npx vitest run src/app/api/seranking --reporter=tap-flat` command and appended summary counters derived from the run's own TAP plan/ok/not-ok lines (13 tests, 13 fail, exit 1). Evidence record: `C:/Users/PC/AppData/Local/Temp/opencode/red-evidence-08-02.json` — verdict `RED_EVIDENCE_OK`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Route handler with per-slice envelope and tests** - `ab5d84f` (test, RED) + `2c55a1c` (feat, GREEN)

## Files Created/Modified
- `src/app/api/seranking/route.ts` - BFF route: three-slice envelope, partial-failure tolerant, never calls backlinks
- `src/app/api/seranking/backlinks/route.ts` - On-demand backlinks BFF route (100-credit call isolated here)
- `src/app/api/seranking/route.test.ts` - 8 Vietnamese route tests (envelope, validation, partial failure, key leak)
- `src/app/api/seranking/backlinks/route.test.ts` - 5 Vietnamese route tests (validation, success, error slice, cache dedup)

## Decisions Made
- Duplicated `errorResponse`/`toErrorSlice` (~10 lines) in both routes instead of extracting a shared helper — the plan explicitly allows duplication when extraction would require editing/creating files outside the plan's file list
- Backlinks upstream failure returns HTTP 200 with an error slice (mirrors the envelope contract); only invalid domain (400) and missing key (500) are HTTP errors
- Validation order domain → source → key keeps error semantics deterministic: bad input never surfaces as a key-configuration error and never triggers an upstream call
- Test fixtures assert the mapped DTO shape (including `backlinks: null` on anchor rows lacking the field) matching the lib's degrade-missing-fields-to-null contract from plan 08-01

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Backlinks anchor fixture missed the mapped `backlinks: null` key**
- **Found during:** Task 1 (GREEN phase, first test run)
- **Issue:** Expected fixture for `top_anchors_by_refdomains` omitted `backlinks`, but the lib's `toAnchors` (plan 08-01 contract) always emits both anchor keys, degrading missing numerics to `null` — 1 of 13 tests failed on the deep-equal
- **Fix:** Added `backlinks: null` to the expected anchor row in `backlinks/route.test.ts` (test-fixture repair; implementation was correct per the locked 08-01 contract)
- **Files modified:** src/app/api/seranking/backlinks/route.test.ts
- **Verification:** `npx vitest run src/app/api/seranking` → 13/13 pass
- **Committed in:** 2c55a1c (part of GREEN task commit)

---

**Total deviations:** 1 auto-fixed (1 bug — executor-authored test fixture, not plan behavior)
**Impact on plan:** None on shipped behavior; the fix aligned the test fixture with the already-locked lib contract. No scope creep.

## Issues Encountered
- Vitest TAP output lacks node:test summary counters for the RED-evidence classifier — resolved with the truth-preserving format runner documented above (same approach as plan 08-01)

## User Setup Required

None - no external service configuration required by this plan. (`SE_RANKING_API_KEY` value stays in `.env.local`; `.env.example` blanking is plan 08-04's scope. Until the key exists, both routes return 500 `missing_api_key` with the Vietnamese message, which is the designed behavior.)

## Next Phase Readiness
- Both route contracts are stable for plan 08-03's UI section: `GET /api/seranking?domain=&source=` → `SeRankingResponse` (per-slice `{data|error}`), `GET /api/seranking/backlinks?domain=` → `SeRankingBacklinksResponse`; missing key / slice errors arrive as typed Vietnamese codes (`missing_api_key`, `invalid_api_key`, `insufficient_credits`, `rate_limited`, `seranking_error`, `network_error`, `unexpected_error`) ready for `role="alert"` handling
- 99/99 suite green; `clearSeRankingCache()` remains the test-isolation seam

---
*Phase: 08-se-ranking-integration-supplementary-organic-paid-traffic-pa*
*Completed: 2026-10-22*

## Self-Check: PASSED

- All 5 key files exist on disk (4 source + SUMMARY)
- Commits `ab5d84f` (RED), `2c55a1c` (GREEN), `a93bcf2` (metadata) present in git log
- RED gate: `test(08-02)` commit precedes GREEN `feat(08-02)` commit; `check tdd-red-evidence` → `RED_EVIDENCE_OK` (13 tests, 13 failed, target test failed on the envelope assertion)
- Full suite 99/99 (13 files), `npx tsc --noEmit` 0, `npm run lint` 0
- All 7 acceptance criteria verified post-GREEN: directory vitest run exit 0; `runtime = "nodejs"` in both routes; `Promise.allSettled` in main route; `getSeRankingBacklinks` absent from main route and present only in the backlinks route; `process.env.SE_RANKING_API_KEY` only in the two route files; `git diff --stat` for TabAPI surface empty; tsc + lint clean
