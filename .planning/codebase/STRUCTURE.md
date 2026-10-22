# Codebase Structure

**Analysis Date:** 2026-10-13

## Directory Layout

```text
traffic-web/
├── .next/                       # Next.js build output (generated, gitignored)
├── .planning/                   # GSD planning documents
│   └── codebase/                # Codebase map docs (this file, ARCHITECTURE.md, ...)
├── node_modules/                # Dependencies (generated, gitignored)
├── src/
│   ├── app/                     # Next.js App Router (pages + API)
│   │   ├── api/
│   │   │   ├── traffic/
│   │   │   │   ├── route.ts     # GET /api/traffic — TabAPI proxy endpoint
│   │   │   │   └── route.test.ts
│   │   │   ├── ads/
│   │   │   │   ├── route.ts     # GET /api/ads — SerpAPI ads proxy endpoint
│   │   │   │   └── detail/
│   │   │   │       └── route.ts # GET /api/ads/detail — SerpAPI ad-detail proxy
│   │   │   └── seranking/
│   │   │       ├── route.ts     # GET /api/seranking — SE Ranking 3-slice envelope (never calls backlinks)
│   │   │       ├── route.test.ts
│   │   │       └── backlinks/
│   │   │           ├── route.ts     # GET /api/seranking/backlinks — on-demand ~100-credit backlinks summary
│   │   │           └── route.test.ts
│   │   ├── globals.css          # Tailwind v4 import + brutalist theme + responsive tables
│   │   ├── layout.tsx           # Root layout (<html lang="vi">, metadata)
│   │   └── page.tsx             # Home page (server component → TrafficDashboard)
│   ├── components/              # Client components
│   │   ├── traffic-dashboard.tsx    # Entire dashboard UI ("use client", 571 lines)
│   │   └── traffic-dashboard.test.tsx
│   ├── lib/                     # Pure logic modules (side-effect-free except tabapi)
│   │   ├── config.ts            # TRAFFIC_MONTHS env parsing (default 3, range 3–12)
│   │   ├── config.test.ts
│   │   ├── domain.ts            # Domain normalization + validation
│   │   ├── domain.test.ts
│   │   ├── format.ts            # vi-VN/en-US number, %, duration, currency, month formatters
│   │   ├── format.test.ts
│   │   ├── tabapi.ts            # TabAPI HTTP client + 24h in-memory cache + dedup
│   │   └── tabapi.test.ts
│   ├── test/
│   │   └── fixture.ts           # Shared TrafficResponse fixture for tests
│   └── types/
│       └── traffic.ts           # Shared API contracts (TrafficResponse, ApiErrorBody)
├── .env.example                 # Env template (TABAPI_KEY, TRAFFIC_MONTHS)
├── .env.local                   # Local env file (gitignored — contains API key; never commit)
├── .gitignore
├── eslint.config.mjs            # ESLint 9 flat config (next core-web-vitals + typescript)
├── next-env.d.ts                # Next.js type declarations (gitignored, generated)
├── next.config.ts               # Strict mode, allowed dev origins (LAN + ngrok)
├── package.json                 # Scripts: dev, dev:lan, build, start, lint, test, test:watch
├── package-lock.json
├── postcss.config.mjs           # @tailwindcss/postcss plugin
├── README.md                    # Vietnamese project docs
├── tsconfig.json                # Strict TS, bundler resolution, @/* → ./src/* alias
├── vitest.config.ts             # jsdom environment, @ alias, setup file
└── vitest.setup.ts              # Loads @testing-library/jest-dom/vitest
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router — file-based routing for pages and API route handlers
- Contains: `layout.tsx`, `page.tsx`, `globals.css`, and `api/{traffic,ads,seranking}/route.ts`
- Key files: `src/app/page.tsx` (only page), `src/app/api/traffic/route.ts`, `src/app/api/ads/route.ts` (+ `detail/`), `src/app/api/seranking/route.ts` (+ `backlinks/`) — sibling BFF endpoints

**`src/components/`:**
- Purpose: client-side React components
- Contains: one component module `traffic-dashboard.tsx` ("use client") with internal private components (`Results`, `Panel`, `MetricCard`, `InfoButton`, `EmptyCell`) plus its test
- Key files: `src/components/traffic-dashboard.tsx`

**`src/lib/`:**
- Purpose: framework-agnostic logic modules — one concern per file, co-located tests
- Contains: `config.ts` (env config), `domain.ts` (validation), `format.ts` (formatting), `tabapi.ts` (external API client + cache)
- Key files: `src/lib/tabapi.ts` is the only module with side effects (network, module-level caches)

**`src/types/`:**
- Purpose: shared TypeScript contracts between server and client layers
- Contains: `src/types/traffic.ts` — `TrafficResponse`, `ApiErrorBody`, and nested shapes

**`src/test/`:**
- Purpose: cross-module test support (fixtures)
- Contains: `src/test/fixture.ts` — a complete `TrafficResponse` used by multiple test files

**`.planning/`:**
- Purpose: GSD workflow documents (PROJECT, ROADMAP, codebase maps)
- Generated: No — maintained by GSD tooling

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: root layout — `<html lang="vi">`, metadata, global CSS import
- `src/app/page.tsx`: home page — server component rendering `<TrafficDashboard trafficMonths={getTrafficMonths()} />`
- `src/app/api/traffic/route.ts`: `GET /api/traffic?domain=...` — TabAPI BFF endpoint; siblings `src/app/api/ads/route.ts` (SerpAPI) and `src/app/api/seranking/route.ts` + `src/app/api/seranking/backlinks/route.ts` (SE Ranking; backlinks is the only route touching `/backlinks/summary`)
- `package.json:6-14`: CLI scripts (`dev`, `build`, `start`, `lint`, `test`)

**Configuration:**
- `next.config.ts`: `reactStrictMode`, `allowedDevOrigins` (LAN IP + `*.ngrok-free.app`)
- `tsconfig.json`: strict mode, `moduleResolution: "bundler"`, path alias `@/*` → `./src/*`
- `eslint.config.mjs`: flat config with `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
- `vitest.config.ts` + `vitest.setup.ts`: jsdom, globals, `@` alias, jest-dom matchers
- `postcss.config.mjs`: Tailwind v4 PostCSS plugin
- `.env.example`: template documenting `TABAPI_KEY` (required) and `TRAFFIC_MONTHS` (optional, 3–12, default 3)
- `.env.local`: local secrets (gitignored; presence noted only — never read or commit)

**Core Logic:**
- `src/lib/tabapi.ts`: TabAPI client (`fetchTrafficFromTabApi` line 42), cache wrapper (`getTraffic` line 87), `TrafficApiError` (line 15)
- `src/lib/domain.ts`: `normalizeDomain` (line 12), `DomainValidationError` (line 5)
- `src/lib/config.ts`: `getTrafficMonths` (line 5) with `DEFAULT_/MIN_/MAX_TRAFFIC_MONTHS` constants (lines 1-3)
- `src/lib/format.ts`: seven `format*` helpers with module-level `Intl` formatters
- `src/components/traffic-dashboard.tsx`: all UI — state + form (line 418), results panels (`Results` line 202), info-content dictionary (`PANEL_INFO` line 39)

**Testing:**
- `src/app/api/traffic/route.test.ts`: API route integration test
- `src/components/traffic-dashboard.test.tsx`: component test
- `src/lib/*.test.ts`: unit tests for each lib module (config, domain, format, tabapi)
- `src/test/fixture.ts`: shared `trafficFixture` (full `TrafficResponse` for `vercel.com`)

## Naming Conventions

**Files:**
- kebab-case for components: `traffic-dashboard.tsx`, `traffic-dashboard.test.tsx`
- single-word concern names for lib modules: `config.ts`, `domain.ts`, `format.ts`, `tabapi.ts`
- tests co-located next to source with `.test` suffix: `route.ts` → `route.test.ts`

**Directories:**
- lowercase, no nesting beyond one level of grouping: `app/api/traffic/`, `lib/`, `types/`, `test/`
- API routes mirror URL path segments: `src/app/api/traffic/route.ts` serves `/api/traffic`

**Code symbols:**
- Components: PascalCase exports (`TrafficDashboard`, `Panel`, `MetricCard`, `InfoButton`)
- Functions/variables: camelCase (`normalizeDomain`, `getTraffic`, `successCache`)
- Constants: SCREAMING_SNAKE_CASE (`DEFAULT_TRAFFIC_MONTHS`, `TABAPI_BASE_URL`, `CACHE_TTL_MS`, `PANEL_INFO`)
- Types/interfaces: PascalCase (`TrafficResponse`, `ApiErrorBody`, `PanelInfo`)
- API payload fields: snake_case, mirroring upstream TabAPI JSON (`traffic_sources`, `top_keywords`, `monthly_visits`) — keep this convention in `src/types/traffic.ts`

## Where to Add New Code

**New page:**
- Create `src/app/<route>/page.tsx` (server component by default; add `"use client"` only when the page itself needs interactivity)
- Shared layout changes go in `src/app/layout.tsx`
- Metadata per page via `export const metadata` following `src/app/layout.tsx:4-7`

**New API endpoint:**
- Create `src/app/api/<name>/route.ts` (kebab-case folder name = URL path)
- Copy the error-envelope pattern: reuse `ApiErrorBody` from `src/types/traffic.ts`, build responses with a local `errorResponse(status, code, message)` helper like `src/app/api/traffic/route.ts:9-11`
- Set `export const runtime = "nodejs"` if you import Node built-ins (see `route.ts:7`)
- Read secrets only here (e.g. `process.env.TABAPI_KEY` pattern at `route.ts:23`)
- Test in `src/app/api/<name>/route.test.ts` with an injected/mock fetch

**New client component:**
- Small/private: add a private function component inside `src/components/traffic-dashboard.tsx` (the existing pattern — see `Panel` at line 160, `MetricCard` at line 193) and, if it's a data panel, add a `PanelInfo` entry to `PANEL_INFO` (line 39) and wire it via `<Panel info={...}>`
- Reusable/shared: create `src/components/<kebab-name>.tsx`, export PascalCase, add co-located `<kebab-name>.test.tsx`
- New panel inside the existing dashboard: follow `Results` in `src/components/traffic-dashboard.tsx:202-416` — use `Panel`, `EmptyCell`, and the `format*` helpers from `src/lib/format.ts`; use `data-label` attributes on `<td>` for mobile table stacking (see `src/app/globals.css:110-119`)

**New lib module (business logic/utilities):**
- Create `src/lib/<concern>.ts` — pure functions, no React, no Next imports
- Keep modules single-concern (one file per concern: config, domain, format, tabapi)
- Side effects (network, caches) belong only in dedicated integration modules like `src/lib/tabapi.ts`; accept `fetchImpl: typeof fetch = fetch` as a parameter for testability
- Add co-located `src/lib/<concern>.test.ts`

**New shared type / API contract:**
- Domain-specific contracts: `src/types/<domain>.ts` (mirror the existing `traffic.ts` style — snake_case fields for upstream payloads, `NullableMetric` for optional numbers)
- Exported from one place and imported via `@/types/...`

**New test fixture:**
- Add `src/test/<name>.ts` next to `src/test/fixture.ts`, typed against the relevant `src/types/` interface

**New env variable:**
- Add to `.env.example` with a comment; read it through a validating accessor in `src/lib/config.ts` (follow `getTrafficMonths` at `src/lib/config.ts:5-23` — parse, validate range, throw with Vietnamese message); never read `process.env` directly in components

**Utilities:**
- Shared helpers: `src/lib/` (formatting → extend `src/lib/format.ts` with a module-level `Intl` formatter + null-safe `format*` function returning `"—"`)

## Special Directories

**`.next/`:**
- Purpose: Next.js build artifacts and generated types
- Generated: Yes — do not edit
- Committed: No (gitignored)

**`node_modules/`:**
- Purpose: installed dependencies (npm)
- Generated: Yes — `npm install`
- Committed: No (gitignored; `package-lock.json` is committed)

**`.planning/`:**
- Purpose: GSD planning state, roadmap, phase plans, and these codebase maps
- Generated: by GSD tooling
- Committed: Yes

**`.env.local` / `.env.example`:**
- Purpose: environment configuration (`TABAPI_KEY`, `TRAFFIC_MONTHS`)
- Generated: No — `.env.local` is copied from `.env.example` per README
- Committed: `.env.local` is gitignored (`.gitignore` rule `.env*` with `!.env.example` exception); `.env.example` is committed

---

*Structure analysis: 2026-10-13*
