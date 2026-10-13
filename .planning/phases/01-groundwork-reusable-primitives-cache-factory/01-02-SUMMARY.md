---
phase: 01-groundwork-reusable-primitives-cache-factory
plan: 02
subsystem: api
tags: [cache, ttl, dedup, factory, vitest, typescript, refactor]

# Dependency graph
requires:
  - phase: milestone-init
    provides: working TabAPI client (src/lib/tabapi.ts) with 24h success cache whose semantics are the extraction spec
provides:
  - "Stateless generic cache factory src/lib/cached-store.ts — createCachedStore<T>() with get(key, load)/clear(), 24h TTL, bounded FIFO eviction, in-flight dedup, injectable now clock"
  - "getTraffic/clearTrafficCache delegating to one module-local store instance; public signature and {domain}:{months} key unchanged (D-04)"
  - "Factory guarantee test suite (src/lib/cached-store.test.ts) covering TTL expiry, strict freshness boundary, dedup shared fate, FIFO cap, clear reset, error non-caching, fresh store-time clock, per-resource isolation"
affects: [phase-2 referring-sites backlinks store, phase-3 search/advertisers store, any future cached upstream resource]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 2553        # chars/4 over src/lib/cached-store.ts + cached-store.test.ts + tabapi.ts (10,211 chars)
  tasks: 3
  commits: 4          # MEASURED: git rev-list --count 22ed104..HEAD — 2 belong to this plan (ed1ef7c, 9bd22b0); 2 are sibling plan 01-01 interleaved on the shared main tree
  plan_commits: 2     # this plan's own commits (filtered by this plan's files)
plan_head_before: 22ed10476aa97435ecc6da78dc570360a0a960e3

# Tech tracking
tech-stack:
  added: []           # zero new dependencies (hard project constraint)
  patterns:
    - "Per-resource store instances: consumers create their own createCachedStore<T>() instance; the factory itself stays stateless (no module-level mutable Maps)"
    - "Injectable clock seam (now?: () => number) replacing Date.now() for TTL testability without fake timers"
    - "Genericize-don't-optimize: factory reproduces tabapi.ts:75-118 step-for-step (prune-before-insert, strict expiresAt > now, fresh Date.now() x2 at store time, delete-before-dedup-check)"

key-files:
  created:
    - src/lib/cached-store.ts
    - src/lib/cached-store.test.ts
  modified:
    - src/lib/tabapi.ts

key-decisions:
  - "Constants home: factory defaults (DEFAULT_TTL_MS / DEFAULT_MAX_ENTRIES in cached-store.ts); tabapi.ts calls createCachedStore<TrafficResponse>() bare (research open question 1, planner-pinned)"
  - "get is an async function mirroring the original getTraffic body verbatim — cached-hit returns without touching the in-flight map; dedup returns the shared in-flight promise"
  - "FIFO-by-insertion eviction preserved (Map insertion order), consciously NOT LRU (zero-behavior-change phase)"

patterns-established:
  - "createCachedStore<T>({ ttlMs?, maxEntries?, now? }) — one store per upstream resource; Phase 2-3 add one line each instead of copying cache mechanics"
  - "Deferred-promise dedup tests + injected-clock TTL tests as the house pattern for cache guarantee testing"

requirements-completed: [GRND-02]

coverage:
  - id: D1
    description: "createCachedStore<T>() factory with get(key, load)/clear(), 24h TTL, bounded FIFO eviction, in-flight dedup, injectable now clock — stateless (all Maps in per-call closures)"
    requirement: GRND-02
    verification:
      - kind: unit
        ref: "src/lib/cached-store.test.ts#createCachedStore — 10 guarantee tests (idempotency, key separation, TTL + strict boundary, dedup shared value/rejection, error non-caching, FIFO cap, clear, fresh store-time clock, per-resource isolation)"
        status: pass
      - kind: integration
        ref: "npm test — full unmodified suite: 8 files / 59 tests green (existing 37 + 10 new factory + 12 sibling panel tests)"
        status: pass
  - id: D2
    description: "getTraffic keeps public signature (domain, apiKey, months, fetchImpl) and {domain}:{months} key, delegating to a module-local createCachedStore instance; old private cache plumbing fully deleted"
    requirement: GRND-02
    verification:
      - kind: unit
        ref: "src/lib/tabapi.test.ts (unmodified) + src/app/api/traffic/route.test.ts (unmodified) — 12 tests green"
        status: pass
      - kind: other
        ref: "node -e absence regex: no successCache|inFlightRequests|pruneCache|CACHE_TTL_MS|MAX_CACHE_ENTRIES in tabapi.ts; no module-level Map in cached-store.ts"
        status: pass
  - id: D3
    description: "Phase gate for lib workstream: full suite, lint, build clean; frozen surface (route.ts, route.test.ts, types/traffic.ts, test/fixture.ts) untouched"
    requirement: GRND-02
    verification:
      - kind: other
        ref: "npm run lint (exit 0); npm run build (exit 0, TypeScript finished); git status --porcelain on 4 frozen paths (empty)"
        status: pass

# Metrics
duration: 10min
completed: 2026-10-13
status: complete
---

# Phase 1 Plan 2: Reusable Primitives & Cache Factory Summary

**Stateless `createCachedStore<T>()` factory (24h TTL, bounded FIFO eviction, in-flight dedup, injectable clock) with `getTraffic` delegating to it at its frozen public signature — existing tabapi/route suites green unmodified**

