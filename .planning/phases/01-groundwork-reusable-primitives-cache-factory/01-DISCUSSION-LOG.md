# Phase 1: Groundwork — Reusable Primitives & Cache Factory - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-13
**Phase:** 1-Groundwork — Reusable Primitives & Cache Factory
**Areas discussed:** Primitives extraction boundary, Cache factory design, Behavior preservation proof
**Mode:** `--auto` (all areas auto-selected; recommended defaults chosen; no interactive prompts)

---

## Primitives extraction boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Primitives + PanelInfo type → `panel.tsx`; PANEL_INFO stays with consumers | Content-as-data near panels; shared chrome reusable by Phases 2–4 | ✓ |
| Move primitives + PANEL_INFO together | Single module, but panel-specific content drifts away from its panel | |
| Minimal: move `Panel` only | Smallest diff; leaves InfoButton/EmptyCell/MetricCard duplicated later | |

**User's choice:** (auto) Move all four primitives + `PanelInfo` type to `src/components/panel.tsx`; `PANEL_INFO` dictionaries stay with consumers (recommended default)
**Notes:** Matches research ARCHITECTURE.md recommendation and GRND-01; keeps `PANEL_INFO satisfies Record<string, PanelInfo>` pattern per-panel.

| Option | Description | Selected |
|--------|-------------|----------|
| New co-located `panel.test.tsx`; existing tests unmodified | Proves primitives work standalone; zero regression risk to dashboard tests | ✓ |
| No new tests | Faster but extraction unverified | |

**User's choice:** (auto) New co-located `src/components/panel.test.tsx` (recommended default)

---

## Cache factory design

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated `src/lib/cached-store.ts` + co-located test | Single responsibility; clean isolation; tabapi delegates | ✓ |
| Factory inside `tabapi.ts` | Fewer files but muddles the module's single responsibility | |

**User's choice:** (auto) Dedicated `src/lib/cached-store.ts` exporting `createCachedStore<T>()` with `{ get(key, fetchFn), clear() }`, 24h TTL, bounded prune, in-flight dedup, injectable seams (recommended default)
**Notes:** Guarantees must match current semantics exactly (D-03); `MAX_CACHE_ENTRIES` behavior preserved.

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve `getTraffic` signature + `"{domain}:{months}"` key; internal delegation | Contract frozen; existing `tabapi.test.ts` passes unmodified | ✓ |
| Change signature/call sites and update tests | Breaks the frozen route seam for no benefit | |

**User's choice:** (auto) Preserve public signature and cache key; internal delegation (recommended default)

---

## Behavior preservation proof

| Option | Description | Selected |
|--------|-------------|----------|
| Full existing suite passes unmodified + lint + build green; only additive new tests | Objective, automatable definition of "identical behavior" | ✓ |
| Manual visual check only | Subjective, easy to miss regressions | |

**User's choice:** (auto) Full existing test suite (route, tabapi, dashboard, domain, config, format) passes unmodified; `npm run lint` and `npm run build` green; new tests are additive only (recommended default)

---

## the agent's Discretion

- Factory internals (generic options like `ttlMs`/`maxEntries`) — planner may refine while preserving D-03 guarantees
- Whether `SOURCE_LABELS` and similar dashboard-specific data move — default: they stay

## Deferred Ideas

None — discussion stayed within phase scope.
