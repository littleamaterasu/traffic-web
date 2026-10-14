---
phase: 01-groundwork-reusable-primitives-cache-factory
verified: 2026-10-14T11:15:29Z
status: passed
score: 11/11 must-haves verified
behavior_unverified: 0
overrides_applied: 0
covered_files:
  - .planning/phases/01-groundwork-reusable-primitives-cache-factory/01-01-PLAN.md
  - .planning/phases/01-groundwork-reusable-primitives-cache-factory/01-01-SUMMARY.md
  - .planning/phases/01-groundwork-reusable-primitives-cache-factory/01-02-PLAN.md
  - .planning/phases/01-groundwork-reusable-primitives-cache-factory/01-02-SUMMARY.md
  - src/components/panel.test.tsx
  - src/components/panel.tsx
  - src/components/traffic-dashboard.tsx
  - src/lib/cached-store.test.ts
  - src/lib/cached-store.ts
  - src/lib/tabapi.ts
covered_digest: "v1:sha256:50cf82cfe880b7708552e5998beb2c4c490d478f57dce3275c7c7d3e93385321"
gaps: []
---

# Phase 1: Groundwork - Reusable Primitives & Cache Factory — Verification Report

## Summary

**VERDICT: PASSED — Phase goal achieved.**

The researcher's report is behaviorally unchanged (full suite green with zero edits to pre-existing tests, plus completed human UAT 6/6), the shared panel primitives are importable and composably wired from `@/components/panel`, and the 24h cache now lives in a stateless `createCachedStore<T>()` factory with `getTraffic` delegating to it at its frozen signature. All 11 must-haves verified against the codebase; all 6 test-tier prohibitions have wired enforcement; `npm test` (10 files / 71 tests), `npm run lint`, and `npm run build` all pass in the verifier's own process; the frozen surface is untouched by phase commits.

**Phase Goal:** The researcher's report looks and behaves exactly as before, while the shared panel primitives and the 24h cache become reusable foundations that the new sections can build on without copy-paste.
**Mode:** mvp (User Story: As a marketing researcher, I want to see the report render and behave exactly as before the refactor, so that the extracted panel primitives and shared cache foundations become reusable building blocks that new report sections plug into without copy-paste.)
**Verified:** 2026-10-14T11:15:29Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### User Flow Coverage (MVP mode)

| # | User Story Step | Expected | Evidence in Codebase | Status |
|---|----------------|----------|---------------------|--------|
| 1 | Researcher runs a search | Report renders identically to pre-refactor (panels, metric cards, tables, Vietnamese "i" explainers) | `traffic-dashboard.test.tsx` unmodified (git diff: phase range added only NEW test files) and green; renders through the `@/components/panel` import path; human UAT #1 pass | ✓ VERIFIED |
| 2 | Researcher opens/closes an "i" dialog | Dialog opens with full ARIA contract; closes via Escape (focus on trigger), backdrop, and × buttons | `panel.test.tsx` behavioral tests (open, aria-modal/labelledby, Escape-with-focus, dual close buttons, backdrop) all green; UAT #2 pass | ✓ VERIFIED |
| 3 | Researcher hits an empty metric | Vietnamese default "Chưa có dữ liệu" renders | `EmptyCell` default (panel.tsx:109) + `panel.test.tsx` case green; UAT #3 pass | ✓ VERIFIED |
| 4 | Researcher repeats a lookup within 24h | Served from cache — loader runs once, no upstream re-fetch | `cached-store.test.ts` idempotency test green; `getTraffic` delegates to `trafficStore` (tabapi.ts:66-78); UAT #4 pass | ✓ VERIFIED |
| 5 | Researcher looks up two domains | Each domain gets its own correct data; no cross-contamination | Key scheme `${domain}:${months}` (tabapi.ts:74) + per-resource isolation test (cached-store.test.ts:154) green; UAT #5 pass | ✓ VERIFIED |
| 6 | Developer adds a new section | Composes panels from `@/components/panel` and creates stores via `createCachedStore<T>()` without copying mechanics | panel.tsx exports Panel/InfoButton/EmptyCell/MetricCard/PanelInfo; dashboard imports and uses them 12×; stateless factory with per-instance state | ✓ VERIFIED |

### Observable Truths

