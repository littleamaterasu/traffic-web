<!-- refreshed: 2026-10-13 -->
# Architecture

**Analysis Date:** 2026-10-13

## System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                      Browser (Client)                            │
│   `src/components/traffic-dashboard.tsx`  ("use client")         │
│   Search form → fetch → useState(data) → Results panels          │
└────────────────────────────┬────────────────────────────────────┘
                             │  GET /api/traffic?domain=...
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Layer (Route Handler)                     │
│   `src/app/api/traffic/route.ts`  (Node.js runtime)              │
│   validate domain → read config → call service → map errors      │
└────────┬───────────────────┬────────────────────┬───────────────┘
         │                   │                    │
         ▼                   ▼                    ▼
┌──────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│ `src/lib/domain` │ │ `src/lib/config`│ │ `src/lib/tabapi`    │
│ normalize +      │ │ env parsing     │ │ TabAPI client +     │
│ validate domain  │ │ TRAFFIC_MONTHS  │ │ in-memory cache +   │
│                  │ │ (3–12)          │ │ in-flight dedup     │
└──────────────────┘ └─────────────────┘ └──────────┬──────────┘
                                                    │ Bearer TABAPI_KEY
                                                    ▼
                                       ┌─────────────────────────┐
                                       │  TabAPI (external SaaS) │
                                       │  tabapi.com/api/v1      │
                                       └─────────────────────────┘

        Shared contract (used by both client and server):
        `src/types/traffic.ts`  →  TrafficResponse | ApiErrorBody
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

**Overall:** Layered full-stack Next.js App Router app (Backend-For-Frontend proxy pattern) — a single client page calls sibling server API routes (traffic, ads, seranking), which proxy third-party APIs to keep API keys server-side.

**Key Characteristics:**
- **BFF proxy:** `TABAPI_KEY` is read only in `src/app/api/traffic/route.ts:23` (server-side); `SERPAPI_KEY` only in the two `/api/ads*` routes; `SE_RANKING_API_KEY` only in the three `/api/seranking/*` routes. The browser only talks to internal endpoints — no key reaches the client.
- **Shared type contract:** one file (`src/types/traffic.ts`) defines both the success payload (`TrafficResponse`) and error envelope (`ApiErrorBody`) used by server and client. Upstream TabAPI field names (snake_case) are passed through as-is.
- **Pure lib modules:** `src/lib/config.ts`, `src/lib/domain.ts`, `src/lib/format.ts` are pure functions with no side effects — independently unit-testable. The API client modules `src/lib/tabapi.ts`, `src/lib/ads-transparency.ts` and `src/lib/seranking.ts` own side effects (network + cache).
- **No database, no state library:** caching is in-process memory via the shared `createCachedStore<T>()` factory in `src/lib/cached-store.ts` (used by `tabapi.ts`, `ads-transparency.ts`, `seranking.ts`); client state is local `useState` (`src/components/traffic-dashboard.tsx:419-422`).
- **Single page, several BFF endpoints:** the whole app is one page route (`/`) and these API routes: `/api/traffic` (TabAPI, auto-fetched on search), `/api/ads` and `/api/ads/detail` (SerpAPI Transparency, click-to-load), `/api/seranking/ads`, `/api/seranking/competitors`, `/api/seranking/backlinks` (SE Ranking, click-to-load).

## Layers

**UI Layer (Client):**
- Purpose: search input, request lifecycle state (loading/error/data), rendering of all report panels
- Location: `src/components/traffic-dashboard.tsx` ("use client" directive at line 1)
- Contains: `TrafficDashboard` (stateful root), `Results`, `Panel`, `MetricCard`, `InfoButton`, `EmptyCell`, plus the `PANEL_INFO` content dictionary (line 39) that drives the per-table "i" info modals
- Depends on: `src/lib/format.ts`, `src/types/traffic.ts`
- Used by: `src/app/page.tsx`

**API Layer (Route Handler):**
- Purpose: HTTP boundary — parse query params, validate config, delegate to service, map errors to JSON envelope with proper status codes
- Location: `src/app/api/traffic/route.ts` (`export const runtime = "nodejs"` at line 7)
- Contains: `GET` handler (line 13), `errorResponse()` helper (line 9) producing `{ error: { code, message } }`
- Depends on: `src/lib/domain.ts`, `src/lib/config.ts`, `src/lib/tabapi.ts`
- Used by: browser fetch from `src/components/traffic-dashboard.tsx:438`

