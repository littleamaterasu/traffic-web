---
phase: 08-se-ranking-integration-supplementary-organic-paid-traffic-pa
verified: 2026-10-22T13:18:25Z
status: human_needed
score: 14/14 must-haves verified
covered_files: [".env.example", ".planning/phases/08-se-ranking-integration-supplementary-organic-paid-traffic-pa/08-01-PLAN.md", ".planning/phases/08-se-ranking-integration-supplementary-organic-paid-traffic-pa/08-01-SUMMARY.md", ".planning/phases/08-se-ranking-integration-supplementary-organic-paid-traffic-pa/08-02-PLAN.md", ".planning/phases/08-se-ranking-integration-supplementary-organic-paid-traffic-pa/08-02-SUMMARY.md", ".planning/phases/08-se-ranking-integration-supplementary-organic-paid-traffic-pa/08-03-PLAN.md", ".planning/phases/08-se-ranking-integration-supplementary-organic-paid-traffic-pa/08-03-SUMMARY.md", ".planning/phases/08-se-ranking-integration-supplementary-organic-paid-traffic-pa/08-04-PLAN.md", ".planning/phases/08-se-ranking-integration-supplementary-organic-paid-traffic-pa/08-04-SUMMARY.md", "src/app/api/seranking/backlinks/route.test.ts", "src/app/api/seranking/backlinks/route.ts", "src/app/api/seranking/route.test.ts", "src/app/api/seranking/route.ts", "src/components/seranking-panel.test.tsx", "src/components/seranking-panel.tsx", "src/components/traffic-dashboard.test.tsx", "src/components/traffic-dashboard.tsx", "src/lib/seranking.test.ts", "src/lib/seranking.ts", "src/test/seranking-fixture.ts", "src/types/seranking.ts"]
covered_digest: "v1:sha256:2aae50a93ca497e530f452d42a4426e75ab2894b039b1ce590d40c097ad5171a"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Visual adequacy of the four SE Ranking panels in the running dashboard: run `npm run dev`, search a domain with data, inspect the SE Ranking section below the TabAPI report — brutalist styling consistency, responsive competitors-table stacking on a phone-width viewport, and the 'i' info dialogs for all four panels"
    expected: "Section reads as part of the existing report; tables stack on mobile via td[data-label]; info dialogs open with the SE Ranking / TabAPI-difference explanations"
    why_human: "Pure visual/UX judgment — jsdom tests assert content and roles, not rendered styling"
  - test: "Live end-to-end with a real SE_RANKING_API_KEY in .env.local: search a domain known to have SE Ranking data, confirm the SE Ranking overview/keyword/competitor figures appear alongside the TabAPI figures, then click 'Tải backlink' and confirm the backlinks summary renders (this burns ~100 SE Ranking credits)"
    expected: "Estimates appear clearly labeled SE Ranking · toàn cầu; backlink summary loads only after the click; with the key removed, the section shows 'Chưa cấu hình SE_RANKING_API_KEY trên máy chủ.' while the TabAPI report still renders"
    why_human: "Requires the external SE Ranking service, a real key and real credits — cannot be exercised programmatically; roadmap planning gate also leaves credit metering as an open question (units_left did not move in probes)"
---

# Phase 8: SE Ranking Integration (Supplementary SEO / Paid Data) — Verification Report

**Phase Goal:** The researcher sees SE Ranking's organic and paid search estimates for the analyzed domain alongside the TabAPI figures, clearly labeled by source, without any change to the existing report or its credit usage.
**Verified:** 2026-10-22T13:18:25Z
**Status:** human_needed (all must-haves verified; 2 visual/live-API items require human UAT)
**Re-verification:** No — initial verification

## Goal Achievement

Every roadmap Success Criterion and every plan must-have was checked against the actual code (not SUMMARY claims). All behavior-dependent truths (no-auto-backlinks-fetch, click-only fetch, cache dedup, failure isolation, abort-on-unmount, key-leak prevention) are backed by passing named tests in the suite that was re-run during this verification (127/127, 14 files).

### Observable Truths

