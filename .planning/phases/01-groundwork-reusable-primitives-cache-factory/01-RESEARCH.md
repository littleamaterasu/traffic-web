# Phase 1: Groundwork — Reusable Primitives & Cache Factory - Research

**Researched:** 2026-10-13
**Domain:** In-repo refactor of a Next.js 16 / React 19 / TypeScript-strict codebase — extracting presentational React primitives and generalizing an in-memory TTL cache into a generic factory. No new dependencies, no external services, no contract changes.
**Confidence:** HIGH (every claim verified by reading the source files this session; baseline test run executed)

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Move `Panel`, `InfoButton`, `EmptyCell`, `MetricCard` plus the `PanelInfo` type from `src/components/traffic-dashboard.tsx` (lines 33–200) into a new shared module `src/components/panel.tsx`. `PANEL_INFO` dictionaries remain with their consumers (content-as-data lives near the panels that use it; Phase 2–4 panels add their own entries). — **Reversibility:** reversible — file moves are local and cheap to undo via git; no external contract changes.
- **D-02:** Add a new co-located test file `src/components/panel.test.tsx` covering the extracted primitives (render props, dialog aria semantics, Escape-to-close). Existing dashboard tests are not modified.
- **D-03:** Create a dedicated `src/lib/cached-store.ts` exporting `createCachedStore<T>()` with a minimal API (`get(key, fetchFn)`, `clear()`), preserving the existing guarantees: 24h TTL, bounded entries with prune/eviction (current `MAX_CACHE_ENTRIES`), in-flight request dedup, and injectable `fetchImpl`/clock seam for tests. Co-located `cached-store.test.ts`. — **Reversibility:** reversible — additive module; `getTraffic` simply delegates.
- **D-04:** `getTraffic` keeps its public signature `(domain, apiKey, months, fetchImpl)` and its `"{domain}:{months}"` cache key; it delegates internally to a module-local store instance. All existing `tabapi.test.ts` cases must pass unmodified — this proves the factory reproduces the current cache semantics. — **Reversibility:** reversible — public contract unchanged.

### the agent's Discretion

- Exact internal shape of the factory (generics, option fields like `ttlMs`/`maxEntries`) — planner/researcher may refine as long as D-03 guarantees hold.
- Whether `PANEL_INFO`-adjacent helpers (e.g., `SOURCE_LABELS`) move — they are dashboard-specific data, default is they stay.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

**Additional frozen surface (from milestone decision, STATE.md):** the `/api/traffic` route and `TrafficResponse` contract stay frozen — new capabilities get sibling routes/contracts in later phases. This phase must not touch `src/app/api/traffic/route.ts`, `route.test.ts`, or `src/types/traffic.ts`.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRND-01 | Researcher sees no behavior change after shared UI primitives (`Panel`, `InfoButton`, `EmptyCell`, `MetricCard`, `PANEL_INFO`) are extracted into a reusable module | Verbatim-move map of lines 33–200 (component-to-line-range table below); dashboard tests (123 lines) verified to pin every observable behavior — modal classes, aria attributes, Vietnamese labels — so unmodified-green proves parity. Note the D-01 nuance: the `PanelInfo` **type** moves; the `PANEL_INFO` **dictionaries** stay in the dashboard. |
| GRND-02 | New data sections reuse a generalized cached-store factory preserving 24h TTL, in-flight dedup, injectable `fetchImpl` | Exact semantic spec of the existing cache extracted from `src/lib/tabapi.ts:75-118` (get sequence, prune/eviction order, error non-caching, fresh-timestamp-on-store); factory skeleton + delegation plan for `getTraffic`; new `cached-store.test.ts` covers the guarantees the old suite leaves untested (TTL expiry, dedup, eviction). |

## Summary

This phase is a zero-behavior-change refactor with an unusually favorable verification setup: the existing suite (6 files, 37 tests, verified green this session in 3.99s) already pins the observable behavior of both refactor targets. The dashboard test asserts exact modal ARIA semantics, class names (`max-h-[calc(100dvh-2rem)]`), and Vietnamese strings through the `Panel`/`InfoButton` path; the tabapi tests pin the cache key scheme, per-months key separation, error non-caching, and the 4-arg public signature. If the extraction is a **verbatim move** (not a rewrite) and the factory **genericizes the existing `get` sequence step-for-step**, an unmodified green suite is a genuine no-regression proof.

Two findings matter most for planning. **First**, the refactor surface is fully contained: grep across `src/` shows `successCache`, `inFlightRequests`, `pruneCache`, `CACHE_TTL_MS`, `MAX_CACHE_ENTRIES` exist *only* inside `tabapi.ts`, and the four panel primitives plus `PanelInfo` are referenced *only* inside `traffic-dashboard.tsx` (the dashboard test reaches them only through the rendered DOM). No third file imports either surface, so the refactor cannot break an unknown consumer. **Second**, the cache has three precise semantic details the factory must reproduce byte-for-byte: eviction is FIFO-by-insertion-order (a `Map` property, not LRU — cache hits do not refresh order), the prune-then-insert sequence runs *before* insertion making effective capacity exactly `MAX_CACHE_ENTRIES` (100), and expiry uses a fresh `Date.now()` at store time with a strict `expiresAt > now` freshness check. "Improving" any of these (LRU, capacity off-by-one, reusing a stale timestamp) would be an unrequested behavior change.