**Service/Integration Layer:**
- Purpose: all third-party interaction and caching
- Location: `src/lib/tabapi.ts`
- Contains: `fetchTrafficFromTabApi` (line 42, raw HTTP call with injectable `fetchImpl`), `getTraffic` (line 87, cache + dedup wrapper), `TrafficApiError` (line 15), `clearTrafficCache` (line 115)
- Depends on: `src/types/traffic.ts`
- Used by: `src/app/api/traffic/route.ts:37`

**Domain/Utility Layer:**
- Purpose: pure business logic and presentation helpers
- Location: `src/lib/domain.ts` (validation), `src/lib/config.ts` (env config), `src/lib/format.ts` (formatting)
- Contains: `normalizeDomain` + `DomainValidationError`; `getTrafficMonths` + min/max/default constants; seven `format*` functions with module-level `Intl` formatters
- Depends on: `node:net` (only in `domain.ts`)
- Used by: API layer and UI layer

**Types Layer:**
- Purpose: the single contract between all layers
- Location: `src/types/traffic.ts`
- Contains: `TrafficResponse` and its nested shapes (`TrafficOverview`, `MonthlyVisit`, `TrafficSources`, `TopKeyword`, `TopRegion`, `AiTraffic`), `ApiErrorBody`

## Data Flow

### Primary Request Path

1. User submits the domain form — `handleSubmit` at `src/components/traffic-dashboard.tsx:466` calls `search()` (line 424)
2. Client fetches internal API with 20s `AbortController` timeout — `src/components/traffic-dashboard.tsx:434-443` (`fetch("/api/traffic?domain=...")` at line 438)
3. Route handler `GET` starts — `src/app/api/traffic/route.ts:13`
4. Domain normalized/validated — `normalizeDomain` at `src/lib/domain.ts:12`; failure throws `DomainValidationError` → 400 `invalid_domain` (`route.ts:18-21`)
5. API key read from `process.env.TABAPI_KEY` — `route.ts:23-26`; missing → 500 `missing_api_key`
6. `TRAFFIC_MONTHS` parsed by `getTrafficMonths` — `src/lib/config.ts:5`; invalid → 500 `invalid_configuration` (`route.ts:28-34`)
7. Cache-aware service call — `getTraffic` in `src/lib/tabapi.ts` via `trafficStore.get()`: cache key `"{domain}:{months}"`; hit → return cached; miss → in-flight dedup inside `createCachedStore`, then call `fetchTrafficFromTabApi`
8. Upstream HTTP call — `GET https://tabapi.com/api/v1/domains/{domain}/traffic?months=N` with `Authorization: Bearer` header, `cache: "no-store"` — `src/lib/tabapi.ts:51-60`
9. Success cached for 24h (store default TTL, max 100 entries with prune/eviction) — `src/lib/cached-store.ts`
10. JSON `TrafficResponse` returned to client with `Cache-Control: private, max-age=0, must-revalidate` — `src/app/api/traffic/route.ts:38-42`
11. Client parses body as `TrafficResponse | ApiErrorBody` — `src/components/traffic-dashboard.tsx:444-450`; success sets `data` state, rendered by `<Results data={...} />` (line 562)

### Error Path

1. `TrafficApiError` thrown from `src/lib/tabapi.ts` (network failure → 502 `network_error` at line 62; upstream non-OK → status mapped via `vietnameseError` at line 26)
2. Route handler catches and re-maps to JSON envelope — `src/app/api/traffic/route.ts:43-48`; unknown errors → 502 `unexpected_error`
3. Client throws on `!response.ok` using `body.error.message` — `src/components/traffic-dashboard.tsx:446-448` — and renders the error banner (line 536-541); `AbortError` gets a dedicated timeout message (line 454-455)

**State Management:**
- Client: four `useState` hooks (`domain`, `data`, `error`, `loading`) in `TrafficDashboard` — `src/components/traffic-dashboard.tsx:419-422`. No context, no reducer, no external store.
- Server: module-level `createCachedStore` instances (`trafficStore` in `src/lib/tabapi.ts`, two in `src/lib/ads-transparency.ts`, three in `src/lib/seranking.ts`), each with its own success cache and in-flight map. In-process only; cleared on server restart (`clearTrafficCache()`, `clearAdsCache()`, `clearSeRankingCache()` for tests).

