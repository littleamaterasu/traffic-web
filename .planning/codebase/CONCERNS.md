# Codebase Concerns

**Analysis Date:** 2026-10-13

Scope: full repo (`D:\affiliate\traffic-web`). Small Next.js 16 app (~950 source lines across 10 files) that proxies TabAPI traffic data. No `TODO`/`FIXME`/`HACK`/`XXX` markers exist anywhere in `src/` — concerns below were found by reading the code. A `.env.local` file is present in the repo root (correctly ignored by `.gitignore` via `.env*` / `!.env.example`); its contents were never read. `TABAPI_KEY` and `TRAFFIC_MONTHS` are the only env vars referenced, both read server-side only (`src/app/api/traffic/route.ts:23`, `src/lib/config.ts:5`).

## Tech Debt

**Monolithic dashboard component:**
- Issue: `src/components/traffic-dashboard.tsx` (534 lines, ~30KB) contains everything: `InfoButton` modal, `Panel`, `MetricCard`, `EmptyCell`, `Results` (5 rendering panels + derived calculations), `TrafficDashboard` (form, fetch logic, loading/error states), plus the 13-channel `SOURCE_LABELS` table and the large Vietnamese `PANEL_INFO` content object.
- Files: `src/components/traffic-dashboard.tsx`
- Impact: Any panel change risks the whole file; derived data logic (MoM delta at lines 277–279, AI delta at lines 389–393, source sorting at lines 210–212) is entangled with JSX and cannot be unit-tested without rendering.
- Fix approach: Extract `Results` and each panel into `src/components/panels/*`, move derived calculations (MoM deltas, AI deltas, source sorting) into a pure module `src/lib/derive.ts` with its own test, move `PANEL_INFO`/`SOURCE_LABELS` into `src/lib/panel-content.ts`. Keep the file-per-panel pattern used elsewhere in the repo.

**No runtime validation of the upstream TabAPI response:**
- Issue: `fetchTrafficFromTabApi` blindly casts the parsed body: `return (await response.json()) as TrafficResponse;` (`src/lib/tabapi.ts:72`). No schema check on any field.
- Files: `src/lib/tabapi.ts`, `src/types/traffic.ts`
- Impact: A 200 response with an unexpected shape (HTML error page, changed field names, missing `overview`) flows straight into `Results` and crashes the client at render time; there is no error boundary to catch it (see Fragile Areas).
- Fix approach: Add a minimal validator (hand-rolled checks or zod) in `src/lib/tabapi.ts` that throws `TrafficApiError(502, "invalid_upstream_response", ...)` when required fields are missing; map it to the existing `errorResponse` path in `src/app/api/traffic/route.ts:43-48`.

**Tunnel workaround hardcoded into the production client path:**
- Issue: Every browser fetch sends the `ngrok-skip-browser-warning` header (`src/components/traffic-dashboard.tsx:439-441`), a workaround for ngrok interstitial pages during LAN development.
- Files: `src/components/traffic-dashboard.tsx`, `next.config.ts` (`allowedDevOrigins: ["192.168.2.12", "*.ngrok-free.app"]` at line 6)
- Impact: Non-essential header shipped in all environments; the hardcoded LAN IP `192.168.2.12` is machine-specific config baked into the repo and will silently break for other machines.
- Fix approach: Make the header conditional on hostname ending in `.ngrok-free.app` (or drop it), and move LAN origin into env (e.g., `NEXT_PUBLIC_DEV_ORIGIN`) or a local-only config file.

**Hardcoded upstream base URL:**
- Issue: `const TABAPI_BASE_URL = "https://tabapi.com/api/v1";` is not configurable (`src/lib/tabapi.ts:3`).
- Files: `src/lib/tabapi.ts`
- Impact: Cannot point the app at a proxy, mock server, or alternate region without a code edit; also complicates integration testing against a real sandbox.
- Fix approach: Read from `process.env.TABAPI_BASE_URL` with the current value as default, validated the same way as `getTrafficMonths` in `src/lib/config.ts`.

**`www.` prefix not stripped during domain normalization:**
- Issue: `normalizeDomain` lowercases and extracts the hostname but keeps `www.` (`src/lib/domain.ts:26-40`; test at `src/lib/domain.test.ts:7` asserts `www.example.com` passes through unchanged).
- Files: `src/lib/domain.ts`
- Impact: The same site can be queried as `example.com` and `www.example.com`, producing two distinct cache keys (`src/lib/tabapi.ts:94`) and two separate TabAPI credit charges for identical data.
- Fix approach: Strip a leading `www.` label after hostname extraction in `src/lib/domain.ts` (keep a test asserting `https://www.example.com/blog` → `example.com`).