The plan decomposes cleanly into two independent workstreams — panel extraction (UI) and cache factory (lib) — touching disjoint files, so they parallelize into separate plans/waves with a full-suite green gate at merge.

**Primary recommendation:** Move the five UI artifacts verbatim into `src/components/panel.tsx` (with `"use client"` and exported `PanelInfo` type), leaving `PANEL_INFO`/`SOURCE_LABELS` in the dashboard; implement `createCachedStore<T>(options)` in `src/lib/cached-store.ts` as a genericized copy of `tabapi.ts:93-112` with injectable `now` clock, then have `getTraffic`/`clearTrafficCache` delegate to one module-local store instance. Add `panel.test.tsx` and `cached-store.test.ts`; run the full unmodified suite plus `npm run lint` and `npm run build` as the phase gate.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Panel primitives (`Panel`, `InfoButton`, `EmptyCell`, `MetricCard`) | Browser / Client | — | Pure presentational React with local `useState`/`useId`; live inside the `"use client"` boundary; no data ownership |
| `PanelInfo` type contract | Client (shared type) | — | Type-only export consumed by dashboard + future panel files; follows the one-type-file-per-domain convention (component-domain type lives beside its components) |
| `PANEL_INFO` dictionaries | Client (consumer-owned) | — | D-01: content-as-data stays with its consumer panels; shared thing is the type + the `Panel info` prop |
| Cache factory `createCachedStore<T>()` | API / Backend (lib) | — | Cache is server-side state (`Map` singletons live in the Node runtime); the factory itself is stateless code — instances are created and owned in `tabapi.ts` |
| `getTraffic` / `clearTrafficCache` | API / Backend (lib) | — | Public service API unchanged; the frozen route (`route.ts:37`) is the only production caller |
| Test seams (`fetchImpl`, `now`) | Test infrastructure | — | Dependency-injection via defaulted parameters — the established house pattern (`tabapi.ts:46, 91`) |

## Standard Stack

### Core

No new dependencies — this is a hard constraint (AGENTS.md: "no new heavy dependencies unless research justifies one"; none is justified). Everything needed is already installed and verified working:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.4.0 | App Router; frozen route stays as-is `[VERIFIED: package.json:17]` | Existing app framework |
| react / react-dom | 19.3.0 | Function components + hooks for extracted primitives `[VERIFIED: package.json:18-19]` | Existing UI runtime |
| typescript | 6.0.3 | strict mode; generics for the factory `[VERIFIED: package.json:33]` | Existing compiler |
| vitest | 5.0.4 | jsdom env, `globals: true`, new co-located tests `[VERIFIED: package.json:34, vitest.config.ts:7-12]` | Existing runner — suite executed this session |
| @testing-library/react | 16.3.3 | `render`/`screen` for `panel.test.tsx` `[VERIFIED: package.json:22]` | Existing component-test library |
| @testing-library/user-event | 14.6.7 | Click/keyboard interaction (Escape-to-close test) `[VERIFIED: package.json:23]` | Existing interaction library |

**Installation:** none. `npm install` of anything new is out of scope and violates project constraints.

### Supporting

None needed. No ORM, no HTTP client library, no state manager — the factory uses only `Map`, `Promise`, and function types from the language.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Verbatim move of primitives | Rewrite components while extracting | Rewrite risks silent behavior drift (class names, aria labels, Vietnamese strings are all test-pinned); verbatim move is provably safe. **Do not rewrite.** |
| Factory options object | Positional params `createCachedStore<T>(ttlMs, maxEntries)` | Options object is self-documenting and makes the `now` clock seam addable without positional churn; discretion area per CONTEXT.md — options object recommended |
| FIFO eviction (current) | LRU (refresh order on hit) | LRU is a behavior change nobody asked for; PITFALLS.md suggests LRU but D-03 pins "current MAX_CACHE_ENTRIES" semantics and the phase is zero-behavior-change. **Preserve FIFO.** |
| `vi.useFakeTimers()` for TTL tests | Injectable `now: () => number` factory option | D-03 explicitly names an "injectable clock seam"; also works identically in jsdom and node envs without timer-side effects |

**Version verification:** all versions above were read from `package.json` this session (not training memory), and `npm test` executed successfully against them (37/37 green).

## Package Legitimacy Audit

