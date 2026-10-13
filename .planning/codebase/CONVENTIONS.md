# Coding Conventions

**Analysis Date:** 2026-10-13

## Naming Patterns

**Files:**
- kebab-case for every file: `src/components/traffic-dashboard.tsx`, `src/lib/tabapi.ts`, `src/test/fixture.ts`
- Tests co-located with source, suffixed `.test.ts` / `.test.tsx`: `src/lib/config.test.ts`, `src/app/api/traffic/route.test.ts`
- Route files use the Next.js App Router reserved name `route.ts` under the URL path: `src/app/api/traffic/route.ts`
- Type definitions live in one dedicated file per domain: `src/types/traffic.ts`

**Functions:**
- camelCase, verb-first: `normalizeDomain`, `getTrafficMonths`, `formatPercent`, `getTraffic`, `clearTrafficCache`
- Private helpers are plain module-local functions (no underscore prefix): `errorResponse`, `vietnameseError`, `pruneCache`, `readError` in `src/app/api/traffic/route.ts` and `src/lib/tabapi.ts`

**Variables:**
- SCREAMING_SNAKE_CASE for module-level constants: `DEFAULT_TRAFFIC_MONTHS`, `MAX_CACHE_ENTRIES` (`src/lib/tabapi.ts`), `DOMAIN_LABEL` regex (`src/lib/domain.ts`), `SOURCE_LABELS`, `PANEL_INFO` (`src/components/traffic-dashboard.tsx`)
- camelCase for locals and function parameters everywhere else

**Types:**
- PascalCase `interface` for data shapes: `TrafficResponse`, `TrafficOverview`, `ApiErrorBody` (`src/types/traffic.ts`)
- PascalCase `type` aliases for unions/utilities: `NullableMetric`, `PanelInfo` (`src/types/traffic.ts`, `src/components/traffic-dashboard.tsx`)
- Error classes end in `Error` and set `this.name`: `DomainValidationError` (`src/lib/domain.ts`), `TrafficApiError` (`src/lib/tabapi.ts`)
- Env vars are SCREAMING_SNAKE_CASE: `TABAPI_KEY`, `TRAFFIC_MONTHS`

**UI copy language:**
- All user-facing strings, error messages, and test descriptions are Vietnamese. Error *codes* are English snake_case (`invalid_domain`, `insufficient_credits`). Keep this split: code for machines, Vietnamese for humans.

## Code Style

**Formatting:**
- No Prettier config detected — formatting is by consistent manual convention
- Double quotes for strings/imports, semicolons, 2-space indent, trailing commas in multiline literals
- Numeric separators for large constants: `20_000`, `24 * 60 * 60 * 1000` (`src/components/traffic-dashboard.tsx:435`, `src/lib/tabapi.ts:4`)

**Linting:**
- ESLint 9 flat config in `eslint.config.mjs`
- Uses `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`; global ignores: `.next/**`, `coverage/**`, `next-env.d.ts`
- Run with `npm run lint`. Do not add custom rules — rely on the Next.js presets

**TypeScript:**
- `strict: true` in `tsconfig.json`; target ES2017, `moduleResolution: "bundler"`, `isolatedModules: true`
- Path alias `@/*` → `./src/*` (mirrored in `vitest.config.ts`)
- Always use `import type { ... }` for type-only imports (see `src/lib/tabapi.ts:1`, `src/components/traffic-dashboard.tsx:13`)
- Use Node built-ins with the `node:` protocol: `import { isIP } from "node:net"` (`src/lib/domain.ts:1`)

## Import Organization

**Order (observed pattern):**
1. Node built-ins (`node:net`, `node:url`)
2. Third-party (`next/server`, `react`, `vitest`, `@testing-library/*`)
3. Internal `@/` alias imports (`@/lib/config`, `@/types/traffic`)
4. Relative imports for siblings (`./route`, `./tabapi`)

