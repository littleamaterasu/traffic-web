---
phase: 01-groundwork-reusable-primitives-cache-factory
reviewed: 2026-10-14T11:03:34+07:00
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/components/panel.tsx
  - src/components/panel.test.tsx
  - src/components/traffic-dashboard.tsx
  - src/lib/cached-store.ts
  - src/lib/cached-store.test.ts
  - src/lib/tabapi.ts
status: findings
counts:
  critical: 0
  blocker: 0
  warning: 4
  info: 4
  total: 8
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
---

# Phase 01: Code Review Report

**Reviewed:** 2026-10-14T11:03:34+07:00
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Narrative Findings (AI reviewer)

### Summary

The refactor's two headline claims were verified against the pre-refactor source (`67668f4^`):

- **Panel extraction** — `InfoButton`, `Panel`, `EmptyCell`, `PANEL_INFO`, and the `PanelInfo` type were byte-compared against the pre-refactor `traffic-dashboard.tsx` and are verbatim. One deviation: `MetricCard` gained a `hint?: string` prop during extraction (see IN-01). Both `traffic-dashboard.tsx` and `ads-panel.tsx` now consume the shared primitives; no duplicate component copies remain anywhere in `src/`.
- **Cache factory** — `createCachedStore<T>()` reproduces the old `tabapi.ts` semantics exactly: key format `${domain}:${months}`, TTL anchored to load completion, expiry boundary `expiresAt > now` (equal timestamps count as expired), FIFO eviction at `>= maxEntries` via insert-order, in-flight dedup, errors not cached, `.finally` in-flight cleanup. `getTraffic` delegates at its frozen signature; `route.ts` and `types/traffic.ts` were confirmed untouched.

Evidence: 71/71 tests pass (`npx vitest run`), `npx tsc --noEmit` clean, `npm run lint` clean, no debug artifacts or secrets in reviewed files.

No Critical issues. Four Warnings — all robustness gaps that are **pre-existing semantics faithfully preserved by the refactor**, but which this phase promotes into shared/reusable public APIs (`panel.tsx` primitives, `createCachedStore`), making them worth fixing now. One Warning (WR-03) was proven by direct execution against `src/lib/cached-store.ts`.

**Scope note:** the diff range also contains the ads feature (`ads-panel.tsx`, `ads-transparency.ts`, `ads-insights.ts`, `api/ads/*`, `types/ads.ts`), which is outside the configured review file list and was not reviewed here.

## Critical Issues

None.

## Warnings

### WR-01: `InfoButton` modal has no focus trap; Escape only works while the trigger holds focus

**File:** `src/components/panel.tsx:24-26`, `src/components/panel.tsx:31-44`
**Issue:** The dialog declares `aria-modal="true"` (line 42) but nothing enforces modality: focus is never moved into the dialog, there is no focus trap, and background content is not made inert. Pressing Tab from the trigger moves focus to the backdrop button and then into the page content behind the overlay. The `onKeyDown` Escape handler (lines 24-26) is attached only to the trigger button, so once focus is anywhere else (backdrop, close button, background), Escape stops closing the dialog. The test suite even pins the limitation ("đóng khi nhấn Escape **trong khi nút kích hoạt giữ focus**", `panel.test.tsx:95`). This is pre-existing (verbatim extraction), but the extraction makes this the canonical reusable modal primitive — every future panel inherits the defect.
**Fix:** On open, move focus into the dialog and restore it to the trigger on close; handle Escape at window level while open; trap Tab within the dialog (or switch to the native `<dialog>`/`showModal()`, which provides all three for free):

```tsx
const dialogRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (!open) return;
  const previous = document.activeElement as HTMLElement | null;
  dialogRef.current?.focus();
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") setOpen(false);
  };
  window.addEventListener("keydown", onKey);
  return () => {
    window.removeEventListener("keydown", onKey);
    previous?.focus();
  };
}, [open]);
```

### WR-02: Non-JSON error response leaks an English `SyntaxError` message to the user

**File:** `src/components/traffic-dashboard.tsx:332`, `src/components/traffic-dashboard.tsx:344-345`
**Issue:** `await response.json()` is not guarded. When `/api/traffic` fails behind a proxy that returns an HTML body (realistic here: `*.ngrok-free.app` is whitelisted in `next.config.ts`, and upstream/gateway 502s are commonly HTML), `response.json()` throws a `SyntaxError` whose English engine text ("Unexpected token '<'…") flows through `cause.message` (line 345) into the `role="alert"` box. This violates the project convention that all user-facing messages are Vietnamese, and exposes raw engine diagnostics to the user. Pre-existing behavior, preserved verbatim by the refactor.
**Fix:** Wrap the parse and fall back to a Vietnamese message:

```ts
let body: TrafficResponse | ApiErrorBody;
try {
  body = (await response.json()) as TrafficResponse | ApiErrorBody;
} catch {
  throw new Error("Máy chủ trả về phản hồi không hợp lệ. Vui lòng thử lại sau.");
}
```

### WR-03: `clear()` during an in-flight load does not prevent cache re-population — proven by execution

