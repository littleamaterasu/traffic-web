# External Integrations

**Analysis Date:** 2026-10-13

## APIs & External Services

**External data services:**

**Website traffic intelligence:**
- TabAPI — third-party API providing estimated website traffic metrics (visits, ranks, sources, keywords, regions, AI referrals)
  - Base URL: `https://tabapi.com/api/v1` (hardcoded constant `TABAPI_BASE_URL` in `src/lib/tabapi.ts:3`)
  - Endpoint used: `GET /domains/{domain}/traffic?months={3..12}` (`src/lib/tabapi.ts:52`)
  - SDK/Client: none — plain `fetch` with `cache: "no-store"` (`fetchTrafficFromTabApi` in `src/lib/tabapi.ts`)
  - Auth: Bearer token — `Authorization: Bearer ${apiKey}` where `apiKey` comes from `process.env.TABAPI_KEY` (read exclusively in `src/app/api/traffic/route.ts:23`; never exposed to the browser)
  - Billing model: credits are consumed per request, proportional to months returned (3–12); this motivates the caching layer below
  - Error handling: `TrafficApiError` (status, code, Vietnamese user-facing message) — status codes 400 / 402 (insufficient credits) / 422 (not enough data) / 502 are recognized; all others normalize to 502 (`src/lib/tabapi.ts:26-32,65-70`)
- SE Ranking Data API — supplementary SEO/paid-data estimates (Phase 8; supplements TabAPI, never replaces it)
  - Base URL: `https://api.seranking.com/v1` (hardcoded constant `SERANKING_BASE_URL` in `src/lib/seranking.ts`)
  - Endpoints used (`src/lib/seranking.ts`): `GET /domain/keywords?domain=&source=&type=adv&limit=`, `GET /domain/competitors?domain=&source=&type=adv&limit=`, `GET /backlinks/summary?target=`
  - SDK/Client: none — plain `fetch` with `cache: "no-store"` via injectable `fetchImpl` (`requestSeRanking`)
  - Auth: Token header — `Authorization: Token ${apiKey}` where `apiKey` is passed in by the route (lib never reads `process.env`; `SE_RANKING_API_KEY` is read only by the three on-demand routes)
  - Billing model: credits per endpoint record; `backlinks/summary` costs ~100 credits — isolated per-slice cache, fetched on demand only
  - Error handling: `SeRankingApiError` (status, code, Vietnamese message) — 401/403→401 `invalid_api_key`, 402 `insufficient_credits`, 429 `rate_limited`, others normalize to 502 `seranking_error`; fetch rejection 502 `network_error`; unparseable OK body 502 `seranking_error`
  - Caching: three independent `createCachedStore` instances (keywords, competitors, backlinks; 24h TTL, in-flight dedup), keys `domain` / `domain:source:limit`; `clearSeRankingCache()` for tests
- Internal REST route `/api/traffic?domain={query}` — `GET` handler in `src/app/api/traffic/route.ts` (Next.js App Router, `runtime = "nodejs"`); normalizes the domain (`src/lib/domain.ts`), injects the API key, and returns either `TrafficResponse` or `ApiErrorBody` (`src/types/traffic.ts`)
  - Client consumer: `TrafficDashboard.search()` in `src/components/traffic-dashboard.tsx:424-464` — `fetch` with 20-second `AbortController` timeout and `ngrok-skip-browser-warning: true` header (for tunnel usage)
