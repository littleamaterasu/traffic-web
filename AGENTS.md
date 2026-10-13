<!-- GSD:project-start source:PROJECT.md -->

## Project

**Traffic Check — Traffic Intelligence Report**

A local Next.js dashboard where an invited marketing researcher enters any domain and receives one readable report explaining the site's estimated traffic, trend, acquisition channels, leading countries, referring sites, and related Google advertisers and creatives. Data comes from TabAPI estimates, presented in a Vietnamese-language interface.

**Core Value:** An invited marketing researcher enters a domain and receives one readable report that explains its estimated traffic, trend, acquisition channels, leading countries, referring sites, and related Google advertisers and creatives.

### Constraints

- **Tech stack**: Extend the existing Next.js/TypeScript app; no new heavy dependencies unless research justifies one
- **Dependencies**: Referring-sites and advertiser/creative data must come from TabAPI (or a documented viable alternative) — blocked if no such endpoint exists
- **Budget**: TabAPI bills credits per month of history returned — reuse the existing 24h cache pattern and dedup for any new endpoint
- **Security**: `TABAPI_KEY` server-side only; no secrets in the browser bundle
- **Locale**: Vietnamese user-facing strings throughout

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 6.0.3 (`typescript` in `package.json`) — all application code under `src/`; JS is disallowed (`allowJs: false` in `tsconfig.json`); `strict: true`
- CSS (Tailwind v4 syntax) — styling via `src/app/globals.css` and utility classes in components
- None. No server-side or client-side JavaScript sources exist.

## Runtime

- Node.js ≥ 22.13 (documented in `README.md`; local dev machine runs Node v25.9.0)
- Browser runtime for the client dashboard (`src/components/traffic-dashboard.tsx` is a `"use client"` component)
- npm (bundled with Node; npm 11.12.1 on dev machine)
- Lockfile: `package-lock.json` present (commit it; no `.npmrc` in repo)

## Frameworks

- Next.js 16.4.0 — App Router (`src/app/`), server API route `src/app/api/traffic/route.ts` (`export const runtime = "nodejs"`), static root page `src/app/page.tsx`
- React 19.3.0 + React DOM 19.3.0 — single client component `src/components/traffic-dashboard.tsx`
- Tailwind CSS 4.3.3 — via the PostCSS plugin `@tailwindcss/postcss` (`postcss.config.mjs`); imported with `@import "tailwindcss"` in `src/app/globals.css`; v4 inline config, no `tailwind.config` file
- Vitest 5.0.4 — runner with jsdom environment and globals enabled (`vitest.config.ts`)
- @testing-library/react 16.3.3, @testing-library/user-event 14.6.7, @testing-library/jest-dom 7.0.1 — DOM component testing
- jsdom 27.4.0 — browser-like test environment
- Next.js built-in compiler (Turbopack-era Next 16) — `npm run dev` / `npm run build`
- ESLint 9.39.5 (flat config) with `eslint-config-next` core-web-vitals + TypeScript presets (`eslint.config.mjs`)
- TypeScript type-checking via `tsconfig.json` (no separate `tsc` script; type errors surface in `next build`)

## Key Dependencies

- `next` 16.4.0 — the entire application framework (routing, API routes, build, dev server)
- `react` / `react-dom` 19.3.0 — UI runtime for the dashboard component
- None. There is no ORM, database driver, HTTP client library, state manager, or UI component library. All data fetching uses the platform-native `fetch` API (`src/lib/tabapi.ts`, `src/components/traffic-dashboard.tsx`) and URL/domain utilities from `node:net` (`src/lib/domain.ts`).

## Configuration

- `.env.local` file present — contains local environment configuration (existence noted only; never commit it; it is gitignored via `.gitignore`)
- `.env.example` file present — template copied to `.env.local` during setup
- Two server-side env vars are read in code (values are secrets — never quote them):
- No `NEXT_PUBLIC_*` variables exist; no secrets reach the browser bundle
- `next.config.ts` — `reactStrictMode: true`, `agentRules: false`, `allowedDevOrigins: ["192.168.2.12", "*.ngrok-free.app"]` (LAN phone testing and ngrok tunneling)
- `tsconfig.json` — ES2017 target, `moduleResolution: "bundler"`, strict, path alias `@/* → ./src/*`
- `eslint.config.mjs` — ESLint 9 flat config extending `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`; ignores `.next/**`, `coverage/**`
- `postcss.config.mjs` — Tailwind v4 PostCSS plugin
- `vitest.config.ts` — jsdom environment, `globals: true`, setup file `vitest.setup.ts`, `@` alias mirrors tsconfig

