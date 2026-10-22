# Roadmap: Traffic Check — Traffic Intelligence Report

## Overview

A brownfield extension of the working TabAPI-backed traffic dashboard. Four phases take the app from a zero-behavior-change groundwork refactor (extracted panel primitives + generalized cache factory) through two independent data slices — referring sites from the TabAPI Backlinks API, and related Google advertisers with their ad creatives synthesized from Google Search `paid_results` — to the integration goal: one consolidated, readable Vietnamese researcher report with honest labeling, uniform empty states, and per-section failure isolation. Every v1 requirement maps to exactly one phase; each phase ships a working dashboard.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Groundwork — Reusable Primitives & Cache Factory** - Zero-behavior-change refactor: extract shared panel primitives from the monolith and generalize the traffic cache so new sections plug in without copy-paste (completed 2026-10-14)
- [ ] **Phase 2: Referring Sites (Backlinks Slice)** - First new report section: top referring domains from the TabAPI Backlinks API, honestly labeled as link-based, with 24h credit-saving cache
- [ ] **Phase 3: Related Advertisers & Ad Creatives (SERP Slice)** - Advertisers synthesized from Google Search `paid_results`, plus the creatives view over the same payload (zero extra credits)
- [ ] **Phase 4: Consolidated Readable Report** - Canonical section order, short Vietnamese takeaways per section, uniform empty-state rendering, and per-section failure isolation
- [ ] **Phase 5: Persistence & Domain Profile** - Local DB for snapshots and saved inputs, business-sustainability block (WHOIS age + volatility, Trustpilot score/reviews), zero-credit derived callouts (Tier-1 share, brand/non-brand keywords)
- [ ] **Phase 6: Google Ad Longevity (SerpAPI)** - Ads Transparency creatives with first/last shown dates, Winning Ad Ratio, ASI, graceful fallback without `SERPAPI_KEY`
- [ ] **Phase 7: Affiliate Terms & Unit Economics** - Three-tier affiliate data (auto / suggested / manual) and Projected EPC, Max CPC, Arbitrage Spread
- [ ] **Phase 8: SE Ranking Integration** - Supplementary organic/paid estimates, paid keywords with ad copy, advertiser competitors and backlinks summary from SE Ranking Data API, clearly source-labeled

## Phase Details

### Phase 1: Groundwork — Reusable Primitives & Cache Factory

**Goal**: The researcher's report looks and behaves exactly as before, while the shared panel primitives and the 24h cache become reusable foundations that the new sections can build on without copy-paste.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: GRND-01, GRND-02
**Success Criteria** (what must be TRUE):

  1. Researcher sees no change anywhere in the report — every panel, metric, formatter, and Vietnamese "i" explainer renders identically to before the refactor
  2. The full existing test suite passes unmodified against the refactored code, proving behavior is preserved
  3. A developer can compose a new panel from the extracted `Panel`, `InfoButton`, `EmptyCell`, `MetricCard` primitives and the shared `PANEL_INFO` module without copying code out of the monolithic client file
   4. A store created via the generalized `createCachedStore<T>()` factory demonstrates the same guarantees as the existing traffic cache — 24h TTL, in-flight dedup, injectable `fetchImpl` — with `getTraffic` running on the factory and its tests green

**Plans**: 2/2 plans executed

Plans:

- [x] 01-01-PLAN.md — Verbatim-extract Panel/InfoButton/EmptyCell/MetricCard + PanelInfo into src/components/panel.tsx with co-located tests (D-01, D-02, GRND-01)
- [x] 01-02-PLAN.md — Generalize the 24h cache into createCachedStore<T>() in src/lib/cached-store.ts and delegate getTraffic (D-03, D-04, GRND-02)

### Phase 2: Referring Sites (Backlinks Slice)

