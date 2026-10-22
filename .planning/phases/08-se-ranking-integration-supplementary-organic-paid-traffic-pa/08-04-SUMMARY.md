---
phase: 08-se-ranking-integration-supplementary-organic-paid-traffic-pa
plan: 04
subsystem: ui
tags: [seranking, react, nextjs, vitest, testing-library, tdd, vietnamese, env-hygiene, secrets]

# Dependency graph
requires:
  - phase: 08-se-ranking-integration-supplementary-organic-paid-traffic-pa (plan 03)
    provides: standalone SerankingPanel client component (src/components/seranking-panel.tsx) and typed fixtures (src/test/seranking-fixture.ts)
  - phase: 08-se-ranking-integration-supplementary-organic-paid-traffic-pa (plan 02)
    provides: GET /api/seranking with per-slice {data|error} envelope and typed Vietnamese error codes
provides:
  - SE Ranking section reachable in the dashboard: SerankingPanel rendered inside Results directly after AdsPanel, keyed by the report domain
  - Two wiring tests with URL-routing fetch mocks proving the /api/seranking call, the SE Ranking heading alongside TabAPI panels, and failure isolation (TabAPI report intact + section-level alert on seranking failure)
  - Sanitized .env.example template: all four key values blanked, SE_RANKING_API_KEY documented as an empty placeholder with a Vietnamese server-side-only comment
affects: [verify-work UAT of the SE Ranking section, end-of-phase verification]

# Actuals (#2632)
actuals:
  tokens: 690
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "URL-routing fetch mock in dashboard tests: one vi.fn().mockImplementation branch on the URL prefix (/api/seranking vs /api/traffic) so sibling sections can be asserted independently of the all-urls traffic mocks"

key-files:
  created: []
  modified:
    - src/components/traffic-dashboard.tsx
    - src/components/traffic-dashboard.test.tsx
    - .env.example

key-decisions:
  - "Wiring kept to exactly two lines (import + <SerankingPanel key={data.domain} domain={data.domain} /> directly after AdsPanel inside Results) — PANEL_INFO and the TabAPI fetch code untouched, per the plan's must_haves key_link"
  - "No existing dashboard test needed modification: none asserts call counts, and the all-urls traffic-fixture mocks drive SerankingPanel into its designed fallback-error path (isSeRankingResponse rejects the TrafficResponse shape), which is exactly the degradation the behavior bullets require"
  - "All four .env.example key values blanked to empty assignments with names, comments and TRAFFIC_MONTHS=3 kept, per the user-confirmed 2026-10-22 hygiene decision (T-08-15); no removed value echoed anywhere and .env.local untouched"

