---
phase: 01-groundwork-reusable-primitives-cache-factory
plan: 01
subsystem: client-ui
tags: [refactor, extraction, react-components, zero-behavior-change, panel-primitives]
requires:
  - "Monolithic traffic-dashboard.tsx with inline Panel/InfoButton/EmptyCell/MetricCard primitives (pre-existing)"
provides:
  - "src/components/panel.tsx — Panel, InfoButton, EmptyCell, MetricCard, type PanelInfo importable from @/components/panel"
  - "Co-located primitive test coverage (panel.test.tsx, 12 tests)"
affects:
  - "Phase 2–4 new report panels compose @/components/panel primitives instead of growing the monolith"
tech-stack:
  added: []
  patterns:
    - "Verbatim-move extraction (byte-identical bodies, only export keywords added)"
    - "Consumer-owned content dictionaries (PANEL_INFO stays with consumer; shared artifact is the PanelInfo type + Panel info prop)"
key-files:
  created:
    - src/components/panel.tsx
    - src/components/panel.test.tsx
  modified:
    - src/components/traffic-dashboard.tsx
decisions:
  - "D-01 implemented: primitives + PanelInfo type live in panel.tsx; PANEL_INFO dictionary and SOURCE_LABELS remain in the dashboard"
  - "Dashboard imports primitives via @/components/panel alias (house rule: relative ./ reserved for same-folder test imports); panel.test.tsx uses ./panel"
  - "Escape handling scope unchanged — onKeyDown stays on the trigger button; no document-level listeners (verified by new Escape test)"
metrics:
  duration: 11 minutes
  completed: 2026-10-13
  tasks: 3
  files: 3
status: complete
estimate:
  tokens: 45000
actuals:
  tokens: 4600
  tasks: 3
  commits: 2
  plan_head_before: 22ed10476aa97435ecc6da78dc570360a0a960e3
commits_note: >-
  Raw rev-list from plan_head_before counts 4 because plan 01-02 executed concurrently in the
  same working tree (ed1ef7c, 9bd22b0 interleaved). The 2 commits created by THIS plan are
  979ec84 (refactor 01-01) and a3c2f8d (test 01-01); both verified in git log.
---

# Phase 1 Plan 1: Reusable Panel Primitives Extraction Summary

Extracted `Panel`, `InfoButton`, `EmptyCell`, `MetricCard`, and the `PanelInfo` type verbatim from the 571-line dashboard monolith into importable `@/components/panel`, with byte-identical rendering proven by the unmodified dashboard suite.

## What Was Built

- **`src/components/panel.tsx` (NEW)** — `"use client"` module whose first line is the directive, exporting `Panel`, `InfoButton`, `EmptyCell`, `MetricCard`, and `export type PanelInfo`. Component bodies are byte-identical copies of `traffic-dashboard.tsx` lines 91–200 (only `export` keywords added); the type is re-declared as `export type PanelInfo` exactly per the plan. Needs only `import { useId, useState } from "react";` — the `React.ReactNode` annotations resolved as UMD-global types exactly as they did in the dashboard (Pitfall 4 did not materialize; the sanctioned `import type { ReactNode }` fallback was not needed).
- **`src/components/traffic-dashboard.tsx` (MODIFIED)** — deleted moved ranges (PanelInfo type + four component bodies); retained its `PANEL_INFO` dictionary and `SOURCE_LABELS` in place with `satisfies Record<string, PanelInfo>` intact via `import type { PanelInfo } from "@/components/panel"`; react import pruned to `import { FormEvent, useState } from "react";` (`useId` removed per lint gate); added value import `{ EmptyCell, MetricCard, Panel }` from `@/components/panel`. The dashboard never references `InfoButton` directly (renders via `Panel`), so it is not in the value import.
- **`src/components/panel.test.tsx` (NEW)** — 12 co-located tests in four Vietnamese-described describe blocks covering all four primitives: Panel title/children/badge/info-conditionality/extra-className; InfoButton default-closed, full dialog ARIA contract (`role="dialog"`, `aria-modal="true"`, `aria-labelledby` → rendered heading id, trigger `aria-label` = `Giải thích bảng {title}`), Escape-to-close with focus held on the trigger (click-first, then `user.keyboard("{Escape}")`, then dialog-absence assertions), close via both `Đóng giải thích bảng {title}` buttons and the backdrop button, and summary/every metric pair/`Lưu ý:` note rendering; EmptyCell default `"Chưa có dữ liệu"` + children override; MetricCard label/value/accent class.