**Hardcoded channel list and count:**
- Issue: `SOURCE_LABELS` fixes 13 channels and the panel badge hardcodes the count string "Nguồn traffic … · ${sources.length}/13 kênh" (`src/components/traffic-dashboard.tsx:17-31` and `:298`). Unknown upstream source keys are silently dropped by the `keyof TrafficSources` mapping.
- Files: `src/components/traffic-dashboard.tsx`, `src/types/traffic.ts` (`TrafficSources`, lines 23–37)
- Impact: If TabAPI adds or renames a source channel, the dashboard silently omits it and the "…/13 kênh" badge becomes wrong; no error surfaces anywhere.
- Fix approach: Derive the count from `SOURCE_LABELS.length` instead of the literal `13`, and log/flag unknown keys received from upstream.

**Missing `engines` declaration:**
- Issue: README requires Node 22.13+ (`README.md:20`) but `package.json` has no `engines` field and there is no `.nvmrc`.
- Files: `package.json`, `README.md`
- Impact: Developers on older Node get unclear runtime/build failures (Next 16 + `Intl` behaviors differ across versions).
- Fix approach: Add `"engines": { "node": ">=22.13" }` to `package.json` and commit an `.nvmrc`.

## Known Bugs

**Stale `trafficMonths` label after runtime env change:**
- Symptoms: The header badge "Website intelligence / N tháng" shows the value of `TRAFFIC_MONTHS` captured at build time, while `/api/traffic` uses the value at request time.
- Files: `src/app/page.tsx:5` (server component calls `getTrafficMonths()` with no `dynamic` export), `src/components/traffic-dashboard.tsx:418`, `src/app/api/traffic/route.ts:28-34`
- Trigger: Build once, then run `npm start` with a different (valid) `TRAFFIC_MONTHS` in the environment — the UI advertises the old month count while the API fetches the new one. Conversely, an invalid `TRAFFIC_MONTHS` at build time makes `npm run build` throw inside `getTrafficMonths` and fail the whole build.
- Workaround: Rebuild after every env change.
- Fix approach: Export `const dynamic = "force-dynamic"` (or read the value through `request`/`headers()`) in `src/app/page.tsx` so the label is resolved per-request, and wrap the call in try/catch with a fallback to `DEFAULT_TRAFFIC_MONTHS`.

**Month-over-month delta trusts array order:**
- Symptoms: The "So tháng trước (%)" column computes `previous = data.monthly_visits[index - 1]?.visits` without sorting by month (`src/components/traffic-dashboard.tsx:277-279`).
- Files: `src/components/traffic-dashboard.tsx`
- Trigger: Upstream returns `monthly_visits` in non-ascending month order → deltas are computed against the wrong month and displayed as plausible but wrong percentages.
- Workaround: None; currently TabAPI happens to return ordered data.
- Fix approach: Sort a copy of `monthly_visits` by `month` before rendering (mirror the pattern already used for AI history at `traffic-dashboard.tsx:390`).

**Info modal has incomplete keyboard handling:**
- Symptoms: Escape only closes the modal while focus is still on the toggle button (`onKeyDown` is attached to the toggle button, `src/components/traffic-dashboard.tsx:104-106`); opening the dialog does not move focus into it, there is no focus trap, and closing does not restore focus.
- Files: `src/components/traffic-dashboard.tsx` (`InfoButton`, lines 91–158)
- Trigger: Open an "i" dialog, Tab to another element, press Escape → nothing closes; screen-reader/keyboard users get `aria-modal="true"` without a managed focus scope.
- Workaround: Click the backdrop or × button with the mouse.
- Fix approach: Move Escape handling to the dialog container, focus the dialog on open, return focus to the toggle button on close; a `useEffect` + ref approach inside `InfoButton` suffices (no dependency needed).

**Client timeout orphans the server-side upstream request:**
- Symptoms: The client aborts after 20s (`src/components/traffic-dashboard.tsx:434-435`), but `fetchTrafficFromTabApi` passes no `AbortSignal` to its own fetch (`src/lib/tabapi.ts:51-60`), so the server call to TabAPI keeps running to completion.
- Files: `src/lib/tabapi.ts`, `src/app/api/traffic/route.ts`
- Trigger: TabAPI responds slowly (>20s) — the user sees the timeout error, TabAPI still bills credits for the completed call, and the successful response is discarded rather than cached.
- Workaround: None.
- Fix approach: Add an `AbortSignal.timeout(...)` (30s) in `fetchTrafficFromTabApi` and cache the result even when the originating client has disconnected, so slow calls are not paid for twice.

## Security Considerations