## Platform Requirements

- Node.js ≥ 22.13 with npm
- A TabAPI API key in `.env.local` as `TABAPI_KEY` (required for `/api/traffic` to return data; requests without it get a 500 `missing_api_key` response from `src/app/api/traffic/route.ts`)
- Optional: `ngrok` for tunneling — already whitelisted in `next.config.ts`
- Local/self-hosted Node server: `npm run build` then `npm start` (standard Next.js server). No deployment platform config detected (no Vercel/Docker/CI files in repo)
- Note: the traffic cache in `src/lib/tabapi.ts` is an in-process `Map` (24h TTL, max 100 entries) — it resets on restart and is per-instance; a single server instance is the current operating assumption

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- kebab-case for every file: `src/components/traffic-dashboard.tsx`, `src/lib/tabapi.ts`, `src/test/fixture.ts`
- Tests co-located with source, suffixed `.test.ts` / `.test.tsx`: `src/lib/config.test.ts`, `src/app/api/traffic/route.test.ts`
- Route files use the Next.js App Router reserved name `route.ts` under the URL path: `src/app/api/traffic/route.ts`
- Type definitions live in one dedicated file per domain: `src/types/traffic.ts`
- camelCase, verb-first: `normalizeDomain`, `getTrafficMonths`, `formatPercent`, `getTraffic`, `clearTrafficCache`
- Private helpers are plain module-local functions (no underscore prefix): `errorResponse`, `vietnameseError`, `pruneCache`, `readError` in `src/app/api/traffic/route.ts` and `src/lib/tabapi.ts`
- SCREAMING_SNAKE_CASE for module-level constants: `DEFAULT_TRAFFIC_MONTHS`, `MAX_CACHE_ENTRIES` (`src/lib/tabapi.ts`), `DOMAIN_LABEL` regex (`src/lib/domain.ts`), `SOURCE_LABELS`, `PANEL_INFO` (`src/components/traffic-dashboard.tsx`)
- camelCase for locals and function parameters everywhere else
- PascalCase `interface` for data shapes: `TrafficResponse`, `TrafficOverview`, `ApiErrorBody` (`src/types/traffic.ts`)
- PascalCase `type` aliases for unions/utilities: `NullableMetric`, `PanelInfo` (`src/types/traffic.ts`, `src/components/traffic-dashboard.tsx`)
- Error classes end in `Error` and set `this.name`: `DomainValidationError` (`src/lib/domain.ts`), `TrafficApiError` (`src/lib/tabapi.ts`)
- Env vars are SCREAMING_SNAKE_CASE: `TABAPI_KEY`, `TRAFFIC_MONTHS`
- All user-facing strings, error messages, and test descriptions are Vietnamese. Error *codes* are English snake_case (`invalid_domain`, `insufficient_credits`). Keep this split: code for machines, Vietnamese for humans.

## Code Style

- No Prettier config detected — formatting is by consistent manual convention
- Double quotes for strings/imports, semicolons, 2-space indent, trailing commas in multiline literals
- Numeric separators for large constants: `20_000`, `24 * 60 * 60 * 1000` (`src/components/traffic-dashboard.tsx:435`, `src/lib/tabapi.ts:4`)
- ESLint 9 flat config in `eslint.config.mjs`
- Uses `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`; global ignores: `.next/**`, `coverage/**`, `next-env.d.ts`
- Run with `npm run lint`. Do not add custom rules — rely on the Next.js presets
- `strict: true` in `tsconfig.json`; target ES2017, `moduleResolution: "bundler"`, `isolatedModules: true`
- Path alias `@/*` → `./src/*` (mirrored in `vitest.config.ts`)
- Always use `import type { ... }` for type-only imports (see `src/lib/tabapi.ts:1`, `src/components/traffic-dashboard.tsx:13`)
- Use Node built-ins with the `node:` protocol: `import { isIP } from "node:net"` (`src/lib/domain.ts:1`)

## Import Organization

- `@/*` maps to `./src/*` — use it for all cross-directory imports; use relative `./` only for same-folder test imports

## Error Handling

## API & Data Fetching Conventions

