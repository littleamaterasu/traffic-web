---
phase: quick-261023-duc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/seranking.ts
  - src/lib/seranking.ts
  - src/lib/seranking.test.ts
  - src/app/api/seranking/route.ts
  - src/app/api/seranking/route.test.ts
  - src/app/api/seranking/ads/route.ts
  - src/app/api/seranking/ads/route.test.ts
  - src/lib/seranking-ad-title.ts
  - src/lib/seranking-ad-title.test.ts
  - src/test/seranking-fixture.ts
  - src/components/seranking-panel.tsx
  - src/components/seranking-panel.test.tsx
  - src/components/traffic-dashboard.test.tsx
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/PROJECT.md
autonomous: true
requirements: [SERK-01, SERK-02, SERK-05]
must_haves:
  truths:
    - "SerankingPanel makes no request on mount; ad copy, competitors and backlinks each load only on button click"
    - "Clicking 'Tải mẫu quảng cáo' shows up to 10 ad cards (keyword, block, position, title, display URL, description, landing page) with no volume/CPC/traffic/price anywhere"
    - "No SE Ranking overview code, type, route, fixture or test remains"
    - "Competitors and backlinks behave exactly as before"
  artifacts:
    - { path: "src/app/api/seranking/ads/route.ts", provides: "GET ads route returning SeRankingAdsResponse" }
    - { path: "src/lib/seranking-ad-title.ts", provides: "cleanAdTitle pure helper" }
  key_links:
    - { from: "src/components/seranking-panel.tsx", to: "/api/seranking/ads", via: "fetch on click", pattern: "api/seranking/ads" }
    - { from: "src/app/api/seranking/ads/route.ts", to: "src/lib/seranking.ts", via: "getSeRankingAds" }
---

<objective>
Remove the SE Ranking overview panel end to end (SERK-01 dropped) and re-add the ad-copy panel (SERK-02) as an on-demand section without volume/CPC. TabAPI stays the source of truth for numbers.
Output: ads route + lib/type changes, updated panel/fixtures/tests, updated planning docs.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@src/lib/seranking.ts
@src/types/seranking.ts
@src/app/api/seranking/competitors/route.ts
@src/components/seranking-panel.tsx
@src/test/seranking-fixture.ts

Reference for the old keywords code (adapt, do not copy volume/cpc): `git show 36d2abf^:src/lib/seranking.ts`, `git show 36d2abf^:src/components/seranking-panel.tsx`, `git show 36d2abf^:src/test/seranking-fixture.ts`, `git show 36d2abf^:src/app/api/seranking/route.ts`.