requirements-completed: [SERK-01, SERK-02, SERK-03, SERK-04, SERK-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "SerankingPanel wired into Results directly after AdsPanel, keyed by data.domain: after a successful /api/traffic search a /api/seranking?domain=<domain> fetch occurs (ngrok-skip-browser-warning header + AbortSignal) and the 'SEO & quảng cáo trả phí (SE Ranking)' heading renders alongside the existing TabAPI panels"
    requirement: SERK-01
    verification:
      - kind: unit
        ref: "tests/src/components/traffic-dashboard.test.tsx#gọi /api/seranking và hiển thị phần SE Ranking bên dưới các panel TabAPI sau khi báo cáo tải xong"
        status: pass
      - kind: other
        ref: "grep -n \"SerankingPanel key={data.domain}\" src/components/traffic-dashboard.tsx (line 303)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Failure isolation of the wired section: when /api/seranking rejects, the TabAPI report (domain title, monthly-visits panel) stays visible and a role=alert with the Vietnamese fallback appears; existing dashboard tests (including the all-urls traffic-fixture mocks and the TabAPI error path) still pass unmodified"
    requirement: SERK-05
    verification:
      - kind: unit
        ref: "tests/src/components/traffic-dashboard.test.tsx#giữ nguyên báo cáo TabAPI và hiển thị alert của phần SE Ranking khi yêu cầu SE Ranking thất bại"
        status: pass
      - kind: unit
        ref: "tests/src/components/traffic-dashboard.test.tsx#hiển thị lỗi từ API"
        status: pass
      - kind: unit
        ref: "tests/src/components/traffic-dashboard.test.tsx#tìm kiếm và hiển thị toàn bộ nhóm dữ liệu"
        status: pass
    human_judgment: false
  - id: D3
    description: ".env.example sanitized: SE_RANKING_API_KEY= empty placeholder with Vietnamese server-side-only comment, and TABAPI_KEY/SERPAPI_KEY/WHOIS_API_KEY blanked to empty assignments (names, comments, TRAFFIC_MONTHS=3 kept); no non-empty key assignment remains; full suite, type-check and lint green"
    requirement: SERK-05
    verification:
      - kind: other
        ref: "grep -n \"^SE_RANKING_API_KEY=$\" .env.example (line 12)"
        status: pass
      - kind: other
        ref: "grep -nE \"^(TABAPI_KEY|SERPAPI_KEY|WHOIS_API_KEY|SE_RANKING_API_KEY)=.+\" .env.example returns no lines"
        status: pass
      - kind: other
        ref: "grep -n \"^TRAFFIC_MONTHS=3$\" .env.example (line 4)"
        status: pass
      - kind: other
        ref: "npx vitest run (127/127, 14 files) && npx tsc --noEmit (exit 0) && npm run lint (exit 0)"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-10-22
status: complete
---

# Phase 8 Plan 4: Dashboard Wiring + Env Sanitization Summary

**SerankingPanel wired one line into the dashboard Results after AdsPanel with wiring tests (RED→GREEN), and .env.example fully sanitized — all four key values blanked per the user-confirmed 2026-10-22 hygiene decision.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-10-22T05:48:32Z
- **Completed:** 2026-10-22T05:58:32Z
- **Tasks:** 2 (Task 1 TDD, Task 2 plain)
- **Files modified:** 3

## Accomplishments

- `src/components/traffic-dashboard.tsx`: two-line integration — `import { SerankingPanel } from "@/components/seranking-panel";` next to the AdsPanel import and `<SerankingPanel key={data.domain} domain={data.domain} />` rendered directly after `<AdsPanel … />` inside `Results`; `PANEL_INFO` and the TabAPI fetch code untouched (T-08-18: zero TabAPI regression, proven by `git diff` on `src/app/api/traffic`, `src/types/traffic.ts`, `src/lib/tabapi.ts` being empty)
- `src/components/traffic-dashboard.test.tsx`: two new Vietnamese tests with a URL-routing fetch mock — (1) `/api/seranking` returns `serankingFixture` → the `/api/seranking?domain=vercel.com` call happens with ngrok header + AbortSignal and the "SEO & quảng cáo trả phí (SE Ranking)" heading appears alongside TabAPI panels (ready-marker "534.575" awaited before the heading query to avoid the loading-panel twin heading); (2) `/api/seranking` rejects → TabAPI domain title and monthly-visits panel remain and a `role="alert"` with the Vietnamese SE Ranking fallback appears
- Existing dashboard tests needed zero modification — no `toHaveBeenCalledTimes` assertions exist, and `toHaveBeenCalledWith("/api/traffic?domain=vercel.com", …)` tolerates the extra seranking call; the all-urls traffic-fixture mocks drive the unwired-shape response into SerankingPanel's designed fallback-error path without throwing
- `.env.example`: all four key values (`TABAPI_KEY`, `SERPAPI_KEY`, `WHOIS_API_KEY`, `SE_RANKING_API_KEY`) blanked to empty assignments; names, comments and `TRAFFIC_MONTHS=3` kept; `SE_RANKING_API_KEY=` documented as the empty placeholder with the Vietnamese server-side-only comment (T-08-15; user-confirmed 2026-10-22); removed values never echoed into code, tests, docs or commit messages; `.env.local` untouched
- Full plan verification green: `npx vitest run` 127/127 (14 files), `npx tsc --noEmit` 0, `npm run lint` 0

## TDD Cycle (Task 1)

| Phase | Commit | Evidence |
|-------|--------|----------|
| RED | `d5be891` test(08-04): add failing tests for SerankingPanel wiring in dashboard | 2 of 7 tests fail on target assertions (fetch-arg AssertionError for the `/api/seranking?domain=vercel.com` call; TestingLibraryElementError for missing `role="alert"`); the 5 pre-existing dashboard tests all pass; `gsd-tools check tdd-red-evidence` → `RED_EVIDENCE_OK` |
| GREEN | `54e55ad` feat(08-04): wire SerankingPanel into dashboard Results | `npx vitest run src/components` 45/45 pass; all four task acceptance criteria met (suite exit 0, `SerankingPanel key={data.domain}` grep match, TabAPI/types diff empty, lint 0) |
| REFACTOR | — | No changes needed — the implementation is the minimal two-line wiring the plan prescribed |

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire SerankingPanel into Results and keep existing tests green** - `d5be891` (test, RED) + `54e55ad` (feat, GREEN)
2. **Task 2: Sanitize .env.example and run full verification** - `08cfb9e` (chore)

## Files Created/Modified

- `src/components/traffic-dashboard.tsx` - SerankingPanel import + keyed render after AdsPanel inside Results
- `src/components/traffic-dashboard.test.tsx` - Two wiring tests with URL-routing fetch mocks (seranking success + rejection isolation)
- `.env.example` - All key values blanked; SE_RANKING_API_KEY empty placeholder with Vietnamese comment

## Decisions Made

- Wiring is exactly the plan's two lines — no state plumbing added to TrafficDashboard since SerankingPanel owns its own fetch lifecycle (requestedDomain-keyed state from plan 08-03)
- No existing test edits: the plan's instruction to fix broken assertions found nothing broken — asserted via reading the full suite and re-running it before and after wiring
- All four keys blanked in one commit per the user-confirmed 2026-10-22 decision in 08-CONTEXT.md, rather than only SE_RANKING_API_KEY, because the file is a committed template (T-08-15)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `gsd-tools check tdd-red-evidence` requires the target test name to exactly equal the TAP-emitted failing-test name (file prefix included) — first record used the describe-relative name and returned `no_target_test_failure`; fixed by re-encoding the record with the full name. Additionally, PowerShell 5.1 `>` redirection re-encodes native UTF-8 output and mangles Vietnamese test names, so the adapter (outside the repo, `C:/Users/PC/AppData/Local/Temp/opencode/red-adapter-08-04.cjs`) captures the run via Node `execSync` — same truth-preserving adapter approach as plans 08-01/08-02/08-03

## User Setup Required

None - no external service configuration required by this plan. (The real key values now belong only in `.env.local`; per 08-CONTEXT.md the previously committed values must be **rotated by the user** — they remain in git history.)

## Next Phase Readiness

- Phase 08 plan 04 of 04 complete: SERK-01..05 are wired end to end (routes → lib → standalone panel → dashboard section) and the committed env template carries no secrets
- Ready for end-of-phase verification / UAT: visual adequacy of the four SE Ranking panels in the running dashboard (08-03's D7 human-judgment item) can now be checked in context, since the section is reachable below the TabAPI report

---
*Phase: 08-se-ranking-integration-supplementary-organic-paid-traffic-pa*
*Completed: 2026-10-22*
