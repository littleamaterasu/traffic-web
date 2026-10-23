---
phase: quick-261023-djq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/seranking.ts
  - src/app/api/seranking/route.ts
  - src/app/api/seranking/competitors/route.ts
  - src/app/api/seranking/route.test.ts
  - src/app/api/seranking/competitors/route.test.ts
  - src/test/seranking-fixture.ts
  - src/components/seranking-panel.tsx
  - src/components/seranking-panel.test.tsx
  - src/components/traffic-dashboard.test.tsx
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/PROJECT.md
autonomous: true
requirements: [SERK-03, SERK-05]
must_haves:
  truths:
    - "GET /api/seranking returns only {domain, source, overview} and never requests /domain/competitors"
    - "GET /api/seranking/competitors is the only caller of getSeRankingCompetitors"
    - "Competitors panel makes no request until the user clicks 'Tải đối thủ quảng cáo'"
    - "Loading disables the button and shows role=status; failure shows role=alert and 'Thử lại'; success hides the button and shows the table; domain change resets to idle"
    - "Backlinks flow and its tests are unchanged in behavior"
  artifacts:
    - path: "src/app/api/seranking/competitors/route.ts"
      provides: "On-demand competitors route"
      exports: ["GET", "runtime"]
    - path: "src/app/api/seranking/competitors/route.test.ts"
      provides: "Route tests"
  key_links:
    - from: "src/components/seranking-panel.tsx"
      to: "/api/seranking/competitors"
      via: "fetch on button click"
      pattern: "api/seranking/competitors\\?domain="
    - from: "src/app/api/seranking/competitors/route.ts"
      to: "getSeRankingCompetitors"
      via: "call with LIST_LIMIT 10"
      pattern: "getSeRankingCompetitors\\(domain, source, LIST_LIMIT, apiKey\\)"
---

<objective>
Make SE Ranking advertiser competitors load on explicit click, mirroring the backlinks flow, to save SE Ranking credits.
Output: new competitors route, slimmed default route, panel with idle/loading/error/ready state, updated fixtures/tests, planning docs.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@.planning/STATE.md
@src/app/api/seranking/route.ts
@src/app/api/seranking/backlinks/route.ts
@src/components/seranking-panel.tsx
@src/types/seranking.ts
@src/test/seranking-fixture.ts
@src/lib/seranking.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Types, default route slimmed, new competitors route with tests</name>
  <files>src/types/seranking.ts, src/app/api/seranking/route.ts, src/app/api/seranking/competitors/route.ts, src/app/api/seranking/route.test.ts, src/app/api/seranking/competitors/route.test.ts, src/test/seranking-fixture.ts</files>
  <behavior>
    - GET /api/seranking: body is exactly {domain, source, overview}; fetch mock is never called with a URL containing /domain/competitors
    - competitors route: invalid domain -> 400 invalid_domain; source not /^[a-z]{2}$/ -> 400 invalid_source; no SE_RANKING_API_KEY -> 500 missing_api_key; success -> {domain, source, competitors:{data,error:null}}; upstream failure -> 200 with competitors {data:null, error:{code,message}} (SeRankingApiError code preserved, unknown errors -> code unexpected_error, message "Không thể lấy dữ liệu SE Ranking lúc này."); key string absent from body; second call served from cache (fetch called once)
  </behavior>
  <action>