## GRND-01 Evidence (the flagged-assumption proxy)

1. **Full suite green with ZERO edits to any pre-existing test file:** `npm test` final run — **8 files / 59 tests passed**. The 37 baseline tests (6 files, baseline verified 2026-10-13) all pass unmodified; the +22 new tests are `panel.test.tsx` (12, this plan) and `cached-store.test.ts` (10, concurrent plan 01-02).
2. **`npm run lint`** — exit 0 (proves the `useId` prune; no unused imports).
3. **`npm run build`** — exit 0, TypeScript clean, all routes compiled (proves the extracted module bundles cleanly for the client).
4. **Frozen surface untouched:** `git status --porcelain` on `src/app/api/traffic/route.ts`, `route.test.ts`, `src/types/traffic.ts`, `src/test/fixture.ts` — empty output.
5. **D-01 absence check:** `PANEL_INFO` appears nowhere in `panel.tsx` (node fs check exits 0).

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Verbatim-move primitives into panel.tsx + rewire dashboard | 979ec84 | src/components/panel.tsx (new), src/components/traffic-dashboard.tsx |
| 2 | Add co-located panel.test.tsx (D-02) | a3c2f8d | src/components/panel.test.tsx (new) |
| 3 | UI-half phase gate (full suite, lint, build, frozen surface) | — (verification-only; artifacts committed in tasks 1–2) | — |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Whitespace-normalizer mismatch in two new test assertions**
- **Found during:** Task 2 (first `npm test -- src/components/panel.test.tsx` run — 11/12 green)
- **Issue:** `getByText("Tháng: ")` / `getByText("Lượt truy cập: ")` failed because Testing Library's default normalizer trims trailing whitespace from the rendered `<dt>` text (`{metric.label}: ` renders as `"Tháng:"` after normalization)
- **Fix:** dropped the trailing spaces in the two expected strings (assertions still pin the exact `label: ` construct as rendered)
- **Files modified:** src/components/panel.test.tsx
- **Commit:** a3c2f8d (fixed before the task commit; no post-commit fix)

### Environment Notes (not plan deviations)

- **Concurrent executor in the same working tree:** plan 01-02 (cache factory) executed in parallel; its commits (`ed1ef7c`, `9bd22b0`) and file edits (`src/lib/tabapi.ts`, `src/lib/cached-store.*`) appeared mid-run. All staging in this plan was done file-by-file — no cross-contamination in either plan's commits.
- **Transient full-suite failure during Task 3 gate:** first `npm test` run showed 1 failure in `src/lib/cached-store.test.ts` (the sibling executor's mid-TDD file, test `tính thời hạn từ thời điểm load hoàn tất…`). Out of this plan's scope per the frozen-surface rule (dashboard/panel never import `cached-store`); the re-run after the sibling stabilized was fully green (8/8 files, 59/59 tests). The final gate evidence above is the green re-run.
- **Transient `next build` lock collision:** first build attempt failed with "Another next build process is already running" (sibling executor's build in flight); retried after the lock cleared — exit 0.

## Known Stubs

None — no placeholder text, no unwired data paths. All four primitives are pure presentational components receiving real props; the dashboard renders them exactly as before.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes. Threat-model mitigations verified in the extracted file: T-01-01 (no `process.env` access in panel.tsx; grep-verified) and T-01-02 (no `dangerouslySetInnerHTML`, no raw-HTML construct, no `fetch(` — grep-verified; React default escaping preserved by the verbatim move).

## Verification Checklist (plan `<verification>` section)

1. ✓ `npm test` — full unmodified suite green (8 files / 59 tests: baseline 37 + panel 12 + cached-store 10)
2. ✓ `npm run lint` and `npm run build` exit 0
3. ✓ `src/components/panel.tsx` exists, first line is `"use client";`, exports Panel, InfoButton, EmptyCell, MetricCard, type PanelInfo
4. ✓ `traffic-dashboard.tsx` imports primitives from `@/components/panel` and retains its own PANEL_INFO dictionary + SOURCE_LABELS
5. ✓ Frozen surface (route.ts, route.test.ts, types/traffic.ts, test/fixture.ts) shows no git diff

## Self-Check: PASSED

- FOUND: src/components/panel.tsx (first line `"use client";`)
- FOUND: src/components/panel.test.tsx
- FOUND: commit 979ec84
- FOUND: commit a3c2f8d