Merged from ROADMAP success criteria (SC1–SC4, the contract) and PLAN frontmatter must_haves; duplicates deduplicated to the roadmap wording.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 / 01-01-T2: Researcher sees no change anywhere in the report — every panel, metric, formatter, and Vietnamese "i" explainer renders identically to before | ✓ VERIFIED | Full suite green in verifier's run (71/71); `traffic-dashboard.test.tsx` pins exact modal class strings, ARIA semantics, Vietnamese labels and was NOT edited in the phase range (`git diff 22ed104..9bd22b0 -- src/**.test.*` → only new files); behavior exercised through the new import path; human UAT 6/6 pass (01-UAT.md, commit 2f5c54e) |
| 2 | SC2 / 01-01-T1: The full existing test suite passes unmodified against the refactored code (flagged-assumption proxy for GRND-01) | ✓ VERIFIED | `npm test` → 10 files / 71 tests passed (verifier-run); phase-range diff touches only new test files (`panel.test.tsx`, `cached-store.test.ts`, +327/-0); frozen `route.test.ts` and baseline tests byte-untouched |
| 3 | SC3 / 01-01-T3: A developer can compose a new panel from Panel, InfoButton, EmptyCell, MetricCard imported from `@/components/panel` without copying code out of the monolith | ✓ VERIFIED | panel.tsx:1-131 — first line `"use client";`, exports all four primitives + `export type PanelInfo`; dashboard imports them (traffic-dashboard.tsx:5-6) and uses Panel ×5, MetricCard/EmptyCell ×12; `npm run build` exit 0 proves the module bundles for the client |
| 4 | 01-01-T4 (D-01): Info-content dictionaries and SOURCE_LABELS remain in traffic-dashboard.tsx; only the PanelInfo type moves | ✓ VERIFIED | `PANEL_INFO` declared at traffic-dashboard.tsx:36 with `satisfies Record<string, PanelInfo>` (:86) via type import; `SOURCE_LABELS` at :20; `PANEL_INFO` absent from panel.tsx (full read) |
| 5 | SC4 / 01-02-T4: A store created via `createCachedStore<T>()` demonstrates the same guarantees as the existing traffic cache, with getTraffic running on the factory and its tests green | ✓ VERIFIED | All 10 factory guarantee tests green in verifier's run; tabapi.ts:66 `const trafficStore = createCachedStore<TrafficResponse>();` and getTraffic/clearTrafficCache delegate; unmodified tabapi.test.ts + route.test.ts green |
| 6 | 01-02-T1: Same key twice within TTL → load invoked exactly once, identical data returned both times | ✓ VERIFIED | cached-store.test.ts:11-21 (behavioral test, green) |
| 7 | 01-02-T2: Concurrent get() for the same key share a single in-flight promise — load runs once; on rejection all concurrent callers receive the same rejection | ✓ VERIFIED | cached-store.test.ts:48-66 (shared value) and :68-86 (shared rejection), deferred-promise pattern, green |
| 8 | 01-02-T3 (D-04): getTraffic keeps signature (domain, apiKey, months, fetchImpl=default) and `${domain}:${months}` key; all existing tabapi.test.ts and route.test.ts cases pass unmodified | ✓ VERIFIED | tabapi.ts:68-78 (4 params, fetchImpl defaulted last, key template :74); both test files absent from phase-range diff and green |
| 9 | 01-02-B1: An entry stops being served strictly after ttlMs (expiresAt === now counts as expired) — verified through the injectable clock seam | ✓ VERIFIED | cached-store.test.ts:33-46 drives the injected `now` clock; strict `expiresAt > current` check at cached-store.ts:39; green |
| 10 | 01-02-B2: Steady-state capacity is exactly maxEntries — prune-and-evict runs BEFORE insert, evicts oldest-inserted key (FIFO, not LRU) | ✓ VERIFIED | prune-before-insert at cached-store.ts:23-33 (`while (entries.size >= maxEntries)` deletes `entries.keys().next().value`, called inside `.then` before `entries.set`); FIFO test cached-store.test.ts:97-113 green |
| 11 | 01-02-B3: Store-time uses fresh clock reads — expiresAt computed from now() at load completion, not the read-time snapshot | ✓ VERIFIED | Two fresh `now()` calls at cached-store.ts:47-48; behavioral test cached-store.test.ts:127-152 (clock advanced between get() and resolve) green |

**Score:** 11/11 truths verified (0 present, behavior-unverified)

### Prohibition Verification (test-tier, must-NOT checks)

