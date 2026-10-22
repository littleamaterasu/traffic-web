# Phase 8: SE Ranking Integration - Context

**Gathered:** 2026-10-22
**Status:** Ready for planning
**Source:** User discussion + live API probe (no discuss-phase run)

<domain>
## Phase Boundary

Add SE Ranking Data API as a **supplementary** data source. The researcher sees SE Ranking organic/paid estimates, top paid keywords with ad copy, advertiser competitors and a backlinks summary for the analyzed domain, clearly labeled as SE Ranking estimates. Existing TabAPI report, `/api/traffic` contract and credit usage are unchanged.

Out of this phase: ad longevity / creative dates (SerpAPI, Phase 6), persistence (Phase 5), replacing any TabAPI section, site audit / AI search / keyword research modules.
</domain>

<decisions>
## Implementation Decisions

### Role and scope (locked by user)
- SE Ranking **supplements** TabAPI; it never replaces or alters existing TabAPI panels.
- Four data slices: overview (organic+paid), paid keywords with ad copy, advertiser competitors, backlinks summary.
- Panels show the data source label "SE Ranking" distinctly from TabAPI; figures may legitimately differ (both are estimates).

### Architecture (locked by AGENTS.md conventions)
- New sibling route `src/app/api/seranking/route.ts` (`export const runtime = "nodejs"`, `GET(request: NextRequest)`, `Cache-Control: private, max-age=0, must-revalidate`). Do NOT modify `/api/traffic` or `TrafficResponse`.
- New lib module `src/lib/seranking.ts` owning HTTP + cache via `createCachedStore<T>()` from `src/lib/cached-store.ts`; `fetchImpl: typeof fetch = fetch` injectable; errors wrapped in a typed `SeRankingApiError` (name set); `clearSeRankingCache()` export for tests.
- Types in `src/types/seranking.ts`; Vietnamese user-facing errors; English snake_case error codes.
- `SE_RANKING_API_KEY` read server-side only (route), sent as header `Authorization: Token <key>`. Never exposed to the client. Absent key → 500-style `missing_api_key` JSON like the existing route, and the UI shows a Vietnamese notice for this section only.
- Domain input reuses `normalizeDomain` from `src/lib/domain.ts`.
- UI: new panel(s) composed from the extracted primitives in `src/components/panel.tsx` (`Panel`, `InfoButton`, `EmptyCell`, `MetricCard`); each panel gets a `PANEL_INFO` entry (Vietnamese) explaining the SE Ranking source and that figures are estimates that can differ from TabAPI. Client fetches `/api/seranking?domain=...` independently, so a failure or missing key affects only this section (loading / error / empty states, `role="status"` / `role="alert"`).
- Tests co-located (`*.test.ts(x)`), Vietnamese descriptions; fixtures typed; no real network in tests.
- `.env.example` documents `SE_RANKING_API_KEY=` as an **empty placeholder only** (real keys must not be committed — the file currently contains real values, which the user was told to rotate; do not copy any key value into code, tests, fixtures or planning docs).

### Endpoints (verified live 2026-10-22, base `https://api.seranking.com/v1`)
- `GET /domain/overview/worldwide?domain=<d>&currency=USD` → `{"organic":[{"source":"worldwide","keywords_count":534575,"traffic_sum":531195,"price_sum":274754.56}],"adv":[{"source":"worldwide","keywords_count":335,"traffic_sum":2916,"price_sum":658.06}]}`. Either array may be empty/missing for small domains — handle.
- `GET /domain/keywords?domain=<d>&source=<db e.g. us>&type=adv&limit=N` → array of `{keyword, position, volume, cpc, competition, url, block ("top"|"bottom"), block_position, snippet_title, snippet_description, snippet_display_url, traffic, price, difficulty, ...}`. Gives ad copy + landing URL. `source` is a regional database code; default `us`, configurable.
- `GET /domain/competitors?domain=<d>&source=<db>&type=adv&limit=N` → array of `{domain, common_keywords, domain_relevance, total_keywords, missing_keywords, traffic_sum, price_sum}`.
- `GET /backlinks/summary?target=<d>` → `{"summary":[{target, backlinks, refdomains, subnets, ips, nofollow_backlinks, dofollow_backlinks, edu_backlinks, gov_backlinks, inlink_rank, domain_inlink_rank, dofollow_refdomains, top_anchors_by_backlinks:[{anchor, backlinks}], top_anchors_by_refdomains:[{anchor, refdomains}], ...}]}`. Documented cost 100 credits/record — highest-cost call; fetch lazily/cache aggressively.
- `GET /account/subscription` (0 credits) → `{"subscription_info":{status, expiraton_date, units_limit, units_left}}` (note upstream typo `expiraton_date`). Optional use only; not required.
- Auth failures / quota: map unknown upstream statuses to 502 like `tabapi.ts`; pass through 401/402/429-style conditions with Vietnamese messages.

