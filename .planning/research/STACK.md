# Stack Research

**Domain:** Website traffic intelligence — referring-sites + Google advertisers/creatives for an existing Next.js TabAPI dashboard (brownfield)
**Researched:** 2026-10-13
**Confidence:** HIGH (data-source availability verified live from vendor docs; app-stack choices verified against `package.json` and existing code)

---

## Critical Question Answered: TabAPI Endpoint Availability

**Verified live from https://tabapi.com/docs (fetched 2026-10-13, HIGH confidence):** TabAPI exposes **exactly 9 endpoints**. The complete catalog:

| Endpoint | Route | Cost | Relevance to new features |
|----------|-------|------|---------------------------|
| Website Traffic | `GET /domains/{domain}/traffic?months=3-12` | 3–12 cr | **Already integrated** |
| WHOIS | `GET /domains/{domain}/whois` | 1 cr | None |
| RDAP | `GET /domains/{domain}/rdap` | 1 cr | None |
| DNS Lookup | `GET /domains/{domain}/dns` | 1 cr | None |
| **Backlinks** | `GET /domains/{domain}/backlinks` | **5 cr** | **Closest match for referring sites** |
| Web Reader | `POST /markdown` | 1 cr | None |
| Screenshot | `POST /screenshot` | 1 cr | None |
| **Google Search** | `GET /search/google?q=…&country=&language=&page=` | **1 cr** | **`paid_results[]` = advertisers visible in SERP** |
| Reverse AdSense | `GET /publishers/{pub_id}/sites` | 3 cr | **Not usable** (publisher-side, see below) |

**Verdict per feature:**

1. **Referring sites — NO dedicated endpoint.** There is no "top sites sending referral traffic" endpoint (SimilarWeb-style visit-weighted referrer lists). The **Backlinks API** (5 credits) is the only in-stack match: it returns `overview.domain_rating` (0–100), `overview.referring_domains` (count), `overview.dofollow_*_pct`, and a sample of top backlinks with `from_url`, `to_url`, `title`, `anchor`, and the referring domain's `domain_rating`. This is a **link-graph view ("top referring domains")**, not visit-weighted referral traffic — honest framing in the Vietnamese UI is required (e.g. "Trang web giới thiệu hàng đầu (theo liên kết)"), combined with the already-available `traffic_sources.referrals` share from the Traffic API. This is the standard combination most SEO tools present and is defensible for a researcher report.
2. **Google advertisers / ad creatives — NO endpoint.** No ad-library, advertiser, or creative endpoint exists. Two viable paths:
   - **Tier 0 (in-stack, zero new vendor):** TabAPI **Google Search API** `paid_results[]` — every paid ad on a query with `position`, `placement` (top/bottom), `title`, `link`, `snippet`. Run brand + category queries for the analyzed domain; the ad's link domain identifies the advertiser. Text ads only; no media creatives; no advertiser identity beyond the ad's destination domain. 1 credit/query.
   - **Tier 1 (true ad library):** **SerpAPI Google Ads Transparency Center API** (`engine=google_ads_transparency_center`) — the official public ad library, programmatically. Returns advertiser identity (`AR…` id, name, `legal_name`, country) and `ad_creatives[]` with `format` (text/image/video), hosted creative `link`, `first_shown`/`last_shown`, and `details_link`. This is the only verified API that satisfies "ad creatives view."
