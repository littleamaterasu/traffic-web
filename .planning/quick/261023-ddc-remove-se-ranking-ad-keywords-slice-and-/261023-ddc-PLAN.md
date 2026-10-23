---
phase: quick-261023-ddc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/seranking.ts
  - src/lib/seranking.test.ts
  - src/types/seranking.ts
  - src/app/api/seranking/route.ts
  - src/app/api/seranking/route.test.ts
  - src/components/seranking-panel.tsx
  - src/components/seranking-panel.test.tsx
  - src/components/traffic-dashboard.test.tsx
  - src/test/seranking-fixture.ts
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/PROJECT.md
autonomous: true
requirements: [SERK-02]
must_haves:
  truths:
    - "GET /api/seranking returns {domain, source, overview, competitors} with no keywords slice"
    - "Dashboard no longer renders the panel 'Từ khóa quảng cáo & mẫu quảng cáo'; overview, competitors and on-demand backlinks still work"
    - "No SE Ranking ad-keyword code, types, fixtures or tests remain in src"
    - "Planning docs record SERK-02 as dropped with reason; v1 total is 39"
  artifacts:
    - path: "src/lib/seranking.ts"
      provides: "SE Ranking client without keywords fetch/store"
    - path: ".planning/PROJECT.md"
      provides: "Key Decisions row for dropping ad-keywords panel"
  key_links:
    - from: "src/app/api/seranking/route.ts"
      to: "src/lib/seranking.ts"
      via: "getSeRankingOverview, getSeRankingCompetitors only"
      pattern: "getSeRanking(Overview|Competitors)"
---

<objective>
Remove the SE Ranking "ad keywords" slice (SERK-02) end to end. TabAPI is the source of truth for keyword volume/CPC (user decision); SE Ranking numbers conflict with it. Keep SE Ranking overview, competitors and on-demand backlinks unchanged.

Purpose: eliminate conflicting figures and dead code.
Output: pruned lib/types/route/component/fixtures/tests, updated planning docs.
Do NOT touch: TabAPI code, /api/traffic, src/types/traffic.ts, /api/seranking/backlinks behavior, .env.example, historical phase 08 PLAN/SUMMARY files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@.planning/STATE.md
@.planning/phases/08-se-ranking-integration-supplementary-organic-paid-traffic-pa/08-CONTEXT.md
@src/lib/seranking.ts
@src/types/seranking.ts
@src/app/api/seranking/route.ts
@src/components/seranking-panel.tsx
@src/test/seranking-fixture.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove ad-keywords slice from code, fixtures and tests</name>
  <files>src/lib/seranking.ts, src/types/seranking.ts, src/app/api/seranking/route.ts, src/components/seranking-panel.tsx, src/test/seranking-fixture.ts, src/lib/seranking.test.ts, src/app/api/seranking/route.test.ts, src/components/seranking-panel.test.tsx, src/components/traffic-dashboard.test.tsx</files>
  <action>
Delete, end to end, with nothing left unused:
- src/lib/seranking.ts: `KEYWORDS_PATH`, `UpstreamKeywordRow`, `toKeyword`, `fetchSeRankingKeywords`, `keywordsStore`, `getSeRankingKeywords`, the `keywordsStore.clear()` line in `clearSeRankingCache`, and the `SeRankingAdKeyword` import. Keep `keywords_count`, `common_keywords`, `total_keywords`, `missing_keywords` (overview/competitors fields) and any shared helpers (`str`, `num`, `requestSeRanking`) still used; remove any helper that becomes unused.
- src/types/seranking.ts: `SeRankingAdKeyword`; remove `keywords` from `SeRankingResponse` so it is {domain, source, overview, competitors}.
- src/app/api/seranking/route.ts: drop `getSeRankingKeywords` import and its entry in Promise.allSettled (destructure `[overview, competitors]`), drop `keywords: toSlice(keywords)` from the response. Keep `LIST_LIMIT`, `source`, `SOURCE_PATTERN`, `DEFAULT_SOURCE` since competitors uses them.
- src/components/seranking-panel.tsx: `KeywordsPanel`, `AdCard`, the `SERANKING_INFO.keywords` entry (and its PANEL_INFO-style constants), the `SeRankingAdKeyword` import, the `isSliceShape(candidate.keywords)` check in the response type guard (~line 110), and the `<KeywordsPanel slice={view.data.keywords} />` render (~line 517). Keep `LIST_LIMIT` only if CompetitorsPanel still uses it; otherwise remove. Keep OverviewPanel, CompetitorsPanel, BacklinksPanel and the on-demand "Tải backlink" flow untouched.
- src/test/seranking-fixture.ts: keyword rows/fixture and `keywords` slice in the response fixture; remove now-unused exports/imports.
- Tests (Vietnamese descriptions, per AGENTS.md): in src/lib/seranking.test.ts delete keyword-specific tests (fetch/get/cache/dedup of keywords) and update clearSeRankingCache expectations; in src/app/api/seranking/route.test.ts delete keyword tests, update response-shape assertions to {domain, source, overview, competitors} and fetch-call counts; in src/components/seranking-panel.test.tsx delete tests for the ad-keywords panel and drop `keywords` from fixtures; in src/components/traffic-dashboard.test.tsx remove `keywords` from any mocked /api/seranking payload and any assertion on the removed panel. Do not weaken remaining assertions (only adjust for the removed slice). Leave unrelated TabAPI `top_keywords` untouched.
  </action>
  <verify>
    <automated>npx vitest run src/lib/seranking.test.ts src/app/api/seranking src/components/seranking-panel.test.tsx src/components/traffic-dashboard.test.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>Targeted tests and type-check pass; /api/seranking response has no keywords; panel "Từ khóa quảng cáo & mẫu quảng cáo" is gone; overview, competitors and backlinks tests still pass.</done>
