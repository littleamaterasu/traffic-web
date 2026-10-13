# Traffic Check — Traffic Intelligence Report

## What This Is

A local Next.js dashboard where an invited marketing researcher enters any domain and receives one readable report explaining the site's estimated traffic, trend, acquisition channels, leading countries, referring sites, and related Google advertisers and creatives. Data comes from TabAPI estimates, presented in a Vietnamese-language interface.

## Core Value

An invited marketing researcher enters a domain and receives one readable report that explains its estimated traffic, trend, acquisition channels, leading countries, referring sites, and related Google advertisers and creatives.

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

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- User authentication / invite system — single-user local tool; "invited researcher" is the persona, not an auth feature
- Database or persistence layer — in-memory cache is sufficient for a local dashboard
- PDF/CSV export — not requested for this phase
- First-party analytics integration — TabAPI estimates are the sole data source
- Mobile native app — responsive web is enough

## Context

- Existing codebase: Next.js 16.4 (App Router), React 19, Tailwind v4, TypeScript strict, Vitest + Testing Library. Full map in `.planning/codebase/` (ARCHITECTURE, STACK, CONVENTIONS, TESTING, etc.).
- Architecture: single page + single `/api/traffic` route acting as a Backend-For-Frontend proxy to `https://tabapi.com/api/v1`; shared contract in `src/types/traffic.ts`; pure lib modules (`domain`, `config`, `format`); side effects isolated in `src/lib/tabapi.ts` with injectable `fetchImpl` for tests.
- New sections (referring sites, Google advertisers/creatives) depend on TabAPI capabilities — research must verify which endpoints exist, their response shapes, and credit costs before planning.
- UI is Vietnamese (`lang="vi"`, `vi-VN` formatters); new panels must follow the existing brutalist theme and add `PANEL_INFO` entries for their "i" dialogs.
- Known limitation: the dashboard is a monolithic 571-line client component; new sections should follow its internal structure or extract reusable components with co-located `.test.tsx` files.

## Constraints

- **Tech stack**: Extend the existing Next.js/TypeScript app; no new heavy dependencies unless research justifies one
- **Dependencies**: Referring-sites and advertiser/creative data must come from TabAPI (or a documented viable alternative) — blocked if no such endpoint exists
- **Budget**: TabAPI bills credits per month of history returned — reuse the existing 24h cache pattern and dedup for any new endpoint
- **Security**: `TABAPI_KEY` server-side only; no secrets in the browser bundle
- **Locale**: Vietnamese user-facing strings throughout

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Extend existing Traffic Check app rather than start a new project | Brownfield codebase map exists; BFF + shared-contract patterns are reusable | — Pending |
| Treat the phase goal as one consolidated readable report | Goal phrased as a single report for the researcher, not raw metric dumps | — Pending |
| Source referring sites + advertisers/creatives from TabAPI | Existing integration and key management already in place | — Pending (endpoint availability unverified) |

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
*Last updated: 2026-10-13 after initialization*