### Cache and credit discipline
- Cache key per (endpoint, normalized domain, source db, type, limit); TTL 24h, FIFO bounded by factory defaults; in-flight dedup. Four independent stores or one keyed store — planner's choice, but backlinks must not be re-fetched when only keywords are re-requested.
- **Locked by user (2026-10-22): backlinks load on demand only.** `/api/seranking` fetches overview, keywords and competitors in parallel with partial-failure tolerance; a separate `/api/seranking/backlinks` route (100 credits) is called only when the researcher clicks a "Tải backlink" button. Nothing auto-fetches backlinks.
- **Locked by user (2026-10-22): `.env.example` must have ALL key values blanked** (TABAPI_KEY, SERPAPI_KEY, WHOIS_API_KEY, SE_RANKING_API_KEY), names and comments kept. Keys must also be rotated by the user (they remain in git history).
- Trial key expires 2026-11-05 (100K credits); credit metering was not observed to change `units_left` during probing — do not build logic that depends on credit counts.

### Claude's Discretion
- Single `/api/seranking` route returning all slices vs one route per slice (prefer one route with per-slice `{data|error}` envelope).
- Exact panel layout and number of rows shown (top 10 with "xem thêm" is consistent with the app).
- Whether to place the new panels in the existing `Results` or a new client component file (prefer a new component file to avoid growing the monolith; wire into `TrafficDashboard` minimally).
- Default `source` DB selection mechanism (constant `us` now; env override optional).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project conventions
- `AGENTS.md` — stack, naming, error handling, BFF/cache patterns, Vietnamese locale rules
- `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md` (SERK-01..05), `.planning/ROADMAP.md` (Phase 8)

### Existing code to mirror
- `src/lib/tabapi.ts`, `src/lib/cached-store.ts` — client + cache factory pattern, `TrafficApiError`
- `src/app/api/traffic/route.ts`, `src/app/api/traffic/route.test.ts` — route + error-mapping + test seam
- `src/lib/ads-transparency.ts`, `src/app/api/ads/route.ts` — most recent sibling-integration example (SerpAPI)
- `src/components/panel.tsx` (+ test) — reusable panel primitives
- `src/components/traffic-dashboard.tsx` — `PANEL_INFO`, `Results`, how sections are rendered
- `src/lib/domain.ts`, `src/lib/format.ts` — validation and vi-VN formatters
- `src/types/traffic.ts` — contract style

### External
- SE Ranking Data API docs: https://seranking.com/api/data/getting-started/ (module/endpoint list), auth `Authorization: Token <key>`
</canonical_refs>

<specifics>
## Specific Ideas

- Panel titles (Vietnamese), e.g.: "SEO & quảng cáo trả phí (SE Ranking)", "Từ khóa quảng cáo & mẫu quảng cáo", "Đối thủ quảng cáo", "Backlink (SE Ranking)".
- Show traffic value (`price_sum`) as USD via existing currency formatter.
- Render ad copy as ad cards: title, display URL, description, block (top/bottom), CPC, with landing-page link (`rel="noopener noreferrer"`, `target="_blank"`).
</specifics>

<deferred>
## Deferred Ideas

- `domain/overview/history` (returned HTTP 400 on probe; parameters unknown) — trend charts from SE Ranking
- `domain/ads` (thin, empty snippets in probe), `domain/pages`, `domain/keywords/comparison`
- Keyword Research, AI Search, Website Audit modules
- Backlink history / referring-domain lists / authority endpoints
- Credit-balance display via `account/subscription`
- Creative first/last-seen dates (not provided by SE Ranking; SerpAPI Phase 6)
</deferred>

---

*Phase: 08-se-ranking-integration-supplementary-organic-paid-traffic-pa*
*Context gathered: 2026-10-22 via user discussion and live probe*