> Not applicable — this phase installs **zero** external packages (locked decision context: "no new heavy dependencies"; both D-01 and D-03 are pure extraction/generalization). No legitimacy gate run was required; no registry lookups performed.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| *(none — no installs this phase)* | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                        PHASE 1 — TARGET STATE (zero behavior change)
═══════════════════════════════════════════════════════════════════════════════
  Browser (client)
  ┌───────────────────────────────────────────────────────────────────┐
  │  traffic-dashboard.tsx          src/components/panel.tsx (NEW)    │
  │  ┌─────────────────────────┐    ┌────────────────────────────┐    │
  │  | TrafficDashboard       │    │ "use client"               │    │
  │  | Results                 │───>│ export Panel               │    │
  │  | PANEL_INFO (STAYS HERE) │    │ export InfoButton          │    │
  │  | SOURCE_LABELS (stays)   │    │ export EmptyCell           │    │
  │  └─────────────────────────┘    │ export MetricCard          │    │
  │   imports: Panel, EmptyCell,    │ export type PanelInfo      │    │
  │   MetricCard, type PanelInfo    └────────────────────────────┘    │
  │            panel.test.tsx (NEW) — primitives covered directly     │
  └───────────────────────────────┬───────────────────────────────────┘
                                  │ GET /api/traffic?domain=  (FROZEN)
                                  ▼
  ┌───────────────────────────────────────────────────────────────────┐
  │  /api/traffic/route.ts (UNTOUCHED) — calls getTraffic(domain,     │
  │  apiKey, months) with default fetchImpl [route.ts:37]             │
  └───────────────────────────────┬───────────────────────────────────┘
                                  ▼
  ┌───────────────────────────────────────────────────────────────────┐
  │  src/lib/tabapi.ts (INTERNAL REWIRE ONLY)                         │
  │   fetchTrafficFromTabApi — unchanged raw HTTP client              │
  │   TrafficApiError — unchanged                                     │
  │   getTraffic ──────delegates──────┐                               │
  │   clearTrafficCache ─delegates────┤                               │
  └───────────────────────────────────┼───────────────────────────────┘
                                      ▼
  ┌───────────────────────────────────────────────────────────────────┐
  │  src/lib/cached-store.ts (NEW — stateless factory)                │
  │   createCachedStore<T>({ ttlMs?, maxEntries?, now? })             │
  │     → { get(key, load), clear() }                                 │
  │   One instance per upstream resource (created by consumers):      │
  │     trafficStore = createCachedStore<TrafficResponse>()  [tabapi] │
  │     (Phase 2: backlinksStore · Phase 3: searchStore)              │
  └───────────────────────────────────────────────────────────────────┘