In src/types/seranking.ts remove `competitors` from `SeRankingResponse`; add exported `SeRankingCompetitorsResponse { domain: string; source: string; competitors: SeRankingSlice<SeRankingCompetitor[]> }`; keep `SeRankingCompetitor`.
In src/app/api/seranking/route.ts drop the `getSeRankingCompetitors` import, `LIST_LIMIT`, and the `Promise.allSettled`; call only `getSeRankingOverview(domain, apiKey)` inside try/catch (or allSettled on one item) reusing `toSlice`; respond `{domain, source, overview}`. Keep validation order (normalizeDomain -> source pattern default "us" -> key) and Cache-Control.
Create src/app/api/seranking/competitors/route.ts modeled on backlinks/route.ts: `export const runtime = "nodejs"`, same errorResponse, validation order normalizeDomain -> source (`SOURCE_PATTERN`, `DEFAULT_SOURCE = "us"`, invalid_source 400, message "Mã cơ sở dữ liệu khu vực không hợp lệ.") -> key (missing_api_key 500, same Vietnamese message), `const LIST_LIMIT = 10`, `toErrorSlice` typed for `SeRankingCompetitor[]`, call `getSeRankingCompetitors(domain, source, LIST_LIMIT, apiKey)`, respond `NextResponse.json<SeRankingCompetitorsResponse>` with header `Cache-Control: private, max-age=0, must-revalidate`. Caching comes from the existing competitors store in the lib; do not change src/lib/seranking.ts unless a test proves it necessary.
In src/test/seranking-fixture.ts remove `competitors` from `serankingFixture`; add exported `serankingCompetitorsFixture: SeRankingCompetitorsResponse` {domain "acme.com", source "us", competitors: {data: COMPETITOR_ROWS, error: null}}.
Update src/app/api/seranking/route.test.ts: remove competitors assertions/cases, assert body has no `competitors` key and no fetched URL includes `/domain/competitors`; keep other assertions. Create competitors/route.test.ts following the existing route.test.ts/backlinks test setup (fetch stub, `clearSeRankingCache()` in beforeEach, env key handling), Vietnamese test descriptions, covering all behaviors listed. Do not weaken remaining assertions.
  </action>
  <verify>
    <automated>npx vitest run src/app/api/seranking src/lib/seranking.test.ts</automated>
  </verify>
  <done>Default route never touches competitors; new route tests pass including cache hit and key-not-in-body.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Competitors panel on demand, panel and dashboard tests</name>
  <files>src/components/seranking-panel.tsx, src/components/seranking-panel.test.tsx, src/components/traffic-dashboard.test.tsx</files>
  <behavior>
    - After overview loads, competitors panel shows explanatory line mentioning SE Ranking credits and button "Tải đối thủ quảng cáo"; fetch is not called for /api/seranking/competitors on mount
    - Click -> fetch `/api/seranking/competitors?domain=<encodeURIComponent(domain)>` with NGROK headers and AbortSignal; role=status shown, button disabled
    - Failure (non-OK, bad shape, slice.error, abort/timeout) -> role=alert with message and button "Thử lại"; retry works
    - Success -> button gone, table rows (rival-one.com etc.) rendered; empty data -> EmptyCell "Chưa phát hiện đối thủ quảng cáo nào cho tên miền này."
    - Rerender with a different domain -> back to idle with button and no table
  </behavior>
  <action>
In seranking-panel.tsx: change `isSeRankingResponse` to require only domain, source, overview slice; add `isSeRankingCompetitorsResponse` (domain string + `isSliceShape(candidate.competitors)`). Import `SeRankingCompetitorsResponse` type as needed. Replace `CompetitorsPanel({slice})` with `CompetitorsPanel({ domain })` using a `CompetitorsState` union identical in shape to `BacklinksState` (phase idle/loading/error/ready, `requestedDomain`, `IDLE_COMPETITORS_STATE`), a `load()` copying the backlinks one (same AbortController, `REQUEST_TIMEOUT_MS`, `NGROK_HEADERS`, `readErrorMessage`, `isAbortError`, FALLBACK/TIMEOUT messages; on `body.competitors.error` -> error phase with its message). Keep the existing table markup and `SERANKING_INFO.competitors` (update its note to say each load costs SE Ranking credits so it loads only on click). Render explanatory line, error `<p role="alert">`, loading `<p role="status">` ("Đang tải danh sách đối thủ từ SE Ranking…"), table/empty on ready, and button (`buttonClass`, disabled while loading, label "Thử lại" on error else "Tải đối thủ quảng cáo") hidden when ready. Do not refactor the backlinks code unless a small shared helper keeps both flows identical; otherwise duplicate for safety. In SerankingPanel render `<CompetitorsPanel domain={domain} />` instead of passing a slice.
Update seranking-panel.test.tsx: remove tests/lines assigning `payload.competitors` (lines ~195, ~207) and rewrite them as click-driven tests of the competitors flow (use `serankingCompetitorsFixture`, mock fetch routing by URL like the existing backlinks tests); add tests for no request on mount, loading/disabled, error + "Thử lại", button hidden after success, empty list, domain-change reset. Update traffic-dashboard.test.tsx fixtures/mocks so `/api/seranking` returns the slimmed `serankingFixture` and any competitors expectations become click-driven or removed; keep other assertions intact. Vietnamese test descriptions.
  </action>
  <verify>
    <automated>npx vitest run src/components</automated>
  </verify>
  <done>Competitors load only on click with full idle/loading/error/ready/reset behavior; backlinks tests still pass unchanged.</done>
