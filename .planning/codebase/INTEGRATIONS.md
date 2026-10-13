# External Integrations

**Analysis Date:** 2026-10-13

## APIs & External Services

**Website traffic intelligence (the only external service):**
- TabAPI — third-party API providing estimated website traffic metrics (visits, ranks, sources, keywords, regions, AI referrals)
  - Base URL: `https://tabapi.com/api/v1` (hardcoded constant `TABAPI_BASE_URL` in `src/lib/tabapi.ts:3`)
  - Endpoint used: `GET /domains/{domain}/traffic?months={3..12}` (`src/lib/tabapi.ts:52`)
  - SDK/Client: none — plain `fetch` with `cache: "no-store"` (`fetchTrafficFromTabApi` in `src/lib/tabapi.ts`)
  - Auth: Bearer token — `Authorization: Bearer ${apiKey}` where `apiKey` comes from `process.env.TABAPI_KEY` (read exclusively in `src/app/api/traffic/route.ts:23`; never exposed to the browser)
  - Billing model: credits are consumed per request, proportional to months returned (3–12); this motivates the caching layer below
  - Error handling: `TrafficApiError` (status, code, Vietnamese user-facing message) — status codes 400 / 402 (insufficient credits) / 422 (not enough data) / 502 are recognized; all others normalize to 502 (`src/lib/tabapi.ts:26-32,65-70`)
- Internal REST route `/api/traffic?domain={query}` — `GET` handler in `src/app/api/traffic/route.ts` (Next.js App Router, `runtime = "nodejs"`); normalizes the domain (`src/lib/domain.ts`), injects the API key, and returns either `TrafficResponse` or `ApiErrorBody` (`src/types/traffic.ts`)
  - Client consumer: `TrafficDashboard.search()` in `src/components/traffic-dashboard.tsx:424-464` — `fetch` with 20-second `AbortController` timeout and `ngrok-skip-browser-warning: true` header (for tunnel usage)

## Data Storage

**Databases:**
- None. No database, ORM, or persistence layer exists anywhere in the codebase.

**File Storage:**
- None. Local filesystem only for Next.js internals; no file upload/read logic.

**Caching:**
- In-process memory cache in `src/lib/tabapi.ts`:
  - `successCache: Map<string, CacheEntry>` keyed by `"{domain}:{months}"`, TTL 24h (`CACHE_TTL_MS`), max 100 entries with FIFO eviction (`pruneCache`, `MAX_CACHE_ENTRIES`)
  - In-flight request deduplication via `inFlightRequests: Map<string, Promise<TrafficResponse>>` — concurrent identical requests share one upstream call (credit saver)
  - `clearTrafficCache()` exported for tests; cache resets on server restart
- HTTP response cache header on `/api/traffic`: `Cache-Control: private, max-age=0, must-revalidate` (`src/app/api/traffic/route.ts:39-42`)

## Authentication & Identity

**Auth Provider:**
- None. The app has no user accounts, sessions, or login.
- Upstream service auth only: TabAPI bearer key via `TABAPI_KEY` env var (server-side only)
- The API route is unauthenticated by design — it is a local dashboard (LAN/ngrok); anyone who can reach the server can spend TabAPI credits through it

## Monitoring & Observability

**Error Tracking:**
- None. Errors are converted to JSON error bodies (`ApiErrorBody { error: { code, message } }`) with Vietnamese messages; nothing is reported to an external service.

**Logs:**
- None. No logging framework and no `console.*` calls in `src/` (grep verified). Failures are surfaced to the user in the UI error panel (`src/components/traffic-dashboard.tsx:536-541`).

## CI/CD & Deployment

**Hosting:**
- Local machine only. `npm run build && npm start` for production mode; `npm run dev:lan` exposes on LAN; `*.ngrok-free.app` tunnels whitelisted in `next.config.ts` (`allowedDevOrigins`). No Vercel/Docker/cloud config detected.

**CI Pipeline:**
- None. No `.github/`, no `.gitlab-ci.yml`, no CI config files in the repo.

## Environment Configuration

**Required env vars (server-side, defined in `.env.local`, template in `.env.example`):**
- `TABAPI_KEY` — **required** for any successful lookup; missing key returns 500 `missing_api_key` (`src/app/api/traffic/route.ts:23-26`)
- `TRAFFIC_MONTHS` — optional; integer 3–12, default 3; validated by `getTrafficMonths()` in `src/lib/config.ts:5-23`; invalid values fail the request with 500 `invalid_configuration`

**Secrets location:**
- `.env.local` (gitignored by `.gitignore` via `.env*` pattern; `.env.example` is the committed template). Never commit `.env.local` or quote key values.

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- None (no webhook dispatch logic anywhere in `src/`).

## Data Contract Notes

**Upstream TabAPI response shape** (modeled in `src/types/traffic.ts`, sample in `src/test/fixture.ts`):
- `TrafficResponse`: `domain`, `title`, `description`, `overview` (global/country rank, visits, bounce rate, pages/visit, time on site, month), `monthly_visits[]`, `traffic_sources` (13 channels incl. `gen_ai`, `affiliate`), `top_keywords[]` (volume, CPC, estimated value), `top_regions[]`, `ai_traffic.trends[]`
- The client renders `null` metrics as `—` via `src/lib/format.ts` formatters (vi-VN locale, USD currency)

---

*Integration audit: 2026-10-13*