**Goal**: The researcher sees the top external sites linking to the analyzed domain, presented as a ranked panel in the Vietnamese dashboard and honestly labeled as link-based referring domains — never as visit-weighted traffic.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: REFS-01, REFS-02, REFS-03, REFS-04, REFS-05
**Success Criteria** (what must be TRUE):

  1. Researcher enters a domain and sees a ranked, domain-grouped table of top referring domains, each with its domain rating (DR) and anchor/link context where the API provides it
  2. The section is visibly labeled (panel badge + "i" explainer) as link-based referring domains, distinct from the aggregate referral-traffic share
  3. For a domain with no backlink data, the researcher sees a Vietnamese empty state and the rest of the report keeps rendering — no failure
  4. A repeated lookup of the same domain within 24h is served from cache with in-flight dedup, so Backlink credits are not re-billed

**Plans**: TBD
**UI hint**: yes

### Phase 3: Related Advertisers & Ad Creatives (SERP Slice)

**Goal**: The researcher sees which advertisers appear around the domain's search results and the text creatives they run — one credit-gated Google Search fetch powering both views in the dashboard.
**Mode:** mvp
**Depends on**: Phase 1 (independent of Phase 2; ordered second so cache discipline is proven on the pricier endpoint first)
**Requirements**: ADVR-01, ADVR-02, ADVR-03, ADVR-04, CRTV-01, CRTV-02
**Success Criteria** (what must be TRUE):

  1. Researcher sees a deduplicated list of advertisers related to the analyzed domain, synthesized from Google Search `paid_results`
  2. Each advertiser entry shows its displayed ad text and display URL from the SERP snapshot
  3. Researcher can view creatives as cards (headline, display URL, description) filtered client-side from the advertisers payload — costing no extra credits — and can open a creative's landing page
  4. When no paid results exist for the query, the researcher sees a Vietnamese empty state and the report does not fail
  5. Advertiser queries are cached and deduplicated like other sections, so repeated lookups within 24h do not re-bill credits

**Plans**: TBD
**UI hint**: yes

### Phase 4: Consolidated Readable Report

**Goal**: The dashboard reads as one coherent researcher report — sections in a canonical order, each new section carrying a short Vietnamese takeaway, with honest empty-state rendering and failure isolation so one broken section never blocks the rest.
**Mode:** mvp
**Depends on**: Phase 2, Phase 3
**Requirements**: RPT-01, RPT-02, RPT-03, RPT-04
**Success Criteria** (what must be TRUE):

  1. Sections render in the canonical report order: traffic → trend → sources → referring sites → countries → keywords → advertisers/creatives → AI referrals
  2. Each new section carries a short Vietnamese takeaway explaining what its data means for the researcher
  3. Every nullable or absent metric renders as "—" or a Vietnamese empty state — never an error, a misleading zero, or a crash
  4. When any single section fails, it shows its own loading/error/retry state while the rest of the report renders normally

**Plans**: TBD
**UI hint**: yes

### Phase 5: Persistence & Domain Profile

**Goal**: Lookups and researcher inputs survive restarts, and the report opens with a business-sustainability block (how old and stable is the domain, what do customers say) plus derived callouts computed from data already fetched.
**Depends on**: Phase 4
**Requirements**: PERS-01, PERS-02, VET-01, VET-02, VET-06, TRST-01, TRST-02
**Success Criteria** (what must be TRUE):

  1. Researcher reopens a previously analyzed domain after a server restart and sees its saved snapshot and inputs
  2. Researcher sees domain age, registrar, expiry, last-updated, nameservers and a Vietnamese age verdict from WHOIS/RDAP, cached and deduplicated like other sections
  3. Researcher sees volatility as changes between stored snapshots, labeled with the tracking start date; a first-time lookup says no history yet instead of "stable"
  4. Researcher sees the Trustpilot score, review count and link, labeled with source and fetch date; a domain without a Trustpilot page shows a Vietnamese empty state and the report keeps rendering
  5. Researcher sees Tier-1 geo share, brand vs non-brand keyword split, and threshold badges without extra credits

**Plans**: TBD
**UI hint**: yes
**Planning gate**: (a) choose DB engine (e.g., SQLite) and migration approach; decide how it coexists with `createCachedStore`; update AGENTS.md "no database" constraints. (b) Trustpilot source: verify with one live call whether the official Business Units API (API key, find by domain) returns score + review count for arbitrary domains, versus reading the public page via TabAPI Web Reader (JSON-LD `aggregateRating`; ToS and bot-protection risk). Pick one; fail soft into TRST-02. (c) Decide whether a paid WHOIS-history provider is worth adding; default is own snapshots only (VET-06).

