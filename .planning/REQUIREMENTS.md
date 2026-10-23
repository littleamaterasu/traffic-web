# Requirements: Traffic Check — Traffic Intelligence Report

**Defined:** 2026-10-13
**Core Value:** An invited marketing researcher enters a domain and receives one readable report that explains its estimated traffic, trend, acquisition channels, leading countries, referring sites, and related Google advertisers and creatives.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Groundwork

- [x] **GRND-01**: Researcher sees no behavior change after shared UI primitives (`Panel`, `InfoButton`, `EmptyCell`, `MetricCard`, `PANEL_INFO`) are extracted into a reusable module
- [x] **GRND-02**: New data sections reuse a generalized cached-store factory that preserves 24h TTL, in-flight dedup, and injectable `fetchImpl` behavior of the existing traffic cache

### Referring Sites

- [ ] **REFS-01**: Researcher can view top referring domains for the analyzed domain, sourced from the TabAPI Backlinks API (5 credits)
- [ ] **REFS-02**: Researcher sees each referring domain with its domain rating (DR) and anchor/link context where the API provides it
- [ ] **REFS-03**: Researcher sees the section honestly labeled as link-based referring domains (not visit-weighted traffic) via panel badge and "i" explainer
- [ ] **REFS-04**: Researcher sees a Vietnamese empty state when the domain has no backlink data, without the report failing
- [ ] **REFS-05**: Referring-sites requests are cached per domain and deduplicated so repeated lookups within 24h do not re-bill credits

### Related Advertisers

- [ ] **ADVR-01**: Researcher can view advertisers related to the analyzed domain, synthesized from Google Search `paid_results` (1 credit per query) — ⚠ partial: advertisers are delivered through the Google Ads Transparency panel (SerpAPI, commit 300b113), not through SERP `paid_results`
- [ ] **ADVR-02**: Researcher sees each advertiser with its displayed ad text and display URL from the SERP snapshot — ⚠ unverified/partial: advertiser cards show creative counts and formats; per-creative text appears only in the on-demand detail box; no display URL
- [ ] **ADVR-03**: Researcher sees a Vietnamese empty state when no paid results exist for the query, without the report failing — ⚠ code shows a Vietnamese empty state for the Transparency panel ("Không tìm thấy quảng cáo nào cho tên miền này."); SERP `paid_results` empty state does not exist
- [ ] **ADVR-04**: Advertiser queries are cached and deduplicated like other sections to limit credit spend — ⚠ the ads routes cache and dedup via `createCachedStore` (`src/lib/ads-transparency.ts`, 24h); SERP-based advertiser queries do not exist

### Ad Creatives

- [ ] **CRTV-01**: Researcher can view creatives (headline, display URL, description) as a client-side filtered view of the advertisers payload, costing no extra credits — ⚠ partial: creative cards (preview image, format, size, first/last shown, status) exist via Transparency, but each load costs a SerpApi call and there is no headline/description
- [ ] **CRTV-02**: Researcher can open the ad's landing page from a creative card — ⚠ only a Google details link ("Xem trên Google"); no landing page link in the Transparency panel. The SE Ranking ad copy section shows landing pages on demand

### Readable Report

- [ ] **RPT-01**: Researcher reads sections in a canonical report order (traffic → trend → sources → referring sites → countries → keywords → advertisers/creatives → AI referrals)
- [ ] **RPT-02**: Researcher sees a short Vietnamese takeaway per new section explaining what it means
- [ ] **RPT-03**: Researcher sees "—" and Vietnamese empty states for every nullable/absent metric instead of errors or zeros
- [ ] **RPT-04**: Researcher is never blocked by a single section failing — each section shows its own loading/error/retry state while the rest of the report renders

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Ad Creatives (enhanced)

- ~~**CRTV-02b**~~: Promoted to v1 as ADLG-01 (2026-10-14)
- **CRTV-03**: Landing-page screenshots for creatives (TabAPI Web Reader + download-and-serve, 1 credit on demand)

### Referring Sites (enhanced)

- **REFS-06**: Visit-weighted referral traffic share per referrer (blocked: no TabAPI endpoint provides it)
- **REFS-07**: Full backlink pagination beyond the top sample

### Advertisers (enhanced)

- **ADVR-05**: Per-advertiser estimated spend/traffic metrics (blocked: no data source)
- **ADVR-06**: Multi-keyword SERP fan-out for deeper advertiser coverage (credit-budget decision deferred)

### Affiliate Domain Vetting (milestone direction decided 2026-10-14)

Source: domain-check checklist; analysis and decisions in `.planning/research/DOMAIN-CHECK-FRAMEWORK.md`. Google-only for ads; Meta/TikTok deferred (see v2).

**Persistence & Domain Profile**