| #   | Truth (deduplicated; roadmap SC wording kept where plans restate it) | Status     | Evidence |
| --- | -------------------------------------------------------------------- | ---------- | -------- |
| 1   | SC1 (≈ 08-03 T1, 08-04 T1): Organic and paid keyword count, estimated traffic and traffic value (worldwide) from SE Ranking, labeled as SE Ranking estimates distinct from TabAPI, appearing below the TabAPI panels after a report renders | ✓ VERIFIED | `seranking-panel.tsx:189-245` OverviewPanel with 6 MetricCards (formatNumber/formatCompactNumber/formatCurrency), badge "SE Ranking · toàn cầu", `SERANKING_INFO.overview.note` explicitly states "khác với TabAPI"; wired at `traffic-dashboard.tsx:303`; dashboard wiring test "gọi /api/seranking và hiển thị phần SE Ranking bên dưới các panel TabAPI…" passes |
| 2   | SC2 (≈ 08-03 T2): Top paid keywords with CPC, volume, position, ad block (top/bottom), title/description/display URL and landing page | ✓ VERIFIED | `seranking-panel.tsx:144-187` AdCard + 10-row cap (line 248 `slice(0, LIST_LIMIT)`); tests "chỉ hiển thị tối đa 10 mẫu quảng cáo từ fixture 11 dòng", "hiển thị đầy đủ thông tin mẫu quảng cáo…", link rendered only for http/https with `rel="noopener noreferrer"` `target="_blank"` (lines 146-148, 178) — all pass |
| 3   | SC3 (≈ 08-03 T3a): Advertiser competitors with common-keyword counts | ✓ VERIFIED | `seranking-panel.tsx:271-312` CompetitorsPanel (`responsive-table` + `td data-label`: Tên miền / Từ khóa chung / Mức liên quan / Traffic); tests "hiển thị bảng đối thủ dùng responsive-table với td data-label" pass |
| 4   | SC4 (≈ 08-03 T3b): "Tải backlink" loads backlinks summary (backlinks, refdomains, dofollow share, domain inlink rank, top anchors) on explicit click only — never fetched automatically | ✓ VERIFIED | `seranking-panel.tsx:322-430` BacklinksPanel (idle→loading→error/ready, fetch only in `load()` click handler line 422); tests "không bao giờ gọi /api/seranking/backlinks khi mount hay khi domain không đổi", "bấm Tải backlink gọi đúng một lần… và hiển thị tỷ lệ dofollow 75.0%", "đặt lại về nút Tải backlink khi domain thay đổi" all pass; main route never imports `getSeRankingBacklinks` (verified by reading `src/app/api/seranking/route.ts`) |
| 5   | SC5 (≈ 08-03 T4, 08-02 T3/T4, 08-04 T3): Without key, on failure or empty data → Vietnamese state; rest of report renders; key never reaches the browser | ✓ VERIFIED | Route 500 `missing_api_key` "Chưa cấu hình SE_RANKING_API_KEY trên máy chủ." (`route.ts:55-58`, `backlinks/route.ts:37-40`); per-slice error alerts inside their own panels while siblings render (`SliceState`, tests pass); dashboard test "giữ nguyên báo cáo TabAPI và hiển thị alert của phần SE Ranking…" passes; `process.env.SE_RANKING_API_KEY` appears only in the two server route files (recursive grep of non-test src); no `NEXT_PUBLIC_*` anywhere; route happy-path test asserts body lacks the key |
| 6   | SC6 (≈ 08-01 T2): Repeated lookups within 24h served from cache with in-flight dedup | ✓ VERIFIED | Four separate `createCachedStore` instances (`seranking.ts:284-287`) keyed `domain` / `domain:source:limit`; `cached-store.ts:1` `DEFAULT_TTL_MS = 24 * 60 * 60 * 1000`, in-flight `Map` dedup (lines 21-53); lib tests "getSeRankingX cùng tham số chỉ gọi mạng một lần và không đụng chéo store", "backlinks có store riêng…", "lỗi không được cache…" pass; backlinks route test "gọi upstream chỉ một lần khi gọi route hai lần liên tiếp nhờ cache" passes |
| 7   | 08-01 T1: Four SE Ranking slices (overview, ad keywords, ad competitors, backlinks summary) fetched and normalized from upstream JSON | ✓ VERIFIED | `src/lib/seranking.ts` — four `fetchSeRankingX` mappers with `num()`/`str()` guards (lines 111-282), fixed base `https://api.seranking.com/v1` + hard-coded path literals + `URLSearchParams` only; 15 lib tests pass |
| 8   | 08-01 T3: Upstream failures become `SeRankingApiError` with Vietnamese messages and English snake_case codes | ✓ VERIFIED | `failure()` mapping 401/403→invalid_api_key, 402→insufficient_credits, 429→rate_limited, else 502 seranking_error; network→network_error; `this.name = "SeRankingApiError"`; tests including "thông báo không bao giờ chứa key" pass |
| 9   | 08-01 T4: Empty/missing upstream arrays yield null/empty data, not exceptions | ✓ VERIFIED | `toMetric` null for missing organic/adv (lines 230-231), non-array keyword/competitor bodies → `[]` (lines 248, 265), empty/missing `summary` → null (line 280); tests "overview với mảng rỗng hoặc thiếu mảng trả null thay vì lỗi", "backlinks: summary rỗng hoặc thiếu trả null" pass |
| 10  | 08-02 T1: GET /api/seranking returns overview+keywords+competitors with per-slice {data,error}; one failing slice does not fail the others; NEVER calls the backlinks endpoint | ✓ VERIFIED | `route.ts:60-64` `Promise.allSettled` over the three getters with `LIST_LIMIT = 10`; `toSlice` maps rejected→error slice; happy-path test explicitly asserts no fetch path contains `/backlinks/`; keywords-500 partial-failure and all-401 tests pass |
| 11  | 08-02 T2: GET /api/seranking/backlinks is the only route calling /backlinks/summary, requested only by explicit user action | ✓ VERIFIED | `backlinks/route.ts:2,44` imports/calls only `getSeRankingBacklinks`; main route has no such import (file read confirms); UI triggers it only from the "Tải backlink" click (test passes) |
| 12  | 08-02 T5 + 08-04 T2: /api/traffic, TrafficResponse, tabapi.ts and existing dashboard tests are unmodified | ✓ VERIFIED | `git diff b2bbfd4..HEAD -- src/app/api/traffic src/types/traffic.ts src/lib/tabapi.ts` is EMPTY; `git diff b2bbfd4..HEAD -- src/components/traffic-dashboard.test.tsx` = 50 insertions, 0 deletions (only the two wiring tests added); full suite 127/127 green |
| 13  | 08-04 T3: `.env.example` documents `SE_RANKING_API_KEY=` as an empty placeholder with no real key value | ✓ VERIFIED | `.env.example:11-12` — Vietnamese server-side-only comment + `SE_RANKING_API_KEY=`; grep `^(TABAPI_KEY|SERPAPI_KEY|WHOIS_API_KEY|SE_RANKING_API_KEY)=.+` returns no lines; `TRAFFIC_MONTHS=3` intact |
| 14  | 08-03 (state model): re-fetch on domain change, abort on unmount, stale completions for a previous domain never render | ✓ VERIFIED | `seranking-panel.tsx:444-485` effect keyed `[domain]` with AbortController + 20s timeout, cleanup aborts; requestedDomain-derived view (lines 365, 487) makes out-of-domain responses unrenderable by construction; tests "gọi lại /api/seranking khi domain thay đổi", "hủy yêu cầu đang chờ khi component unmount", "đặt lại về nút Tải backlink khi domain thay đổi" pass |

