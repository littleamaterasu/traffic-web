# Roadmap: Traffic Check — Traffic Intelligence Report

## Overview

A brownfield extension of the working TabAPI-backed traffic dashboard. Four phases take the app from a zero-behavior-change groundwork refactor (extracted panel primitives + generalized cache factory) through two independent data slices — referring sites from the TabAPI Backlinks API, and related Google advertisers with their ad creatives synthesized from Google Search `paid_results` — to the integration goal: one consolidated, readable Vietnamese researcher report with honest labeling, uniform empty states, and per-section failure isolation. Every v1 requirement maps to exactly one phase; each phase ships a working dashboard.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Groundwork — Reusable Primitives & Cache Factory** - Zero-behavior-change refactor: extract shared panel primitives from the monolith and generalize the traffic cache so new sections plug in without copy-paste
- [ ] **Phase 2: Referring Sites (Backlinks Slice)** - First new report section: top referring domains from the TabAPI Backlinks API, honestly labeled as link-based, with 24h credit-saving cache
- [ ] **Phase 3: Related Advertisers & Ad Creatives (SERP Slice)** - Advertisers synthesized from Google Search `paid_results`, plus the creatives view over the same payload (zero extra credits)
- [ ] **Phase 4: Consolidated Readable Report** - Canonical section order, short Vietnamese takeaways per section, uniform empty-state rendering, and per-section failure isolation

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

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Groundwork — Reusable Primitives & Cache Factory | 2/2 | In Progress|  |
| 2. Referring Sites (Backlinks Slice) | 0/TBD | Not started | - |
| 3. Related Advertisers & Ad Creatives (SERP Slice) | 0/TBD | Not started | - |
| 4. Consolidated Readable Report | 0/TBD | Not started | - |

## Coverage

| Requirement | Phase |
|-------------|-------|
| GRND-01, GRND-02 | 1 |
| REFS-01, REFS-02, REFS-03, REFS-04, REFS-05 | 2 |
| ADVR-01, ADVR-02, ADVR-03, ADVR-04, CRTV-01, CRTV-02 | 3 |
| RPT-01, RPT-02, RPT-03, RPT-04 | 4 |

**Coverage:** 17/17 v1 requirements mapped ✓ — no orphans, no duplicates.

## Notes for Planning

- **Live TabAPI probe pending**: endpoint shapes/costs are verified from official docs (HIGH confidence) but not exercised. One-call live confirmation is required before committing to response shapes in Phase 2–3 planning (also resolves PROJECT.md's "endpoint availability unverified" pending decision).
- **Phase 3 is the highest-uncertainty phase**: SERP `paid_results` sparsity is unknown (TabAPI's own example is empty), and query-derivation strategy (brand term vs top keywords) + default `SEARCH_COUNTRY` must be settled at its planning gate. Consider `--research-phase` for it.
- **Phase 2 planning gate** must decide the link-graph-vs-traffic labeling framing, the BFF timeout strategy for ~15s cold Backlink latency, and small-domain (empty-sample) fixtures — not just `vercel.com`.
- Phase 1 is pure extraction/generalization of existing working code — standard patterns, skip research-phase.

---
*Roadmap created: 2026-10-13*