Existing contracts: `SeRankingSlice<T> {data, error}`, `SeRankingApiError(status, code, message)`, `requestSeRanking` (module-private), `createCachedStore<T>()` with `.get(key, fn)` and `.clear()`, `Panel`/`EmptyCell`/`PanelInfo` from `@/components/panel`. The competitors route is the template for the ads route (same validation order, headers, error slice, `LIST_LIMIT = 10`).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Lib, types, ads route, title helper; delete overview code and default route</name>
  <files>src/types/seranking.ts, src/lib/seranking.ts, src/lib/seranking.test.ts, src/lib/seranking-ad-title.ts, src/lib/seranking-ad-title.test.ts, src/app/api/seranking/ads/route.ts, src/app/api/seranking/ads/route.test.ts, src/app/api/seranking/route.ts, src/app/api/seranking/route.test.ts</files>
  <behavior>
    - Normalizer drops volume, cpc, competition, traffic, price, difficulty, block_position; keeps only keyword, position, block, url, snippet_title, snippet_description, snippet_display_url
    - block: "top" | "bottom" when the upstream string equals one of them, else null
    - cleanAdTitle("Buy Shoes - Acme https://www.acme.com") -> "Buy Shoes - Acme"; strips trailing " › path" breadcrumb tail too; if result empty returns the raw title; null/empty input -> null
    - Ads route: invalid domain 400 invalid_domain; invalid source 400 invalid_source; missing key 500 missing_api_key with fetch never called; success returns {domain, source, ads:{data,error:null}}; upstream failure -> 200 with ads.error slice (generic Vietnamese "Không thể lấy dữ liệu SE Ranking lúc này." for unknown errors); key never in body; no row has volume/cpc keys; second call hits the 24h cache (one upstream fetch)
  </behavior>
  <action>
    types/seranking.ts: delete `SeRankingMetric`, `SeRankingOverview`, `SeRankingResponse`. Add `SeRankingAdKeyword { keyword: string|null; position: number|null; block: "top"|"bottom"|null; url: string|null; snippet_title: string|null; snippet_description: string|null; snippet_display_url: string|null }` (no volume/cpc/traffic/price fields) and `SeRankingAdsResponse { domain: string; source: string; ads: SeRankingSlice<SeRankingAdKeyword[]> }`.
    lib/seranking.ts: remove `OVERVIEW_PATH`, `CURRENCY`, `UpstreamOverviewEntry`, `UpstreamOverview`, `toMetric`, `fetchSeRankingOverview`, `getSeRankingOverview`, `overviewStore` and their imports. Add `KEYWORDS_PATH = "/domain/keywords"`, restore `UpstreamKeywordRow` (as in 36d2abf^), `toKeyword` returning only the 7 allowed fields, `fetchSeRankingKeywords(domain, source, limit, apiKey, fetchImpl)` calling `/domain/keywords` with `type=adv` (reuse `KEYWORD_TYPE`), `keywordsStore`, `getSeRankingKeywords(domain, source, limit, apiKey, fetchImpl)` keyed `${domain}:${source}:${limit}`, and include `keywordsStore.clear()` in `clearSeRankingCache`. Keep `num`, `str`, `failure`, `requestSeRanking` (still used by competitors/backlinks).
    lib/seranking-ad-title.ts: export `cleanAdTitle(raw: string | null): string | null` using regexes for a trailing `\s*https?:\/\/\S+\s*$` and a trailing `\s*›.*$`; trim; fall back to raw when cleaned is empty. Test in seranking-ad-title.test.ts (Vietnamese descriptions).
    ads/route.ts: copy competitors/route.ts structure with `export const runtime = "nodejs"`, `LIST_LIMIT = 10`, same Cache-Control header `private, max-age=0, must-revalidate`, `getSeRankingKeywords`, response typed `NextResponse.json<SeRankingAdsResponse>({ domain, source, ads }, ...)`. Read `process.env.SE_RANKING_API_KEY` in this route only after domain and source validation. Do not reference volume/cpc anywhere.
    Delete src/app/api/seranking/route.ts and route.test.ts (git rm). Update seranking.test.ts: remove overview tests, add keywords fetch/normalizer tests (URL contains /domain/keywords and type=adv, volume/cpc dropped, block mapping, cache dedup, clear). Write ads/route.test.ts modeled on competitors/route.test.ts covering every behavior above; do not weaken competitors/backlinks tests.
  </action>
  <verify>
    <automated>npx vitest run src/lib src/app/api/seranking</automated>
  </verify>
  <done>Ads route and helper tested green; overview lib code, types and default route gone; competitors/backlinks tests unchanged and green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Panel (no mount fetch, on-demand ads), fixtures, panel and dashboard tests</name>
  <files>src/test/seranking-fixture.ts, src/components/seranking-panel.tsx, src/components/seranking-panel.test.tsx, src/components/traffic-dashboard.test.tsx</files>
  <behavior>
    - Mount issues zero fetches; three sections render with buttons "Tải mẫu quảng cáo", "Tải đối thủ quảng cáo", "Tải backlink"
    - Ads click: one fetch to /api/seranking/ads?domain=..., status role while loading with disabled button, up to 10 cards, button hidden after success, error shows role="alert" and "Thử lại", domain change resets to idle
    - Landing page is a link with target="_blank" rel="noopener noreferrer" only for http(s) url; otherwise plain text; glued title cleaned; no volume/CPC text rendered
  </behavior>
  <action>
    Fixtures: remove `serankingFixture` (overview) and the `SeRankingResponse` import; add `serankingAdsFixture: SeRankingAdsResponse` (domain "acme.com", source "us") with 11 rows: one with url "ftp://..." or "acme.com/page" (non-http), one with snippet_title "Giày chạy bộ giá tốt - Acme https://www.acme.com", block "top"/"bottom" mix, no volume/cpc keys. Keep competitors/backlinks fixtures.
    seranking-panel.tsx: delete `SERANKING_INFO.overview`, `OverviewPanel`, `isSeRankingResponse`, `SerankingFetchState`, `loadingState`, the mount `useEffect`, and unused imports (`useEffect`, `MetricCard` stays for backlinks, drop `formatCompactNumber`/`formatCurrency` if unused, `SeRankingOverview`, `SeRankingResponse`). Add `SERANKING_INFO.ads satisfies PanelInfo` (Vietnamese: source is SE Ranking; estimate snapshot of one country database `us`, not full history, no run-date information; numbers and volumes intentionally not shown because TabAPI is the reference; credits note). Add `isSeRankingAdsResponse` (domain string + slice shape on `ads`), `AdsState` union and `IDLE_ADS_STATE`, and `AdsPanel({ domain })` mirroring `CompetitorsPanel` (fetch `/api/seranking/ads?domain=${encodeURIComponent(domain)}` with NGROK_HEADERS and AbortController timeout; slice error -> error phase; loading text "Đang tải mẫu quảng cáo từ SE Ranking…"; `view = state.requestedDomain === domain ? state : IDLE`). Title "Mẫu quảng cáo & trang đích (SE Ranking)", badge "Nguồn: SE Ranking · cơ sở dữ liệu us", explanatory line and button "Tải mẫu quảng cáo" (error: "Thử lại"). Ready: `AdCard` list (`ul`/`li`, max 10 via slice(0,10)) showing keyword, block label ("Trên cùng"/"Cuối trang"), "Vị trí {position}", title via `cleanAdTitle(snippet_title) ?? "—"`, display URL, description, landing page via helper `isHttpUrl` -> anchor else text; empty list -> EmptyCell Vietnamese. Render everything as React text. `SerankingPanel` becomes a stateless `<div className="space-y-6">` rendering `AdsPanel`, `CompetitorsPanel`, `BacklinksPanel` (drop aria-live wrapper only if it triggers lint; otherwise keep). Keep competitors and backlinks code untouched.
    Tests: rewrite seranking-panel.test.tsx — delete overview/mount-fetch tests and the "SeRankingResponse shape" test; add: no fetch on mount (fetch mock not called), ads idle button + explanation, ads click flow (single call, 10 cards cap, block labels, cleaned title, http link attributes, non-http plain text, no "volume"/"CPC" text), loading disabled + role status, error + Thử lại retry, slice error, domain change reset, unmount abort not required. Keep all competitors/backlinks tests (adjust only setup that relied on the mount fetch). traffic-dashboard.test.tsx: drop `serankingFixture` import/mocking of `/api/seranking`; assert that after report loads the SE Ranking panel titles/buttons render and no fetch URL starts with `/api/seranking`; keep other assertions.
  </action>
  <verify>
    <automated>npx vitest run src/components</automated>
  </verify>
  <done>Panel tests and dashboard tests green; mount makes no SE Ranking request; ads panel works on click with no volume/CPC.</done>