- Declare `export const runtime = "nodejs";`
- Handler signature: `export async function GET(request: NextRequest)`
- Respond with `NextResponse.json<TypedBody>(...)`; set `Cache-Control: private, max-age=0, must-revalidate`
- Read secrets only server-side via `process.env.TABAPI_KEY`; never pass them to the client (tests enforce this — see TESTING.md)
- Dependency-inject fetch as a defaulted parameter — this is the seam tests use: `fetchImpl: typeof fetch = fetch`
- Wrap external errors in `TrafficApiError`; map unknown upstream statuses to 502
- Cache with module-level `Map` singletons (`successCache`, `inFlightRequests`), bounded by `MAX_CACHE_ENTRIES`, TTL-based expiry, plus request de-duplication via `inFlightRequests`
- Export a `clearTrafficCache()` reset function — required for test isolation
- Start the file with `"use client";`
- Fetch relative URLs with `encodeURIComponent`: `` fetch(`/api/traffic?domain=${encodeURIComponent(query)}`, ...) ``
- Fire-and-forget async from event handlers with `void search(domain)` (line 468)

## React Conventions

- Function components only — no classes, no `React.FC`
- Named exports for shared components (`export function TrafficDashboard`); default exports only where Next.js requires them (`src/app/layout.tsx`, `src/app/page.tsx`)
- Props typed inline in the signature: `function Panel({ title, badge, info, children, className = "" }: { ... })`
- Private subcomponents live in the same file above their consumer: `InfoButton`, `Panel`, `EmptyCell`, `MetricCard`, `Results` inside `src/components/traffic-dashboard.tsx`
- One page-level client component per feature; server pages stay thin (see `src/app/page.tsx` — 5 lines)
- Static lookup data defined as module constants typed with `satisfies`: `PANEL_INFO ... satisfies Record<string, PanelInfo>` (line 89)
- State updater form: `setOpen((value) => !value)`; list keys from stable domain data (`item.month`, `region.country`)
- `aria-expanded` / `aria-controls` on disclosure buttons, `role="dialog"` + `aria-modal` + `aria-labelledby` on modals, `role="alert"` for errors, `role="status"` for loading, `aria-live="polite"` on results, `sr-only` labels for inputs, `htmlFor`/`id` pairs
- Tailwind CSS 4 utility classes inline; arbitrary hex values in brackets (`border-[#171710]`, `bg-[#ffdb1f]`)
- Reusable structural patterns go in `src/app/globals.css` as plain classes (`.responsive-table`, `.responsive-table-wrap`, `.loading-stripes`), with mobile stacking driven by `td[data-label]` attributes
- Design tokens as CSS variables in `:root` (`--ink`, `--paper`, `--yellow`, `--orange`, `--mint`)

## Logging

- Do not add logging ad hoc. Errors are surfaced via error classes/HTTP responses (server) and `role="alert"` UI (client). If logging is needed later, introduce it as a deliberate cross-cutting decision.

## Comments

- Almost never — the codebase is essentially comment-free; rely on descriptive names (`pruneCache`, `vietnameseError`)
- Explanatory copy lives in typed data structures (e.g., `PANEL_INFO` metric explanations), not prose comments

## Function Design

## Module Design

- Named exports everywhere except Next.js-mandated default exports for layouts/pages
- One responsibility per module: `src/lib/config.ts` (env parsing), `src/lib/domain.ts` (input validation), `src/lib/format.ts` (display formatting), `src/lib/tabapi.ts` (upstream client + cache)

## Where the Conventions Live

- Lint rules: `eslint.config.mjs`
- TS strictness: `tsconfig.json`
- Next config: `next.config.ts` (`reactStrictMode: true`)
- Shared test data follows the same typing rules: `src/test/fixture.ts` is a typed `TrafficResponse` literal

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| RootLayout | HTML shell (`lang="vi"`), metadata | `src/app/layout.tsx` |
| Home (page) | Server component; reads env config and renders dashboard | `src/app/page.tsx` |
| TrafficDashboard | Entire client UI: search form, loading/error states, results rendering | `src/components/traffic-dashboard.tsx` |
| Results / Panel / MetricCard / InfoButton | Presentational sub-components inside the dashboard file | `src/components/traffic-dashboard.tsx` |
| GET /api/traffic | Request parsing, orchestration, error-to-HTTP mapping | `src/app/api/traffic/route.ts` |
| normalizeDomain | Domain normalization + validation (URL parsing, label regex, IP/localhost rejection) | `src/lib/domain.ts` |
| getTrafficMonths | Parse/validate `TRAFFIC_MONTHS` env var (default 3, range 3–12) | `src/lib/config.ts` |
| getTraffic / fetchTrafficFromTabApi | TabAPI HTTP client, 24h in-memory success cache, in-flight request dedup | `src/lib/tabapi.ts` |
| format* functions | vi-VN / en-US number, percent, duration, currency, month formatters | `src/lib/format.ts` |
| TrafficResponse, ApiErrorBody | Shared TypeScript contract between API route and client | `src/types/traffic.ts` |
| trafficFixture | Shared test fixture of a full `TrafficResponse` | `src/test/fixture.ts` |

