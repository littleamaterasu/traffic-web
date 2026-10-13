# Project Research Summary

**Project:** Traffic Check — Traffic Intelligence Report (referring sites + Google advertisers/creatives milestone)
**Domain:** Website traffic intelligence / SEO & PPC research tooling — brownfield Next.js 16.4 BFF dashboard, Vietnamese UI, TabAPI-backed
**Researched:** 2026-10-13
**Confidence:** HIGH overall — TabAPI's full 9-endpoint catalog, credit costs, error semantics, and response shapes were verified live from the vendor's official docs (tabapi.com/docs, llms-full.txt, OpenAPI spec); competitor feature patterns were read from official vendor documentation (SimilarWeb, Semrush, Ahrefs KB); architecture is derived from the mapped, working codebase

## Executive Summary

This milestone extends an existing, working TabAPI-backed traffic dashboard (Next.js BFF, single `/api/traffic` route, 24h cache + in-flight dedup, Vietnamese brutalist UI) with three new report sections and one integration goal: referring sites, related Google advertisers, ad creatives, and a consolidated readable report. All four research streams verified the same decisive external fact independently: **TabAPI exposes exactly 9 endpoints, and none of them is a "referring sites by traffic" or "advertisers/creatives" endpoint.** The referring-sites section must therefore be built from the **Backlinks API** (5 credits) as a link-graph view ("top sites linking here"), honestly labeled and cross-displayed next to the existing aggregate `traffic_sources.referrals` share. The advertisers/creatives sections must be **synthesized** from the Google Search API's `paid_results[]` (1 credit/query) by running the domain's brand/top keywords and extracting advertisers as the domains behind the paid ads. No new data source is strictly required for v1; the only verified true ad-creative source (SerpAPI's Google Ads Transparency Center engine) is a recommended optional second vendor behind a `SERPAPI_KEY` env var, with graceful degradation when absent.

The recommended approach is a strictly additive, five-phase brownfield extension following the architecture research's dependency-driven build order: (1) a zero-behavior-change groundwork refactor that extracts shared panel primitives from the 571-line monolith and generalizes the existing cache into a `createCachedStore<T>()` factory; (2) the referring-sites slice (Backlinks, priciest endpoint, validates the cache strategy); (3) the related-advertisers slice (Google Search, query-derivation decision); (4) the ad-creatives view as pure client-side filtering of phase 3's already-fetched payload (zero new credits); (5) report consolidation — ordering, per-section takeaways, empty states, estimate labeling. The codebase constraint "no new heavy dependencies" is fully honored: the entire v1 ships with **zero new runtime dependencies**.

The dominant risks are all data-semantics traps, not engineering ones: mislabeling backlink data as referral traffic (Pitfall 1 — the vocabulary trap that produces wrong acquisition conclusions), inventing advertisers/creatives endpoints that don't exist (Pitfall 2), treating TabAPI's 200-with-nulls and 422-unprocessable sparse-data responses as errors so long-tail domains look broken (Pitfall 3), credit blow-up from uncontrolled fan-out, double-fetching, and client-driven retries (Pitfall 4), and the consolidated report degenerating into a wall of tables, null soup, and false precision (Pitfall 7). Each is prevented by a specific, cheap convention established in the first data phase: honest Vietnamese labeling pinned in `PANEL_INFO`, a four-state contract (`data | partial | no-coverage | error`), errors-never-cached plus param-scoped cache keys, per-panel partial-success rendering, and a narrative-first report with a uniform rounding policy. One gap remains across all files: endpoint facts are verified from official docs but no **live TabAPI probe** has run yet — a one-call confirmation (free tier) is required before committing to response shapes in phases 2–3.

## Key Findings

### Recommended Stack

The stack adds **nothing** to the runtime dependency tree. Every new data flow reuses platform `fetch` (Node ≥ 22), the existing `src/lib/tabapi.ts` pattern (injectable `fetchImpl` for Vitest), hand-written TS contract types, and Tailwind tables. See STACK.md for full detail.

**Core technologies:**
- **TabAPI Backlinks API** (`GET /domains/{d}/backlinks`, 5 cr) — referring-sites section: `domain_rating`, `referring_domains`, dofollow %, sample of top backlinks. Already behind the existing key/BFF. *Note: returns a sample, not a complete index.*
- **TabAPI Google Search API** (`GET /search/google`, 1 cr/query, per page) — advertiser panel v1: `paid_results[]` (position, placement, title, link, snippet) per brand/category query → advertiser = destination domain of the paid ad.
- **SerpAPI Google Ads Transparency Center API** (optional, HTTP, no SDK) — the only verified programmatic source of true ad creatives (text/image/video, advertiser legal names, first/last-shown dates). Requires `SERPAPI_KEY`; free tier (250 searches/mo) covers a single-user tool. Recommended as an optional enhancement, not a v1 blocker.
- **Platform-native `fetch` + hand-written contract types** — matches existing BFF patterns; the `serpapi` npm SDK was evaluated and rejected (thin query-string wrapper).
- **Explicitly rejected:** self-scraping adstransparency.google.com (bot protection, ToS, silent selector rot), Google Ads API (scoped to your own ad accounts only), TabAPI Reverse AdSense (publisher-side mapping — answers "where ads run", never "who buys"), SimilarWeb/Semrush APIs (enterprise-only, opaque pricing), zod/axios/chart libraries (violates the no-new-deps constraint).

### Expected Features

See FEATURES.md for the full landscape, judged against what SimilarWeb/Semrush/Ahrefs/SpyFu/Google ATC actually show and what TabAPI can actually feed.

**Must have (table stakes, P1):**
- **Referring-sites panel** — ranked, domain-grouped table from the Backlinks sample (domain, link count, DR, dofollow overview badges) + aggregate referral-share context banner above it + expandable per-domain link evidence + Vietnamese empty states. Every competitor leads with a ranked list; bare backlink dumps read as unfinished.
- **Honest labeling + `PANEL_INFO` explainers for all new panels** — including the critical nuance that referral rows are link-graph data, NOT measured traffic. This is a trust requirement, not polish.
- **Related advertisers via SERP synthesis** — top-N keywords → Google Search `paid_results` → deduped advertiser list with observed-occurrence counts, expandable evidence rows. The make-or-break feature of the advertisers section; must be credit-budget-gated.
- **Ad-creative cards (text ads)** — headline, display URL, description, placement/position, date-observed, LP links. Shares the advertisers fetch — zero additional upstream calls.
- **Section ordering + report continuity** — canonical reading order (identity → scale → trend → channels → referrers → keywords → paid lens), one-line takeaway per section, consistent top-N/expansion. This *is* the "one readable report" requirement.

**Should have (differentiators, P2):**
- LP screenshot thumbnails on demand (TabAPI Screenshot API, 1 cr/URL — never auto-run; hosted PNGs expire ~24h)
- Referrer quality-mix summary strip ("N trang · DR trung bình X · Y% dofollow") — computed from data already fetched
- Referrer heuristic categorization (news/affiliate/social/blog) — labeled as heuristic
- SerpAPI ATC integration for real creative imagery and advertiser identity (requires `SERPAPI_KEY`)

**Defer (v2+, P3 / anti-features):**
- Per-referrer traffic share / MoM change — **data-blocked** (needs per-referrer traffic history TabAPI doesn't sell; conflicts with no-persistence decision)
- Per-advertiser spend/traffic estimates — **anti-feature**: fabricating spend from assumptions is the #1 trust complaint about SpyFu; show only observed facts
- Social/Meta/TikTok ad coverage — TabAPI has zero social-ad endpoints; explicit Vietnamese scope note instead
- Multi-domain comparison, PDF/CSV export, per-panel date-range pickers — scope-explosive, contradicts single-report core value or Out of Scope per PROJECT.md

### Architecture Approach

Strictly additive brownfield extension: the core `/api/traffic` route and its `TrafficResponse` contract are **frozen**; each new upstream capability gets its own sibling BFF route (`/api/traffic/referring-sites`, `/api/traffic/advertisers`) cloned from the proven route skeleton, its own service function and cache store, and its own sibling contract type in `src/types/traffic.ts`. Grouping/ranking logic lives in pure lib modules (`referrers.ts`, `advertisers.ts`) with unit tests — routes pass upstream payloads through untouched. Each new section is one panel component with its own fetch state (`useSectionFetch`), `PANEL_INFO` entry, and loading/empty/error states; one panel's failure never blanks the report. Full detail and code examples in ARCHITECTURE.md.

**Major components:**
1. **`createCachedStore<T>()` factory in `tabapi.ts`** — generalizes the existing 24h cache + in-flight dedup + prune; one store per upstream resource with namespaced keys (`backlinks:{domain}`, `gsearch:{q}:{country}:{page}`); `getTraffic` refactored onto it with behavior-identical tests.
2. **Two new BFF routes** — byte-for-byte clones of the existing route pattern (validate → config → service → error map); new upstream error codes (503/504) mapped once in `vietnameseError()`.
3. **Extracted `panel.tsx` primitives + three new panels** — `Panel`, `InfoButton`, `EmptyCell`, `MetricCard` moved out of the 571-line monolith (the codebase map already flags it as an anti-pattern); `ReferringSitesPanel`, `AdvertisersPanel`, `CreativesPanel` with co-located `.test.tsx`.
4. **Pure shaping helpers + report insights** — `groupBacklinksByDomain()`, `groupPaidResultsByAdvertiser()`, `src/lib/insights.ts` (one-line Vietnamese takeaways) — all unit-testable without network.

### Critical Pitfalls

Top pitfalls (full list, mappings, and recovery strategies in PITFALLS.md):

1. **Backlinks ≠ referral traffic (vocabulary trap)** — TabAPI names the backlink field `referring_domains`, but link graph ≠ measured referral sessions. Never label the panel "các trang gửi traffic". Decide link-profile framing at the referring-sites phase planning gate; cross-display next to the aggregate referral share; pin distinct Vietnamese terms in `PANEL_INFO`.
2. **Inventing advertisers/creatives endpoints that don't exist** — the milestone's feature language borrows from Semrush/SpyFu; the actual catalog has 9 endpoints and none matches. Every plan must name real TabAPI paths verified against `/api/v1/openapi.json`; any design assuming image creatives or ad history is wrong by construction. V1 defines the section from what's obtainable: SERP `paid_results` synthesis.
3. **Sparse data treated as errors** — TabAPI returns 200-with-nulls/empty-arrays for no-coverage domains and 422-unprocessable when <3 months exist (i.e., exactly for new/small domains). Model four distinct states (`data | partial | no-coverage | error`); never cache the error shape but DO cache legitimate empty 200s (each small-domain backlinks view otherwise re-bills 5 credits); ship Vietnamese empty-state copy up front.
4. **Credit blow-up from fan-out × retries** — 10–22+ credits per full-report view is possible with careless composition. No client-driven retries of billable calls (a retry is metered if it succeeds); never retry 402; honor `Retry-After` on 503; cache empty 200s; keep all upstream calls behind the BFF; log per-report spend via TabAPI `request-id`s.
5. **The report becomes a wall of tables** — 13 channels + keywords + countries + referrers + advertisers with no narrative, mixed precision, and null soup destroys the "one readable report" goal. Narrative summary first (2–4 Vietnamese sentences), uniform `≈` rounding policy for all estimates, three distinct renderings for no-data/zero/error, partial-history flagging on charts, anchor nav.

## Implications for Roadmap

Based on research, suggested phase structure (5 phases; dependencies are strict — this order comes directly from ARCHITECTURE.md's build order and FEATURES.md's dependency graph):

### Phase 1: Groundwork Refactor (panel primitives + cache generalization)
**Rationale:** De-risks both extension seams (UI composition and the second/third cache instances) with zero new behavior — the cheapest possible moment to refactor, and every later phase inherits it. Copy-pasting cache/fetch code per endpoint is rated "never acceptable" by the debt analysis; this phase makes that impossible.
**Delivers:** `panel.tsx` extracted from the 571-line monolith (no behavior change); `createCachedStore<T>()` in `tabapi.ts` with `getTraffic` refactored onto it and all existing tests green; extended fixtures structure.
**Addresses:** Prerequisite for every P1 feature; no user-visible features.
**Avoids:** Pitfalls 4, 5 (cache copy-paste variants); anti-pattern 5 (monolith growth); debt patterns 1–3.
**Research flag:** Standard patterns — skip research. Pure extraction/generalization of existing working code.

### Phase 2: Referring Sites (Backlinks slice)
**Rationale:** Highest-value section and the priciest new endpoint (5 cr) — it validates the generalized cache and the four-state data contract first. Independent of phase 3.
**Delivers:** `BacklinksResponse` type → `getBacklinks` → `/api/traffic/referring-sites` route → `ReferringSitesPanel` with `groupBacklinksByDomain()`, referral-share context banner, expandable per-domain evidence, `PANEL_INFO` with the link-graph-vs-traffic honesty note, Vietnamese empty states.
**Uses:** TabAPI Backlinks API (5 cr), existing 24h cache pattern, Tailwind tables, vi-VN formatters.
**Implements:** Architecture patterns 1–4 (route clone, store factory, sibling contract, panel-as-unit).
**Avoids:** Pitfall 1 (labeling decision at planning gate), Pitfall 3 (small/empty-domain fixtures mandatory — not just `vercel.com`), Pitfall 4 (5-credit discipline).
**Research flag:** Light research needed — one live TabAPI probe of the Backlinks endpoint (docs shapes are HIGH confidence but a one-call confirmation is the definitive check); decide BFF timeout strategy for ~15s cold latency; settle empty-sample UX.

### Phase 3: Related Advertisers (Google Search SERP synthesis)
**Rationale:** The second independent vertical slice; creatives (phase 4) depend entirely on this payload. **Phase-level decisions must settle here:** query-derivation strategy (brand term vs top keywords from the Traffic response — drives both cost and sparsity), keyword budget gate (e.g., top 5 keywords), and default `SEARCH_COUNTRY` (suggest `vn`, env-configurable, per the Vietnamese researcher persona).
**Delivers:** `GoogleSearchResponse` type (defensive optionals — docs example shows fields the reference table omits) → `getGoogleSearch` with server-side brand-query derivation → `/api/traffic/advertisers` route → `AdvertisersPanel` with deduped advertiser list, observed-occurrence counts, expandable `paid_results` evidence, ATC deep-link out ("kiểm tra thêm").
**Uses:** TabAPI Google Search API (1 cr/query/page), credit budget gate, cache keyed `gsearch:{q}:{country}:{page}`.
**Implements:** Route clone + pure `groupPaidResultsByAdvertiser()`.
**Avoids:** Pitfall 2 (no invented endpoints — live probe + OpenAPI check mandatory), Pitfall 4 (per-page billing awareness), Pitfall 3 (`paid_results: []` is common — design empty-first).
**Research flag:** **Needs research** — highest-uncertainty phase. Live probe of `paid_results` sparsity for realistic queries; settle query derivation and budget; verify SERP `country`/`language` behavior; decide whether the optional SerpAPI ATC path is in scope for this milestone (see tension note below).

### Phase 4: Ad Creatives View (client-side on phase 3's payload)
**Rationale:** Creatives are the same `paid_results` payload — a second route or upstream call doubles credit spend for zero information. Pure client work, zero new credits, zero new routes.
**Delivers:** Advertiser selection state + `CreativesPanel` rendering text-ad cards (headline, display URL, description, placement/position, date-observed) with LP links; grouping helper with unit tests; `PANEL_INFO` entry explaining the SERP-snapshot method.
**Uses:** Same payload as phase 3; existing card/formatter conventions.
**Implements:** Panel-as-unit pattern; creatives = filtered client view.
**Avoids:** Anti-pattern 2 (creatives-specific BFF route); Pitfall 7 (no gallery-first design for data that's usually sparse); security note (text-only v1, no hot-linked expiring imagery).
**Research flag:** Standard patterns — skip research. Pure UI composition over data already shipped.

### Phase 5: Consolidated Readable Report
**Rationale:** The integration goal — "one coherent report" — can only be composed once all sections exist with their real shapes. This is composition/labeling work, not new data.
**Delivers:** Panel ordering into the canonical researcher flow; `src/lib/insights.ts` (pure, tested) deriving one-line Vietnamese takeaways per section; estimate/`≈` rounding policy applied everywhere; partial-history flagging; unified empty states and "Khác" folding; anchor nav / summary header.
**Uses:** All sections; existing `format` module and `PANEL_INFO` conventions.
**Implements:** Report layout + per-panel partial-success rendering finalized.
**Avoids:** Pitfall 7 (wall of tables, null soup, false precision), Pitfall 6 (aggregate error isolation).
**Research flag:** Standard patterns — skip research-phase. Design decisions are already specified in PITFALLS.md (narrative-first, rounding policy, three-state rendering).

### Phase Ordering Rationale

- **Dependencies drive the order:** groundwork (1) unblocks both data slices; phases 2 and 3 are mutually independent but each simpler than anything built on top; phase 4 is pure client work on phase 3's payload; phase 5 consumes everything and is only honest once the content exists to compose.
- **The priciest endpoint goes first among the data phases** (Backlinks, 5 cr) so the cache strategy and credit discipline are proven before more endpoints stack up.
- **Cost semantics drive grouping:** creatives share the advertisers fetch by construction — they must not become a separate route/phase with its own upstream call.
- **Each phase is a shippable vertical slice** with co-located tests, per the house convention, so partial failure mid-milestone still leaves a working dashboard.

### Cross-Research Tension to Resolve (be opinionated)

STACK.md recommends SerpAPI's Ads Transparency Center API as the path to a *true* creative view (images/video, advertiser legal names, first/last-shown dates); ARCHITECTURE.md designs TabAPI-only with creatives as a client-side view. **Resolution:** v1 ships TabAPI-only (no second vendor, no `SERPAPI_KEY` requirement) exactly as ARCHITECTURE.md's build order specifies. SerpAPI ATC is an **optional Phase 6 / v1.x enhancement** (with `SERPAPI_KEY` absent → graceful degradation is already the designed behavior). This is consistent with STACK.md's own bootstrap pattern and keeps the single-vendor simplicity PROJECT.md's decision log implies. If the researcher's validation of v1 shows text-only creatives are insufficient, the SerpAPI phase becomes a real milestone item; if not, it stays descope-able.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Related Advertisers):** highest uncertainty — SERP `paid_results` sparsity is unknown (TabAPI's own example is `[]`), query-derivation strategy drives both cost and result quality, and the optional SerpAPI ATC decision belongs here. Recommend `/gsd-plan-phase --research-phase 3` plus a live TabAPI playground probe recorded before UI build.
- **Phase 2 (Referring Sites):** light research — one live probe of the Backlinks endpoint to confirm shapes/costs, timeout strategy for ~15s cold latency, small-domain fixture plan. Full research-phase probably unnecessary; a verification step in planning suffices.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Groundwork):** extraction + generalization of existing working code; tests already define correctness.
- **Phase 4 (Ad Creatives):** client-side filtering of an already-fetched payload; established panel patterns.
- **Phase 5 (Consolidated Report):** composition/labeling with conventions fully specified in PITFALLS.md.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | TabAPI endpoint catalog, costs, error semantics verified live from official docs (fetched 2026-10-13); SerpAPI engine docs verified; npm versions verified; existing stack facts verified against `package.json` and working code |
| Features | HIGH | Competitor patterns read from official vendor KB/Academy docs in full; MEDIUM only on SpyFu UI specifics (JS-rendered site, corroborated across 3+ reviews) and Google ATC behavior (4 independent consistent guides, no single official spec page) |
| Architecture | HIGH | Patterns derived from the mapped, working codebase and cross-checked byte-for-byte against the live traffic integration; upstream endpoint facts verified against vendor docs with a live-probe caveat |
| Pitfalls | HIGH for TabAPI claims / MEDIUM for ad-platform & UX claims | All TabAPI behavior claims verified against the official full reference; ad-platform legality (ATC scraping ToS, "no official API") and report-UX practices are MEDIUM — cross-reasoned, not directly fetchable |

**Overall confidence:** HIGH for the TabAPI-only v1 path; MEDIUM for the optional SerpAPI ATC enhancement.

### Gaps to Address

- **No live TabAPI sandbox probe yet** — all endpoint shapes/costs are verified from official docs (HIGH) but not exercised. Handle: one-call live confirmation during phases 2–3 planning (free docs + 100 free credits; playground available). This also resolves PROJECT.md's "endpoint availability unverified" pending decision — flip it to verified-from-docs, pending live probe.
- **SERP `paid_results` sparsity unknown** — TabAPI's own example response is empty; the creatives gallery may be mostly empty for many domains. Handle: live probe in phase 3 planning; design empty-first; budget-gate keyword fan-out.
- **Query-derivation strategy undecided** — brand term vs top-keywords vs category query, and default `SEARCH_COUNTRY`. Handle: explicit phase-3 planning decision; make it env-configurable.
- **"No official ATC API" is a MEDIUM-confidence inference** — only matters if the SerpAPI path is pursued; SerpAPI's engine absorbs the scraping risk regardless. Handle: re-verify at phase 6/v1.x time if pursued.
- **Backlinks cold latency (~15s)** — default fetch timeouts may not suffice. Handle: timeout/streaming strategy decision at phase 2 planning; 24h cache amortizes the cost.
- **Creative first/last-seen dates** — impossible without persistence (Out of Scope). Handle: date-observed only; revisit only if the cache grows into persistence.

## Sources

### Primary (HIGH confidence)
- **TabAPI official docs** — https://tabapi.com/docs (full 9-endpoint reference, response shapes, credit costs, error codes), https://tabapi.com/llms-full.txt (full reference), https://tabapi.com/api/v1/openapi.json (OpenAPI 3.1 machine contract) — fetched live 2026-10-13
- **SerpAPI** — https://serpapi.com/google-ads-transparency-center-api (engine parameters, `ad_creatives`/`advertiser` shapes), https://serpapi.com/pricing.md — fetched live 2026-10-13
- **SimilarWeb Knowledge Center** — Referring Domains, Incoming Traffic, Using Referral Traffic, Finding Insights in 30 Minutes (report reading order) — read in full
- **Semrush KB** — Advertising Research, Competitors Report, Ads Copies, Ads History — read in full
- **Ahrefs Academy** — Referring Domains report (sort-by-traffic, expandable links, first-seen)
- **Local codebase** — `package.json`, `src/lib/tabapi.ts`, `src/types/traffic.ts`, `.planning/codebase/*` (verified working integration, cross-checked against vendor docs)
- **npm registry** (`npm view`, 2026-10-13) — openapi-typescript 7.13.0, serpapi 2.2.1, zod 4.6.7

### Secondary (MEDIUM confidence)
- SpyFu feature set (Kombat, ad-history depth, search-only scope) — JS-rendered site; corroborated across 3+ independent reviews
- Google Ads Transparency Center behavior (advertiser/domain search, filters, last-shown, no performance data) — four independent consistent guides (moda.app, admakeai.com, oppira.com, hawky.ai)
- iSpionage sunset (absorbed into TapClicks, 2025-07-09) — sunset notice on vendor site
- Google Ads API docs (scope characterization: own-accounts only, OAuth + developer token) — official, fetched

### Tertiary (LOW confidence, needs validation)
- "No official public API for Google ATC" — inferred from Google's developer-docs catalog, not a single definitive statement; re-verify if SerpAPI path is pursued
- Report-UX practices (narrative-first summaries, estimate labeling conventions) — established practice from training knowledge; not independently fetched this session

---
*Research completed: 2026-10-13*
*Ready for roadmap: yes*
