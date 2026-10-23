# Phase 9: Domain Age and WHOIS History via WhoisXML API - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Source:** User request + live API probe (no discuss-phase run)

<domain>
## Phase Boundary

Answer the checklist question "tuổi thọ & lịch sử domain": how old is the analyzed domain and how stable has it been. Data comes from the WhoisXML API (key `WHOIS_API_KEY`, server-side only). Adds one independent report section; existing TabAPI/Ads/SE Ranking sections and `/api/traffic` are untouched. Out of scope: Trustpilot, persistence/DB, Wayback, other WhoisXML products (Domain Reputation, Website Categorization) — deferred ideas only.
</domain>

<decisions>
## Implementation Decisions

### Architecture (locked by AGENTS.md conventions)
- New lib `src/lib/whois.ts` owns HTTP + cache: `createCachedStore<T>()` (one store per endpoint), injectable `fetchImpl: typeof fetch = fetch`, typed `WhoisApiError` (sets `this.name`, carries `status` and `code`), `clearWhoisCache()` for tests, Vietnamese user messages, English snake_case codes. Types in `src/types/whois.ts`.
- Routes (nodejs runtime, `Cache-Control: private, max-age=0, must-revalidate`, validation order `normalizeDomain` -> key read `process.env.WHOIS_API_KEY` -> upstream): `GET /api/whois?domain=` (current record) and `GET /api/whois/history?domain=` (on demand). Response envelope per slice `{domain, <slice>: {data, error}}` like the SE Ranking routes; missing key -> 500 `missing_api_key` with Vietnamese message; unknown errors replaced by a generic Vietnamese message; the key must never appear in any response, error text, cache key or test fixture.
- UI: new client component `src/components/whois-panel.tsx` composed from `src/components/panel.tsx` primitives (`Panel`, `InfoButton`, `EmptyCell`, `MetricCard`), with `satisfies PanelInfo` info constants (Vietnamese). Rendered from `traffic-dashboard.tsx` `Results` next to the other independent panels (`<WhoisPanel key={data.domain} domain={data.domain} />`), with its own loading/error/empty states so a failure never affects the rest of the report.
- Current record: loads automatically on mount (1 credit, cached 24h). History: loads ONLY on explicit click ("Tải lịch sử domain"), idle -> loading -> ready/error with "Thử lại", hidden after success, reset on domain change — same pattern as the SE Ranking on-demand sections in `src/components/seranking-panel.tsx`.
- Tests co-located, Vietnamese descriptions, injected fetch only (no network, no real keys), typed fixtures in `src/test/whois-fixture.ts`.
- `.env.example` already contains `WHOIS_API_KEY` as an empty placeholder — keep it empty.

### Upstream APIs (verified live 2026-10-23, trial key)
- Current record: `GET https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=<key>&domainName=<d>&outputFormat=JSON` → `WhoisRecord` with `createdDate`, `updatedDate`, `expiresDate` (ISO strings, top level or under `registryData`), `estimatedDomainAge` (days), `registrarName`, `status` (space-separated string), `nameServers.hostNames[]`, `registrant` (privacy services show organization like "Domains By Proxy, LLC" / redacted). 1 credit. Example (public domain): created 2017-01-11, estimatedDomainAge 3571 days, registrar GoDaddy.com, LLC.
- History preview: `GET https://whois-history.whoisxmlapi.com/api/v1?apiKey=<key>&domainName=<d>&mode=preview` → `{"recordsCount": N}` (1 credit).
- History purchase: same URL with `mode=purchase` → `{recordsCount, records: [...]}`; each record has `audit` (observation date), `createdDateISO8601`, `updatedDateISO8601`, `expiresDateISO8601`, `registrarName`, `nameServers` (array whose entries may be pipe-joined strings like "a.ns.com|b.ns.com" — normalize/split), `status[]`, `registrantContact.organization`, plus heavy `rawText`/`cleanText`/contacts that MUST be dropped server-side. Cost observed: 44 records cost 50 credits (~1 per record + overhead) — cost scales with record count.
- Auth: `apiKey` is a query parameter on these endpoints; build the upstream URL ONLY from the fixed base + hard-coded path + `URLSearchParams` (no concatenation of user input into host/path); never log or echo the URL.
- Trial balances at probe time: WHOIS API 500, Domain Research Suite ~448 (history). Credits are finite: be frugal.