</task>

<task type="auto">
  <name>Task 3: Planning docs and full verification</name>
  <files>.planning/REQUIREMENTS.md, .planning/ROADMAP.md, .planning/PROJECT.md</files>
  <action>
    REQUIREMENTS.md: SERK-01 -> `[~]` struck-through with "Dropped 2026-10-23: SE Ranking overview overlaps TabAPI and the numbers disagree"; SERK-02 -> `[x]` replaced with "Researcher can load, on explicit click, SE Ranking ad copy (title/description/display URL) and landing page for paid keywords; volume/CPC intentionally not shown" (source `domain/keywords?type=adv`); SERK-05 text: "competitors, backlinks and ad copy are fetched on demand only" and drop any overview mention; traceability table SERK-01 Dropped, SERK-02 Complete; adjust coverage counts consistently (recount from the file).
    ROADMAP.md Phase 8: goal and success criteria remove the overview criterion and add ad copy as on-demand (click "Tải mẫu quảng cáo"); Requirements line -> `SERK-02, SERK-03, SERK-04, SERK-05`; plan-list line 08-02 note updated (default `/api/seranking` removed; routes ads, competitors, backlinks all on demand); coverage table row (line ~195) -> `SERK-02, SERK-03, SERK-04, SERK-05 | 8`; Phase 8 list line 21 summary updated. Do not edit historical phase 08 PLAN/SUMMARY or older quick files.
    PROJECT.md: add Key Decisions row `| Drop SE Ranking overview panel; restore ad-copy panel on demand without volume/CPC (2026-10-23) | Overview overlaps TabAPI with disagreeing numbers; ad copy/landing page has no TabAPI equivalent, numbers withheld | ✓ Decided |` after line 89.
    Then run the full verification below and fix anything failing.
  </action>
  <verify>
    <automated>npx vitest run && npx tsc --noEmit && npm run lint && test ! -e src/app/api/seranking/route.ts && ! grep -rnE "getSeRankingOverview|OverviewPanel|/domain/overview|fetchSeRankingOverview|SeRankingOverview|SeRankingResponse\b" src --include=*.ts --include=*.tsx | grep -v "\.test\." && ! grep -nE "volume|cpc" src/app/api/seranking/ads/route.ts && test "$(grep -rl 'process.env.SE_RANKING_API_KEY' src | grep -v '\.test\.' | sort | tr '\n' ' ')" = "src/app/api/seranking/ads/route.ts src/app/api/seranking/backlinks/route.ts src/app/api/seranking/competitors/route.ts "</automated>
  </verify>
  <done>All tests, typecheck and lint pass; greps confirm overview code and default route are gone, ads route has no volume/cpc, API key read only in the three routes; docs reflect SERK-01 dropped and SERK-02 re-added on demand.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser -> /api/seranking/ads | untrusted domain/source query params |
| SE Ranking -> server -> browser | third-party ad text and URLs rendered in UI |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-duc-01 | I | ads route | mitigate | key read server-side only, never in body; test asserts key absent from response |
| T-duc-02 | T | ads route params | mitigate | normalizeDomain and `/^[a-z]{2}$/` source check before any upstream call |
| T-duc-03 | T/XSS | AdCard rendering | mitigate | render snippet fields as React text only; link only when url starts with http:// or https://, with rel="noopener noreferrer" |
| T-duc-04 | D | credit usage | mitigate | on-demand click only, 24h cached store with in-flight dedup, limit 10 |
| T-duc-05 | I | volume/cpc leak | mitigate | normalizer drops them; route test asserts rows have no volume/cpc keys |
</threat_model>

<verification>
Task 3 automated command covers tests, types, lint and structural greps.
</verification>

<success_criteria>
Overview fully removed; ad copy loads only on click without numbers; competitors and backlinks unchanged; docs updated; all checks green.
</success_criteria>

<output>
Create `.planning/quick/261023-duc-se-ranking-remove-overview-panel-re-add-/261023-duc-SUMMARY.md` when done
</output>
