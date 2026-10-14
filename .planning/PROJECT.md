# Traffic Check — Traffic Intelligence Report

## What This Is

A local Next.js dashboard where a marketing researcher enters any domain and receives one readable report judging it as an affiliate offer: estimated traffic, trend, acquisition channels, leading countries, referring sites, Google advertisers and creatives (with ad longevity), affiliate terms, and unit economics. Data comes from TabAPI estimates plus SerpAPI (Google Ads Transparency) and researcher-confirmed affiliate inputs, persisted locally, presented in a Vietnamese-language interface.

## Core Value

A marketing researcher enters a domain and receives one readable report that explains its estimated traffic, channels, countries, referring sites, and Google advertisers and creatives, and helps decide whether it is a viable affiliate offer (ad longevity, affiliate terms, EPC vs CPC).

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Inferred from existing code + codebase map (.planning/codebase/). -->

- ✓ Domain lookup with normalization and validation (bare domain or full URL) — existing
- ✓ Overview metrics: monthly visits, global rank, country rank, bounce rate, pages/visit, avg time on site — existing
- ✓ Monthly visits trend with month-over-month change (3–12 months via `TRAFFIC_MONTHS`) — existing
- ✓ Traffic source mix across 13 channels (direct, search organic/paid, social organic/paid, referrals, mail, gen-AI, affiliate, other) — existing
- ✓ Leading countries with traffic share — existing
- ✓ Top keywords with search volume, CPC, estimated traffic value — existing
- ✓ AI assistant referral share trends per month — existing
- ✓ Per-panel "i" explainer dialogs and responsive Vietnamese UI — existing
- ✓ 24h in-memory success cache with in-flight dedup; `TABAPI_KEY` stays server-side (BFF proxy) — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Referring sites section — top external sites sending referral traffic to the analyzed domain
- [ ] Related Google advertisers section — advertisers associated with the domain's search results
- [ ] Ad creatives view — the creatives those advertisers run
- [ ] Consolidated readable report — the sections read as one coherent researcher report rather than scattered raw tables
- [ ] Local persistence — snapshots and researcher-entered affiliate inputs stored per domain (Phase 5)
- [ ] Domain profile and derived callouts — WHOIS age, Tier-1 geo share, brand/non-brand keywords (Phase 5)
- [ ] Google ad longevity via SerpAPI Ads Transparency — Winning Ad Ratio, ASI (Phase 6)
- [ ] Affiliate terms in three tiers (auto / suggested-with-source / manual) and unit economics: Projected EPC, Max CPC, Arbitrage Spread (Phase 7)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- User authentication / invite system — single-user local tool; "invited researcher" is the persona, not an auth feature
- Meta / TikTok ads, Trustpilot, Wayback — deferred to a later milestone (SOCL-01..03); Google only for now
- PDF/CSV export — not requested for this phase
- First-party analytics integration — TabAPI estimates are the sole data source
- Mobile native app — responsive web is enough

## Context

- Existing codebase: Next.js 16.4 (App Router), React 19, Tailwind v4, TypeScript strict, Vitest + Testing Library. Full map in `.planning/codebase/` (ARCHITECTURE, STACK, CONVENTIONS, TESTING, etc.).
- Architecture: single page + single `/api/traffic` route acting as a Backend-For-Frontend proxy to `https://tabapi.com/api/v1`; shared contract in `src/types/traffic.ts`; pure lib modules (`domain`, `config`, `format`); side effects isolated in `src/lib/tabapi.ts` with injectable `fetchImpl` for tests.
- New sections (referring sites, Google advertisers/creatives) depend on TabAPI capabilities — research must verify which endpoints exist, their response shapes, and credit costs before planning.
- UI is Vietnamese (`lang="vi"`, `vi-VN` formatters); new panels must follow the existing brutalist theme and add `PANEL_INFO` entries for their "i" dialogs.
- Domain-check checklist (`Các chỉ số và cách lấy để check domain.md`, repo root) describes an affiliate-offer vetting framework (business profile, traffic, ad intelligence, unit economics, AOS score). Coverage vs TabAPI and scope conflicts are analyzed in `.planning/research/DOMAIN-CHECK-FRAMEWORK.md`; its decisions are now reflected in Core Value, REQUIREMENTS.md (PERS/VET/ADLG/AFFL/ECON) and ROADMAP.md Phases 5–7.
- Reusable foundations (Phase 1): panel primitives (`Panel`, `InfoButton`, `EmptyCell`, `MetricCard`, type `PanelInfo`) live in `@/components/panel`; the 24h cache is a stateless `createCachedStore<T>()` factory in `@/lib/cached-store` (one store instance per upstream resource). New sections compose these instead of copying panel or cache mechanics; only content dictionaries (`PANEL_INFO`, `SOURCE_LABELS`) stay consumer-owned.

## Constraints

- **Tech stack**: Extend the existing Next.js/TypeScript app; no new heavy dependencies unless research justifies one
- **Dependencies**: Referring-sites and advertiser/creative data must come from TabAPI (or a documented viable alternative) — blocked if no such endpoint exists
- **Budget**: TabAPI bills credits per month of history returned — reuse the existing 24h cache pattern and dedup for any new endpoint
- **Security**: `TABAPI_KEY` and optional `SERPAPI_KEY` server-side only; no secrets in the browser bundle
- **Persistence**: Local database accepted from Phase 5; engine chosen at Phase 5 planning gate; Phases 1–4 stay in-memory
- **Credit discipline**: Page-scanning affiliate lookups (~2–3 credits) run only on explicit user action, never automatically
- **Locale**: Vietnamese user-facing strings throughout

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Extend existing Traffic Check app rather than start a new project | Brownfield codebase map exists; BFF + shared-contract patterns are reusable | — Pending |
| Treat the phase goal as one consolidated readable report | Goal phrased as a single report for the researcher, not raw metric dumps | — Pending |
| Source referring sites + advertisers/creatives from TabAPI | Existing integration and key management already in place | — Pending (endpoint availability unverified) |
| Change direction to affiliate-offer evaluator (2026-10-14) | Domain-check checklist extends beyond traffic into ad longevity, affiliate terms, EPC | ✓ Decided — Core Value updated; Phases 5–7 added |
| Accept local DB persistence (2026-10-14) | Needed for snapshots, saved affiliate inputs, ad longevity history | ✓ Decided — from Phase 5; engine TBD |
| Google-only second data source: SerpAPI Ads Transparency (2026-10-14) | Only path to creative first/last-shown dates; Meta/TikTok scrapers fragile | ✓ Decided — Meta/TikTok/Trustpilot deferred |
| Affiliate inputs in three tiers: auto / suggested (source snippet, confirm) / manual (2026-10-14) | Payout, cookie, policy live in each program's terms; CR and margin are researcher assumptions | ✓ Decided — scans are on-demand only |
| Cache factory: stateless `createCachedStore<T>()` with factory-default TTL/capacity; FIFO-by-insertion eviction, not LRU (Phase 1) | Zero-behavior-change phase — factory reproduces old tabapi.ts get sequence step-for-step; one home for the 24h/100-entry values | ✓ Decided — GRND-02 shipped |
| Injectable `now` clock seam in the cache factory (Phase 1) | TTL testability without fake timers | ✓ Decided — GRND-02 shipped |
| Panel primitives extracted verbatim; PANEL_INFO/SOURCE_LABELS stay consumer-owned (Phase 1) | D-01/D-02: shared artifact is the component + type; content-as-data stays with its consumer | ✓ Decided — GRND-01 shipped |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-14 after Phase 1*