- Internal REST route `/api/seranking/ads?domain={query}&source={db}` — `GET` handler in `src/app/api/seranking/ads/route.ts` (Phase 8, `runtime = "nodejs"`); validates domain then `source` (`/^[a-z]{2}$/`, default `us`), reads `SE_RANKING_API_KEY`, calls `/domain/keywords?type=adv` with `LIST_LIMIT = 10`; returns `SeRankingAdsResponse` (`{domain, source, ads}`, `ads` is `{data|error}`); on demand only (button "Tải mẫu quảng cáo"); volume/CPC are not shown in the UI; `src/lib/seranking-ad-title.ts` (`cleanAdTitle`) strips trailing URL/breadcrumb text from ad titles
- Internal REST route `/api/seranking/competitors?domain={query}&source={db}` — `GET` handler in `src/app/api/seranking/competitors/route.ts` (Phase 8); same validation and `LIST_LIMIT = 10`; calls `/domain/competitors?type=adv`; returns `SeRankingCompetitorsResponse` (`{domain, source, competitors}`); on demand only (button "Tải đối thủ quảng cáo")
- Internal REST route `/api/seranking/backlinks?domain={query}` — `GET` handler in `src/app/api/seranking/backlinks/route.ts` (Phase 8); the ONLY route calling `/backlinks/summary` (documented ~100 credits/record), on demand only (button "Tải backlink"); returns `SeRankingBacklinksResponse` (`{domain, backlinks}`), where upstream failure degrades to `backlinks:{data:null,error:{code,message}}` with HTTP 200 (only invalid domain 400 / missing key 500 are HTTP errors). All three routes return 500 `missing_api_key` with a Vietnamese message when the key is absent. The former default route `/api/seranking` (overview + keywords + competitors) was removed on 2026-10-23 and `src/components/seranking-panel.tsx` contains no `useEffect`, so nothing is fetched on mount (grep verified)
  - Client consumer: `SerankingPanel` (`src/components/seranking-panel.tsx`), rendered by `Results` in `src/components/traffic-dashboard.tsx` after `AdsPanel`
- Google Ads Transparency via SerpAPI — ad creatives with first/last shown dates (added outside GSD by commit 300b113; partially covers Phases 3 and 6)
  - Base URL: `https://serpapi.com/search.json` (constant in `src/lib/ads-transparency.ts`); engines `google_ads_transparency_center` (creative list) and `google_ads_transparency_center_ad_details` (detail)
  - Routes: `GET /api/ads?domain=&page_token=` (`src/app/api/ads/route.ts`; `page_token` validated by regex) and `GET /api/ads/detail?advertiser_id=&creative_id=` (`src/app/api/ads/detail/route.ts`; ids must match `AR\d+` / `CR\d+`)
  - Auth: `SERPAPI_KEY` env var, read server-side in both routes; when absent the routes return 500 `missing_api_key` — there is NO fallback
  - Caching: two `createCachedStore` instances (list keyed `domain:pageToken`, detail keyed `advertiserId:creativeId`); `clearAdsCache()` for tests
  - Client consumer: `AdsPanel` (`src/components/ads-panel.tsx`), click-to-load; each page or detail load costs one SerpApi call
  - Insight helpers: `src/lib/ads-insights.ts` (`ACTIVE_WINDOW_DAYS` = 7, `LONG_RUNNING_DAYS` = 30); no Winning Ad Ratio or ASI is computed (grep verified)

## Data Storage

**Databases:**
- None. No database, ORM, or persistence layer exists anywhere in the codebase.

**File Storage:**
- None. Local filesystem only for Next.js internals; no file upload/read logic.

**Caching:**
- All server caches use the shared `createCachedStore<T>()` factory in `src/lib/cached-store.ts` (24h TTL, max 100 entries per store with FIFO eviction, in-flight request dedup, injectable clock); stores live in `src/lib/tabapi.ts` (`trafficStore`, key `{domain}:{months}`), `src/lib/ads-transparency.ts` (list and detail) and `src/lib/seranking.ts` (keywords, competitors, backlinks)
  - `clearTrafficCache()`, `clearAdsCache()` and `clearSeRankingCache()` exported for tests; caches reset on server restart
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
- `SE_RANKING_API_KEY` — required for `/api/seranking/*` data; missing/empty key returns 500 `missing_api_key` with Vietnamese message (readers: `src/app/api/seranking/ads/route.ts`, `competitors/route.ts`, `backlinks/route.ts`)
- `SERPAPI_KEY` — required for `/api/ads` and `/api/ads/detail`; missing key returns 500 `missing_api_key`, no fallback (readers: `src/app/api/ads/route.ts`, `src/app/api/ads/detail/route.ts`)
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