## Key Abstractions

**`TrafficResponse` (shared contract):**
- Purpose: the full traffic report payload, mirroring upstream TabAPI JSON (snake_case fields)
- Location: `src/types/traffic.ts:66-76` (plus nested types lines 1-64)
- Pattern: pass-through DTO — server does not reshape upstream data; nullable metrics use `NullableMetric = number | null` and the UI renders "—" for null

**`ApiErrorBody` (error envelope):**
- Purpose: uniform error shape `{ error: { code, message } }` for every non-2xx response
- Location: `src/types/traffic.ts:78-83`; produced by `errorResponse()` in `src/app/api/traffic/route.ts:9`
- Pattern: typed error codes (`invalid_domain`, `missing_api_key`, `invalid_configuration`, plus passthrough TabAPI codes like `insufficient_credits`)

**Typed error classes:**
- `DomainValidationError` — `src/lib/domain.ts:5-10`
- `TrafficApiError` — `src/lib/tabapi.ts:15-24` (carries `status` + `code`)
- Pattern: throw typed errors from lib modules; catch at the route boundary and convert to HTTP responses

**Injectable `fetchImpl`:**
- Purpose: test seam — both `fetchTrafficFromTabApi` and `getTraffic` accept `fetchImpl: typeof fetch = fetch` (`src/lib/tabapi.ts:46, 91`)
- Pattern: dependency injection via default parameter, used by `src/app/api/traffic/route.test.ts` and `src/lib/tabapi.test.ts`

**`PanelInfo` content model:**
- Purpose: declarative per-table explanation content for the "i" info modals
- Location: `src/components/traffic-dashboard.tsx:33-89` (`PANEL_INFO` satisfies `Record<string, PanelInfo>`)
- Pattern: content-as-data; add a new entry to expose a new panel's info dialog

## Entry Points

**Home page:**
- Location: `src/app/page.tsx`
- Triggers: browser navigation to `/`
- Responsibilities: server component; calls `getTrafficMonths()` (env read happens server-side) and renders `<TrafficDashboard trafficMonths={...} />`

**API endpoint:**
- Location: `src/app/api/traffic/route.ts`
- Triggers: `GET /api/traffic?domain=<domain-or-url>` from the dashboard
- Responsibilities: validation, config, proxying TabAPI, cache, error mapping
- Sibling BFF routes: `src/app/api/ads/route.ts`, `src/app/api/ads/detail/route.ts` (SerpAPI, `SERPAPI_KEY`), `src/app/api/seranking/{ads,competitors,backlinks}/route.ts` (SE Ranking, `SE_RANKING_API_KEY`); all triggered by buttons in `AdsPanel` / `SerankingPanel`, not by the search itself

**Root layout:**
- Location: `src/app/layout.tsx`
- Responsibilities: `<html lang="vi">`, metadata (title/description), imports `src/app/globals.css`

**CLI scripts** (via `package.json:6-14`): `npm run dev` (dev server), `dev:lan` (LAN-exposed dev), `build`, `start`, `lint`, `test`, `test:watch`.

## Architectural Constraints

- **Threading/runtime:** API route pinned to Node.js runtime (`export const runtime = "nodejs"` — `src/app/api/traffic/route.ts:7`); required because `src/lib/domain.ts:1` imports `node:net`.
- **Global state:** module-level cached stores (`createCachedStore`) in `src/lib/tabapi.ts`, `src/lib/ads-transparency.ts`, `src/lib/seranking.ts`. Singletons per process — cache is lost on restart and not shared across instances. In dev, Next.js hot reload can re-instantiate these modules, resetting the cache.
- **Env-var coupling:** `TRAFFIC_MONTHS` is read at request time by `src/lib/config.ts:5` (with default in both `page.tsx` and the API route) and by the client only as a display value (`trafficMonths` prop, `src/components/traffic-dashboard.tsx:418`). `TABAPI_KEY` must exist only server-side.
- **No persistence layer:** everything is in-memory. Restarting the server clears the cache; nothing is stored.
- **Single-locale UI:** all user-facing strings are Vietnamese; formatters use `vi-VN` locale (`src/lib/format.ts`); `<html lang="vi">` in `src/app/layout.tsx:11`.
- **Path alias:** `@/*` → `./src/*` configured in `tsconfig.json:17-19` and mirrored for tests in `vitest.config.ts:14-16`.
- **Design system:** brutalist theme — CSS variables in `src/app/globals.css:3-9` (`--ink`, `--paper`, `--yellow`, `--orange`, `--mint`) but Tailwind arbitrary hex values used inline throughout `traffic-dashboard.tsx`; Tailwind v4 via `@import "tailwindcss"` (`src/app/globals.css:1`) with PostCSS plugin (`postcss.config.mjs`). Responsive tables implemented with `data-label` attributes + CSS (`src/app/globals.css:67-125`).