### Credit discipline (locked)
- History route first calls `mode=preview`; if `recordsCount` > `HISTORY_RECORD_CAP` (module const, suggest 100) it returns a per-slice error with code `too_many_records` and a Vietnamese message including the count, WITHOUT purchasing. Otherwise it calls `mode=purchase`. Cache the compact result per domain for 24h with in-flight dedup (one store for preview, one for the compact history, or one combined — planner's choice, but a second click must not re-buy).
- Never send raw WHOIS text, contacts, emails or phone numbers to the browser.

### Domain-logic decisions
- Age: derive years from `createdDate` (fallback `estimatedDomainAge`); Vietnamese verdict buckets: <1 năm "Domain rất mới", 1–3 năm "Domain còn mới", >3 năm "Domain lâu năm" (final wording planner's choice, consistent tone). Pure helper in `src/lib/whois.ts` or `src/lib/whois-insights.ts` with unit tests (boundary cases: exactly 1 and 3 years, missing dates -> null).
- Privacy indicator: true when registrant organization/name matches privacy/proxy/redacted patterns (e.g. "privacy", "proxy", "redacted", "whoisguard", "domains by proxy") — heuristic, label as such in the info text.
- History compaction: sort records by `audit` ascending; emit a change event whenever registrar, normalized nameserver set, registrant organization (privacy on/off included), or expiry year differ from the previous distinct record; each event `{date (audit), field, from, to}`; summary `{records, first_seen (earliest audit), changes_total, registrar_changes, nameserver_changes, registrant_changes}`. Cap emitted events (e.g. latest 30) in the response. Pure function with unit tests (identical consecutive records produce no event; pipe-joined nameservers normalize; empty history -> empty summary).
- Vietnamese volatility summary computed client-side or server-side from the summary counts (planner's choice), without claiming "ổn định" when there are zero records; honest empty state when the provider has no history for the domain.

### Claude's Discretion
- File split (`whois.ts` vs separate insights file), exact Vietnamese copy, number formatting via `src/lib/format.ts`, record cap constant value, event cap, panel layout (MetricCards for age/registrar/expiry/updated/nameservers/status + timeline list).
</decisions>

<canonical_refs>
## Canonical References

- `AGENTS.md` — conventions (naming, error handling, BFF/cache patterns, Vietnamese locale, no comments, no ad-hoc logging)
- `.planning/REQUIREMENTS.md` (VET-02, VET-06), `.planning/ROADMAP.md` (Phase 9), `.planning/research/DOMAIN-CHECK-FRAMEWORK.md`
- Patterns to mirror: `src/lib/seranking.ts`, `src/lib/cached-store.ts`, `src/app/api/seranking/ads/route.ts` and `.../backlinks/route.ts` (+ route tests), `src/components/seranking-panel.tsx` (on-demand section + info constants), `src/components/panel.tsx`, `src/components/traffic-dashboard.tsx` (where panels are mounted), `src/lib/domain.ts`, `src/lib/format.ts`, `src/test/seranking-fixture.ts`
- WhoisXML docs: https://whoisxmlapi.com/documentation/ (WHOIS API, WHOIS History API)
</canonical_refs>

<specifics>
- Panel title idea: "Tuổi thọ & lịch sử domain (WhoisXML)"; badge naming the source.
- Timeline items show date, field label in Vietnamese (Nhà đăng ký / Name server / Chủ sở hữu / Hết hạn) and from -> to.
</specifics>

<deferred>
## Deferred Ideas

- Persisting snapshots in a DB (Phase 5 persistence)
- Trustpilot (Phase 5), Wayback
- WhoisXML Domain Reputation API (credits 50 on trial) for a reputation score; Website Categorization API (credits 100) for business-category hints — possible later phases
- Showing individual raw WHOIS records
</deferred>

---

*Phase: 09-domain-age-and-whois-history-via-whoisxml-api*
*Context gathered: 2026-10-23*