### Phase 6: Google Ad Longevity (SerpAPI)

**Goal**: Researcher sees how long each Google ad has been running for the domain, and which creatives are likely winners.
**Depends on**: Phase 3, Phase 5
**Requirements**: ADLG-01, ADLG-02, ADLG-03, ADLG-04
**Success Criteria** (what must be TRUE):

  1. Researcher sees Ads Transparency creatives with first/last shown dates
  2. Researcher sees active ad count, Winning Ad Ratio, unique advertisers, and ASI
  3. Without `SERPAPI_KEY` the report still renders the Phase 3 view and marks longevity unavailable; the key never reaches the browser

**Plans**: TBD
**UI hint**: yes
**Planning gate**: verify SerpAPI `google_ads_transparency_center` response shape and pricing with one live call; settle whether it replaces or complements Phase 3 SERP synthesis. Consider `--research-phase`.

### Phase 7: Affiliate Terms & Unit Economics

**Goal**: Researcher records the affiliate program's terms (partly auto-detected, partly confirmed by hand) and sees whether EPC beats keyword CPC.
**Depends on**: Phase 5 (Phase 2 for VET-03)
**Requirements**: AFFL-01, AFFL-02, AFFL-03, ECON-01, ECON-02, ECON-03, VET-03
**Success Criteria** (what must be TRUE):

  1. Researcher sees whether an affiliate program exists, its link, and the detected network
  2. On explicit action, researcher gets suggested payout/cookie/policy mentions, each with source snippet and link, and can confirm or edit them
  3. Every stored field shows its source badge (auto / suggested / manual) and survives restart
  4. Researcher sets payout/CR/margin in a collapsed panel and sees Projected EPC, Max CPC, Arbitrage Spread; unconfirmed inputs yield an "unconfirmed estimate" label
  5. The report is fully usable with the panel left untouched

**Plans**: TBD
**UI hint**: yes
**Planning gate**: validate Web Reader extraction accuracy on real program/ToS pages before committing to regex vs LLM; decide whether an LLM dependency is justified.

### Phase 8: SE Ranking Integration (Supplementary SEO / Paid Data)

**Goal**: The researcher sees SE Ranking's organic and paid search estimates for the analyzed domain alongside the TabAPI figures, clearly labeled by source, without any change to the existing report or its credit usage.
**Depends on**: Phase 1 (cached-store factory); independent of Phases 2–7
**Requirements**: SERK-01, SERK-02, SERK-03, SERK-04, SERK-05
**Success Criteria** (what must be TRUE):

  1. Researcher sees organic and paid keyword count, estimated traffic and traffic value (worldwide) from SE Ranking, labeled as SE Ranking estimates distinct from TabAPI
  2. Researcher sees top paid keywords with CPC, volume, position, ad block (top/bottom), ad title/description/display URL and landing page
  3. Researcher sees advertiser competitors (domains bidding on overlapping keywords) with common-keyword counts
  4. Researcher can click "Tải backlink" to load a backlinks summary (backlinks, referring domains, dofollow share, domain inlink rank, top anchors); it is never fetched automatically because it costs ~100 credits
  5. Without `SE_RANKING_API_KEY`, or when SE Ranking fails or has no data, the section shows a Vietnamese empty/error state and the rest of the report renders; the key never reaches the browser
  6. Repeated lookups within 24h are served from cache with in-flight dedup

**Plans**: 4/4 plans executed

Plans:

- [x] 08-01-PLAN.md — Types, SE Ranking client with four per-slice cached stores, tests (wave 1)
- [x] 08-02-PLAN.md — `GET /api/seranking` (overview/keywords/competitors) and on-demand `GET /api/seranking/backlinks` routes with tests (wave 2)
- [x] 08-03-PLAN.md — `SerankingPanel` component with "Tải backlink" on-demand button, fixtures and tests (wave 2)
- [x] 08-04-PLAN.md — Wire panel into dashboard, fix affected tests, sanitize `.env.example` (wave 3)

