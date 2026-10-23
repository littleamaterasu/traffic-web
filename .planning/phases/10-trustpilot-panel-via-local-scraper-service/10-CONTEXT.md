# Phase 10: Trustpilot Panel via Local Scraper Service - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Source:** User request + live probe of the user's scraper (no discuss-phase run)

<domain>
## Phase Boundary

Answer the checklist question about reputation/social proof ("độ uy tín & social proof"): show the domain's Trustpilot profile and latest reviews, presented like the Trustpilot page. Data comes from a Trustpilot scraper service the user built and runs locally (`http://127.0.0.1:5000`), NOT from the official Trustpilot API. One new independent report section. Out of scope: running or modifying the scraper itself, other review sites, persistence/DB, storing review text, rating histograms or profile logos/categories (the scraper does not return them yet).
</domain>

<decisions>
## Implementation Decisions

### Architecture (locked by AGENTS.md conventions)
- New lib `src/lib/trustpilot.ts`: HTTP client + `createCachedStore<T>()` (24h TTL, in-flight dedup), injectable `fetchImpl: typeof fetch = fetch`, typed `TrustpilotApiError` (sets `this.name`, carries `status` and `code`), `clearTrustpilotCache()` for tests, Vietnamese user messages, English snake_case codes. Types in `src/types/trustpilot.ts`.
- Route `GET /api/trustpilot?domain=` (nodejs runtime, `Cache-Control: private, max-age=0, must-revalidate`; validation order `normalizeDomain` -> config read -> upstream). Response envelope `{domain, trustpilot: {data, error}}` like the other on-demand sections; unknown errors replaced by a generic Vietnamese message. The scraper base URL is read server-side from env `TRUSTPILOT_SCRAPER_URL` (document it in `.env.example` as an empty placeholder with a Vietnamese comment, default behavior when unset: respond `missing_scraper_url` 500 with a Vietnamese message; do NOT hard-code 127.0.0.1 in source except as a documented example in the comment). The browser must never receive the scraper URL.
- UI: new client component `src/components/trustpilot-panel.tsx` composed from `src/components/panel.tsx` primitives, `satisfies PanelInfo` info constant (Vietnamese). Rendered from `traffic-dashboard.tsx` `Results` via a single import and one JSX line `<TrustpilotPanel key={data.domain} domain={data.domain} />`, with its own idle/loading/ready/error states. The call is slow (~21 s observed for 1 page) so it loads ONLY on explicit click ("Tải đánh giá Trustpilot"), shows a clear loading state, uses a client timeout of about 60 s (module const) and shows "Thử lại" on error; reset on domain change; hidden/disabled after success; do NOT abort on cleanup (aborting on cleanup caused a StrictMode AbortError in the WHOIS panel; use `active`/mounted guards and timeout-only abort).
- Tests co-located, Vietnamese descriptions, injected/stubbed fetch only (NO real network, no call to 127.0.0.1:5000), typed fixture `src/test/trustpilot-fixture.ts`. Update `traffic-dashboard.test.tsx` fetch stubs so the new panel never receives traffic JSON, and assert no `/api/trustpilot` request happens without a click.

### Upstream contract (verified live 2026-10-23)
`POST {TRUSTPILOT_SCRAPER_URL}/api/reviews` with headers `Content-Type: application/json` and body `{"domain": "<domain>", "max_pages": 1, "limit": 5}` returned HTTP 200 in ~21 s:
```
{
  "success": true,
  "target": "gohighlevel.com",
  "total": 5,
  "trustpilot_url": "https://www.trustpilot.com/review/gohighlevel.com",
  "business": { "id": "...", "name": "HighLevel", "numberOfReviews": 15255, "stars": 5, "trustScore": 4.9, "website": "https://www.gohighlevel.com" },
  "reviews": [ { "id": "...", "author": "...", "heading": "...", "body": "...", "date": "2026-10-23", "location": "HN", "rating": 5 } ]
}
```
- Constants to use from the server: `max_pages = 1`, `limit = 5` (fixed in code, never taken from the client).
- `GET /health` returns `{"service":"trustpilot-scraper-api","status":"ok"}`. The user mentioned a second scraper API but only showed this one; do not depend on it.
- Failure cases are not yet characterized (domain without a Trustpilot page, scraper errors): treat `success !== true`, non-2xx, network error, timeout and malformed bodies as errors with Vietnamese messages; a body with `success:true` but no `business` is an empty state ("Chưa có hồ sơ Trustpilot cho tên miền này").
- Normalize/validate the response server-side: whitelist fields, coerce numbers (`trustScore` 0–5, `stars` 0–5, `numberOfReviews` >= 0, `rating` 1–5), strings trimmed and length-capped (heading ~200, body ~2000, author ~100, location ~20), dates kept as `YYYY-MM-DD` strings or null, `website` and `trustpilot_url` kept only if they start with `https://` or `http://`. Never pass through unknown fields.
- The scraper is the user's own service; its latency and Trustpilot's anti-bot behavior are outside our control. Document in the info text that data is scraped from the public Trustpilot page and may be unavailable or stale.