- [ ] **PERS-01**: Lookups, snapshots, and researcher-entered affiliate inputs persist per domain across server restarts in a local database (engine chosen at Phase 5 planning gate)
- [ ] **PERS-02**: Traffic and ad data are stored as timestamped snapshots so time-series can be derived later
- [ ] **VET-01**: Researcher sees zero-credit derived callouts from existing data — Tier-1 geo share (US/UK/CA/AU), brand vs non-brand keyword split, referral/paid-search share, threshold badges (visits, bounce rate)
- [ ] **VET-02**: Researcher sees domain age (years since creation), registrar, expiry, last-updated date, status flags, nameservers, and privacy-protected indicator from the WhoisXML WHOIS API (1 credit, cached 24h), with a short Vietnamese verdict on age (e.g., <1 năm / 1–3 năm / >3 năm per the checklist's 2–3 year trust threshold)
- [ ] **VET-06**: Researcher can load, on explicit click only (credit-aware: preview first, fixed record cap), the domain's WHOIS history from the WhoisXML WHOIS History API and sees a compact change timeline (registrar, nameserver, registrant-organization/privacy and expiry changes with dates) with a Vietnamese volatility summary; raw WHOIS text is never sent to the browser (provider history replaces the earlier own-snapshot approach, so no persistence is needed)
- [ ] **TRST-01**: Researcher sees the domain's Trustpilot score and review count (with link to the Trustpilot page), fetched server-side and cached 24h
- [ ] **TRST-02**: Researcher sees a Vietnamese empty state when the domain has no Trustpilot page or the source is unreachable, without the report failing; the figure is labeled with source and fetch date
- [ ] **VET-03**: Researcher sees an affiliate-link signal from the Backlinks sample (`?ref=`/`?via=`/`?aff=` in `to_url`)

**Google Ad Longevity (SerpAPI)**

- [ ] **ADLG-01**: Researcher sees Google Ads Transparency creatives for the domain with first/last shown dates, via SerpAPI behind a server-side optional `SERPAPI_KEY` — ✓ delivered via 300b113 (SerpAPI Transparency, `SERPAPI_KEY` required, not optional); requirement text needs re-check against actual behavior
- [ ] **ADLG-02**: Researcher sees active Google ad count and Winning Ad Ratio (share of ads running >30d) — ⚠ partial: active count yes (shown in the last 7 days, `ACTIVE_WINDOW_DAYS`=7); Winning Ad Ratio not computed (`LONG_RUNNING_DAYS`=30 only drives a per-creative "Chạy lâu" badge and longest-running highlight)
- [ ] **ADLG-03**: Researcher sees unique advertiser count and Advertiser Saturation Index (ASI) — ⚠ partial: unique advertiser count yes; ASI not computed
- [ ] **ADLG-04**: Without `SERPAPI_KEY`, the report falls back to the Phase 3 SERP-synthesis view and labels longevity as unavailable — ✗ not delivered: `SERPAPI_KEY` is required, `/api/ads` and `/api/ads/detail` return 500 `missing_api_key`, no fallback

**SE Ranking (supplementary SEO / paid data)**

- [~] ~~**SERK-01**: Researcher sees worldwide organic and paid keyword count, estimated traffic and traffic value from SE Ranking `domain/overview/worldwide`, labeled as SE Ranking estimates distinct from TabAPI~~ Dropped 2026-10-23: SE Ranking overview overlaps TabAPI and the numbers disagree
- [x] **SERK-02**: Researcher can load, on explicit click, SE Ranking ad copy (title/description/display URL) and landing page for paid keywords from `domain/keywords?type=adv` (source db `us` by default, top 10); volume/CPC intentionally not shown
- [x] **SERK-03**: Researcher can load advertiser competitors from `domain/competitors?type=adv` only by explicit click (never automatically), with common-keyword counts and relevance
- [x] **SERK-04**: Researcher can load, on explicit click only (never automatically; ~100 credits), a backlinks summary from `backlinks/summary` (backlinks, referring domains, dofollow share, domain inlink rank, top anchors)
- [x] **SERK-05**: `SE_RANKING_API_KEY` is read server-side only; absent key, upstream error or empty data yields a Vietnamese state without failing the report; results are cached 24h with in-flight dedup via `createCachedStore`; competitors, backlinks and ad copy are fetched on demand only

**Affiliate Terms (three-tier data)**

- [ ] **AFFL-01**: Tier 1 (auto) — researcher sees whether the domain has an affiliate program, its link, and the detected network (from URL pattern), at ≤1 credit
- [ ] **AFFL-02**: Tier 2 (suggested) — on an explicit "Lấy thông tin affiliate" action, Web Reader scans the program/ToS pages and proposes payout, cookie days, and brand-bidding/direct-linking mentions, each with source snippet and link; scan costs ~2–3 credits and never runs automatically
- [ ] **AFFL-03**: Tier 3 (manual) — researcher can enter or correct payout, cookie, policy flags, EPC, and manager notes; each field stores `source` (auto/suggested/manual), `source_url`, and `confirmed_at`, and is shown with a source badge

**Unit Economics**

- [ ] **ECON-01**: Researcher can set payout, funnel CR (default 1.5–3%), and target margin in a collapsed panel with defaults; report works fully without them
- [ ] **ECON-02**: Researcher sees Projected EPC, Max CPC, and Arbitrage Spread against the domain's keyword CPC, computed client-side at zero credits
- [ ] **ECON-03**: Results based on unconfirmed (suggested) inputs are labeled as unconfirmed estimates

### Social Ads & Reputation (deferred by decision, 2026-10-14)

- **SOCL-01**: Meta Ad Library active-ad volume and creative age (needs third-party scraper; official API excludes commercial non-EU ads)
- **SOCL-02**: TikTok Creative Center ads
- **SOCL-03**: Wayback history, Scamadviser/Reddit risk signals (Trustpilot promoted to v1 as TRST-01/02 on 2026-10-15)
- **TRST-03**: Individual Trustpilot review text/themes (refund, scam keywords), rating distribution, review trend over time

### Scoring & Ranking (v2)

- **VET-04**: Heuristic referrer classification (`is_affiliate_site`) enabling Affiliate Reliance Score (ARS)
- **VET-05**: Composite Affiliate Opportunity Score (AOS) and ranking of saved domains (persistence now accepted; multi-domain mode still undecided)
- **AFFL-04**: Pull payout/EPC directly from Impact/CJ/ShareASale/PartnerStack publisher APIs (needs joined accounts, per-network integration)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| User authentication / invite system | Single-user local tool; "invited researcher" is the persona, not an auth feature |
| Google Ads API (official) integration | Advertiser-scoped (OAuth + developer token) — cannot look up third-party advertisers |
| Scraping Google Ads Transparency Center directly | Client-rendered JS shell, ToS-risky; SerpAPI is the sanctioned path in v2 |
| Per-advertiser spend/impressions metrics | No viable data source; would be false precision |
| PDF/CSV export | Not requested for this milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GRND-01 | Phase 1 | Complete |
| GRND-02 | Phase 1 | Complete |
| REFS-01 | Phase 2 | Pending |
| REFS-02 | Phase 2 | Pending |
| REFS-03 | Phase 2 | Pending |
| REFS-04 | Phase 2 | Pending |
| REFS-05 | Phase 2 | Pending |
| ADVR-01 | Phase 3 | Partial (via Transparency, 300b113) |
| ADVR-02 | Phase 3 | Partial |
| ADVR-03 | Phase 3 | Pending |
| ADVR-04 | Phase 3 | Pending |
| CRTV-01 | Phase 3 | Partial |
| CRTV-02 | Phase 3 | Partial |
| RPT-01 | Phase 4 | Pending |
| RPT-02 | Phase 4 | Pending |
| RPT-03 | Phase 4 | Pending |
| RPT-04 | Phase 4 | Pending |
| PERS-01 | Phase 5 | Pending |
| PERS-02 | Phase 5 | Pending |
| VET-01 | Phase 5 | Pending |
| VET-02 | Phase 9 | Pending |
| VET-06 | Phase 9 | Pending |
| TRST-01 | Phase 5 | Pending |
| TRST-02 | Phase 5 | Pending |
| ADLG-01 | Phase 6 | Complete (needs re-check, 300b113) |
| ADLG-02 | Phase 6 | Partial |
| ADLG-03 | Phase 6 | Partial |
| ADLG-04 | Phase 6 | Pending |
| AFFL-01 | Phase 7 | Pending |
| AFFL-02 | Phase 7 | Pending |
| AFFL-03 | Phase 7 | Pending |
| VET-03 | Phase 7 | Pending |
| ECON-01 | Phase 7 | Pending |
| ECON-02 | Phase 7 | Pending |
| ECON-03 | Phase 7 | Pending |
| SERK-01 | Phase 8 | Dropped |
| SERK-02 | Phase 8 | Complete |
| SERK-03 | Phase 8 | Complete |
| SERK-04 | Phase 8 | Complete |
| SERK-05 | Phase 8 | Complete |

Note: Phase 8 human UAT is still pending; the SERK statuses reflect code, not UI verification. ADVR-03/04 stay Pending (the SERP `paid_results` behavior does not exist).

**Coverage:**

- v1 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-13*
*Last updated: 2026-10-23 (reality-check sync with implemented code; statuses: Pending/Partial/Complete/Dropped)*