**UI hint**: yes
**Planning gate**: probed live on 2026-10-22 (see `.planning/research/DOMAIN-CHECK-FRAMEWORK.md` and SE Ranking probe notes): `domain/overview/worldwide`, `domain/keywords?type=adv`, `domain/competitors?type=adv`, `backlinks/summary` return data; `domain/overview/history` returned 400 (parameters unknown); `domain/ads` is thin (empty snippets). Open: credit metering (units_left did not move), rate limits, small-domain coverage, trial expires 2026-11-05. SE Ranking has no creative dates — ad longevity stays with SerpAPI (Phase 6).

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Groundwork — Reusable Primitives & Cache Factory | 2/2 | Complete    | 2026-10-14 |
| 2. Referring Sites (Backlinks Slice) | 0/TBD | Not started | - |
| 3. Related Advertisers & Ad Creatives (SERP Slice) | 0/TBD | Not started | - |
| 4. Consolidated Readable Report | 0/TBD | Not started | - |
| 5. Persistence & Domain Profile | 0/TBD | Not started | - |
| 6. Google Ad Longevity (SerpAPI) | 0/TBD | Not started | - |
| 7. Affiliate Terms & Unit Economics | 0/TBD | Not started | - |
| 8. SE Ranking Integration | 4/4 | In Progress|  |

## Coverage

| Requirement | Phase |
|-------------|-------|
| GRND-01, GRND-02 | 1 |
| REFS-01, REFS-02, REFS-03, REFS-04, REFS-05 | 2 |
| ADVR-01, ADVR-02, ADVR-03, ADVR-04, CRTV-01, CRTV-02 | 3 |
| RPT-01, RPT-02, RPT-03, RPT-04 | 4 |
| PERS-01, PERS-02, VET-01, VET-02, VET-06, TRST-01, TRST-02 | 5 |
| ADLG-01, ADLG-02, ADLG-03, ADLG-04 | 6 |
| AFFL-01, AFFL-02, AFFL-03, ECON-01, ECON-02, ECON-03, VET-03 | 7 |
| SERK-01, SERK-02, SERK-03, SERK-04, SERK-05 | 8 |

**Coverage:** 40/40 v1 requirements mapped ✓ — no orphans, no duplicates.

## Notes for Planning

- **Live TabAPI probe pending**: endpoint shapes/costs are verified from official docs (HIGH confidence) but not exercised. One-call live confirmation is required before committing to response shapes in Phase 2–3 planning (also resolves PROJECT.md's "endpoint availability unverified" pending decision).
- **Phase 3 is the highest-uncertainty phase**: SERP `paid_results` sparsity is unknown (TabAPI's own example is empty), and query-derivation strategy (brand term vs top keywords) + default `SEARCH_COUNTRY` must be settled at its planning gate. Consider `--research-phase` for it.
- **Phase 2 planning gate** must decide the link-graph-vs-traffic labeling framing, the BFF timeout strategy for ~15s cold Backlink latency, and small-domain (empty-sample) fixtures — not just `vercel.com`.
- **Domain-check checklist (2026-10-14)**: direction changed to an affiliate-offer evaluator; Phases 1–4 are unchanged and Phases 5–7 were appended. Phase 6 may supersede Phase 3's SERP-synthesis advertisers when `SERPAPI_KEY` is present — keep Phase 3 as the fallback. AGENTS.md (generated from PROJECT.md) still states "no database" and the old Core Value; regenerate at Phase 5 start. See `.planning/research/DOMAIN-CHECK-FRAMEWORK.md`.
- Phase 1 is pure extraction/generalization of existing working code — standard patterns, skip research-phase.

## Backlog

- **Social ads & reputation (SOCL-01..03, TRST-03)** — Meta, TikTok, Wayback/Scamadviser/Reddit, Trustpilot review-level analysis; deferred until Google flow ships. (Trustpilot score + count moved into Phase 5.)
- **Scoring & ranking (VET-04, VET-05, AFFL-04)** — ARS, AOS ranking of saved domains, network publisher APIs.

---
*Roadmap created: 2026-10-13 · Last updated: 2026-10-14 (domain-check checklist notes)*