**No authentication or rate limiting on `/api/traffic`:**
- Risk: Anyone who can reach the server can issue arbitrary domain lookups; every cache miss spends TabAPI credits from the owner's account.
- Files: `src/app/api/traffic/route.ts` (the only API route), `src/lib/tabapi.ts` (cache is the only throttle)
- Current mitigation: 24h in-process success cache (`src/lib/tabapi.ts:4-5, 87-113`) limits repeats of the same domain+months; domain validation blocks IP/localhost targets (`src/lib/domain.ts:29-38`). README positions this as a local dashboard, but `npm run dev:lan` binds `0.0.0.0` (README lines 77–83; script in `package.json:8`) and `allowedDevOrigins` includes `*.ngrok-free.app` (`next.config.ts:6`), so LAN and tunneled access are explicitly enabled.
- Recommendations: If this stays local-only, keep as-is but document the exposure; if it ever leaves localhost, add per-IP rate limiting (e.g., a token bucket in `src/app/api/traffic/route.ts` or middleware), consider a shared secret, and never enable `dev:lan` + ngrok simultaneously on a shared network.

**Upstream data rendered unvalidated (low XSS risk, high crash risk):**
- Risk: Malformed upstream JSON reaches the client unvalidated (see Tech Debt above).
- Files: `src/lib/tabapi.ts:72`, `src/components/traffic-dashboard.tsx` (`Results`)
- Current mitigation: React escapes all interpolated strings and there is no `dangerouslySetInnerHTML` anywhere in `src/`, so reflected-script XSS is not a realistic vector; the realistic failure is a client render crash (no error boundary).
- Recommendations: Runtime validation at the proxy boundary (see Tech Debt fix) plus a route-level `error.tsx` boundary.

**Secrets handling (verified sound, keep it that way):**
- Risk: TabAPI key leakage would allow credit theft.
- Files: `src/lib/tabapi.ts:51-60` (key sent only in `Authorization` header), `src/app/api/traffic/route.ts:23-26`
- Current mitigation: Key read only server-side; tests explicitly assert the key never appears in URLs or response bodies (`src/lib/tabapi.test.ts:15-27`, `src/app/api/traffic/route.test.ts:42-60`). `.gitignore` excludes `.env*` except `.env.example`.
- Recommendations: Preserve these assertions in any refactor; never log request headers (there is currently zero logging, which itself is a gap — see below).

## Performance Bottlenecks

**Process-local cache only:**
- Problem: The 24h cache (`successCache` Map, `src/lib/tabapi.ts:12`) is per Node process, capped at 100 entries, and cleared on restart; the in-flight dedup map (`src/lib/tabapi.ts:13`) has the same scope.
- Files: `src/lib/tabapi.ts`
- Cause: Deliberate simplicity for a local single-user tool.
- Improvement path: Fine for current use; if multi-user or serverless deployment happens, move to a shared store (Redis, or even a JSON file cache) keyed by `domain:months` (`src/lib/tabapi.ts:94`). Also note expired entries are only pruned when a new successful fetch triggers `pruneCache` (`src/lib/tabapi.ts:105`) — bounded by `MAX_CACHE_ENTRIES`, so harmless, but the eviction logic (oldest-inserted eviction at lines 80–84) has no test.

**Synchronous upstream latency passed through to the user:**
- Problem: Every cache-miss request waits the full TabAPI round trip with no server-side timeout (see Known Bugs) — the UI hangs up to 20s on a slow upstream.
- Files: `src/app/api/traffic/route.ts:36-42`, `src/lib/tabapi.ts:50-63`
- Cause: No `AbortSignal`/timeout on the upstream fetch.
- Improvement path: Server-side timeout + the client already has a 20s budget (`src/components/traffic-dashboard.tsx:435`).

## Fragile Areas

**`Results` rendering assumes the TabAPI response contract:**
- Files: `src/components/traffic-dashboard.tsx:202-416`, `src/types/traffic.ts`
- Why fragile: Accesses `data.overview.visits`, `data.traffic_sources[key]`, `data.top_regions`, `data.top_keywords`, `data.ai_traffic?.trends` directly; only `ai_traffic` is optional-chained (`traffic-dashboard.tsx:209`). A missing `overview` or `traffic_sources` throws during render and — with no error boundary — replaces the whole page with the Next.js error screen.
- Safe modification: When touching `Results`, guard nested access the way `ai_traffic` is guarded, or validate at the API boundary first (root fix).
- Test coverage: Component tests cover the happy path, API error path, and empty-coverage path (`src/components/traffic-dashboard.test.tsx`), but no test renders a partially malformed response.

**Upstream error-code mapping:**
- Files: `src/lib/tabapi.ts:26-32, 65-70`
- Why fragile: `vietnameseError` and the status allowlist `[400, 402, 422, 502]` are hardcoded; any new upstream status (401, 429, 500) collapses to a generic 502/"Không thể lấy dữ liệu website lúc này." response, hiding the real cause with zero logging.
- Safe modification: Extend the mapping table + tests together (`src/lib/tabapi.test.ts:67-80` uses `it.each` — add rows there).
- Test coverage: Mapped codes are tested; unmapped-status fallback and the network-failure path (`tabapi.ts:61-63`) are not.

