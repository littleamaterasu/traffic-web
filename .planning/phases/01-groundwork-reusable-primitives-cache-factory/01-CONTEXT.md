# Phase 1: Groundwork — Reusable Primitives & Cache Factory - Context

**Gathered:** 2026-10-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Zero-behavior-change refactor of the working dashboard: extract the shared panel primitives (`Panel`, `InfoButton`, `EmptyCell`, `MetricCard`, `PanelInfo` type) out of the monolithic client component into a reusable module, and generalize the 24h success cache into a reusable `createCachedStore<T>()` factory — so Phases 2–3 plug in new data sections without copy-paste. The researcher's report must look and behave exactly as before; the `/api/traffic` route and `TrafficResponse` contract stay frozen.

</domain>

<decisions>
## Implementation Decisions

Captured autonomously in `--auto` mode (recommended defaults logged for audit).

### Primitives extraction boundary
- **D-01:** Move `Panel`, `InfoButton`, `EmptyCell`, `MetricCard` plus the `PanelInfo` type from `src/components/traffic-dashboard.tsx` (lines 33–200) into a new shared module `src/components/panel.tsx`. `PANEL_INFO` dictionaries remain with their consumers (content-as-data lives near the panels that use it; Phase 2–4 panels add their own entries). — **Reversibility:** reversible — file moves are local and cheap to undo via git; no external contract changes.
- **D-02:** Add a new co-located test file `src/components/panel.test.tsx` covering the extracted primitives (render props, dialog aria semantics, Escape-to-close). Existing dashboard tests are not modified.

### Cache factory design
- **D-03:** Create a dedicated `src/lib/cached-store.ts` exporting `createCachedStore<T>()` with a minimal API (`get(key, fetchFn)`, `clear()`), preserving the existing guarantees: 24h TTL, bounded entries with prune/eviction (current `MAX_CACHE_ENTRIES`), in-flight request dedup, and injectable `fetchImpl`/clock seam for tests. Co-located `cached-store.test.ts`. — **Reversibility:** reversible — additive module; `getTraffic` simply delegates.
- **D-04:** `getTraffic` keeps its public signature `(domain, apiKey, months, fetchImpl)` and its `"{domain}:{months}"` cache key; it delegates internally to a module-local store instance. All existing `tabapi.test.ts` cases must pass unmodified — this proves the factory reproduces the current cache semantics. — **Reversibility:** reversible — public contract unchanged.

### Agent's Discretion
- Exact internal shape of the factory (generics, option fields like `ttlMs`/`maxEntries`) — planner/researcher may refine as long as D-03 guarantees hold.
- Whether `PANEL_INFO`-adjacent helpers (e.g., `SOURCE_LABELS`) move — they are dashboard-specific data, default is they stay.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning
- `.planning/ROADMAP.md` §Phase 1 — goal, success criteria, notes for planning
- `.planning/REQUIREMENTS.md` §Groundwork — GRND-01, GRND-02 definitions
- `.planning/PROJECT.md` — constraints (frozen route/contract, Vietnamese locale, no new heavy deps)

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md` — layer responsibilities, cache abstractions (`successCache`/`inFlightRequests`), test seams, error-handling patterns
- `.planning/codebase/CONVENTIONS.md` — naming, import organization, React conventions (kebab-case files, `satisfies`, `import type`, co-located tests, no comments)
- `.planning/codebase/TESTING.md` — test conventions and isolation patterns (`clearTrafficCache()` reset seam)

### Research
- `.planning/research/ARCHITECTURE.md` — extraction + cache-factory rationale, target integration architecture and 5-step build order this phase implements step 1 of
- `.planning/research/PITFALLS.md` — cache generalization and credit-budgeting gates (context for why the factory must preserve dedup/TTL exactly)

### Source of truth (read-only in this phase)
- `src/components/traffic-dashboard.tsx` — monolith being extracted (primitives at lines 33–200)
- `src/lib/tabapi.ts` — cache being generalized (lines 12–13, 75–113)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Panel`, `InfoButton`, `EmptyCell`, `MetricCard`, `PanelInfo` — presentational primitives currently private in `traffic-dashboard.tsx:33-200`; extraction target
- `successCache`, `inFlightRequests`, `pruneCache`, `clearTrafficCache` — `src/lib/tabapi.ts:12-13, 75-115`; the behavior contract the factory must reproduce
- Injectable `fetchImpl: typeof fetch = fetch` — established test seam to carry into the factory
- `trafficFixture` (`src/test/fixture.ts`) — typed fixture reusable for new tests

### Established Patterns
- Private function components above their consumer; named exports; content-as-data with `satisfies Record<string, PanelInfo>`
- Typed error classes + single error-conversion boundary; no logging
- Co-located `.test.ts`/`.test.tsx` with jsdom + Testing Library; `vi` globals enabled
- Pure lib modules (`config`, `domain`, `format`) vs side-effect module (`tabapi`) — the factory keeps tabapi as the only side-effectful module family

### Integration Points
- `src/components/traffic-dashboard.tsx` imports the extracted primitives (client UI unchanged visually)
- `src/lib/tabapi.ts` imports the factory; `/api/traffic` route untouched (frozen by milestone decision)

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

*Phase: 1-Groundwork — Reusable Primitives & Cache Factory*
*Context gathered: 2026-10-13*