Example from `src/app/api/traffic/route.ts:1-5`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getTrafficMonths } from "@/lib/config";
import { DomainValidationError, normalizeDomain } from "@/lib/domain";
import { getTraffic, TrafficApiError } from "@/lib/tabapi";
import type { ApiErrorBody } from "@/types/traffic";
```

**Path Aliases:**
- `@/*` maps to `./src/*` — use it for all cross-directory imports; use relative `./` only for same-folder test imports

## Error Handling

**Patterns (follow these exactly):**

1. **Custom error classes carry HTTP metadata.** Domain errors extend `Error`, set `this.name`, and hold `status`/`code` fields:
```typescript
export class TrafficApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TrafficApiError";
  }
}
```
(`src/lib/tabapi.ts:15-24`, same shape as `DomainValidationError` in `src/lib/domain.ts:5-10`)

2. **Libraries throw; the route handler maps to HTTP.** `src/app/api/traffic/route.ts` catches known error classes and converts via a single helper:
```typescript
function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json<ApiErrorBody>({ error: { code, message } }, { status });
}
```
Never build ad-hoc error JSON inline — always go through this shape.

3. **Error contract:** every API error body is `{ error: { code, message } }` typed as `ApiErrorBody` (`src/types/traffic.ts:78-82`).

4. **Fail-fast config validation with catch-all fallback:** unknown errors return a generic 502 `unexpected_error` with a user-safe Vietnamese message — never leak stack traces or internals (`src/app/api/traffic/route.ts:43-48`).

5. **Client-side fetch:** wrap in try/catch with an `AbortController` 20s timeout, distinguish `DOMException` `AbortError`, and surface the message in a `role="alert"` block (`src/components/traffic-dashboard.tsx:424-464`).

6. **Null tolerance:** metrics are `number | null`; all formatters in `src/lib/format.ts` accept `number | null | undefined` and render `"—"` (em dash) for missing values. Keep the em dash as the universal null placeholder.

7. **Defensive JSON parsing:** `readError()` in `src/lib/tabapi.ts:34-40` returns `null` instead of throwing when the upstream body is not JSON.

## API & Data Fetching Conventions

**Route handlers (`src/app/api/traffic/route.ts`):**
- Declare `export const runtime = "nodejs";`
- Handler signature: `export async function GET(request: NextRequest)`
- Respond with `NextResponse.json<TypedBody>(...)`; set `Cache-Control: private, max-age=0, must-revalidate`
- Read secrets only server-side via `process.env.TABAPI_KEY`; never pass them to the client (tests enforce this — see TESTING.md)

**Upstream client (`src/lib/tabapi.ts`):**
- Dependency-inject fetch as a defaulted parameter — this is the seam tests use: `fetchImpl: typeof fetch = fetch`
- Wrap external errors in `TrafficApiError`; map unknown upstream statuses to 502
- Cache with module-level `Map` singletons (`successCache`, `inFlightRequests`), bounded by `MAX_CACHE_ENTRIES`, TTL-based expiry, plus request de-duplication via `inFlightRequests`
- Export a `clearTrafficCache()` reset function — required for test isolation

**Client components (`src/components/traffic-dashboard.tsx`):**
- Start the file with `"use client";`
- Fetch relative URLs with `encodeURIComponent`: `` fetch(`/api/traffic?domain=${encodeURIComponent(query)}`, ...) ``
- Fire-and-forget async from event handlers with `void search(domain)` (line 468)

## React Conventions

**Components:**
- Function components only — no classes, no `React.FC`
- Named exports for shared components (`export function TrafficDashboard`); default exports only where Next.js requires them (`src/app/layout.tsx`, `src/app/page.tsx`)
- Props typed inline in the signature: `function Panel({ title, badge, info, children, className = "" }: { ... })`
- Private subcomponents live in the same file above their consumer: `InfoButton`, `Panel`, `EmptyCell`, `MetricCard`, `Results` inside `src/components/traffic-dashboard.tsx`
- One page-level client component per feature; server pages stay thin (see `src/app/page.tsx` — 5 lines)
- Static lookup data defined as module constants typed with `satisfies`: `PANEL_INFO ... satisfies Record<string, PanelInfo>` (line 89)
- State updater form: `setOpen((value) => !value)`; list keys from stable domain data (`item.month`, `region.country`)

**Accessibility (non-negotiable):**
- `aria-expanded` / `aria-controls` on disclosure buttons, `role="dialog"` + `aria-modal` + `aria-labelledby` on modals, `role="alert"` for errors, `role="status"` for loading, `aria-live="polite"` on results, `sr-only` labels for inputs, `htmlFor`/`id` pairs

**Styling:**
- Tailwind CSS 4 utility classes inline; arbitrary hex values in brackets (`border-[#171710]`, `bg-[#ffdb1f]`)
- Reusable structural patterns go in `src/app/globals.css` as plain classes (`.responsive-table`, `.responsive-table-wrap`, `.loading-stripes`), with mobile stacking driven by `td[data-label]` attributes
- Design tokens as CSS variables in `:root` (`--ink`, `--paper`, `--yellow`, `--orange`, `--mint`)

## Logging

**Framework:** None. There are zero `console.*` statements in `src/`.

- Do not add logging ad hoc. Errors are surfaced via error classes/HTTP responses (server) and `role="alert"` UI (client). If logging is needed later, introduce it as a deliberate cross-cutting decision.

## Comments

**When to Comment:**
- Almost never — the codebase is essentially comment-free; rely on descriptive names (`pruneCache`, `vietnameseError`)
- Explanatory copy lives in typed data structures (e.g., `PANEL_INFO` metric explanations), not prose comments

**JSDoc/TSDoc:** Not used. Do not introduce doc-block boilerplate for simple exported functions.

## Function Design

**Size:** Small, single-purpose. The largest function is the `Results` render component (~215 lines of JSX); logic stays out of it via `src/lib/format.ts` helpers.

**Parameters:** Prefer 2–3 positional params; the upstream client takes a defaulted injectable `fetchImpl` last.

**Return Values:** Functions return typed values or throw typed errors — never return `null` to signal failure. Nullable *data* is modeled as `T | null` in types (`src/types/traffic.ts`).

## Module Design

**Exports:**
- Named exports everywhere except Next.js-mandated default exports for layouts/pages
- One responsibility per module: `src/lib/config.ts` (env parsing), `src/lib/domain.ts` (input validation), `src/lib/format.ts` (display formatting), `src/lib/tabapi.ts` (upstream client + cache)

**Barrel Files:** None. Import directly from module paths.

## Where the Conventions Live

- Lint rules: `eslint.config.mjs`
- TS strictness: `tsconfig.json`
- Next config: `next.config.ts` (`reactStrictMode: true`)
- Shared test data follows the same typing rules: `src/test/fixture.ts` is a typed `TrafficResponse` literal

---

*Convention analysis: 2026-10-13*