All six prohibitions are `verification: test` — each has wired enforcement evidence (a green test or direct code observation in the verifier's own run), so none is flagged unverified.

| # | Prohibition | Enforcement Evidence | Status |
|---|-------------|---------------------|--------|
| 1 | 01-01: MUST NOT rewrite component bodies during the move (verbatim copy) | Unmodified dashboard suite green pins exact class strings/ARIA/Vietnamese text through the extracted components | ✓ VERIFIED |
| 2 | 01-01: MUST NOT relocate info-content dictionaries or SOURCE_LABELS out of the dashboard | PANEL_INFO still at traffic-dashboard.tsx:36-86; absent from panel.tsx; dashboard tests green | ✓ VERIFIED |
| 3 | 01-01: MUST NOT change Escape handling scope — no document-level listeners; handler stays onKeyDown on the trigger | panel.tsx:24-26 `onKeyDown` on the trigger; no `addEventListener` anywhere in panel.tsx; Escape behavioral test green | ✓ VERIFIED |
| 4 | 01-02: MUST NOT share cache state across upstream resources — stateless factory, per-resource instances | All Maps inside the `createCachedStore` closure (cached-store.ts:20-21); zero module-level Maps; per-resource isolation test (case 9) green | ✓ VERIFIED |
| 5 | 01-02: MUST NOT reorder or improve the get sequence (expired-delete before dedup check, prune before insert, strict freshness) | cached-store.ts:35-55 matches the tabapi spec order step-for-step; unmodified tabapi.test.ts green | ✓ VERIFIED |
| 6 | 01-02: MUST NOT cache rejected loads — failed load clears in-flight entry and re-executes next get | `.finally(() => inFlight.delete(key))` at cached-store.ts:51; no catch-and-store path; error non-caching test green | ✓ VERIFIED |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/panel.tsx` | Shared primitives extracted verbatim; exports Panel, InfoButton, EmptyCell, MetricCard, type PanelInfo | ✓ VERIFIED | 131 lines; `"use client";` is line 1; all five exports present; substantive (full component bodies, no stubs); wired (imported by dashboard) |
| `src/components/panel.test.tsx` | Direct co-located coverage of the four primitives: render props, dialog ARIA semantics, Escape-to-close | ✓ VERIFIED | 163 lines; 12 tests in 4 Vietnamese describe blocks; Escape test clicks trigger first, asserts dialog removal; wired into green suite |
| `src/components/traffic-dashboard.tsx` | Modified: imports primitives from `@/components/panel`; retains PANEL_INFO + SOURCE_LABELS | ✓ VERIFIED | Lines 5-6 import value + type; PANEL_INFO (:36) and SOURCE_LABELS (:20) retained; `useId` removed from react import; renders through Panel/MetricCard/EmptyCell |
| `src/lib/cached-store.ts` | Stateless generic cache factory: TTL, bounded FIFO eviction, in-flight dedup, injectable seams | ✓ VERIFIED | 63 lines; exports createCachedStore, CachedStore, CachedStoreOptions; `DEFAULT_TTL_MS = 24 * 60 * 60 * 1000`, `DEFAULT_MAX_ENTRIES = 100`; both Maps inside the per-call closure — no module-level mutable state |
| `src/lib/cached-store.test.ts` | Factory guarantee coverage: TTL expiry, dedup shared fate, FIFO cap, clear reset, error non-caching, + isolation | ✓ VERIFIED | 164 lines; 10 tests covering all 9 mandated guarantee cases (dedup split into shared-value and shared-rejection); injected `now` clock, deferred promises, no fake timers |
| `src/lib/tabapi.ts` | getTraffic/clearTrafficCache delegate to one module-local store; private cache plumbing deleted | ✓ VERIFIED | 82 lines; single `trafficStore` (:66); 4-arg signature with fetchImpl default; `${domain}:${months}` key; `successCache`/`inFlightRequests`/`pruneCache`/`CACHE_TTL_MS`/`MAX_CACHE_ENTRIES` all absent |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/components/traffic-dashboard.tsx` | `src/components/panel.tsx` | Value import `{ EmptyCell, MetricCard, Panel }` + `import type { PanelInfo }` from `@/components/panel` | ✓ WIRED | Lines 5-6; Panel used at :151/:184/:204/:232/:262; MetricCard/EmptyCell used 12× |
| `src/lib/tabapi.ts` | `src/lib/cached-store.ts` | Module-local `createCachedStore<TrafficResponse>()` | ✓ WIRED | Import at :1, instantiation at :66, used by getTraffic (:75) and clearTrafficCache (:81) |
| `src/app/api/traffic/route.ts` | `src/lib/tabapi.ts` | Frozen 3-arg `getTraffic(domain, apiKey, months)` call with fetchImpl default intact | ✓ WIRED | Frozen file untouched (git diff empty); signature accepts 3 args with defaulted 4th; route.test.ts green unmodified |

### Data-Flow Trace (Level 4)

This is a zero-behavior-change refactor — no new data sources were introduced. Trace confirms no hollow wiring:

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| traffic-dashboard.tsx | `data` | `fetch("/api/traffic?...")` at runtime | Yes — live TabAPI-backed endpoint | ✓ FLOWING |
| Panel / MetricCard / EmptyCell | props (`title`, `badge`, `info`, `label`, `value`) | Derived from `data` state and consumer-owned PANEL_INFO / SOURCE_LABELS dictionaries | Yes — renders caller-supplied values; no hardcoded render output | ✓ FLOWING |
| cached-store.ts | `entries` / `inFlight` | Populated exclusively by the `load()` callback results (tabapi's real fetch) | Yes — cache stores actual loader output, errors never cached | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite green incl. all 9 factory guarantee cases + 12 panel tests | `npm test` | 10 files / 71 tests passed, 0 failed | ✓ PASS |
| ESLint clean (proves useId prune, no unused imports) | `npm run lint` | exit 0 | ✓ PASS |
| Production build compiles extracted module + factory for client/server | `npm run build` | exit 0; all routes compiled (/, /_not-found, /api/ads, /api/ads/detail, /api/traffic — the two /api/ads routes are post-phase user work, commit 300b113, outside phase scope) | ✓ PASS |
| Frozen surface unmodified in working tree | `git status --porcelain` on the 4 frozen paths | empty output | ✓ PASS |

Note: the single full-suite run covers the named behavioral tests for the behavior-dependent truths (idempotency, dedup shared fate, TTL strict boundary, FIFO cap, fresh store-time clock, per-resource isolation, Escape-to-close) — all present in the suite and passing.

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes exist and none are declared in either PLAN. Step 7c: SKIPPED (no probes declared or conventional for this repo).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GRND-01 | 01-01-PLAN (`requirements:` line 13) | Researcher sees no behavior change after shared UI primitives (Panel, InfoButton, EmptyCell, MetricCard, PANEL_INFO) are extracted into a reusable module | ✓ SATISFIED | Verbatim extraction verified in code; unmodified suite green (verifier-run); UAT 6/6; REQUIREMENTS.md :12 + traceability "Phase 1 / Complete" |
| GRND-02 | 01-02-PLAN (`requirements:` line 13) | New data sections reuse a generalized cached-store factory that preserves 24h TTL, in-flight dedup, and injectable fetchImpl behavior of the existing traffic cache | ✓ SATISFIED | createCachedStore with DEFAULT_TTL_MS=24h, dedup, injectable `now`/`fetchImpl` seams; getTraffic delegates; 10 guarantee tests green; REQUIREMENTS.md :13 + traceability "Phase 1 / Complete" |

Orphaned requirements: none — traceability maps only GRND-01 and GRND-02 to Phase 1, and both are claimed by plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers in any phase-modified file; no stub returns, no empty handlers, no hardcoded-empty render data | — | Clean |

Commit verification: all four claimed task commits exist in history — 979ec84, a3c2f8d (plan 01-01); ed1ef7c, 9bd22b0 (plan 01-02). Commit 300b113 ("integrate google transparency") and successors are post-phase user work (ads feature) and are excluded from phase scope, per orchestrator instruction.

### 01-REVIEW.md Warnings (4) — Disposition

All four are robustness gaps that are **pre-existing semantics faithfully preserved by this zero-behavior-change refactor** (e.g., no focus trap in InfoButton; Escape only while the trigger holds focus). None contradicts a must-have — in fact, must-have #1 and prohibition #3 (Escape scope unchanged, no document-level listeners) *require* preserving this exact behavior. Not counted as phase gaps; they now live in shared public APIs and are candidates for a future hardening phase.

### Human Verification Required

None outstanding. The visual/behavioral human checkpoint for this phase was already completed post-phase: **01-UAT.md — 6/6 passed, 0 issues, 0 pending** (commit 2f5c54e, 2026-10-14), covering identical rendering, dialog interactions (Escape/backdrop/×), empty states, cache-hit behavior through the factory, per-domain cache separation, and clean lint/build. No `<human-check>` blocks were deferred in either PLAN.

### Gaps Summary

None. All 11 merged must-haves verified, all 6 prohibitions enforced and green, all artifacts exist/substantive/wired, all key links connected, requirements GRND-01 and GRND-02 satisfied and traceable, gates (test/lint/build) pass in the verifier's own process, frozen surface untouched by phase commits, and the human UAT checkpoint is complete.

---

_Verified: 2026-10-14T11:15:29Z_
_Verifier: the agent (gsd-verifier)_