## Pattern Overview

- **BFF proxy:** `TABAPI_KEY` is read only in `src/app/api/traffic/route.ts:23` (server-side). The browser only ever talks to the internal `/api/traffic` endpoint — the key never reaches the client.
- **Shared type contract:** one file (`src/types/traffic.ts`) defines both the success payload (`TrafficResponse`) and error envelope (`ApiErrorBody`) used by server and client. Upstream TabAPI field names (snake_case) are passed through as-is.
- **Pure lib modules:** `src/lib/config.ts`, `src/lib/domain.ts`, `src/lib/format.ts` are pure functions with no side effects — independently unit-testable. Only `src/lib/tabapi.ts` owns side effects (network + cache).
- **No database, no state library:** caching is in-process memory (`Map` in `src/lib/tabapi.ts:12-13`); client state is local `useState` (`src/components/traffic-dashboard.tsx:419-422`).
- **Single page, single endpoint:** the whole app is one route (`/`) and one API route (`/api/traffic`).

## Layers

- Purpose: search input, request lifecycle state (loading/error/data), rendering of all report panels
- Location: `src/components/traffic-dashboard.tsx` ("use client" directive at line 1)
- Contains: `TrafficDashboard` (stateful root), `Results`, `Panel`, `MetricCard`, `InfoButton`, `EmptyCell`, plus the `PANEL_INFO` content dictionary (line 39) that drives the per-table "i" info modals
- Depends on: `src/lib/format.ts`, `src/types/traffic.ts`
- Used by: `src/app/page.tsx`
- Purpose: HTTP boundary — parse query params, validate config, delegate to service, map errors to JSON envelope with proper status codes
- Location: `src/app/api/traffic/route.ts` (`export const runtime = "nodejs"` at line 7)
- Contains: `GET` handler (line 13), `errorResponse()` helper (line 9) producing `{ error: { code, message } }`
- Depends on: `src/lib/domain.ts`, `src/lib/config.ts`, `src/lib/tabapi.ts`
- Used by: browser fetch from `src/components/traffic-dashboard.tsx:438`
- Purpose: all third-party interaction and caching
- Location: `src/lib/tabapi.ts`
- Contains: `fetchTrafficFromTabApi` (line 42, raw HTTP call with injectable `fetchImpl`), `getTraffic` (line 87, cache + dedup wrapper), `TrafficApiError` (line 15), `clearTrafficCache` (line 115)
- Depends on: `src/types/traffic.ts`
- Used by: `src/app/api/traffic/route.ts:37`
- Purpose: pure business logic and presentation helpers
- Location: `src/lib/domain.ts` (validation), `src/lib/config.ts` (env config), `src/lib/format.ts` (formatting)
- Contains: `normalizeDomain` + `DomainValidationError`; `getTrafficMonths` + min/max/default constants; seven `format*` functions with module-level `Intl` formatters
- Depends on: `node:net` (only in `domain.ts`)
- Used by: API layer and UI layer
- Purpose: the single contract between all layers
- Location: `src/types/traffic.ts`
- Contains: `TrafficResponse` and its nested shapes (`TrafficOverview`, `MonthlyVisit`, `TrafficSources`, `TopKeyword`, `TopRegion`, `AiTraffic`), `ApiErrorBody`

## Data Flow

### Primary Request Path

### Error Path

- Client: four `useState` hooks (`domain`, `data`, `error`, `loading`) in `TrafficDashboard` — `src/components/traffic-dashboard.tsx:419-422`. No context, no reducer, no external store.
- Server: two module-level `Map`s — `successCache` and `inFlightRequests` — `src/lib/tabapi.ts:12-13`. In-process only; cleared on server restart (also exposes `clearTrafficCache()` for tests).

## Key Abstractions