**Score:** 14/14 truths verified (0 present, behavior-unverified)

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| SERK-01 | 08-01, 08-02, 08-03, 08-04 | Worldwide organic/paid keyword count, traffic, traffic value from SE Ranking overview, labeled distinct from TabAPI | ✓ SATISFIED | Truth #1 |
| SERK-02 | 08-01, 08-02, 08-03, 08-04 | Top paid keywords (type=adv) with CPC, volume, position, ad block, ad title/description/display URL and landing page | ✓ SATISFIED | Truth #2 |
| SERK-03 | 08-01, 08-02, 08-03, 08-04 | Advertiser competitors (type=adv) with common-keyword counts and relevance | ✓ SATISFIED | Truth #3 |
| SERK-04 | 08-01, 08-02, 08-03, 08-04 | Backlinks summary on explicit click only (~100 credits), never automatic | ✓ SATISFIED | Truth #4 |
| SERK-05 | 08-01, 08-02, 08-03, 08-04 | Key server-side only; absent key / upstream error / empty data → Vietnamese state without failing the report; 24h cache + in-flight dedup via createCachedStore | ✓ SATISFIED | Truths #5, #6 |

No orphaned requirements: REQUIREMENTS.md maps exactly SERK-01..05 to Phase 8 (traceability lines 169-173, marked Complete), and all five are declared in every plan's frontmatter `requirements` field.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/types/seranking.ts` | SE Ranking DTOs + per-slice envelope (`SeRankingResponse`, `SeRankingBacklinksResponse`) | ✓ VERIFIED | 79 lines, all 9 planned interfaces present, snake_case pass-through style |
| `src/lib/seranking.ts` | HTTP client + 4 cached stores, `SeRankingApiError`, `clearSeRankingCache` | ✓ VERIFIED | 338 lines; all 10 planned exports present; 5 `createCachedStore` references (1 import + 4 stores); no `process.env` reads |
| `src/lib/seranking.test.ts` | 15 lib tests, no real network | ✓ VERIFIED | 15 `it()` blocks, injectable `fetchImpl` mocks, pass |
| `src/app/api/seranking/route.ts` | BFF route, 3-slice envelope | ✓ VERIFIED | 76 lines; `runtime = "nodejs"`, validation order domain→source→key, `Promise.allSettled`, Cache-Control header |
| `src/app/api/seranking/route.test.ts` | 8 route tests | ✓ VERIFIED | 8 `it()` blocks pass (incl. no-backlinks-call and no-key-leak assertions) |
| `src/app/api/seranking/backlinks/route.ts` | On-demand backlinks route | ✓ VERIFIED | 53 lines; only `getSeRankingBacklinks`; no source/limit params |
| `src/app/api/seranking/backlinks/route.test.ts` | 5 route tests | ✓ VERIFIED | 5 `it()` blocks pass (incl. cache dedup) |
| `src/components/seranking-panel.tsx` | SerankingPanel client component | ✓ VERIFIED | 524 lines; "use client"; named export; 4 panels + PANEL_INFO `satisfies Record<string, PanelInfo>`; no `process.env`, no `dangerouslySetInnerHTML` |
| `src/components/seranking-panel.test.tsx` | 26 component tests | ✓ VERIFIED | 26 `it()` blocks pass |
| `src/test/seranking-fixture.ts` | Typed fixtures | ✓ VERIFIED | `serankingFixture` (11 ad rows, 1 non-http URL, 2 competitors) + `serankingBacklinksFixture` (750/1000), no secrets |
| `src/components/traffic-dashboard.tsx` | SerankingPanel wired after AdsPanel | ✓ VERIFIED | Import line 5; `<SerankingPanel key={data.domain} domain={data.domain} />` line 303, directly after AdsPanel line 302 |
| `src/components/traffic-dashboard.test.tsx` | 2 wiring tests, existing tests untouched | ✓ VERIFIED | Diff = 50 added / 0 removed; both wiring tests pass |
| `.env.example` | `SE_RANKING_API_KEY=` empty placeholder | ✓ VERIFIED | Line 12; all four key values blanked |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `src/lib/seranking.ts` | `https://api.seranking.com/v1` | `Authorization: Token ${apiKey}` header | ✓ WIRED | Lines 11, 125-135; fixed base + URLSearchParams only |
| `src/app/api/seranking/route.ts` | `src/lib/seranking.ts` | `getSeRankingOverview/Keywords/Competitors` in `Promise.allSettled` | ✓ WIRED | Lines 60-64 |
| `src/app/api/seranking/backlinks/route.ts` | `src/lib/seranking.ts` | `getSeRankingBacklinks` (on demand only) | ✓ WIRED | Lines 2, 44 |
| `src/components/seranking-panel.tsx` | `/api/seranking` | fetch with `encodeURIComponent(domain)`, ngrok header, AbortSignal | ✓ WIRED | Line 450; asserted by panel + dashboard tests |
| `src/components/seranking-panel.tsx` | `/api/seranking/backlinks` | click-only fetch, 20s timeout | ✓ WIRED | Line 331 inside `load()`; mount-no-call test passes |
| `src/components/traffic-dashboard.tsx` | `src/components/seranking-panel.tsx` | `<SerankingPanel key={data.domain} domain={data.domain} />` | ✓ WIRED | Line 303 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| OverviewPanel MetricCards | `SeRankingResponse.overview` | `/api/seranking` → `getSeRankingOverview` → SE Ranking API | Yes (server fetch; cache 24h) | ✓ FLOWING |
| AdCard list | `SeRankingResponse.keywords` | `/api/seranking` → `getSeRankingKeywords` | Yes | ✓ FLOWING |
| CompetitorsPanel table | `SeRankingResponse.competitors` | `/api/seranking` → `getSeRankingCompetitors` | Yes | ✓ FLOWING |
| BacklinksPanel metrics/anchors | `SeRankingBacklinksResponse.backlinks` | click → `/api/seranking/backlinks` → `getSeRankingBacklinks` | Yes | ✓ FLOWING |