</task>

<task type="auto">
  <name>Task 2: Update planning docs and run full verification</name>
  <files>.planning/REQUIREMENTS.md, .planning/ROADMAP.md, .planning/PROJECT.md</files>
  <action>
- .planning/REQUIREMENTS.md: in the SERK list (line ~86) change SERK-02 to a struck-through entry `- [~] ~~**SERK-02**: ...~~` annotated "Dropped 2026-10-23: SE Ranking volume/CPC conflict with TabAPI; TabAPI is the source of truth for keyword metrics". Update traceability row `| SERK-02 | Phase 8 | Complete |` to `| SERK-02 | Phase 8 | Dropped |`. Update any v1 total/coverage count from 40 to 39. Leave SERK-01/03/04/05 text unchanged (SERK-05 cache wording stays); if any of them mention keywords/ad copy, reword only that.
- .planning/ROADMAP.md: line 21 phase-list summary: remove "paid keywords with ad copy,". Phase 8 goal text mentions none; leave. Requirements line (147): remove SERK-02. Remove success criterion 2 (paid keywords with ad copy) and renumber 3-6 to 2-5. Plan 08-02 description (line 162): leave historical text as is. Coverage table row (196): `SERK-01, SERK-03, SERK-04, SERK-05 | 8`; coverage line: `39/39 v1 requirements mapped`. Do not alter the planning-gate note.
- .planning/PROJECT.md: add a Key Decisions table row: Decision "Drop SE Ranking ad-keywords panel (2026-10-23)", Rationale "volume/CPC numbers disagree with TabAPI, which matches the user's Similarweb extension; TabAPI is the source of truth for keyword metrics", Outcome "✓ Decided" (match existing column layout).
- Do not edit historical phase 08 PLAN/SUMMARY files.
Then run full verification and the leftover greps.
  </action>
  <verify>
    <automated>npx vitest run && npx tsc --noEmit && npm run lint && ! grep -rnE "Keywords|AdKeyword|KeywordRow|toKeyword|KEYWORDS_PATH|keywordsStore|snippet_" src --include=*.ts --include=*.tsx | grep -v top_keywords | grep -vE "keywords_count|common_keywords|total_keywords|missing_keywords"</automated>
  </verify>
  <done>Full suite, tsc and lint pass; grep returns nothing (only unrelated TabAPI top_keywords and SE Ranking *_keywords count fields exist); SERK-02 marked Dropped, ROADMAP criteria renumbered with 39 coverage, PROJECT.md decision row added.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client to /api/seranking | Query params domain/source (unchanged validation) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ddc-01 | I | SE_RANKING_API_KEY | mitigate | Removal only; key still read server-side in route.ts, existing no-secret-in-client tests must keep passing |
| T-ddc-02 | T | domain/source validation | accept | Unchanged code paths; existing invalid_domain/invalid_source tests retained |
</threat_model>

<verification>
`npx vitest run`, `npx tsc --noEmit`, `npm run lint` all green; leftover grep in Task 2 empty.
</verification>

<success_criteria>
SERK-02 code, types, fixtures and tests fully removed; remaining SE Ranking sections work unchanged; docs reflect the drop and 39 v1 requirements.
</success_criteria>

<output>
Create `.planning/quick/261023-ddc-remove-se-ranking-ad-keywords-slice-and-/261023-ddc-SUMMARY.md` when done
</output>