3. **Reverse AdSense is the wrong direction:** it maps a publisher's AdSense ID → sites displaying ads, i.e. where ads *run*, not who *buys* them. Do not use it for the advertisers panel.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **TabAPI Backlinks API** | (vendor; spec: OpenAPI 3.1 at `/api/v1/openapi.json`) | Referring-sites section: `domain_rating`, `referring_domains` count, top backlinks sample | Already behind the existing key and BFF; 5 credits/call; DR-scored ranking gives an immediately readable "top referring domains" table; optional SSE streaming exists but plain JSON is sufficient at this scale. **Confidence: HIGH** (verified from official docs) |
| **TabAPI Google Search API** | — | Advertiser panel v1: `paid_results[]` per brand/category query → advertiser domains in Google SERP ads | Already in-stack (same key, same error shape); 1 credit/query; powers the "advertisers associated with the domain's search results" framing without any new dependency. **Confidence: HIGH** |
| **SerpAPI Google Ads Transparency Center API** | (HTTP API; no SDK required) | Ad creatives view + advertiser identity: `ad_creatives[]`, formats text/image/video, `first_shown`/`last_shown`, legal names | The only verified programmatic source for actual ad creatives from Google's public ad library; free tier (250 searches/mo) covers a single-user local tool; documented engine with stable JSON. **Confidence: HIGH** (docs verified; engine behavior is vendor-maintained scraping of the ATC) |
| **Platform-native `fetch`** | (Node ≥ 22 built-in) | All new HTTP calls (TabAPI Backlinks, TabAPI Search, SerpAPI) | Matches the existing `src/lib/tabapi.ts` pattern with injectable `fetchImpl` for Vitest; zero dependency surface; the codebase constraint forbids heavy additions without justification |
| **Hand-written shared contract types** | (TS 6.0.3) | `src/types/traffic.ts` extended or sibling `src/types/report.ts` for `BacklinksResponse`, `SerpaPaidResult`, `AdvertiserCreative` | The existing codebase defines its API contract as hand-written `interface`s consumed by both the BFF route and the client component; generated types would break that single-file-contract convention |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `openapi-typescript` (dev-only, optional) | 7.13.0 (npm-verified 2026-10-13) | Generate a check-only `tabapi.d.ts` from TabAPI's public OpenAPI 3.1 spec to cross-validate hand-written types | Only if you want machine-verified TabAPI types; not needed for SerpAPI (no published OpenAPI). Skip it to stay minimal — hand-written types matching captured fixture responses are sufficient |
| `serpapi` (official JS SDK) | 2.2.1 (npm-verified) | Alternative client for SerpAPI | **Not recommended** — plain `fetch` to `https://serpapi.com/search` matches the existing BFF pattern, keeps the dep tree empty, and the SDK adds nothing (it's a thin query-string wrapper) |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest 5.0.4 + Testing Library 16.3.3 (existing) | Contract tests for new BFF routes with captured response fixtures | Reuse the existing `fetchImpl` injection pattern; snapshot real captured payloads from TabAPI playground + SerpAPI docs as fixtures |
| ESLint 9.39.5 + `eslint-config-next` (existing) | Lint | Plain `<img>` for creatives triggers `@next/next/no-img-element` (warning in core-web-vitals); disable per-line with an inline comment justifying it |

---

## Recommended Architecture Additions (stack-shaped, no new deps)

1. **New BFF routes** mirroring the existing single-route pattern:
   - `GET /api/backlinks?domain=…` → proxies TabAPI Backlinks (5 cr), reuses a generalized version of the 24h cache + in-flight dedup from `src/lib/tabapi.ts` (extract `src/lib/cached-fetch.ts` helper; keep `fetchImpl` injectable).
   - `GET /api/advertisers?domain=…` → fans out to TabAPI Google Search (brand + category queries, ~2–3 cr total) and, when configured, SerpAPI ATC (`text=<domain>` or `advertiser_id`).
2. **New server-side env vars** (never in browser bundle, same rule as `TABAPI_KEY`): `SERPAPI_KEY` — the advertiser/creatives panel degrades gracefully (TabAPI paid_results only) when absent.
3. **Consolidated report**: extend the existing `traffic-dashboard.tsx` panel pattern (`Panel` component + `PANEL_INFO` entries + `.test.tsx` co-located) with three new panels; the "one readable report" goal needs **zero new libraries** — the dashboard is already pure Tailwind tables/bars, and the consolidated presentation is a composition/labeling problem, not a charting problem.
4. **Creative images**: render SerpAPI creative `link` URLs (`displayads-formats.googleusercontent.com/...`) with plain `<img loading="lazy">`. **Do not use `next/image`** — it would require `remotePatterns` allow-listing for Google's rotating asset hosts and adds optimization pass-through for URLs that expire; a 24h-cached local tool should hotlink directly.

---

## Installation

```bash
# Core — nothing to install. All new data flows reuse platform fetch + existing deps.

# Optional dev-only cross-check of hand-written TabAPI types against the live spec
npm install -D openapi-typescript@7.13.0
npx openapi-typescript https://tabapi.com/api/v1/openapi.json -o tabapi-spec.d.ts
```

New credit/env surface (no packages):

```bash
# .env.local additions
# TABAPI_KEY=...            # existing
SERPAPI_KEY=...             # optional; enables ad-creatives view via SerpAPI ATC
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| TabAPI Backlinks for referring sites | SimilarWeb API (referral sources, visit-weighted) | Only if visit-weighted referrer lists are a hard requirement — but SimilarWeb sells enterprise contracts with no public pricing; overkill for a single-user local tool |
| TabAPI Backlinks | DataForSEO Backlinks API (pay-per-task, cheaper at volume) | Only if TabAPI backlink sample depth proves insufficient AND volume grows; adds a second vendor + billing model for marginal gain at this scale |
| SerpAPI ATC for advertisers/creatives | TabAPI Google Search `paid_results` only | When no SerpAPI account is desired: ship the advertiser panel v1 from SERP ads (text-only, no creative gallery) |
| SerpAPI ATC | Apify Google Ads Transparency Center actors (pay per result) | Only if SerpAPI pricing is unacceptable; tradeoff: actor maintenance quality varies wildly, no contract stability, no Legal Shield |
| Plain `<img>` | `next/image` | Never for expiring Google creative URLs; only if creatives were re-hosted locally (out of scope) |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Scraping adstransparency.google.com yourself** (Playwright/Puppeteer/undici-raw) | No official public API exists (verified against Google's developer docs catalog, MEDIUM confidence); ATC is a JS-heavy SPA behind bot protection; DOM selectors break silently; ToS risk | SerpAPI's `google_ads_transparency_center` engine (vendor absorbs the scraping, ~$0.025–0.075/search on paid tiers, free 250/mo) |
| **Google Ads API** (official, v26) | Requires OAuth2 + approved developer token and is scoped to *your own* ad accounts — it cannot look up arbitrary third-party advertisers or their creatives | SerpAPI ATC |
| **TabAPI Reverse AdSense endpoint** | Publisher-side mapping (AdSense pub-id → sites showing ads); answers "where do ads run", never "who advertises" | TabAPI Google Search + SerpAPI ATC |
| **`serpapi` npm SDK (2.2.1)** | Thin wrapper; adds a dependency for query-string building the BFF already does by hand | Plain `fetch` with injectable `fetchImpl` |
| **Unofficial npm "ad transparency" scrapers** | One-author packages that rot within weeks of ATC DOM changes; no types, no tests | SerpAPI ATC |
| **zod (4.6.7) / axios / chart libraries (recharts, chart.js)** | The codebase validates by contract types + tests, uses platform `fetch`, and renders tables with zero chart deps; each addition violates the "no new heavy dependencies" constraint without a triggering need | Existing patterns: hand-written TS contracts, `fetch`, Tailwind tables |
| **SimilarWeb / Semrush APIs for referral traffic** | Enterprise-only contracts, opaque pricing, heavyweight SDKs — mismatched with a local single-user tool | TabAPI Backlinks (in-stack, 5 cr) + honest labeling |

---

## Stack Patterns by Variant

**If SERPAPI_KEY is absent (default bootstrap):**
- Ship referring-sites (TabAPI Backlinks) + advertiser panel from TabAPI `paid_results` (text ads) + creatives section hidden with a Vietnamese "not configured" note.
- Because the app remains fully functional on one key and one vendor, and the researcher still gets advertiser signal.

**If SERPAPI_KEY is present:**
- Add the ATC call (`engine=google_ads_transparency_center`, `text=<domain>`, optionally `get_advertiser=true` per top advertiser — each is a billed search) and render `ad_creatives` as a format-aware grid (text → styled card; image → `<img>`; video → link-out card since the `link` is a `content.js` blob, not a playable URL).
- Budget note: each creative *detail* fetch (`serpapi_details_link`) is a separate SerpAPI search — cap detail fetches (e.g. top 5 advertisers) and lean on the list response's `first_shown`/`last_shown` metadata instead.

**If credit pressure on TabAPI grows:**
- Backlinks costs 5 cr/domain and Google Search 1 cr/query; both are behind the 24h cache. If the researcher runs many lookups, prefer 12-month caching for backlinks (link graphs move slowly) over the shared 24h TTL — a per-endpoint TTL constant is a one-line change.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| TabAPI Traffic/Backlinks/Search contracts | Next 16.4 BFF route pattern | Same base URL, bearer auth, single error shape (`{error:{code,message,status,request_id,docs_url}}`), errors never charged — reuse `TrafficApiError` mapping; extend `vietnameseError()` codes for `unprocessable` backlinks cases |
| SerpAPI HTTP API | Node ≥ 22 `fetch` | Query-string API key (unlike TabAPI) — keep it server-side only; response is plain JSON, no envelope; `next_page_token` pagination |
| openapi-typescript 7.13.0 | TypeScript 6.0.3 strict | Dev-only; generated file is a type cross-check, not imported by the app |
| No new runtime deps | React 19.3 / Tailwind 4.3.3 | Zero peer-dependency risk; the entire feature set fits the existing dependency set |

---

## Sources

- https://tabapi.com/docs — full 9-endpoint API reference, request/response shapes, credit costs, error codes (fetched live 2026-10-13) — **HIGH**
- https://tabapi.com — product catalog, pricing table, FAQ, streaming/OpenAPI/llms.txt conventions (fetched live 2026-10-13) — **HIGH**
- https://serpapi.com/google-ads-transparency-center-api — engine parameters, response shape with `ad_creatives`/`advertiser` (fetched live 2026-10-13) — **HIGH**
- https://serpapi.com/pricing.md — plan tiers, search counting rules, throughput (fetched live 2026-10-13) — **HIGH**
- https://developers.google.com/google-ads/api/docs/start — official API scope: account/campaign management, OAuth + developer token (updated 2026-09-30); absence of any ATC public API inferred from Google's product catalog — **MEDIUM** for the "no official ATC API" inference, **HIGH** for the advertiser-scoped characterization
- npm registry (`npm view`, 2026-10-13): openapi-typescript 7.13.0, serpapi 2.2.1, zod 4.6.7 — **HIGH**
- `package.json` + `src/lib/tabapi.ts` + `src/types/traffic.ts` (local, verified) — existing stack facts — **HIGH**

---
*Stack research for: Traffic Check — referring sites + Google advertisers/creatives milestone*
*Researched: 2026-10-13*