### Presentation ("giống hệt Trustpilot" — as far as the data allows)
- Header card: business name (large), "Reviews 15,255" style count (vi-VN formatting, label in Vietnamese e.g. "15.255 đánh giá"), TrustScore number (e.g. 4.9) next to Trustpilot-style star boxes (five square green boxes with white stars; fill according to `stars`, partial/half rendering per rounding rules, Trustpilot green `#00b67a`, grey `#dcdce6` for empty), link "Xem trên Trustpilot" to `trustpilot_url`, button/link "Truy cập website" to `business.website`, both `target="_blank" rel="noopener noreferrer"`.
- Review cards: star boxes by `rating`, bold heading, body text, author name, location code, date formatted with `formatDate` from `src/lib/format.ts` (vi-VN, UTC). Render all strings as React text only (no HTML).
- Fields visible in the user's Trustpilot screenshot but NOT returned by the scraper today: profile logo, "Claimed profile • Aug 2018", category breadcrumb (e.g. Software Company), rating distribution. Make the types and component accept OPTIONAL `logo_url`, `claimed_since`, `categories` (string[]), `rating_distribution` so the panel can show them automatically once the scraper adds them, but do NOT invent or fetch them now; render nothing when absent. Record in the phase docs that the scraper owner must add these fields to match the Trustpilot header exactly.

### Credit/ToS note
- Scraping Trustpilot's public pages may violate Trustpilot's terms of service; this is the user's decision. Keep the panel's info text honest about the source. No review text or personal data is persisted: cache only in memory for 24h (no DB, no files).

### Claude's Discretion
- Exact component split (header, star boxes, review card), Vietnamese copy, star-box rounding helper (pure function with unit tests), client timeout constant value, whether to expose a `retry` token pattern like WhoisPanel.
</decisions>

<canonical_refs>
## Canonical References

- `AGENTS.md` — conventions (naming, error handling, BFF/cache patterns, Vietnamese locale, no comments, no ad-hoc logging)
- `.planning/REQUIREMENTS.md` (TRST-01, TRST-02), `.planning/ROADMAP.md` (Phase 10)
- Patterns to mirror: `src/lib/whois.ts`, `src/app/api/whois/route.ts` and `.../history/route.ts` (+ tests), `src/components/whois-panel.tsx` (on-demand history section, no abort on cleanup), `src/components/seranking-panel.tsx`, `src/components/panel.tsx`, `src/components/traffic-dashboard.tsx` (where panels mount), `src/lib/cached-store.ts`, `src/lib/domain.ts`, `src/lib/format.ts`, `src/test/whois-fixture.ts`
</canonical_refs>

<specifics>
- Panel title idea: "Đánh giá Trustpilot"; badge "Nguồn: Trustpilot (scraper nội bộ)".
- Env var: `TRUSTPILOT_SCRAPER_URL` (server-side only; no `NEXT_PUBLIC_`).
</specifics>

<deferred>
## Deferred Ideas

- Logo, claimed-profile date, categories and rating distribution (needs scraper changes)
- More than 5 reviews / multiple pages, filtering by stars, review sentiment keywords (refund, scam)
- Official Trustpilot Business Units / Data Solutions API (needs approved key)
- Persisting Trustpilot snapshots (Phase 5 DB; avoid storing review text)
- The scraper's second API (unspecified)
</deferred>

---

*Phase: 10-trustpilot-panel-via-local-scraper-service*
*Context gathered: 2026-10-23*