## Anti-Patterns

### Monolithic client component

**What happens:** the entire UI — form, state machine, six panels, tables, modal, presentational sub-components — lives in one 571-line file (`src/components/traffic-dashboard.tsx`).
**Why it's wrong:** every panel addition grows the file; only `TrafficDashboard` is exported, so sub-components (`Panel`, `MetricCard`, `InfoButton`) can't be reused or tested in isolation.
**Do this instead:** when adding UI, either extend the existing file following its internal structure (private function components + `PANEL_INFO` entry) or extract genuinely reusable pieces into new files in `src/components/` with co-located `.test.tsx`.

### Duplicated color values (design tokens not enforced)

**What happens:** theme colors are defined as CSS variables in `src/app/globals.css:3-9` but components hardcode the same hex values as Tailwind arbitrary classes (e.g. `bg-[#ffdb1f]`, `border-[#171710]` throughout `src/components/traffic-dashboard.tsx`).
**Why it's wrong:** changing the palette requires editing both the CSS variables and dozens of inline class names.
**Do this instead:** keep using the existing arbitrary-value style for consistency within this codebase, or (if restyling) map the CSS variables into a Tailwind v4 `@theme` block in `src/app/globals.css` and replace hex classes with token classes.

### Cache not keyed by API key or data version

**What happens:** cache key is `"{domain}:{months}"` (`src/lib/tabapi.ts:94`); entries live 24h in-process.
**Why it's wrong:** swapping `TABAPI_KEY` or changing response shape won't invalidate stale entries until restart.
**Do this instead:** for a single-user local tool this is acceptable; if it becomes multi-user, key by more dimensions or move to a shared store (see `clearTrafficCache()` for the existing reset seam).

## Error Handling

**Strategy:** typed errors thrown from lib modules → caught and converted at the API boundary into a uniform JSON envelope; client unwraps the envelope into human-readable Vietnamese messages.

**Patterns:**
- Throw typed error classes (`DomainValidationError`, `TrafficApiError`) from `src/lib/` — never return null sentinels
- Convert to HTTP at exactly one place: `errorResponse()` + catch blocks in `src/app/api/traffic/route.ts:9-48`
- Vietnamese user-facing messages centralized in `vietnameseError()` — `src/lib/tabapi.ts:26-32` — and error literals in `src/lib/domain.ts`
- Client treats every non-OK response as an error with server-supplied message — `src/components/traffic-dashboard.tsx:446-448`; network/timeout handled via `AbortController` (line 434-435, 453-459)
- Upstream status allow-list `[400, 402, 422, 502]` passes through; everything else collapses to 502 — `src/lib/tabapi.ts:68`
- Defensive JSON parsing of upstream error bodies — `readError()` in `src/lib/tabapi.ts:34-40`

## Cross-Cutting Concerns

**Logging:** none — no logger, no `console.*` in source. Silent failure with typed errors.
**Validation:** domain validation in `src/lib/domain.ts` (URL parse + label regex + IP/localhost rejection); env config validation in `src/lib/config.ts`. No schema-validation library.
**Authentication:** none for users (local tool). Bearer-token auth to TabAPI only, server-side (`src/lib/tabapi.ts:56`).
**Caching:** 24h in-memory success cache + in-flight request deduplication via `createCachedStore` (`src/lib/cached-store.ts`); HTTP response marked `private, max-age=0, must-revalidate` (`src/app/api/traffic/route.ts:40`).
**Accessibility:** modal semantics (`role="dialog"`, `aria-modal`, `aria-labelledby`), `aria-live="polite"` results, Escape-to-close, focus outlines — `src/components/traffic-dashboard.tsx:91-158, 215` and `src/app/globals.css:39-43`.

---

*Architecture analysis: 2026-10-13*