## Performance

- **Duration:** 10 min
- **Started:** 2026-10-13T14:42:17Z
- **Completed:** 2026-10-13T14:52:00Z
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- Extracted the traffic cache into `src/lib/cached-store.ts` — a stateless generic factory (`createCachedStore<T>(options?: { ttlMs?, maxEntries?, now? })`) whose closures reproduce `tabapi.ts` lines 75–118 step-for-step: TTL sweep (`expiresAt <= now`) then FIFO-by-insertion eviction running BEFORE insert (capacity exactly `maxEntries`), strict `expiresAt > now` freshness, delete-expired-before-dedup-check, two fresh clock reads at store time, `.finally` in-flight cleanup so failures are never cached.
- `getTraffic`/`clearTrafficCache` now delegate to one module-local `trafficStore = createCachedStore<TrafficResponse>()`; the 4-arg public signature, `{domain}:{months}` key template, `fetchImpl` default, `fetchTrafficFromTabApi`, `TrafficApiError`, `vietnameseError`, and `readError` are byte-identical (D-04). The old private Maps, `CacheEntry`, `pruneCache`, and both cache constants are deleted.
- `src/lib/cached-store.test.ts` pins the 10 guarantees the old suite left untested — including the two probe-resolved edges: same-key idempotency (load once, identical data) and shared-fate concurrency (single in-flight promise; all concurrent callers receive the same value or the same rejection), plus per-resource isolation (the T-01-03 cache-poisoning guard).
- Tracer gate passed in auto mode: after Task 1's commit the full `<verify>` chain re-ran end-to-end green before expanding.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create createCachedStore<T>() and put getTraffic on it — one path end-to-end** - `ed1ef7c` (refactor)
2. **Task 2: Pin the factory guarantees in cached-store.test.ts** - `9bd22b0` (test)
3. **Task 3: Lib-half phase gate — full unmodified suite, lint, build, frozen surface** - verification-only gate, no code delta (nothing to commit)

**Plan metadata:** committed with final docs commit (see below)

_Note: commits `979ec84` and `a3c2f8d` in the same range belong to sibling plan 01-01 (panel extraction), interleaved on the shared main working tree in sequential mode._

## Files Created/Modified

- `src/lib/cached-store.ts` - NEW: stateless `createCachedStore<T>()` factory; exports `createCachedStore`, `CachedStore<T>`, `CachedStoreOptions`, `DEFAULT_TTL_MS`/`DEFAULT_MAX_ENTRIES` (internal constants)
- `src/lib/cached-store.test.ts` - NEW: 10 guarantee tests (Vietnamese descriptions, injected `now` clock, deferred promises — no fake timers)
- `src/lib/tabapi.ts` - MODIFIED: one module-local `trafficStore = createCachedStore<TrafficResponse>()`; `getTraffic`/`clearTrafficCache` delegate; private cache Maps + `CacheEntry` + `pruneCache` + 2 constants deleted (82 lines, down from 118)

## Decisions Made

- **Constants home:** factory defaults — `tabapi.ts` calls `createCachedStore<TrafficResponse>()` bare, giving TTL/capacity values a single home (research open question 1, planner-pinned).
- **`get` shaped as `async function`:** most literal generalization of the original async `getTraffic` body — cached-hit path returns `cached.data` directly without touching the in-flight map; dedup path returns the shared in-flight promise (shared fate preserved).
- **FIFO preserved, not LRU:** `Map` insertion-order eviction copied verbatim; the PITFALLS.md LRU suggestion consciously rejected for this zero-behavior-change phase.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Task 2 (test-authoring bug, fixed before commit):** the fresh-store-time-clock test initially hung to the 5s vitest timeout — after the expiry boundary the final reload called the deferred loader again, creating a second promise that nobody resolved. Fixed by resolving the second deferred (`resolveLoad("dữ-liệu-mới")`) and asserting the reloaded value. The factory itself was correct; no source change needed.

## Verification Evidence

- Baseline precondition: `npm test` → 6 files / 37 tests green (precondition met before any edit)
- Task 1: `npm test -- src/lib/tabapi.test.ts src/app/api/traffic/route.test.ts` → 2 files / 12 tests green **unmodified**; absence regexes clean (no old plumbing in tabapi.ts, no module-level Map in factory)
- Task 2: `npm test -- src/lib/cached-store.test.ts` → 10 tests green
- Task 3 gate: `npm test` → **8 files / 59 tests green** (37 baseline + 10 factory + 12 sibling panel tests); `npm run lint` exit 0; `npm run build` exit 0 (TypeScript finished, no type errors); `git status --porcelain` on the four frozen paths → empty

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2–3 data sections can now create their own stores in one line (`const backlinksStore = createCachedStore<BacklinksResponse>();`) instead of copying cache mechanics; keys never collide across resources (per-resource instances + Phase 2+ prefixed keys).
- The `/api/traffic` route and `TrafficResponse` contract remain frozen and untouched — verified by empty `git status --porcelain` on all four frozen paths.
- No blockers or concerns.

---
*Phase: 01-groundwork-reusable-primitives-cache-factory*
*Completed: 2026-10-13*

## Self-Check: PASSED

All claimed files exist on disk; both task commit hashes (`ed1ef7c`, `9bd22b0`) exist in git history; SUMMARY committed with plan metadata.