```

Data flow for the primary use case is unchanged end-to-end: search → `/api/traffic` → `getTraffic` → store (`get` key hit / dedup / load) → `fetchTrafficFromTabApi` → TabAPI. The only change is *which module owns the cache mechanics*.

### Recommended Project Structure

```
src/
├── components/
│   ├── panel.tsx                    # NEW: "use client"; exports Panel, InfoButton, EmptyCell, MetricCard, type PanelInfo
│   ├── panel.test.tsx               # NEW: render props, dialog aria semantics, Escape-to-close
│   └── traffic-dashboard.tsx        # MODIFIED: imports primitives from @/components/panel; PANEL_INFO + SOURCE_LABELS stay
├── lib/
│   ├── cached-store.ts              # NEW: createCachedStore<T>() — stateless factory, no module-level state
│   ├── cached-store.test.ts         # NEW: TTL, dedup, eviction, clear, error non-caching
│   └── tabapi.ts                    # MODIFIED: module-local trafficStore; getTraffic/clearTrafficCache delegate; pruneCache/successCache/inFlightRequests deleted
├── app/api/traffic/
│   ├── route.ts                     # FROZEN — verified untouched surface
│   └── route.test.ts                # FROZEN — must pass unmodified
├── types/traffic.ts                 # FROZEN
└── test/fixture.ts                  # FROZEN (trafficFixture reused by panel tests if needed)
```

### Pattern 1: Verbatim-move extraction (move, don't rewrite)

**What:** cut the component bodies out of `traffic-dashboard.tsx` lines 33–200 and paste them unmodified into `panel.tsx`, changing only the export keywords and imports.
**When to use:** every extraction in this phase.
**Exact move map** `[VERIFIED: src/components/traffic-dashboard.tsx:33-200]`:

| Artifact | Current lines | Destination | Notes |
|----------|---------------|-------------|-------|
| `type PanelInfo = { summary: string; metrics: Array<{ label: string; meaning: string }>; note?: string; }` | 33–37 | `panel.tsx` (exported) | The only type that moves |
| `PANEL_INFO` dictionary | 39–89 | **stays** in `traffic-dashboard.tsx` | D-01: dictionaries remain with consumers; keeps `satisfies Record<string, PanelInfo>` via `import type { PanelInfo }` |
| `InfoButton` | 91–158 | `panel.tsx` | Uses `useState`, `useId` — imports move with it |
| `Panel` | 160–187 | `panel.tsx` | Renders `InfoButton` internally; dashboard no longer imports `InfoButton` directly |
| `EmptyCell` | 189–191 | `panel.tsx` | Default `children = "Chưa có dữ liệu"` — preserve verbatim |
| `MetricCard` | 193–200 | `panel.tsx` | `accent` is a raw className fragment (e.g. `bg-[#ffdb1f]`) |

**Example — new module skeleton:**

```tsx
// src/components/panel.tsx
"use client";

import { useId, useState } from "react";

export type PanelInfo = {
  summary: string;
  metrics: Array<{ label: string; meaning: string }>;
  note?: string;
};

export function InfoButton({ title, info }: { title: string; info: PanelInfo }) {
  /* body copied verbatim from traffic-dashboard.tsx:91-158 */
}

export function Panel({ title, badge, info, children, className = "" }: {
  title: string;
  badge?: string;
  info?: PanelInfo;
  children: React.ReactNode;
  className?: string;
}) {
  /* body copied verbatim from traffic-dashboard.tsx:160-187 */
}

export function EmptyCell({ children = "Chưa có dữ liệu" }: { children?: React.ReactNode }) {
  /* body copied verbatim from traffic-dashboard.tsx:189-191 */
}

export function MetricCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  /* body copied verbatim from traffic-dashboard.tsx:193-200 */
}
```

**Dashboard-side changes** (the only edits to the monolith):
- Delete lines 33–37 and 91–200 (keep `PANEL_INFO` at 39–89, now type-imported).
- Line 3: `import { FormEvent, useId, useState } from "react";` → `import { FormEvent, useState } from "react";` — `useId` becomes unused and must be pruned (lint gate).
- Add: `import { EmptyCell, MetricCard, Panel } from "@/components/panel";` and `import type { PanelInfo } from "@/components/panel";`
- Import style note: the dashboard and `panel.tsx` are same-folder, but house convention reserves relative `./` for same-folder *test* imports — use the `@/components/panel` alias. (Test file `panel.test.tsx` uses `./panel`, matching `tabapi.test.ts:2` and `traffic-dashboard.test.tsx:5`.)

### Pattern 2: Genericized cache factory — reproduce the sequence exactly

**What:** `createCachedStore<T>()` is the existing `getTraffic` cache logic (`tabapi.ts:93-112`) with `TrafficResponse` replaced by `T` and `Date.now` behind an injectable `now`. It must reproduce these verified semantics:

**The exact get sequence** `[VERIFIED: src/lib/tabapi.ts:93-112]`:
1. Snapshot `now`.
2. Look up the cached entry; if present and `expiresAt > now` (strict), return its data. Note: `expiresAt === now` counts as **expired**.
3. If present but expired, **delete** the stale entry *before* the dedup check.
4. Check in-flight map; if a request for the key exists, return that same promise (shared fate: concurrent callers of a failing load all reject).
5. Start the load; on success: prune expired entries, evict oldest while size ≥ max, store `{ data, expiresAt: now() + ttl }` — using **fresh** timestamps at store time (the current code calls `Date.now()` twice, at lines 105–106).
6. On completion (success *or* failure), remove the in-flight entry (`.finally`). Failures are never cached.

**Eviction semantics** `[VERIFIED: src/lib/tabapi.ts:75-85]`:

```ts
function pruneCache(now: number): void {
  for (const [key, entry] of successCache) {
    if (entry.expiresAt <= now) successCache.delete(key);
  }

  while (successCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = successCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    successCache.delete(oldestKey);
  }
}
```

- TTL sweep first (`expiresAt <= now`), then a `while` loop evicting `keys().next()` — i.e. **insertion-order FIFO**, not LRU. Cache hits do not reorder entries.
- The loop runs `size >= MAX` *before* inserting the new entry, so steady-state capacity is exactly `MAX_CACHE_ENTRIES = 100` `[VERIFIED: src/lib/tabapi.ts:5, 80]`.
- This relies on ECMAScript `Map` iteration = insertion order `[ASSUMED — stable language guarantee, not re-fetched this session]`.

**Recommended factory skeleton** (options-object shape is within the agent's discretion; guarantees are what's locked):

```ts
// src/lib/cached-store.ts
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 100;

export interface CachedStoreOptions {
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
}

export interface CachedStore<T> {
  get(key: string, load: () => Promise<T>): Promise<T>;
  clear(): void;
}

export function createCachedStore<T>(options: CachedStoreOptions = {}): CachedStore<T> {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const now = options.now ?? Date.now;

  const entries = new Map<string, { data: T; expiresAt: number }>();
  const inFlight = new Map<string, Promise<T>>();

  function prune(current: number): void {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= current) entries.delete(key);
    }
    while (entries.size >= maxEntries) {
      const oldestKey = entries.keys().next().value as string | undefined;
      if (!oldestKey) break;
      entries.delete(oldestKey);
    }
  }

  function get(key: string, load: () => Promise<T>): Promise<T> {
    const current = now();
    const cached = entries.get(key);

    if (cached && cached.expiresAt > current) return cached.data_resolved; // return cached.data
    if (cached) entries.delete(key);

    const existing = inFlight.get(key);
    if (existing) return existing;

    const request = load()
      .then((data) => {
        prune(now());
        entries.set(key, { data, expiresAt: now() + ttlMs });
        return data;
      })
      .finally(() => inFlight.delete(key));

    inFlight.set(key, request);
    return request;
  }

  function clear(): void {
    entries.clear();
    inFlight.clear();
  }

  return { get, clear };
}
```

*(The `cached.data_resolved` line above is pseudo-notation for "return `cached.data` directly" — the point is the hit path returns without touching the in-flight map.)*

Note the factory is a **stateless factory**: all mutable state lives in the closures created per call, not at module level. This preserves the house rule that side-effecting singletons are created by consumers (`tabapi.ts`), keeping `cached-store.ts` itself pure and trivially testable.

### Pattern 3: `getTraffic` delegation with a frozen public surface

**What:** replace the module-private Maps in `tabapi.ts` with one store instance; keep every export signature identical.

```ts
// src/lib/tabapi.ts — only the cache plumbing changes
const trafficStore = createCachedStore<TrafficResponse>();

export async function getTraffic(
  domain: string,
  apiKey: string,
  months: number,
  fetchImpl: typeof fetch = fetch,
): Promise<TrafficResponse> {
  return trafficStore.get(`${domain}:${months}`, () =>
    fetchTrafficFromTabApi(domain, apiKey, months, fetchImpl),
  );
}

export function clearTrafficCache(): void {
  trafficStore.clear();
}
```

Verified constraints this satisfies `[VERIFIED: src/lib/tabapi.test.ts:2, 32; src/app/api/traffic/route.ts:4, 37; src/app/api/traffic/route.test.ts:3, 8]`:
- `tabapi.test.ts` imports exactly `{ clearTrafficCache, fetchTrafficFromTabApi, getTraffic, TrafficApiError }` and calls `getTraffic("vercel.com", "sk_test", 3, fetchMock)` — 4-arg form with injected fetch.
- The route calls `getTraffic(domain, apiKey, months)` — 3-arg form, so the `fetchImpl` **default parameter must stay**.
- `route.test.ts` imports `clearTrafficCache` from `@/lib/tabapi` — the re-export point must not move.
- Cache key stays `` `${domain}:${months}` `` (`[VERIFIED: src/lib/tabapi.ts:94]`: `` const cacheKey = `${domain}:${months}`; ``) — the "tách cache theo số tháng" test depends on it.

Constants decision: `CACHE_TTL_MS` / `MAX_CACHE_ENTRIES` are private to `tabapi.ts` today (`[VERIFIED: src/lib/tabapi.ts:4-5]`; grep shows no other reference). Recommended: delete them from `tabapi.ts` and rely on the factory defaults (`DEFAULT_TTL_MS`/`DEFAULT_MAX_ENTRIES`), so the values have one home. Alternative (also fine): keep them in `tabapi.ts` and pass `{ ttlMs: CACHE_TTL_MS, maxEntries: MAX_CACHE_ENTRIES }` explicitly. Either passes all tests.

### Anti-Patterns to Avoid

- **"Improving" the get sequence while genericizing** (e.g., checking dedup before expiry, or reusing the read-time timestamp when storing): each step order is observable through existing and future tests. Genericize, don't optimize.
- **Rewriting components during the move**: the dashboard test asserts exact class strings (`max-h-[calc(100dvh-2rem)]`, `overflow-y-auto`) and exact Vietnamese aria labels; any "cleanup" invites drift. Verbatim move only.
- **Moving `PANEL_INFO` or `SOURCE_LABELS`**: D-01 keeps dictionaries with consumers; the discretion default keeps `SOURCE_LABELS` put. Success criterion 3's phrase "shared `PANEL_INFO` module" is satisfied by the shared `PanelInfo` type + `Panel info` prop, not by relocating the dictionaries — D-01 is the more specific, governing decision.
- **Adding a document-level Escape listener "while we're here"**: the current Escape handling is `onKeyDown` on the trigger button (`traffic-dashboard.tsx:104-106`). Changing scope changes behavior and breaks the D-02 test plan.
- **Touching the frozen surface**: `route.ts`, `route.test.ts`, `types/traffic.ts`, `test/fixture.ts` — no edits, not even cosmetic.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TTL/expiry bookkeeping | Ad-hoc timestamp math per store | The factory's single `expiresAt` field + prune sweep | One implementation of the semantics; per-resource stores inherit it |
| Concurrent-request dedup | Per-caller promise bookkeeping or counters | In-flight `Map<string, Promise<T>>` returning the shared promise | The shared-promise model is the existing, test-proven behavior; per-caller wrapping changes failure semantics |
| Eviction policy | A custom LRU class | `Map` insertion-order FIFO (current behavior) | Zero-behavior-change phase; Map ordering is a language guarantee; LRU is an unrequested change |
| Test clock control | `vi.useFakeTimers()` scaffolding | Injectable `now: () => number` option | D-03 names the clock seam; no timer side effects; works the same in jsdom/node |
| Fetch mocking | A mock HTTP layer (MSW/nock) | Existing pattern: injected `fetchImpl` in lib, `vi.stubGlobal("fetch", …)` in components/routes | House style `[VERIFIED: src/lib/tabapi.test.ts:16, 32; src/components/traffic-dashboard.test.tsx:17-20]`; adds zero deps |

**Key insight:** the entire value of this phase is *sameness*. Every place research recommends "use the existing pattern" is a place where substituting a cleverer mechanism would invalidate the unmodified-green-suite proof.

## Runtime State Inventory

> Completed — this is a refactor phase. The canonical question: after every file is updated, what runtime systems still have old state cached/stored/registered?

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — the app has no database or persistence layer; the only "stored" state is the in-process `Map` cache, which is recreated fresh on module load `[VERIFIED: src/lib/tabapi.ts:12-13; .planning/codebase/ARCHITECTURE.md "No persistence layer"]` | None |
| Live service config | None — no external service holds phase-relevant config; TabAPI is stateless HTTP and is not called by this phase (route frozen, no new endpoints) | None |
| OS-registered state | None — no pm2/Task Scheduler/launchd/systemd registrations in this project; local `npm run dev`/`npm start` only | None |
| Secrets/env vars | `TABAPI_KEY`, `TRAFFIC_MONTHS` — names unchanged by this phase; no new env reads introduced. Verified all cache/plumbing references live in `tabapi.ts` only (grep sweep, 24 matches, all in tabapi.ts + its two test files) | None |
| Build artifacts | None — no compiled/installed artifacts carry refactorable state; `.next/**` is regenerated by `npm run build` and gitignored | None — but note: Next dev hot reload re-instantiates module-level caches (pre-existing behavior, unchanged) |

**Verification method:** exhaustive grep of `src/` for `successCache|inFlightRequests|pruneCache|CACHE_TTL_MS|MAX_CACHE_ENTRIES|clearTrafficCache` (24 matches, all in `tabapi.ts` + the two test files that import its public exports) and for the primitive names in `*.tsx` (all matches in `traffic-dashboard.tsx` + its test). No third file touches either surface.

## Common Pitfalls

### Pitfall 1: Semantic drift inside the factory "rewrite"
**What goes wrong:** the genericized `get` reorders steps (dedup before expiry, prune after insert, cached timestamps reused), producing subtly different observable behavior that the *current* tests may not catch but future phases inherit.
**Why it happens:** refactoring invites cleanup; the original code looks "inefficient" (two `Date.now()` calls, delete-then-check ordering).
**How to avoid:** treat `tabapi.ts:93-112` as a spec — genericize line-by-line; write the new `cached-store.test.ts` cases to pin each step (fresh hit, expired miss, dedup, eviction cap, error non-caching, clear).
**Warning signs:** diff of the factory `get` vs the original `getTraffic` body shows reordered statements.

### Pitfall 2: Eviction-cap off-by-one
**What goes wrong:** factory evicts *after* insert (`size > max`) → capacity 101, or evicts *after* TTL sweep incorrectly → oldest live entry evicted too early.
**Why it happens:** the current code's `while (size >= max)` runs *pre-insert*, which reads oddly and tempts "fixing".
**How to avoid:** copy the `prune` function verbatim; test the cap by inserting exactly `maxEntries` then one more and asserting the *oldest* key re-fetches while the newest survives.
**Warning signs:** cache-size assertion in a new test fails by 1.

### Pitfall 3: Silent import lint/typecheck failures after extraction
**What goes wrong:** `useId` remains imported in `traffic-dashboard.tsx` (now unused) — `eslint-config-next/typescript` flags it and `next build` fails; or `PanelInfo` is imported as a value instead of `import type`, violating house convention.
**Why it happens:** extraction moves code out but not imports.
**How to avoid:** after the move, prune line 3 to `{ FormEvent, useState }`; add `import type { PanelInfo }` and a value import for the three primitives used (`Panel`, `EmptyCell`, `MetricCard` — the dashboard never references `InfoButton` directly, it renders via `Panel`) `[VERIFIED: src/components/traffic-dashboard.tsx:181, 265-413]`.
**Warning signs:** `npm run lint` or `npm run build` failure immediately after the move.

### Pitfall 4: `React.ReactNode` namespace in the new file
**What goes wrong:** uncertainty about whether `React.ReactNode` resolves without `import React` in `panel.tsx`.
**Why it happens:** the current file uses `React.ReactNode` at lines 170/189 without importing React (UMD-global type resolution from `@types/react`), which looks like a mistake but compiles `[VERIFIED: src/components/traffic-dashboard.tsx:170, 189 + green suite]`.
**How to avoid:** copy the annotations verbatim. If TS ever complains in the new file, the sanctioned fallback is `import type { ReactNode } from "react"` and renaming the annotations — cosmetic, zero behavior change.
**Warning signs:** TS2304/TS2686 on `panel.tsx`.

### Pitfall 5: Escape-to-close test fights focus
**What goes wrong:** the new `panel.test.tsx` tries `user.keyboard("{Escape}")` against `document` and nothing closes, because the `onKeyDown` handler lives on the **trigger button**.
**Why it happens:** tester assumes dialog-level keyboard handling that doesn't exist.
**How to avoid:** click the trigger first (focus stays on it), then `await user.keyboard("{Escape}")`; assert `aria-expanded` returns to `"false"` and `queryByRole("dialog")` is null.
**Warning signs:** flaky/failing Escape test with everything else passing.

### Pitfall 6: Dedup test racy by construction
**What goes wrong:** the in-flight dedup test starts two `get`s but the first load resolves synchronously before the second call, so dedup never engages and the test lies.
**Why it happens:** mock loaders that resolve immediately.
**How to avoid:** use a deferred promise (`let resolve!; const load = vi.fn(() => new Promise<T>((r) => { resolve = r; }));`) — fire `get` twice, assert `load` called once, then resolve and assert both callers receive the value.
**Warning signs:** dedup test passes even after breaking the in-flight map.

## Code Examples

### Existing tabapi tests that must pass unmodified (the proof of GRND-02)

The full behavioral contract pinned by `src/lib/tabapi.test.ts` `[VERIFIED: src/lib/tabapi.test.ts:12-80]`:
- Same domain+months twice → **1** upstream fetch (cache hit).
- Same domain, months 3 then 6 → **2** fetches with `months=3` / `months=6` in URLs (key separation).
- 402 upstream error twice → **2** fetches, both rejecting with `TrafficApiError` (errors never cached).
- Status/code/message mapping via `it.each`: `[400, "invalid_domain", "Tên miền không hợp lệ."]`, `[402, "insufficient_credits", "Tài khoản TabAPI không đủ credits."]`, `[422, "unprocessable", "Tên miền chưa có đủ 3 tháng dữ liệu."]`, `[502, "upstream_error", "TabAPI đang gặp sự cố. Vui lòng thử lại sau."]`.
- `beforeEach(() => clearTrafficCache())` — reset via the exported function (which delegates to `store.clear()` after refactor).

### New `cached-store.test.ts` coverage (fills the gaps TESTING.md documents as untested)

```ts
// Sketch — names/structure per house style: one describe per unit, Vietnamese test names,
// deferred promises for dedup, injected clock for TTL. No new deps.
describe("createCachedStore", () => {
  it("trả về dữ liệu đã cache cho cùng key mà không gọi lại loader", ...);        // hit
  it("gọi lại loader khi key khác nhau", ...);                                     // key separation
  it("không cache lỗi — loader gọi lại sau khi thất bại", ...);                    // error non-caching
  it("gộp các lời gọi đồng thời cùng key thành một loader", ...);                  // dedup (deferred promise)
  it("hết hạn sau ttlMs và gọi lại loader", ...);                                  // TTL via injected now
  it("đuổi entry cũ nhất khi vượt maxEntries", ...);                               // FIFO cap
  it("clear() xóa cache và các request đang chạy", ...);                           // reset seam
});
```

### New `panel.test.tsx` coverage (D-02)

```tsx
// House style: render + screen + userEvent; assert concrete values, no snapshots.
describe("Panel", () => {
  it("hiển thị tiêu đề, badge và children", ...);            // h2 title, badge span only when given
  it("ẩn badge và nút giải thích khi không truyền", ...);    // conditional rendering
  it("áp dụng className bổ sung", ...);
});

describe("InfoButton", () => {
  it("mở và đóng dialog với aria đầy đủ", ...);
  // aria-label "Giải thích bảng {title}", aria-expanded false→true,
  // dialog role="dialog" + aria-modal="true" + aria-labelledby → h3 id
  it("đóng khi nhấn Escape khi nút đang giữ focus", ...);     // click trigger → keyboard "{Escape}"
  it("đóng qua nút × và qua nền mờ", ...);                    // "Đóng giải thích bảng {title}" / backdrop
});

describe("EmptyCell", () => {
  it("mặc định 'Chưa có dữ liệu' và nhận children thay thế", ...);
});

describe("MetricCard", () => {
  it("hiển thị label, value và accent class", ...);
});
```

Verified aria/label facts these tests assert against `[VERIFIED: src/components/traffic-dashboard.tsx:91-158]`: trigger `aria-label` = `` `Giải thích bảng ${title}` `` (line 100); dialog `id={id}`, `role="dialog"`, `aria-modal="true"`, `aria-labelledby={titleId}` with `titleId = `${id}-title`` (lines 93–94, 120–123); both close buttons' `aria-label` = `` `Đóng giải thích bảng ${title}` `` (lines 115, 132); `EmptyCell` default `"Chưa có dữ liệu"` (line 189). The existing dashboard test independently confirms the dialog class contract: `toHaveClass("max-h-[calc(100dvh-2rem)]", "overflow-y-auto")` `[VERIFIED: src/components/traffic-dashboard.test.tsx:65]`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Duplicating cache logic per endpoint | Generic `createCachedStore<T>()` with per-resource instances | This phase (per `.planning/research/ARCHITECTURE.md` Pattern 2) | Phases 2–3 add one store line each; TTL/dedup/eviction tested once |
| Panel primitives locked inside a 571-line monolith | Shared `panel.tsx` module, consumer-owned `PANEL_INFO` dictionaries | This phase (D-01) | New panels become separate files with co-located tests; monolith stops growing |
| Direct `Date.now()` baked into cache logic | Injectable `now` clock option (defaulting to `Date.now`) | This phase (D-03) | TTL becomes testable without fake timers |

**Deprecated/outdated:** nothing in-repo is deprecated by this phase; the only "old" patterns above are the ones being deliberately generalized. No library APIs used are deprecated (React 19 function components, Vitest 5, Next 16 — all current per `package.json` read this session).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | JS `Map` iteration order = insertion order, so eviction via `keys().next()` is FIFO-by-insertion | Pattern 2 | If wrong (it isn't — stable ECMAScript guarantee), eviction-order test expectations change; low impact, would surface immediately in tests |
| A2 | `React.ReactNode` resolves as a UMD-global type in a new `panel.tsx` exactly as it does today in `traffic-dashboard.tsx` | Pitfall 4 | Compile error in new file → trivial fix (`import type { ReactNode }`); no behavior risk |
| A3 | `eslint-config-next/typescript` flags unused imports (drives the `useId` pruning) | Pitfall 3 | If not flagged, an unused import lingers — cosmetic only; typecheck/build unaffected |
| A4 | Import style for the same-folder non-test import (`@/components/panel` over `./panel`) | Pattern 1 | Pure convention choice; planner pins one; zero functional impact |

## Open Questions

1. **Constants home: factory defaults vs. explicit pass-through in `tabapi.ts`**
   - What we know: `CACHE_TTL_MS`/`MAX_CACHE_ENTRIES` are private to `tabapi.ts`; D-03 pins the *values* (24h TTL, 100 entries), not their location.
   - What's unclear: only style — both variants pass all tests.
   - Recommendation: define `DEFAULT_TTL_MS`/`DEFAULT_MAX_ENTRIES` in `cached-store.ts`; `tabapi.ts` calls `createCachedStore<TrafficResponse>()` bare. Planner pins one.
2. **Exact option/param names for the factory**
   - What we know: D-03 fixes the API shape as minimal `get(key, fetchFn)` / `clear()`; internal naming is explicitly discretionary.
   - Recommendation: `createCachedStore<T>(options?: { ttlMs?, maxEntries?, now? })` returning `{ get(key, load), clear() }` — the loader-closure form keeps `fetchImpl` injection at the `getTraffic` layer where it already lives.
   - Recommendation: adopt this; no user confirmation needed (inside stated discretion).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | running vitest/build | ✓ | v25.9.0 (≥ 22.13 required per README) | — |
| npm | scripts | ✓ | 11.12.1 | — |
| vitest | new tests + regression gate | ✓ (ran this session) | 5.0.4 | — |
| jsdom + Testing Library | `panel.test.tsx` | ✓ (existing config) | 27.4.0 / 16.3.3 / 14.6.7 | — |
| TabAPI access | **not required** — no upstream calls in this phase (route frozen; no new endpoints) | n/a | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Security Domain

### Applicable ASVS Categories (ASVS Level 1, `security_enforcement: true`)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surfaces touched; TabAPI key usage code untouched |
| V3 Session Management | no | No sessions in this app |
| V4 Access Control | no | Single-user local tool; no new routes/entrpoints |
| V5 Input Validation | yes (unchanged) | `normalizeDomain` (`src/lib/domain.ts`) remains the sole input boundary; this phase adds no new inputs — the factory's cache keys are built server-side from already-normalized values (`${domain}:${months}`) |
| V6 Cryptography | no | Nothing crypto-adjacent touched |
| V14 Config (secrets) | yes (unchanged) | `TABAPI_KEY` remains server-only; refactor adds no new env reads; regression enforced by existing test `expect(body).not.toContain(secret)` `[VERIFIED: src/app/api/traffic/route.test.ts:58]` |

### Known Threat Patterns for This Stack (refactor-specific)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret leaking into client bundle via moved components | Information Disclosure | Panel primitives are presentational only — they receive strings via props; no env access. Verification: `npm run build` + existing route tests; no `NEXT_PUBLIC_*` introduced |
| XSS via extracted components | Tampering | React default escaping; **no `dangerouslySetInnerHTML` anywhere in `src/`** (grep-verified this session); extraction must not introduce any |
| Cache poisoning across resources after generalization | Tampering | Per-resource store instances (one `createCachedStore` call per upstream resource) — keys never collide across resources even before namespacing; Phase 2+ adds prefixed keys (`backlinks:{domain}`) per the milestone architecture |

**Security invariant for the verifier:** the refactor must not change what crosses the client/server boundary — no new client-visible payload fields, no new fetches outside the BFF, no new `process.env` reads outside server modules.

## Sources

### Primary (HIGH confidence)

- `src/lib/tabapi.ts:1-118` — full read this session: cache constants, entry shape, prune/eviction, get sequence, public signatures, error mapping
- `src/lib/tabapi.test.ts:1-81` — full read: the exact unmodified test contract (imports, key separation, error non-caching, it.each mapping)
- `src/components/traffic-dashboard.tsx:1-571` — full read: extraction map (lines 33–200), `PANEL_INFO` placement, aria/label contract, `React.ReactNode` usage, import list
- `src/components/traffic-dashboard.test.tsx:1-123` — full read: modal class/aria assertions the extraction must preserve
- `src/app/api/traffic/route.ts:1-49` and `route.test.ts:1-61` — frozen-surface confirmation (3-arg `getTraffic` call at route.ts:37; `clearTrafficCache` import at route.test.ts:3)
- `src/types/traffic.ts:1-83` — frozen contract verified
- `package.json`, `vitest.config.ts`, `eslint.config.mjs` — stack versions and lint setup, read this session
- **Baseline run:** `npm test` executed this session — 6 files / 37 tests passed (3.99s), Node v25.9.0

### Secondary (MEDIUM confidence)

- `.planning/research/ARCHITECTURE.md` (2026-10-13) — factory rationale and 5-step build order (step 1 = this phase); its "factory inside tabapi.ts" placement is superseded by the later, more specific D-03 (`src/lib/cached-store.ts`)
- `.planning/research/PITFALLS.md` (2026-10-13) — cache generalization context (Pitfalls 4–5); its LRU suggestion is consciously **not** adopted (zero-behavior-change phase)
- `.planning/codebase/TESTING.md` (2026-10-13) — house test patterns, isolation seams, documented gaps (dedup/eviction untested — now addressed by `cached-store.test.ts`)

### Tertiary (LOW confidence)

- None — no external web sources were consulted; every claim is grounded in files read this session or tagged `[ASSUMED]` above. (All search providers are disabled in `.planning/config.json`; none were needed.)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all versions read from `package.json` and exercised by a green baseline run
- Architecture: HIGH — both refactor targets fully read; extraction surface proven contained by exhaustive grep; locked decisions D-01–D-04 map 1:1 onto verified code locations
- Pitfalls: HIGH — derived from line-level reading of the exact code being changed plus the test files that pin its behavior

**Research date:** 2026-10-13
**Valid until:** 2026-11-12 (30 days — stable, self-contained refactor; no external dependencies to drift)