**File:** `src/lib/cached-store.ts:45-51`, `src/lib/cached-store.ts:57-60`
**Issue:** The `.then` callback sets `entries` unconditionally after the loader resolves (line 48), with no awareness that `clear()` may have run in the meantime. Proven against the actual module (scratch script, Node type-stripping): `get` → `clear()` while the load is pending → loader resolves → a subsequent `get` returns the pre-clear data **without calling the loader again**. This contradicts `clear()`'s contract as pinned by the existing test ("clear() xóa cache — loader chạy lại cho key đã cache", which only exercises `clear()` after completion). Practical impact: `clearTrafficCache()` is the test-isolation reset used in `src/app/api/traffic/route.test.ts:8` and `src/lib/tabapi.test.ts:13` — a slow in-flight fetch from a previous test that resolves late silently pollutes the next test's store. The semantics are inherited from the pre-refactor implementation (not a regression), but this phase promotes the logic to a general-purpose public factory, where the contract should actually hold.
**Fix:** Guard with a generation token:

```ts
let epoch = 0;

function clear(): void {
  epoch += 1;
  entries.clear();
  inFlight.clear();
}

// in get():
const requestEpoch = epoch;
const request = load()
  .then((data) => {
    prune(now());
    if (requestEpoch === epoch) entries.set(key, { data, expiresAt: now() + ttlMs });
    return data;
  })
  .finally(() => {
    if (requestEpoch === epoch) inFlight.delete(key);
  });
```

Add a regression test: start a `get`, call `clear()` before resolving, then assert the next `get` re-invokes the loader.

### WR-04: Cache key omits the API key — anti-pattern now baked into a reusable factory

**File:** `src/lib/tabapi.ts:74`
**Issue:** `cacheKey = \`${domain}:${months}\`` omits `apiKey`. The project's own ARCHITECTURE.md lists "Cache not keyed by API key or data version" as an anti-pattern. Harmless today with a single server-side key, but this phase's deliverable is explicitly a *reusable* cache primitive, and it already has a second consumer (`ads-transparency.ts` instantiates two stores). Key rotation, multi-tenant keys, or per-credential quotas would silently serve cross-credential cached data. Pre-existing keying, preserved exactly.
**Fix:** Either include a credential discriminator in the key (in-memory only, so a fragment is acceptable):

```ts
const cacheKey = `${apiKey.length}:${apiKey.slice(-4)}:${domain}:${months}`;
```

or make the single-key precondition explicit at the factory level (e.g., accept a `keyNamespace` option and document that callers must include every input that can change the loader's output).

## Info

### IN-01: "Verbatim extraction" is inexact — `MetricCard` was extended, and the new prop is untested

**File:** `src/components/panel.tsx:113-131`
**Issue:** The pre-refactor signature was `MetricCard({ label, value, accent })`; the extracted version adds `hint?: string` (line 122) with conditional rendering (line 128) to serve `ads-panel.tsx`. Additive only — existing call sites (the dashboard) pass no `hint`, so rendered behavior is unchanged — but the phase claim of a verbatim extraction is not literally true for this component. `panel.test.tsx` has no case for the `hint` prop; its rendering is only exercised incidentally through ads-panel.
**Fix:** Either amend the phase summary to note the additive `hint` extension, and/or add a one-line assertion to `panel.test.tsx` (`render(<MetricCard … hint="ghi chú" />)` → text present; without `hint` → absent).

### IN-02: Type imports rely on the global `React` namespace / value-import of a type

**File:** `src/components/panel.tsx:90`, `src/components/panel.tsx:109`, `src/components/traffic-dashboard.tsx:3`
**Issue:** `React.ReactNode` is referenced without importing React (works via the UMD global in type positions, confirmed by tsc), and `FormEvent` is imported as a value binding despite being type-only — both contradict the project convention "Always use `import type { … }` for type-only imports". Both are verbatim carry-overs from the pre-refactor file.
**Fix:** `import type { ReactNode } from "react"` in `panel.tsx` (use `ReactNode`), and split `import { useState } from "react"; import type { FormEvent } from "react";` in the dashboard.

### IN-03: `createCachedStore` accepts nonsensical options silently

**File:** `src/lib/cached-store.ts:16-17`
**Issue:** No validation of `ttlMs`/`maxEntries`. `ttlMs: 0` (or negative) yields `expiresAt = now + ttlMs <= now`, so the store never serves a hit; `maxEntries <= 0` degenerates to a no-op cache. Neither crashes (the eviction `while` safely breaks on an empty map), but a public reusable factory that silently no-ops on bad config invites subtle misuse by future consumers.
**Fix:** Clamp or throw for non-positive values, e.g. `if (ttlMs <= 0) throw new RangeError("ttlMs must be positive");` — or at minimum validate once at factory creation, not per-`get`.

### IN-04: Test selects close buttons by `getAllByRole` index, coupled to DOM order

**File:** `src/components/panel.test.tsx:114-121`
**Issue:** The two close affordances (backdrop button and `×` button) share one accessible name, so the test distinguishes them by `getAllByRole(...)[0]`/`[1]` document order. Both handlers do the same thing today, so if the DOM order ever changed, the assertions would pass vacuously against the wrong button rather than fail.
**Fix:** Scope the lookup, e.g. `within(screen.getByRole("dialog")).getByRole("button", { name: "Đóng…" })` for the `×` button and query the backdrop separately.

---

_Reviewed: 2026-10-14T11:03:34+07:00_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
