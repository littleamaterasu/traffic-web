# Phase 2: Referring Sites (Backlinks Slice) - Context

**Gathered:** 2026-10-14
**Status:** Ready for planning

<domain>
## Phase Boundary

First new report section: a ranked, domain-grouped table of top referring domains for the analyzed domain, sourced from the TabAPI Backlinks API (5 credits/call), honestly labeled as link-based referring domains (panel badge + "i" explainer), with Vietnamese empty state and a per-domain 24h cache with in-flight dedup so credits are not re-billed. `/api/traffic` and `TrafficResponse` stay frozen — this phase adds a sibling route and its own contract. Researcher's existing report sections are untouched.

</domain>

<decisions>
## Implementation Decisions

Captured autonomously in `--auto` mode (recommended defaults logged for audit).

### Lookup trigger & credit discipline
- **D-01:** Backlinks data is fetched automatically as part of the main domain search — no separate user action — because the 5-credit call is bounded by the 24h per-domain cache (REFS-05). The on-demand "explicit user action" gate is reserved for the pricier page-scanning affiliate lookups (Phase 7 constraint), not this slice. — **Reversibility:** reversible — switching to on-demand later is a UI trigger change; cache and route stay.

### API contract & probe safety
- **D-02:** New sibling route `GET /api/referring-sites?domain={query}` with its own typed contract (new types file, new `src/lib/*` client module) — `/api/traffic` and `TrafficResponse` remain byte-frozen (milestone decision: new capabilities get sibling routes/contracts). — **Reversibility:** costly — the route/contract becomes the fixed seam the dashboard and tests build on; changing it later means migrating the client fetch path.
- **D-03 (probe gate):** Planning MUST include a one-call live TabAPI Backlinks probe (free-tier credit) before committing to response shapes; if the probe is impossible, design empty-first from documented shapes and keep field mapping behind a narrow adapter. Carries the standing STATE.md blocker into a hard planning requirement. — **Reversibility:** reversible — a failed probe only defers shape-locking.
- **D-04:** Referring-sites store is a per-resource `createCachedStore<BacklinksResponse>()` instance (Phase 1 factory) with a `backlinks:`-prefixed key; cache poisoning is already guarded by per-resource isolation — do NOT add the apiKey into this store's key (WR-04 is a known issue for the shared traffic store, tracked separately, not a Phase 2 blocker). — **Reversibility:** reversible.

### Dashboard presentation
- **D-05:** Panel placement: directly after the traffic-sources panel (groups acquisition-channel intelligence together; Phase 4 sets the canonical report order later). — **Reversibility:** reversible — pure render-order change.
- **D-06:** Table shows the top 10 referring domains grouped by domain, with domain rating (DR), backlink count, and anchor/link context columns for whichever of those fields the API actually provides (pending D-03 probe); rows keyed by stable domain data. — **Reversibility:** reversible — column mapping is one component.
- **D-07:** Honesty labeling is mandatory: panel badge + `PANEL_INFO` "i" entry that explains these are link-based referring domains, distinct from the aggregate referral-traffic share (REFS-03; milestone decision). — **Reversibility:** reversible.
- **D-08:** Vietnamese empty state (via `EmptyCell` + `PANEL_INFO`) when the API returns no backlink data — the rest of the report renders unaffected (REFS-04). — **Reversibility:** reversible.

### Agent's Discretion
- Exact backlinks endpoint path/params and response-shape mapping — researcher verifies via live probe (D-03) and documents in RESEARCH.md.
- Internal placement of the new client module(s) — follow Phase 1 composition (`@/components/panel` primitives, one `PANEL_INFO` entry per new table).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning
- `.planning/ROADMAP.md` §Phase 2 — goal, success criteria SC1–SC4, UI hint
- `.planning/REQUIREMENTS.md` §Referring Sites — REFS-01..REFS-05 definitions
- `.planning/PROJECT.md` — constraints (frozen route, credit discipline, Vietnamese locale, no new heavy deps)
- `.planning/STATE.md` §Blockers/Concerns — live-probe requirement this phase must satisfy (D-03)

### Framework & research
- `.planning/research/DOMAIN-CHECK-FRAMEWORK.md` — affiliate-offer vetting framework; referring-sites framing and how the section feeds the evaluator
- `.planning/phases/01-groundwork-reusable-primitives-cache-factory/01-CONTEXT.md` — locked Phase 1 foundations this phase composes

### Codebase maps
- `.planning/codebase/INTEGRATIONS.md` — TabAPI base URL, auth, billing model, BFF pattern the sibling route must mirror
- `.planning/codebase/ARCHITECTURE.md` — BFF proxy, shared-type-contract, pure-lib layers
- `.planning/codebase/CONVENTIONS.md` — naming, co-located tests, `PANEL_INFO` content-as-data pattern
- `.planning/codebase/TESTING.md` — test seams (`fetchImpl` injection, `clearTrafficCache()`)

### Source of truth
- `src/lib/cached-store.ts` — factory the backlinks store instantiates
- `src/components/panel.tsx` — primitives the new panel composes
- `src/lib/tabapi.ts` — BFF client pattern (error mapping, Vietnamese messages) to replicate for the backlinks client

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createCachedStore<T>()` (`@/lib/cached-store`) — one-line backlinks store: `const backlinksStore = createCachedStore<BacklinksResponse>()`; 24h TTL, FIFO eviction, in-flight dedup, injectable clock for tests
- `Panel`, `InfoButton`, `EmptyCell`, `MetricCard`, `PanelInfo` (`@/components/panel`) — the new referring-sites panel composes these; add one `PANEL_INFO` entry for its "i" dialog
- `normalizeDomain` (`@/lib/domain`), `format*` (`@/lib/format`) — reuse for input handling and vi-VN rendering
- `TrafficApiError` / `vietnameseError` pattern (`src/lib/tabapi.ts`) — template for the backlinks client's error mapping

### Established Patterns
- BFF proxy: key read only in route handler via `process.env.TABAPI_KEY`; browser talks only to internal routes
- Typed sibling contracts in `src/types/` consumed by both route and client
- Co-located `.test.ts`/`.test.tsx` with injected `fetchImpl`; deferred-promise + injected-clock patterns from `cached-store.test.ts`

### Integration Points
- `src/app/api/referring-sites/route.ts` (new) — mirrors `route.ts` structure: `runtime = "nodejs"`, `errorResponse()`, `Cache-Control: private, max-age=0, must-revalidate`
- `src/components/traffic-dashboard.tsx` — search flow gains a parallel fetch of the new route; panel renders under the sources panel

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches (auto mode; recommended defaults selected).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Referring Sites (Backlinks Slice)*
*Context gathered: 2026-10-14*
