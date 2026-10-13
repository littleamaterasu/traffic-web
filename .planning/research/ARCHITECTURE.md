# Architecture Research

**Domain:** Extending a Next.js BFF traffic-intelligence dashboard with new report sections (referring sites, related Google advertisers, ad creatives, consolidated report)
**Researched:** 2026-10-13
**Confidence:** MEDIUM (architecture patterns HIGH — derived from the mapped codebase; upstream endpoint facts verified against TabAPI's own docs pages, cross-checked against the live working traffic integration)

## Standard Architecture

### The Decisive External Fact

TabAPI publishes exactly **9 endpoints** (verified on tabapi.com homepage + /docs, 2026-10-13). The three new sections map onto existing upstream capabilities — **no new third-party service is needed**, and the route design follows directly:

| New feature | Upstream TabAPI endpoint | Cost | Verified response shape |
|-------------|--------------------------|------|-------------------------|
| Referring sites | `GET /api/v1/domains/{domain}/backlinks` | 5 cr | `{ domain, overview: { domain_rating, backlinks, referring_domains, dofollow_backlinks_pct, dofollow_referring_domains_pct }, backlinks: [{ from_url, to_url, title, anchor, domain_rating }] }` |
| Related Google advertisers | `GET /api/v1/search/google?q=...&country=...&language=...&page=...` | 1 cr | `{ search_parameters, paid_results: [{ position, placement: "top"\|"bottom", title, link, snippet }], organic_results, answer_box, knowledge_graph, people_also_ask, related_searches }` |
| Ad creatives | **Same single Google Search call** — each `paid_results` entry *is* a text ad creative | 0 (same response) | same payload, grouped client-side by advertiser domain |

Key consequences:
- **There is no "referring sites" endpoint** — the Backlinks API is the data source. It returns a *sample* of top backlinks; grouping by `from_url` host yields "top referring sites". Semantic caveat for the panel's info dialog: backlinks ≠ measured referral traffic share; it is a link-graph proxy.
- **There is no "advertisers" or "creatives" endpoint** — one `/search/google` call (query derived from the domain's brand term) supplies both. Advertisers = hosts of `paid_results`; creatives = the ad title/snippet/destination of each paid result. Reverse AdSense (`/publishers/{pub_id}/sites`) is unusable here — it requires a publisher ID we don't have.
- Upstream docs mirror at `/docs.txt`, machine contract at `/api/v1/openapi.json` (free, unauthenticated) — useful for generating defensive types during the referring-sites phase.
- New upstream error codes appear: `upstream_timeout` (504) on both backlinks and google-search, `service_unavailable` (503). Errors are never charged; retrying is safe.

### System Overview (target state — existing components unchanged unless marked NEW/EXTEND)

```
┌────────────────────────────────────────────────────────────────────────┐
│                            Browser (Client)                            │
│  traffic-dashboard.tsx (EXTEND: orchestrates 1 core + 2 section        │
│  fetches; keeps search form + global loading/error)                    │
│         │                              │                               │
│  ┌──────▼─────────┐  ┌────────────────▼──────────────┐  ┌───────────┐ │
│  │ Results (core) │  │ useSectionFetch hook (NEW)     │  │ Report    │ │
│  │ (unchanged)    │  │ {data, error, loading, retry}  │  │ Report    │ │
│  └──────┬─────────┘  └───────┬───────────────┬────────┘  │ layout    │ │
│         │            ┌───────▼─────┐  ┌──────▼───────┐   │ (NEW)     │ │
│         │            │ Referring-  │  │ Advertisers- │   └───────────┘ │
│         │            │ SitesPanel  │  │ + Creatives  │                 │
│         │            │ (NEW)       │  │ Panel (NEW)  │                 │
│         │            └───────┬─────┘  └──────┬───────┘                 │
│  panel.tsx (NEW: extracted Panel/InfoButton/EmptyCell/MetricCard,      │
│  PANEL_INFO type — shared by all panels incl. existing ones)           │
└───────┬──────────────────────────┬─────────────────────────────────────┘
        │ GET /api/traffic?domain= │ GET /api/traffic/referring-sites?domain=
        │ (unchanged)              │ GET /api/traffic/advertisers?domain=&page=
        ▼                          ▼
┌────────────────────┐  ┌──────────────────────────────────────────────┐
│ /api/traffic       │  │ NEW route handlers, same shape as existing:  │
│ (FROZEN)           │  │ validate domain → config → service → errors  │
└────────┬───────────┘  └───────────────┬──────────────────────────────┘
         │                              │
         ▼                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│ src/lib/tabapi.ts (EXTEND)                                             │
│  getTraffic (unchanged)  ·  getBacklinks (NEW)  ·  getGoogleSearch(NEW)│
│  generic cached-store: Map + 24h TTL + in-flight dedup + prune, one    │
│  store per upstream resource, keys "backlinks:{domain}" /              │
│  "gsearch:{q}:{country}:{page}"  ·  injectable fetchImpl everywhere    │
└───────────────────────────────┬────────────────────────────────────────┘
                                │ Bearer TABAPI_KEY (server-side only)
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TabAPI: /domains/{d}/traffic (3–12 cr) · /domains/{d}/backlinks (5 cr) │
│         /search/google?q={brand of d} (1 cr/page)                      │
└────────────────────────────────────────────────────────────────────────┘

Shared contract: src/types/traffic.ts (EXTEND, additive only)
  TrafficResponse (FROZEN) + NEW: BacklinksResponse, GoogleSearchResponse,
  ApiErrorBody (shared by all routes)
Pure shaping helpers (NEW): src/lib/referrers.ts, src/lib/advertisers.ts
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `GET /api/traffic` | Core report proxy. **Do not touch** — its contract, cache, and tests stay valid | FROZEN |
| `GET /api/traffic/referring-sites` | Validate domain → `getBacklinks` → pass-through `BacklinksResponse`; map new upstream errors (503/504) | NEW, clone of existing route pattern |
| `GET /api/traffic/advertisers` | Derive brand query from domain (server-side), optional `page` param → `getGoogleSearch` → pass-through consumed subset of `GoogleSearchResponse` | NEW, clone of existing route pattern |
| `getBacklinks` / `getGoogleSearch` | Upstream HTTP + per-resource cached store (TTL, dedup, prune) + `TrafficApiError` with Vietnamese messages; `fetchImpl` injectable | NEW functions in `tabapi.ts` |
| cached-store factory | Generalizes the existing `successCache`/`inFlightRequests` Maps into `createCachedStore<T>()`; `getTraffic` refactored onto it with identical behavior | EXTEND `tabapi.ts` |
| `groupBacklinksByDomain()` | Pure: backlinks sample → top referring sites (group by `from_url` host, count + max domain_rating) | NEW `src/lib/referrers.ts` |
| `groupPaidResultsByAdvertiser()` | Pure: `paid_results[]` → advertisers with embedded creatives | NEW `src/lib/advertisers.ts` |
| `panel.tsx` | Extracted `Panel`, `InfoButton`, `EmptyCell`, `MetricCard`, `PanelInfo` type + shared loading strip; existing dashboard imports from here | NEW extraction, no behavior change |
| `ReferringSitesPanel`, `AdvertisersPanel`, `CreativesPanel` | One panel per new section; own `PANEL_INFO` entry passed via the existing `Panel info` prop; per-panel loading/empty/error/retry | NEW, co-located `.test.tsx` |
| `useSectionFetch()` | Tiny hook: `{ data, error, loading, retry }` with the existing 20s `AbortController` timeout pattern; used twice (backlinks, advertisers) | NEW |
| `TrafficDashboard` | Orchestrates: core `search()` as today; on core success, fires both section fetches in parallel; renders report layout incl. new panels | EXTEND |
| Report layout / insights | "Consolidated readable report": panel ordering + short narrative takeaways derived by pure functions (e.g. `src/lib/insights.ts`) | NEW, last |
| `BacklinksResponse`, `GoogleSearchResponse` types | Sibling contracts next to `TrafficResponse` in the same file; snake_case pass-through, optional fields where docs are ambiguous | NEW in `src/types/traffic.ts` |
| `ApiErrorBody` | The one error envelope for every route (existing + new) | FROZEN |
| `src/test/fixture.ts` | Add `backlinksFixture`, `googleSearchFixture` next to `trafficFixture` | EXTEND |

## Recommended Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── traffic/
│   │   │   ├── route.ts                  # core — FROZEN
│   │   │   ├── route.test.ts             # core tests — FROZEN
│   │   │   ├── referring-sites/
│   │   │   │   ├── route.ts              # NEW: proxy /domains/{d}/backlinks
│   │   │   │   └── route.test.ts         # NEW: injectable fetchImpl
│   │   │   └── advertisers/
│   │   │       ├── route.ts              # NEW: proxy /search/google (brand query)
│   │   │       └── route.test.ts         # NEW
│   ├── page.tsx                          # unchanged
│   └── layout.tsx                        # unchanged
├── lib/
│   ├── tabapi.ts                         # EXTEND: +getBacklinks, +getGoogleSearch, generic store
│   ├── referrers.ts                      # NEW pure: groupBacklinksByDomain
│   ├── advertisers.ts                    # NEW pure: groupPaidResultsByAdvertiser
│   ├── insights.ts                       # NEW pure: one-line takeaways for report (phase 5)
│   ├── domain.ts / config.ts / format.ts # unchanged (config gains SEARCH_COUNTRY later if needed)
├── components/
│   ├── panel.tsx                         # NEW: extracted primitives + PanelInfo type
│   ├── panel.test.tsx                    # NEW
│   ├── use-section.ts                    # NEW: useSectionFetch hook
│   ├── referring-sites-panel.tsx(+test)  # NEW
│   ├── advertisers-panel.tsx(+test)      # NEW
│   ├── creatives-panel.tsx(+test)        # NEW
│   └── traffic-dashboard.tsx             # EXTEND: orchestration + import extracted primitives
├── types/
│   └── traffic.ts                        # EXTEND: +BacklinksResponse, +GoogleSearchResponse
└── test/
    └── fixture.ts                        # EXTEND: +backlinksFixture, +googleSearchFixture
```

### Structure Rationale

- **Routes under `/api/traffic/*`:** groups all domain-report endpoints under one namespace the dashboard already owns; each is a byte-for-byte clone of the proven route skeleton (validate → config → service → errorResponse), keeping review and test effort minimal.
- **Section contracts as siblings, not merged into `TrafficResponse`:** new data comes from *different upstream calls with different costs and failure modes*; merging would force the core route to fan out, coupling a 5-credit backlinks failure to the core report.
- **Pure shaping helpers in `lib/`:** preserves the "server passes upstream through" convention; grouping/referral-ranking logic stays unit-testable without network, exactly like `format.ts`.
- **Extracted `panel.tsx`:** the codebase map flags the 571-line monolith as an anti-pattern; new panels in separate files *require* shared primitives, so extraction is the minimal honest refactor (move, don't rewrite).

## Architectural Patterns

### Pattern 1: One BFF route per upstream capability (NOT one mega-route)

**What:** each new upstream capability gets its own route handler cloned from `/api/traffic`, its own service function, its own cache store, and its own sibling contract type. `/api/traffic` stays frozen.
**When to use:** when upstream endpoints differ in cost (1 vs 5 credits), latency, availability, and failure modes — always true here.
**Trade-offs:** 3 client fetches instead of 1 (negligible locally, run in parallel); in exchange, a backlinks 502 or google-search 504 can never break the working core report, credits are attributable per section, and each phase ships a complete vertical slice.

Rejected alternative — **enriching `TrafficResponse`**: the traffic route would fan out to 3 upstream endpoints with `Promise.allSettled`, a partial-success envelope would need inventing, every existing `TrafficResponse` fixture/test would churn, and a search would burn +6 credits even if the user only reads the overview. Rejected **aggregator route** (`/api/traffic/extras?sections=...`): same coupling, plus a bespoke envelope that both the route and client must learn. A single-user local tool gains nothing from either.

**Example (new route = existing route with one line changed):**
```typescript
// src/app/api/traffic/referring-sites/route.ts — mirrors existing GET exactly
export async function GET(request: NextRequest) {
  const domain = /* normalizeDomain(...) — identical try/catch as core */;
  const apiKey = process.env.TABAPI_KEY; // identical missing_api_key guard
  try {
    const data = await getBacklinks(domain, apiKey);   // ← the only real difference
    return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=0, must-revalidate" } });
  } catch (error) {
    if (error instanceof TrafficApiError) return errorResponse(error.status, error.code, error.message);
    return errorResponse(502, "unexpected_error", "Không thể lấy dữ liệu website lúc này.");
  }
}
```

### Pattern 2: Generalize the cache, don't duplicate it

**What:** extract the existing `successCache` / `inFlightRequests` Maps into a `createCachedStore<T>()` factory inside `tabapi.ts` (24h TTL, 100-entry prune, in-flight dedup, `clear()`). Instantiate one store per upstream resource. Refactor `getTraffic` onto it **with identical keys and behavior** (its tests must not change).
**When to use:** immediately, as phase-1 groundwork — before the first new endpoint lands.
**Trade-offs:** one small abstraction vs. three copies of cache logic; keys become namespaced (`backlinks:{domain}`, `gsearch:{q}:{country}:{page}`) which also fixes nothing today but keeps eviction fair across resources.

**Example:**
```typescript
function createCachedStore<T>(maxEntries = 100, ttlMs = CACHE_TTL_MS) {
  const entries = new Map<string, { data: T; expiresAt: number }>();
  const inFlight = new Map<string, Promise<T>>();
  async function get(key: string, loader: () => Promise<T>): Promise<T> { /* current getTraffic body, genericized */ }
  function clear() { entries.clear(); inFlight.clear(); }
  return { get, clear };
}
const trafficStore = createCachedStore<TrafficResponse>();
const backlinksStore = createCachedStore<BacklinksResponse>();
const searchStore = createCachedStore<GoogleSearchResponse>();
```

### Pattern 3: Contract evolution — siblings + shared error envelope, additive only

**What:** `TrafficResponse` is frozen. New sections get new top-level types **in the same file** (`src/types/traffic.ts`), keeping the one-contract-file convention. `ApiErrorBody` serves every route. Extend `vietnameseError()` and the status allow-list (`[400, 402, 422, 502]` → add `401, 503, 504`) once in `tabapi.ts`; all routes inherit the Vietnamese messages.
**When to use:** always for this milestone. Old tests/fixtures stay green; the client renders each section from its own type.
**Trade-offs:** three fetches on the client vs. one god-object; per-section `null`/error handling lives in the panel, where `EmptyCell` already provides the pattern.

### Pattern 4: Panel-as-unit UI with per-section fetch + info content

**What:** each new section is one panel component owning its fetch state via `useSectionFetch`, its `PANEL_INFO` entry (content-as-data, passed through the existing `Panel info` prop), and its own loading/empty/error states. The dashboard triggers both section fetches in parallel once the core report succeeds — the report reads as one page, but any section can fail without dimming the rest.
**When to use:** for every new data section; it matches the existing per-panel `EmptyCell` and `aria-live` patterns.
**Trade-offs:** a few extra state hooks (absorbed by the hook) vs. reserving global error banners for the core report only.

**Example:**
```tsx
// inside TrafficDashboard, after core success
const referringSites = useSectionFetch<BacklinksResponse>("/api/traffic/referring-sites", domain, coreLoaded);
const advertisers = useSectionFetch<GoogleSearchResponse>("/api/traffic/advertisers", domain, coreLoaded);
// Panels render independently:
<ReferringSitesPanel state={referringSites} onRetry={referringSites.retry} />
<AdvertisersPanel state={advertisers} onSelectAdvertiser={setSelected} />
{selected ? <CreativesPanel advertisers={advertisers.data} selected={selected} /> : null}
```

## Data Flow

### Request Flow (new sections)

```
User submits domain
    ↓
TrafficDashboard.search()  →  GET /api/traffic?domain=...   (EXISTING, unchanged)
    ↓ core succeeds (coreLoaded = true)
useSectionFetch fires in parallel:
    ├─ GET /api/traffic/referring-sites?domain=d
    │     → getBacklinks(d) ─ cache key "backlinks:{d}" ─ hit? return : dedup+fetch
    │           → TabAPI GET /domains/{d}/backlinks (5 cr) → BacklinksResponse passthrough
    │     → ReferringSitesPanel ← groupBacklinksByDomain() (pure, client)
    └─ GET /api/traffic/advertisers?domain=d&page=1
          → server derives q from registrable label → getGoogleSearch(q, country, page)
                → cache "gsearch:{q}:{country}:{page}" → TabAPI GET /search/google (1 cr)
          → AdvertisersPanel ← groupPaidResultsByAdvertiser() (pure, client)
                → user selects advertiser → CreativesPanel (filtered view, no new fetch)
```

### State Management

```
TrafficDashboard:  domain, data (core, existing), error, loading   ← unchanged
useSectionFetch:   { data, error, loading, retry } per section     ← new, ×2
Panels:            stateless presentational + InfoButton local state (existing pattern)
Server:            three typed Map stores in tabapi.ts (traffic, backlinks, google search)
```

### Key Data Flows

1. **Referring sites:** backlinks sample → group by referring host → ranked table (site, links, DR, top anchor/title). One cache entry per domain, 24h.
2. **Advertisers → creatives:** one `/search/google` payload → two panels. Selecting an advertiser filters the already-fetched paid results — creatives require **zero additional upstream calls** (this is why creatives must not get its own route initially).
3. **Partial failure:** core failure = existing global error banner. Section failure = inline panel error with retry; the rest of the report stays readable — preserving the "one coherent report" goal under degraded upstreams.
4. **Error envelope:** identical `ApiErrorBody` from all three routes; `vietnameseError()` gains 503/504 messages once, centrally.

## Scaling Considerations

This is a single-user local tool — the real constraint is **credit budget**, not users:

| Concern | Today | After extension | Mitigation |
|---------|-------|-----------------|------------|
| Credits per domain search | 3–12 | 9–18 (+5 backlinks, +1 search) | 24h cache per resource (already the pattern); a repeat search costs 0 new credits |
| Client requests per search | 1 | 3 (parallel) | Negligible on localhost; sections run concurrently |
| Cache entries | 100 × traffic | 100 × 3 resources | Store factory keeps per-resource eviction; prune logic shared |
| Upstream latency | one call | max(traffic, backlinks, search) via parallelism | Per-section loading states hide stragglers |
| If credits ever matter more | — | defer backlinks until its panel is on-screen | Swap `useSectionFetch` trigger from "coreLoaded" to IntersectionObserver — one-line change, no route changes |

**First bottleneck:** backlinks cost (5 cr) — it is half the new spend. **Second:** none; nothing here approaches scale limits.

## Anti-Patterns

### Anti-Pattern 1: Merging new sections into `TrafficResponse`
**What people do:** add `referring_sites?`, `advertisers?` to the core contract and fan out inside `/api/traffic`.
**Why it's wrong:** couples an independent 5-credit endpoint's failure/cost to the core report; forces partial-success semantics into a route that currently has clean all-or-nothing error handling; invalidates every existing fixture and test.
**Do this instead:** frozen core contract + sibling section types served by sibling routes.

### Anti-Pattern 2: A creatives-specific BFF route (initially)
**What people do:** mirror advertisers and creatives as two routes, two caches, two upstream calls.
**Why it's wrong:** creatives are the same `paid_results` payload — a second call doubles credit spend for zero information, and TabAPI has no creatives endpoint to call anyway.
**Do this instead:** one advertisers route; creatives = client-side filtered view. Add a dedicated route later only if real creative endpoints appear.

### Anti-Pattern 3: Reshaping upstream payloads in the route
**What people do:** have the route group backlinks by domain or paid results by advertiser before returning.
**Why it's wrong:** breaks the codebase's established pass-through DTO convention and pushes testable logic into the HTTP boundary.
**Do this instead:** pass through; group in pure lib functions (`referrers.ts`, `advertisers.ts`) with unit tests.

### Anti-Pattern 4: Copy-pasting the cache per endpoint
**What people do:** duplicate `successCache`/`inFlightRequests` Maps for backlinks and google-search.
**Why it's wrong:** three copies of TTL/dedup/prune logic = three test surfaces and drift risk (e.g., fixing eviction in one only).
**Do this instead:** one `createCachedStore<T>()` factory; `getTraffic` refactored onto it with unchanged tests.

### Anti-Pattern 5: Growing `traffic-dashboard.tsx` by 3 more panels
**What people do:** paste three new table sections into the 571-line monolith.
**Why it's wrong:** the codebase map already flags this; the file would exceed ~900 lines and panels remain untestable in isolation.
**Do this instead:** extract `panel.tsx` primitives first, then one file per panel with co-located tests.

## Integration Points

### External Services (verified 2026-10-13)

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| TabAPI `GET /domains/{d}/traffic` | existing, untouched | 3–12 cr by months returned |
| TabAPI `GET /domains/{d}/backlinks` | NEW: clone of tabapi client, own store, JSON GET (skip SSE streaming — unnecessary here) | 5 cr; returns a *sample* of top backlinks; may 504 |
| TabAPI `GET /search/google` | NEW: server-side query derivation from domain brand term; `country`/`page` as params | 1 cr/page; `site:` operators are preserved by upstream but brand-term queries are what actually serve ads — validate query choice in the playground during the advertisers phase |
| TabAPI error surface | one shape `{error:{code,message,status,request_id,docs_url}}`, errors never charged | extend passthrough to 401/503/504; add Vietnamese messages for 503/504 |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Panels ↔ dashboard | props (`state`, callbacks) | panels stay stateless except InfoButton |
| Panels ↔ API | `useSectionFetch` (fetch + AbortController) | 20s timeout reused |
| Routes ↔ `tabapi.ts` | `get*` functions, injectable `fetchImpl` | tests mirror `route.test.ts` |
| Client ↔ contract types | sibling types in `src/types/traffic.ts` | `ApiErrorBody` shared |
| Panels ↔ grouping logic | pure lib functions | unit-testable, no network |

## Suggested Build Order (for roadmap)

Dependency-driven; each step is a shippable vertical slice:

1. **Groundwork refactor (no behavior change):** extract `panel.tsx` primitives; generalize `createCachedStore<T>()` in `tabapi.ts` with `getTraffic` untouched behaviorally. *Enables everything; its tests prove no regression.*
2. **Referring sites (Backlinks slice):** `BacklinksResponse` type → `getBacklinks` → route → panel + `PANEL_INFO.referringSites` → `groupBacklinksByDomain`. Highest-value section; also the priciest endpoint (5 cr), so it validates the cache strategy first. Includes the honesty note in the info dialog (backlinks ≠ referral share).
3. **Related advertisers (Google Search slice):** `GoogleSearchResponse` type (defensive optionals — docs example shows fields the reference table omits) → `getGoogleSearch` with server-side brand-query derivation → route → panel. **Phase-level decision to settle here:** which query derivation and default `country` (suggest env-configurable, e.g. `SEARCH_COUNTRY`, default `vn` per the Vietnamese researcher persona).
4. **Ad creatives view:** pure client work on top of phase 3's payload — advertiser selection state + `CreativesPanel` + grouping helper tests. No new route, no new upstream call, no new credits.
5. **Consolidated readable report:** depends on all sections existing. Reorder panels into narrative order, add `src/lib/insights.ts` (pure, tested) deriving one-line Vietnamese takeaways per section, unify badges/units, revisit `hasCoverage`-style empty states for the full report.

**Ordering rationale:** 1 de-risks both extension seams (UI primitives, cache) with zero new behavior; 2 and 3 are independent of each other but each is simpler than anything built on top; 4 depends only on 3's payload; 5 consumes everything and is best done once the content exists to compose. Steps 2–3 are also the right place for a live TabAPI playground check (free docs + 100 free credits) before committing to shapes — the endpoint facts above are LOW-tier per the research seam (vendor docs + homepage, cross-consistent with the live traffic integration) and deserve a one-call confirmation during phase 2 planning.

## Sources

- TabAPI homepage & pricing (endpoint list, credit costs, error semantics) — tabapi.com (fetched 2026-10-13)
- TabAPI API reference — tabapi.com/docs (all 9 endpoints, parameters, response fields, error codes; mirrors at `/docs.txt`, OpenAPI at `/api/v1/openapi.json`)
- Existing codebase as cross-check: `src/lib/tabapi.ts` and `.planning/codebase/ARCHITECTURE.md` match the documented traffic endpoint byte-for-byte (path, params, snake_case, error codes), corroborating the docs' reliability for the sibling endpoints
- Provider confidence per seam: webfetch → LOW (unverified tier); upgraded to "cross-checked" status only via consistency with the vendor's own docs pages and the working codebase integration — one live sandbox call is the definitive confirmation

---
*Architecture research for: Traffic Check — new report sections integration*
*Researched: 2026-10-13*