## Scaling Limits

**Single-user assumption baked in:**
- Current capacity: In-memory cache of 100 domains, unlimited request rate, credits-billed upstream.
- Limit: Concurrent LAN/tunnel users can drain TabAPI credits faster than the cache can protect (every distinct domain is a paid call); a server restart drops all cached entries.
- Files: `src/lib/tabapi.ts`, `src/app/api/traffic/route.ts`
- Scaling path: Shared persistent cache + rate limiting (see Security and Performance sections) before any multi-user deployment.

## Dependencies at Risk

**Pinned exact versions, no automated updates:**
- Risk: Every dependency in `package.json` is pinned to an exact version (`next 16.4.0`, `react 19.3.0`, `typescript 6.0.3`, etc.) with no Renovate/Dependabot config and no CI to catch breakage or advisories.
- Impact: Security patches in Next.js (the only internet-facing surface) must be noticed and applied manually.
- Files: `package.json`, `package-lock.json`
- Migration plan: Add a Dependabot/Renovate config and a CI workflow (see Missing Critical Features) so updates arrive as testable PRs.

## Missing Critical Features

**No CI pipeline:**
- Problem: No `.github/` directory exists; `npm run lint`, `npm test`, `npm run build` are only run manually.
- Blocks: Regression protection for the existing test suite; safe dependency updates; any PR-based workflow.
- Fix approach: Add a minimal GitHub Actions workflow running `npm ci && npm run lint && npm test && npm run build` on Node 22.

**Zero observability:**
- Problem: `console.*` is never used anywhere in `src/`; upstream failures, credit-related errors, and cache behavior are invisible. The catch blocks swallow context (`src/lib/tabapi.ts:61-63`, `src/lib/tabapi.ts:34-40` discards unparseable error bodies silently).
- Blocks: Diagnosing "why did this domain fail" or "why are credits draining" after the fact.
- Fix approach: Log (server-side only) in `fetchTrafficFromTabApi` and the route's catch in `src/app/api/traffic/route.ts:43-48` — status, code, domain (never the API key or Authorization header).

**No error boundary:**
- Problem: No `error.tsx`/`global-error.tsx` exists under `src/app/`; any render-time exception in `Results` (likely given the unvalidated upstream data) takes down the entire page.
- Blocks: Graceful degradation when upstream data shape drifts.
- Fix approach: Add `src/app/error.tsx` with the brutalist error styling already used by the `role="alert"` block (`src/components/traffic-dashboard.tsx:536-541`).

## Test Coverage Gaps

**`getTraffic` in-flight dedup:**
- What's not tested: Two concurrent cache-miss calls for the same key share one upstream request (`src/lib/tabapi.ts:100-112`).
- Files: `src/lib/tabapi.test.ts`
- Risk: A regression could double-bill TabAPI credits silently — the exact failure the cache exists to prevent.
- Priority: High

**Upstream network failure path:**
- What's not tested: `fetchTrafficFromTabApi` rejection on fetch throw → `TrafficApiError(502, "network_error", ...)` (`src/lib/tabapi.ts:61-63`), and the route's generic `unexpected_error` 502 fallback (`src/app/api/traffic/route.ts:47`).
- Files: `src/lib/tabapi.test.ts`, `src/app/api/traffic/route.test.ts`
- Risk: Error mapping regressions reach production unnoticed.
- Priority: Medium

**Cache eviction at capacity:**
- What's not tested: `pruneCache` eviction of oldest entries at `MAX_CACHE_ENTRIES` (100) (`src/lib/tabapi.ts:75-85`).
- Files: `src/lib/tabapi.test.ts`
- Risk: Unbounded-growth or wrong-eviction regressions; currently unexercised code.
- Priority: Low

**Client timeout / AbortError branch:**
- What's not tested: The 20s abort → "Yêu cầu mất quá nhiều thời gian…" branch (`src/components/traffic-dashboard.tsx:451-459`).
- Files: `src/components/traffic-dashboard.test.tsx`
- Risk: Timeout UX regressions (the most likely real-world failure mode on a slow TabAPI).
- Priority: Medium

**Domain normalization edge cases:**
- What's not tested: 63-char label limit, 253-char hostname limit, uppercase scheme (`HTTPS://`), trailing-dot hostnames — all enforced in `src/lib/domain.ts:29-38` but absent from `src/lib/domain.test.ts`.
- Files: `src/lib/domain.test.ts`
- Risk: Validation regressions either reject valid domains or admit pathological ones to the paid upstream.
- Priority: Medium

**E2E:**
- What's not tested: No E2E layer at all (vitest + jsdom only, `vitest.config.ts`); the fetch→proxy→render path is only ever exercised with mocks.
- Priority: Low for a local tool; revisit if deployed beyond localhost.

---

*Concerns audit: 2026-10-13*
