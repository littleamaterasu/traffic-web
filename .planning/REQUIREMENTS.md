# Requirements: Traffic Check — Traffic Intelligence Report

**Defined:** 2026-10-13
**Core Value:** An invited marketing researcher enters a domain and receives one readable report that explains its estimated traffic, trend, acquisition channels, leading countries, referring sites, and related Google advertisers and creatives.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Groundwork

- [ ] **GRND-01**: Researcher sees no behavior change after shared UI primitives (`Panel`, `InfoButton`, `EmptyCell`, `MetricCard`, `PANEL_INFO`) are extracted into a reusable module
- [ ] **GRND-02**: New data sections reuse a generalized cached-store factory that preserves 24h TTL, in-flight dedup, and injectable `fetchImpl` behavior of the existing traffic cache

### Referring Sites

- [ ] **REFS-01**: Researcher can view top referring domains for the analyzed domain, sourced from the TabAPI Backlinks API (5 credits)
- [ ] **REFS-02**: Researcher sees each referring domain with its domain rating (DR) and anchor/link context where the API provides it
- [ ] **REFS-03**: Researcher sees the section honestly labeled as link-based referring domains (not visit-weighted traffic) via panel badge and "i" explainer
- [ ] **REFS-04**: Researcher sees a Vietnamese empty state when the domain has no backlink data, without the report failing
- [ ] **REFS-05**: Referring-sites requests are cached per domain and deduplicated so repeated lookups within 24h do not re-bill credits

### Related Advertisers

- [ ] **ADVR-01**: Researcher can view advertisers related to the analyzed domain, synthesized from Google Search `paid_results` (1 credit per query)
- [ ] **ADVR-02**: Researcher sees each advertiser with its displayed ad text and display URL from the SERP snapshot
- [ ] **ADVR-03**: Researcher sees a Vietnamese empty state when no paid results exist for the query, without the report failing
- [ ] **ADVR-04**: Advertiser queries are cached and deduplicated like other sections to limit credit spend

### Ad Creatives

- [ ] **CRTV-01**: Researcher can view creatives (headline, display URL, description) as a client-side filtered view of the advertisers payload, costing no extra credits
- [ ] **CRTV-02**: Researcher can open the ad's landing page from a creative card

### Readable Report

- [ ] **RPT-01**: Researcher reads sections in a canonical report order (traffic → trend → sources → referring sites → countries → keywords → advertisers/creatives → AI referrals)
- [ ] **RPT-02**: Researcher sees a short Vietnamese takeaway per new section explaining what it means
- [ ] **RPT-03**: Researcher sees "—" and Vietnamese empty states for every nullable/absent metric instead of errors or zeros
- [ ] **RPT-04**: Researcher is never blocked by a single section failing — each section shows its own loading/error/retry state while the rest of the report renders

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Ad Creatives (enhanced)

- **CRTV-02b**: True ad creatives from Google Ads Transparency Center via SerpAPI behind optional `SERPAPI_KEY` (first/last shown dates, image/video assets)
- **CRTV-03**: Landing-page screenshots for creatives (TabAPI Web Reader + download-and-serve, 1 credit on demand)

### Referring Sites (enhanced)

- **REFS-06**: Visit-weighted referral traffic share per referrer (blocked: no TabAPI endpoint provides it)
- **REFS-07**: Full backlink pagination beyond the top sample

### Advertisers (enhanced)

- **ADVR-05**: Per-advertiser estimated spend/traffic metrics (blocked: no data source)
- **ADVR-06**: Multi-keyword SERP fan-out for deeper advertiser coverage (credit-budget decision deferred)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| User authentication / invite system | Single-user local tool; "invited researcher" is the persona, not an auth feature |
| Database / persistence | In-memory cache is sufficient; server restart clearing cache is accepted |
| Google Ads API (official) integration | Advertiser-scoped (OAuth + developer token) — cannot look up third-party advertisers |
| Scraping Google Ads Transparency Center directly | Client-rendered JS shell, ToS-risky; SerpAPI is the sanctioned path in v2 |
| Per-advertiser spend/impressions metrics | No viable data source; would be false precision |
| PDF/CSV export | Not requested for this milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GRND-01 | Phase 1 | Pending |
| GRND-02 | Phase 1 | Pending |
| REFS-01 | Phase 2 | Pending |
| REFS-02 | Phase 2 | Pending |
| REFS-03 | Phase 2 | Pending |
| REFS-04 | Phase 2 | Pending |
| REFS-05 | Phase 2 | Pending |
| ADVR-01 | Phase 3 | Pending |
| ADVR-02 | Phase 3 | Pending |
| ADVR-03 | Phase 3 | Pending |
| ADVR-04 | Phase 3 | Pending |
| CRTV-01 | Phase 3 | Pending |
| CRTV-02 | Phase 3 | Pending |
| RPT-01 | Phase 4 | Pending |
| RPT-02 | Phase 4 | Pending |
| RPT-03 | Phase 4 | Pending |
| RPT-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-13*
*Last updated: 2026-10-13 after roadmap creation (traceability mapped to 4 phases)*