No static/hardcoded data paths in production code — fixtures exist only in test files, and null/empty slices render honest Vietnamese EmptyCell states rather than fake values.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite | `npx vitest run` | 14 files, 127/127 passed (4.1s) | ✓ PASS |
| Type check | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Lint | `npm run lint` | exit 0 | ✓ PASS |
| TabAPI surface unchanged since phase start | `git diff b2bbfd4..HEAD -- src/app/api/traffic src/types/traffic.ts src/lib/tabapi.ts` | empty diff | ✓ PASS |
| Key only in server routes | recursive grep `process.env.SE_RANKING_API_KEY` (non-test src) | only `src/app/api/seranking/route.ts:55` and `backlinks/route.ts:37` | ✓ PASS |
| No secrets in env template | grep `^(…KEY)=.+` on `.env.example` | no matches | ✓ PASS |
| Existing dashboard tests not weakened | `git diff b2bbfd4..HEAD -- src/components/traffic-dashboard.test.tsx` | 50 insertions, 0 deletions | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes declared or conventional for this phase. The live SE Ranking probe was run during planning (2026-10-22, recorded in ROADMAP planning gate). SKIPPED — nothing to run.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/components/traffic-dashboard.tsx` | 386, 389 | "placeholder" text match | ℹ️ Info | Legitimate HTML input `placeholder` attributes on the pre-existing search field — not a debt marker or stub |

No TBD/FIXME/XXX/HACK markers in any phase file. No empty implementations, no console.log-only handlers, no hardcoded empty props feeding rendered output.

### Human Verification Required

### 1. Visual adequacy of the SE Ranking section in the running dashboard

**Test:** Run `npm run dev`, search a domain with SE Ranking data, inspect the four SE Ranking panels below the TabAPI report; check a phone-width viewport for the competitors-table stacking and open all four "i" info dialogs.
**Expected:** Section reads as part of the existing brutalist report; `responsive-table` stacks via `td[data-label]` on mobile; info dialogs explain SE Ranking as a supplementary estimate source that can differ from TabAPI.
**Why human:** Pure visual/UX judgment — jsdom tests verify content, roles and wiring, not rendered styling. This is the deferred D7 human-judgment item from plan 08-03, explicitly awaiting this end-of-phase check.

### 2. Live end-to-end run with a real `SE_RANKING_API_KEY` (includes the ~100-credit backlink click)

**Test:** Put the real key in `.env.local`, restart the server, search a known domain, verify SE Ranking figures appear alongside TabAPI figures; then click "Tải backlink" and verify the backlinks summary; finally remove the key and confirm the Vietnamese missing-key alert appears while the TabAPI report still renders.
**Expected:** Figures labeled "SE Ranking · toàn cầu"; backlink summary loads only after the click; without the key the section shows "Chưa cấu hình SE_RANKING_API_KEY trên máy chủ." and the rest of the report is unaffected.
**Why human:** Requires the external SE Ranking service, a real key and real credits — not exercisable programmatically. The roadmap planning gate also leaves SE Ranking credit metering as an open question (units_left did not move during probes), which only a live run can observe.

## Gaps Summary

No gaps. All 14 must-haves are verified against the code with passing behavioral tests (127/127 suite, tsc and lint clean, TabAPI surface byte-identical since phase start b2bbfd4). The phase goal is achieved in code; the two human-verification items above cover the only things static analysis cannot see — rendered visual quality and live external-service behavior with a real key.

---

_Verified: 2026-10-22T13:18:25Z_
_Verifier: the agent (gsd-verifier)_