- Purpose: the full traffic report payload, mirroring upstream TabAPI JSON (snake_case fields)
- Location: `src/types/traffic.ts:66-76` (plus nested types lines 1-64)
- Pattern: pass-through DTO — server does not reshape upstream data; nullable metrics use `NullableMetric = number | null` and the UI renders "—" for null
- Purpose: uniform error shape `{ error: { code, message } }` for every non-2xx response
- Location: `src/types/traffic.ts:78-83`; produced by `errorResponse()` in `src/app/api/traffic/route.ts:9`
- Pattern: typed error codes (`invalid_domain`, `missing_api_key`, `invalid_configuration`, plus passthrough TabAPI codes like `insufficient_credits`)
- `DomainValidationError` — `src/lib/domain.ts:5-10`
- `TrafficApiError` — `src/lib/tabapi.ts:15-24` (carries `status` + `code`)
- Pattern: throw typed errors from lib modules; catch at the route boundary and convert to HTTP responses
- Purpose: test seam — both `fetchTrafficFromTabApi` and `getTraffic` accept `fetchImpl: typeof fetch = fetch` (`src/lib/tabapi.ts:46, 91`)
- Pattern: dependency injection via default parameter, used by `src/app/api/traffic/route.test.ts` and `src/lib/tabapi.test.ts`
- Purpose: declarative per-table explanation content for the "i" info modals
- Location: `src/components/traffic-dashboard.tsx:33-89` (`PANEL_INFO` satisfies `Record<string, PanelInfo>`)
- Pattern: content-as-data; add a new entry to expose a new panel's info dialog

## Entry Points

- Location: `src/app/page.tsx`
- Triggers: browser navigation to `/`
- Responsibilities: server component; calls `getTrafficMonths()` (env read happens server-side) and renders `<TrafficDashboard trafficMonths={...} />`
- Location: `src/app/api/traffic/route.ts`
- Triggers: `GET /api/traffic?domain=<domain-or-url>` from the dashboard
- Responsibilities: validation, config, proxying TabAPI, cache, error mapping
- Location: `src/app/layout.tsx`
- Responsibilities: `<html lang="vi">`, metadata (title/description), imports `src/app/globals.css`

## Architectural Constraints

- **Threading/runtime:** API route pinned to Node.js runtime (`export const runtime = "nodejs"` — `src/app/api/traffic/route.ts:7`); required because `src/lib/domain.ts:1` imports `node:net`.
- **Global state:** module-level mutable caches `successCache` / `inFlightRequests` in `src/lib/tabapi.ts:12-13`. Singletons per process — cache is lost on restart and not shared across instances. In dev, Next.js hot reload can re-instantiate these modules, resetting the cache.
- **Env-var coupling:** `TRAFFIC_MONTHS` is read at request time by `src/lib/config.ts:5` (with default in both `page.tsx` and the API route) and by the client only as a display value (`trafficMonths` prop, `src/components/traffic-dashboard.tsx:418`). `TABAPI_KEY` must exist only server-side.
- **No persistence layer:** everything is in-memory. Restarting the server clears the cache; nothing is stored.
- **Single-locale UI:** all user-facing strings are Vietnamese; formatters use `vi-VN` locale (`src/lib/format.ts`); `<html lang="vi">` in `src/app/layout.tsx:11`.
- **Path alias:** `@/*` → `./src/*` configured in `tsconfig.json:17-19` and mirrored for tests in `vitest.config.ts:14-16`.
- **Design system:** brutalist theme — CSS variables in `src/app/globals.css:3-9` (`--ink`, `--paper`, `--yellow`, `--orange`, `--mint`) but Tailwind arbitrary hex values used inline throughout `traffic-dashboard.tsx`; Tailwind v4 via `@import "tailwindcss"` (`src/app/globals.css:1`) with PostCSS plugin (`postcss.config.mjs`). Responsive tables implemented with `data-label` attributes + CSS (`src/app/globals.css:67-125`).

## Anti-Patterns

### Monolithic client component

### Duplicated color values (design tokens not enforced)

### Cache not keyed by API key or data version

## Error Handling

- Throw typed error classes (`DomainValidationError`, `TrafficApiError`) from `src/lib/` — never return null sentinels
- Convert to HTTP at exactly one place: `errorResponse()` + catch blocks in `src/app/api/traffic/route.ts:9-48`
- Vietnamese user-facing messages centralized in `vietnameseError()` — `src/lib/tabapi.ts:26-32` — and error literals in `src/lib/domain.ts`
- Client treats every non-OK response as an error with server-supplied message — `src/components/traffic-dashboard.tsx:446-448`; network/timeout handled via `AbortController` (line 434-435, 453-459)
- Upstream status allow-list `[400, 402, 422, 502]` passes through; everything else collapses to 502 — `src/lib/tabapi.ts:68`
- Defensive JSON parsing of upstream error bodies — `readError()` in `src/lib/tabapi.ts:34-40`

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