</task>

<task type="auto">
  <name>Task 3: Planning docs and full verification</name>
  <files>.planning/REQUIREMENTS.md, .planning/ROADMAP.md, .planning/PROJECT.md</files>
  <action>
REQUIREMENTS.md: edit SERK-03 (line ~87) to state advertiser competitors from `domain/competitors?type=adv` load only on explicit click (never automatically) with common-keyword counts and relevance; edit SERK-05 (line ~89) so it stays consistent (key server-side, Vietnamese states, 24h cache with in-flight dedup, competitors and backlinks fetched on demand only). ROADMAP.md Phase 8 success criterion 2 (line ~151): "Researcher can click \"Tải đối thủ quảng cáo\" to load advertiser competitors ... never fetched automatically because it costs SE Ranking credits"; adjust the 08-02 plan-list description only if it claims competitors in the default route is current behavior (leave historical wording otherwise). PROJECT.md Key Decisions table: add row `| SE Ranking competitors on demand (2026-10-23) | Loads only on explicit click like backlinks to save credits | ✓ Decided |`. Do not edit historical phase 08 PLAN/SUMMARY files, TabAPI code, /api/traffic, src/types/traffic.ts, .env.example, .env.local.
Then run full verification and fix any failures.
  </action>
  <verify>
    <automated>npx vitest run && npx tsc --noEmit && npm run lint && test "$(grep -rl getSeRankingCompetitors src --include=*.ts --include=*.tsx | grep -v test | sort | tr '\n' ' ')" = "src/app/api/seranking/competitors/route.ts src/lib/seranking.ts " && ! grep -n "getSeRankingCompetitors\|domain/competitors" src/app/api/seranking/route.ts</automated>
  </verify>
  <done>All tests, typecheck and lint pass; non-test references to getSeRankingCompetitors are only the lib and the new route; default route has no competitors reference; docs updated.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser -> /api/seranking/competitors | untrusted domain and source query params |
| server -> SE Ranking | API key leaves server only in upstream header |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-djq-01 | I | competitors route body | mitigate | Return only domain/source/slice; test asserts key string absent from body |
| T-djq-02 | T | domain/source params | mitigate | normalizeDomain and `/^[a-z]{2}$/` validated before any upstream call |
| T-djq-03 | D | credit burn | mitigate | No auto-fetch; button disabled while loading; 24h cache with in-flight dedup |
| T-djq-04 | I | unknown error messages | mitigate | Generic Vietnamese message for non-SeRankingApiError |
</threat_model>

<verification>
npx vitest run; npx tsc --noEmit; npm run lint; greps from Task 3.
</verification>

<success_criteria>
Competitors never fetched unless the user clicks; all tests, typecheck, lint green; docs record the decision.
</success_criteria>

<output>
Create `.planning/quick/261023-djq-se-ranking-competitors-on-demand-button/261023-djq-SUMMARY.md` when done
</output>
