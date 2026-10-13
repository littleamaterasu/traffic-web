# Feature Research

**Domain:** Website traffic intelligence reports — referring sites, related Google advertisers/creatives, single readable domain report
**Researched:** 2026-10-13
**Confidence:** HIGH on competitor feature patterns (read from official vendor docs: SimilarWeb Knowledge Center, Semrush KB, Ahrefs Academy, TapClicks/iSpionage notice, TabAPI docs); MEDIUM on SpyFu UI specifics (site is JS-rendered; corroborated across 3+ independent reviews); MEDIUM on Google Ads Transparency Center behavior (multiple consistent third-party guides, no single official spec page fetched)

**Scope note (affects every row below):** This app's only data source is TabAPI v1 (9 endpoints, verified against tabapi.com/docs on 2026-10-13). Two facts constrain what "table stakes" can mean here:

1. **Referring sites:** TabAPI has NO "referring sites by traffic" endpoint. The Backlinks API (5 credits) returns an overview (domain_rating 0–100, backlinks count, referring_domains count, dofollow % for both) plus a **sample** of top backlinks (`from_url`, `to_url`, `title`, `anchor`, `domain_rating`). The Traffic API's `traffic_sources.referrals` / `paid_referrals` give aggregate channel share. There is **no per-referring-domain traffic share, no per-referrer MoM change, no engagement score, no first-seen dates**.
2. **Advertisers/creatives:** TabAPI has **no domain→advertiser endpoint and no ad-creative library**. The Google Search API (1 credit/call) returns `paid_results` (position, placement `top|bottom`, title, link, snippet) **per query**; Reverse AdSense (3 credits) maps a publisher-id→domains. "Related advertisers" must be synthesized by running the domain's top keywords through the SERP API, or flagged as data-blocked.

Feature categories below are therefore judged against: (a) what the competitor products show, (b) what TabAPI can actually feed, and (c) the phase goal of **one consolidated readable report** (PROJECT.md).

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in a domain report with referral + ad sections. Missing these = the report feels broken compared to free tools (SimilarWeb's free profile, Google's Transparency Center).

**Referring sites section**

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Ranked referring-site list (top N, grouped by domain) | Every tool leads with a ranked list (SimilarWeb Referring Websites, Ahrefs Referring Domains, Semrush Referring Domains). A flat backlink dump grouped by nothing is the #1 way this section reads as unfinished | MEDIUM | Group TabAPI's backlinks sample by `from_url` registrable domain; rank by link count, tie-break by domain_rating. Must label as "sample" — TabAPI returns a sample, not the full index |
| Per-referring-site row metrics: strength + link count | SimilarWeb shows rank/category/share; Ahrefs shows links-to-target + DR-style metrics. Rows of bare domains with no numbers read as a debug dump | LOW | Domain + DR (0–100) + number of links from that domain in the sample. All fields exist in TabAPI response |
| Total referral context (volume + share) above the table | SimilarWeb's Incoming Traffic opens with "Total Referral Visits" and a trend before the table; Semrush channel pages open with the channel share. Users need the "how big is this channel" frame before the list | LOW | Use existing `traffic_sources.referrals` + `paid_referrals` shares and monthly visits; the app already has both — this is presentation, not new data |
| Follow/nofollow indicator | Both SimilarWeb (Follow vs Nofollow distribution) and Ahrefs (Dofollow filter) treat this as core to judging link quality | LOW | TabAPI gives `dofollow_backlinks_pct` / `dofollow_referring_domains_pct` at overview level; display as badges. (Per-link nofollow is NOT in the TabAPI sample — do not imply per-link data) |
| Expandable row → the actual links from that site | Ahrefs' caret-reveals-backlinks pattern; SimilarWeb's row arrow-reveals monthly breakdown. Drill-down from domain to evidence is universal | LOW–MEDIUM | Expand a domain row to show its `from_url → to_url`, title, anchor strings from the sample. Pure client-side grouping of data already fetched |
| Authority score for the analyzed domain itself (DR) | SimilarWeb shows Domain Trust Score; Ahrefs shows DR. Without it, the referral list has no quality anchor to compare against | LOW | One field from Backlinks overview; add to the section header (not overview panel — keep overview as-is) |
| Empty/limited-data state per section | Semrush maintains an FAQ ("why is there limited or no data") precisely because missing data erodes trust. New domains often have empty referral samples | LOW–MEDIUM | Explicit Vietnamese empty-state per panel: "Không có dữ liệu giới thiệu cho tên miền này" + explain sample-based estimates. Reuse existing panel structure |

**Related Google advertisers section**

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Advertiser list derived from the domain's search space | Semrush "Competitors" tab lists domains bidding on overlapping keywords; this is the minimum unit of "related advertisers". Users expect a list of WHO, not just WHAT | MEDIUM–HIGH | Feasible via synthesis: query TabAPI Google Search API with the domain's top keywords (already in Traffic response) and extract `paid_results` advertisers. Cost: 1 credit per keyword — budget-gate it (e.g., top 5 keywords). Dedupe advertisers by registrable domain |
| Overlap signal per advertiser (which keyword/where they appear) | Semrush quantifies overlap (Common Keywords count + Competition Level %). Even a simplified "appears on N of the analyzed keywords" preserves the shared-keyword logic | MEDIUM | Count appearances across the keyword SERPs fetched. Do NOT present it as Semrush-grade "Competition Level %" — label as "số từ khóa xuất hiện" (occurrences observed) |
| Advertiser rows link to their ads/creative evidence | In Semrush, common-keyword numbers drill into Keyword Gap; in SpyFu you click through to ad history. A list you can't verify is dead weight | LOW | Each advertiser row expands to the actual paid results observed (title/snippet/link/position/placement) — the evidence IS the creative card (next section) |
| Scale metrics per advertiser (their keyword/traffic footprint) | Semrush's table carries paid keywords, paid traffic, paid traffic price per competitor | **HIGH / data-blocked** | TabAPI exposes none of this per third-party domain (a Traffic call per advertiser = 3–12 credits each and breaks the "one domain report" budget). Recommend: omit in v1, revisit only if per-advertiser Traffic lookups get budgeted. See Anti-Features |
| Live external check (link out) | Google Ads Transparency Center is the free official archive users cross-check against; SpyFu/Semrush all deep-link out to sites | LOW | Link each advertiser to its domain and offer a prefilled Ads Transparency Center search URL (`https://adstransparency.google.com/?region=VN&domain=…`) as a "kiểm tra thêm" affordance |

**Ad creatives view**

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Creative rendered as an ad card — headline, display URL, description | This is the universal presentation (Semrush Ads Copies mosaic: blue headline, green display URL, description; Google ATC shows the same trio). Users expect to SEE the ad, not read a JSON row | LOW | TabAPI `paid_results` provide title, link, snippet — exactly the three fields. Render in the existing brutalist card style with favicon/registrable domain |
| Landing page link per creative | Semrush: "Clicking on the blue links of any ad takes you directly to the landing page"; LP analysis is a first-class use in every tool | LOW | `link` field; add external-link affordance with rel/noopener |
| Placement + position (top vs bottom, rank) | Semrush keyword tables include "Block" (top/bottom/side) and ad position; it signals how aggressive the placement is | LOW | TabAPI gives `position` + `placement` per paid result |
| Grouping: ads by keyword | Semrush's ad-blocks show "number of keywords that trigger that ad" and Ads History is keyword-keyed. Ad-per-keyword is how PPC researchers read the space | MEDIUM | Our synthesis is per-keyword by construction; invert to per-advertiser → their observed ads. Keyword count per advertiser = the overlap metric above |
| First-seen / last-seen dates per creative | Industry-standard creative-longevity signal (Semrush Ads History monthly grid; Google ATC last-shown date; every ad-spy tool markets first/last-seen). "Ads that ran longest are profitable" is SpyFu's core insight | **HIGH / data-blocked** | TabAPI returns one live SERP snapshot per query — no ad history. Options: (a) omit dates, label creatives "quan sát ngày [date]"; (b) if the 24h cache is later persisted, derive first/last-seen from OUR OWN snapshot history. Do not fabricate dates |
| Creative imagery / display-format ads | iSpionage (historically) and every ad-spy tool show thumbnails; Google ATC covers display/video formats | **Data-blocked** | TabAPI Google Search API covers text search ads only. Recommend: text-only v1 with a Vietnamese note that display/video formats are outside this tool (see Anti-Features) |

**One readable single report**

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Canonical section order: identity → scale → trend → channels → partners → search terms → paid dimension | SimilarWeb's guided flow runs Traffic & Engagement → Marketing Channels → Search Overview → Incoming/Referral → Keywords → Landing Pages; its KC "Finding Insights in 30 Minutes" literally sequences reading order. Researchers read top-to-bottom | LOW | Existing app order already matches (overview → trend → sources → countries → keywords → AI referrals). Insert referring sites after sources/countries (acquisition partners), advertisers+creatives after keywords (paid lens). The consolidation work is ordering + continuity, not new data |
| Per-panel "i" explainer for every new panel | Already the app's convention (`PANEL_INFO` dialogs); SimilarWeb ships a glossary tooltip/icon system for the same reason — estimates need provenance explanations | LOW | Add PANEL_INFO entries for: referring sites (explain link-graph vs traffic meaning — TabAPI shows link-based referrals, NOT per-referrer traffic — this nuance MUST be explained to avoid misreading), advertisers (explain SERP-snapshot method), creatives |
| Top-N with expansion, consistent formatting | All tools cap visible rows (top ~10) and expand for more; unbounded tables destroy report readability | LOW | Cap each new table at ~10 rows, "xem thêm" expansion. Reuse existing `format` module (vi-VN) for numbers/dates |
| Section-level takeaway line | Differentiator in *quality*, table stakes in *structure*: SimilarWeb frames every report block with "What's the Value?" prose. A raw table without one sentence of context is what users leave tools over | LOW | One Vietnamese sentence per new panel, e.g. "Kênh giới thiệu chiếm X% lưu lượng; N trang web dẫn đầu." Static templating over fetched numbers — no AI needed |
| Consistent estimate provenance ("TabAPI estimates" labeling) | Every competitor surfaces data-source caveats; the app already carries this convention for TabAPI estimates | LOW | Extend the existing labeling pattern to new panels; must be honest that referral rows are a link-graph sample, not measured traffic |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Ad-creative landing-page screenshots | Every text-ad tool (Semrush, SpyFu) shows ad copy only; seeing the LP closes the ad→page loop that PPC researchers otherwise check manually. TabAPI Screenshot API (1 credit/URL) makes this cheap and unique at this price point | MEDIUM | Screenshot each unique creative `link` on demand (button per card, not auto — credit discipline). 24h cache keyed by URL. Note hosted PNG expires ~24h — download-and-serve via BFF or re-fetch |
| Referral-quality mix visualization | Ahrefs sorts by traffic; SimilarWeb scores engagement; nobody simple shows DR distribution of referrers at a glance. A compact "N trang giới thiệu · DR trung bình X · Y% dofollow" strip turns a table into a judgment | LOW–MEDIUM | Computed from Backlinks overview + grouped sample; no new endpoint |
| Advertiser inference from the domain's own top keywords ("who buys next to this site") | This IS the "related advertisers" job (Semrush charges a toolkit for it); synthesizing it from SERP paid results of the domain's own top keywords is a genuinely differentiating bridge — none of the free tools do it | MEDIUM–HIGH | This is the make-or-break feature of the advertisers section. Gate by credit budget; degrade gracefully (fewer keywords queried) |
| Referrer categorization (tin tức / affiliate / mạng xã hội / blog…) | SimilarWeb's Referring Websites table has a Category column and category filters — it's how researchers spot partnership patterns | MEDIUM | Heuristic from domain knowledge (news TLDs/patterns, known affiliate networks, social domains); label as heuristic. No TabAPI category field exists |
| New/trending referrers (MoM change) | SimilarWeb's "Change" column is explicitly billed as the way to find "trending sites, fast-growing companies, new partners" | **HIGH / data-blocked** | Requires per-referrer traffic history TabAPI doesn't have; link-graph MoM would require re-sampling Backlinks over time (5 credits × months × storage). Recommend v2 at earliest, only if the 24h-cache grows into persistence (currently Out of Scope) |
| Vietnamese-language takeaways with estimate framing | All five competitors are English-first; a Vietnamese researcher-native report is the product's standing differentiator | LOW | Continue existing locale conventions; new strings must be vi-first |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Impressions / spend estimates per ad or advertiser | Semrush shows Traffic/Cost/Traffic-price; SpyFu shows estimated spend. Looks like "completeness" | TabAPI provides none of it; deriving spend from CPC × assumptions fabricates precision. SpyFu reviews flag "estimated rather than exact figures" as a core trust problem even when the tool DOES model it | Show only observed facts (position, placement, date-observed) with explicit "ước lượng TabAPI" labels; never display spend/impressions |
| Social / Meta / TikTok ad coverage | "Spy tools should cover everything" (the #1 criticism of SpyFu is search-only) | TabAPI has zero social-ad endpoints; half-baked coverage would be worse than none. Even Semrush's social-ad coverage comes via the separate AdClarity acquisition | Explicit Vietnamese note: "Công cụ này chỉ theo dõi quảng cáo Google Tìm kiếm"; keep the boundary in PROJECT.md Out of Scope |
| Full backlink explorer (pagination, millions of rows, advanced filters) | Ahrefs/Semrush make this their centerpiece; users may ask "where's the rest?" | TabAPI returns a sample; building explorer UX around sample data is a lie surface. Also scope explosion: filters, pagination, anchor analysis, index tracking | Curated top-N sample + honest "mẫu dữ liệu" label; link out to a real backlink tool for depth |
| Multi-domain comparison (Kombat-style, SimilarWeb +Compare) | SpyFu's Kombat and SimilarWeb's compare mode are popular; "compare my site" is a natural ask | N× API credits per comparison, a second UI paradigm, and the product is defined as one-domain-one-report (PROJECT.md Core Value) | Per-report context hints (e.g., referrer domains the analyzed site does NOT get traffic from are invisible — don't imply win/loss analysis the data can't support) |
| Per-panel date-range pickers | Semrush/SimilarWeb let users pick month/database/device everywhere | TabAPI Traffic bills 3–12 credits by months returned; a picker invites credit burn and inconsistent panels. The app's `TRAFFIC_MONTHS` config exists precisely to bound this | Keep the single global `TRAFFIC_MONTHS` config; state the window once in the report header |
| PDF/CSV export | Standard in every competitor (Semrush exports everywhere) | Explicitly Out of Scope this phase (PROJECT.md); export formatting + vi-VN printing is a phase of its own | Design tables so a later export phase can wrap them; don't hand-build export now |

## Feature Dependencies

```
[Traffic API data (existing)] ──enables──> [Referral channel context banner]
        │
        └──top_keywords──> [SERP ad synthesis via Google Search API]
                                 └──requires──> [Credit budget gate + 24h cache extension]
                                        └──enables──> [Related advertisers list]
                                               └──enables──> [Ad creative cards]
                                                      └──enhances──> [LP screenshots (Screenshot API)]

[Backlinks API (5 credits)] ──enables──> [Referring-site table]
        └──requires──> [Domain-grouping pure lib + sample labeling]
               └──enables──> [Authority/quality mix view]

[All sections fetched] ──enables──> [Consolidated readable report]
        └──requires──> [Section ordering + PANEL_INFO entries + empty states]
```

### Dependency Notes

- **Related advertisers require the SERP-synthesis bridge:** there is no domain→advertiser endpoint; the advertiser list exists only as a derived artifact of querying Google Search per top keyword. If credit budget rejects multi-SERP calls, the advertisers section collapses to anti-scope — decide this before planning the UI.
- **Ad creative cards require advertiser/keyword data first:** cards render `paid_results` from the same SERP responses; they share the fetch, cache, and contract with the advertiser list. Build contract types once (`src/types/traffic.ts` pattern).
- **Referring-sites table requires the Backlinks endpoint integration (5 credits/call):** the existing cache/dedup pattern must be extended to a second endpoint with its own TTL; the domain-grouping logic should be a pure lib module with co-located tests (house convention).
- **Consolidated report requires all sections present first:** "one readable report" is an integration phase concern — ordering, takeaways, empty-states, and PANEL_INFO depend on the concrete shapes of the new sections.
- **LP screenshots enhance creatives but conflict with credit frugality if auto-run:** make screenshots on-demand only.
- **Referrer trend/change features conflict with the no-persistence decision:** anything "over time" per referrer needs stored snapshots; PROJECT.md currently excludes a DB. Don't combine in one phase.

## MVP Definition

### Launch With (v1)

- [ ] **Referring-sites panel** — ranked, domain-grouped table from Backlinks API sample (domain, link count, DR, dofollow overview badges) + referral-share context banner + expandable per-domain link sample + Vietnamese empty states. *Table stakes; data confirmed available; 5 credits/call with existing 24h-cache pattern.*
- [ ] **Section ordering + report continuity pass** — insert new panels in canonical order, one-line takeaway per section, consistent top-N/expansion, header stating estimate window. *This IS the "one readable report" requirement.*
- [ ] **PANEL_INFO explainers for all new panels** — including the critical nuance that referral rows are link-based, not traffic-measured. *House convention; trust requirement.*
- [ ] **Related-advertisers panel via SERP synthesis** — top-N keywords → Google Search API paid_results → deduped advertiser list with observed-occurrence counts, expandable evidence. *Core of the advertisers requirement; must be credit-budgeted.*
- [ ] **Ad-creative cards** — per-advertiser observed text ads (headline, display URL, description, placement/position, date observed), LP links. *Table stakes for the creative view; shares fetch with advertisers panel.*

### Add After Validation (v1.x)

- [ ] **LP screenshot thumbnails (on-demand)** — trigger: users demonstrably click through to LPs and want context without leaving. *1 credit/screenshot; hosted URL expires ~24h.*
- [ ] **Referrer quality-mix summary** (avg DR, dofollow split visual) — *trigger: table alone reads flat for non-SEO researchers.*
- [ ] **Referrer heuristic categories** — *trigger: list length makes manual pattern-spotting painful.*
- [ ] **"Quan sát lần đầu/gần nhất" dates for creatives** — *only if cache grows into persistence; derives from our own snapshots, labeled honestly.*

### Future Consideration (v2+)

- [ ] **Per-referrer traffic share / MoM change** — blocked on per-referrer traffic data TabAPI doesn't sell; revisit only with a second data source or persistence + re-sampling.
- [ ] **Per-advertiser footprint metrics** (their paid keywords/traffic) — 3–12 credits per advertiser per month; only with a real budget decision.
- [ ] **Multi-domain comparison mode** — new product surface; contradicts single-report scope.
- [ ] **Exports** — Out of Scope per PROJECT.md; revisit at a milestone boundary.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Referring-sites panel (Backlinks API) | HIGH | MEDIUM | P1 |
| Report consolidation (order, takeaways, empty states) | HIGH | LOW–MEDIUM | P1 |
| PANEL_INFO explainers (new panels) | MEDIUM | LOW | P1 |
| Related advertisers via SERP synthesis | HIGH | MEDIUM–HIGH | P1 (scope-guarded) |
| Ad-creative cards (text ads) | HIGH | MEDIUM | P1 |
| LP screenshots on demand | MEDIUM | MEDIUM | P2 |
| Referrer quality-mix summary | MEDIUM | LOW | P2 |
| Referrer categories (heuristic) | MEDIUM | MEDIUM | P2 |
| Creative first/last-seen dates | MEDIUM | HIGH (needs persistence) | P3 |
| Per-advertiser spend/traffic estimates | MEDIUM | HIGH (data-blocked) | P3 — anti-feature until data exists |
| Referrer MoM trend | MEDIUM | HIGH (data-blocked) | P3 |
| Multi-domain comparison | LOW for current persona | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | SimilarWeb | Semrush | SpyFu | Ahrefs | Google ATC | Our Approach |
|---------|------------|---------|-------|--------|------------|--------------|
| Referring sites by *traffic* | Incoming Traffic table: per-referrer traffic share, category, MoM change, engagement score, competitive wins/losses | Traffic Analytics treats referrals at channel level; referrer detail lives in Backlinks | Thin backlink data (known weakness) | Referring Domains sortable **by traffic** (organic), expandable links | n/a | Per-referrer traffic not available from TabAPI → ship link-graph sample table + aggregate referral-share context, labeled honestly |
| Referring domains (link graph) | Referring Domains: domain, DTS 1–100, backlinks count, follow/nofollow, first seen | Backlinks Analytics: full index, filters | "Backlink data is thin" (their own reviews) | Class-leading: links-to-target, dofollow filter, serial linkers, first seen | n/a | Backlinks API sample: domain grouping, DR, dofollow %, expandable links — the honest subset |
| Related advertisers (shared keywords) | Competitor comparison (paid tiers, +Compare up to 4 sites) | Competitors tab: Com. Level %, Common Keywords (→Keyword Gap), Paid Keywords/Traffic/Price, bubble map | Kombat: 3-domain shared/unique/gap keywords; "who advertises on my keywords" | Organic/Paid competitors by keyword overlap | n/a (advertiser search only) | Synthesize from top-keyword SERPs: advertiser = registrable domain seen in paid_results; overlap = observed-occurrence count (not Semrush-grade % — label as observed) |
| Ad creatives display | n/a (via AdClarity add-on) | Ads Copies mosaic: headline, display URL, description, keywords-per-ad tab; Ads History 12-month position grid with per-month creative | Ad History: every ad ever run (~18–20 years), "ads that ran longest = profitable" | Ads report (paid keywords, ad examples) | Search by advertiser/domain; format/region filters; last-shown date; variation counter | Text-ad cards from live SERP snapshots: headline/URL/description/placement/position + date-observed; no mosaic/history until data supports it |
| Creative dates & performance | n/a | First/last seen via Ads History grid; volume, CPC, traffic, Coverage % | First/last seen implicit in history; estimated spend | n/a | Last-shown date only; **no performance data** (explicitly what ads ran, not how they performed) | Date-observed only; no impressions/spend (anti-feature). Cross-check link to Google ATC per advertiser |
| Single readable report | Canonical guided order: Traffic & Engagement → Channels → Search → Referrals/AI → Keywords → Landing Pages; "Value?" framing per block; AI-chatbot referral report | Toolkit tabs with a prescribed workflow (Positions → Changes → Competitors → Ads → History → Pages) | Single niche workflow (keyword→ads→history) | Site Explorer Overview funnel: traffic → keywords → pages → backlinks | Single-purpose creative archive | Existing app order already matches the canonical flow; insert referrers after sources/countries, advertisers+creatives after keywords; add per-section takeaways + explainers |

**Ecosystem notes:**
- **iSpionage officially shut down 2025-07-09** (absorbed into TapClicks). Do not benchmark against it live; its first/last-seen creative pattern survives in ad-spy tools and Google ATC — treat those dates as table stakes *in principle*, but data-blocked here.
- **SpyFu remains Google-Search-only** — search-only scope for the advertisers section is a defensible niche, not a gap.
- **TabAPI (9 endpoints, verified 2026-10-13):** Traffic (3–12 cr, already integrated), Backlinks (5 cr), Google Search (1 cr), Reverse AdSense (3 cr), WHOIS/RDAP/DNS (1 cr), Web Reader/Screenshot (1 cr). No referrer-traffic or advertiser-library endpoints exist — every "Our Approach" cell above is written against this constraint.

## Sources

**Official vendor documentation (read in full, HIGH confidence):**
- SimilarWeb Knowledge Center — Referring Domains Report: https://support.similarweb.com/hc/en-us/articles/16703703247645-Referring-Domains-Report
- SimilarWeb Knowledge Center — Incoming Traffic: https://support.similarweb.com/hc/en-us/articles/360006548198-Incoming-Traffic
- SimilarWeb Knowledge Center — Using Referral Traffic: https://support.similarweb.com/hc/en-us/articles/360010747958-Using-Referral-Traffic
- SimilarWeb Knowledge Center — Finding Insights In 30 Minutes (report reading order): https://support.similarweb.com/hc/en-us/articles/26727061036189-Finding-Insights-In-30-Minutes
- Semrush KB — Advertising Research (tab workflow): https://www.semrush.com/kb/22-advertising-research
- Semrush KB — Competitors Report (column-by-column): https://www.semrush.com/kb/510-ad-research-competitors-report
- Semrush KB — Ads Copies Report (creative mosaic): https://www.semrush.com/kb/511-ad-research-ad-copies-report
- Semrush KB — Ads History Report (12-month grid, coverage %): https://www.semrush.com/kb/512-ad-research-ads-history-report
- Ahrefs Academy — Referring domains (sort-by-traffic, expandable links, first seen): https://ahrefs.com/academy/how-to-use-ahrefs/site-explorer/referring-domains
- iSpionage sunset notice (TapClicks): https://www.ispionage.com/
- TabAPI API reference (all 9 endpoints, response shapes, credit costs): https://tabapi.com/docs

**Corroborating third-party (MEDIUM confidence):**
- SpyFu feature set (Kombat, ad history depth, search-only scope): spyfu.com/ppc/ad-history (JS-only), trendtrack.io/blog-post/spyfu-review, searchengineland.com/guide/spyfu-guide (403'd; snippets only)
- Google Ads Transparency Center behavior (search by advertiser/domain, region/date/format filters, last-shown date, variation counter, no performance data): moda.app, admakeai.com, oppira.com, hawky.ai, openadlibrary.com guides — four independent sources, mutually consistent

**Search execution note:** Brave/exa MCP providers unavailable in this environment; research executed via DuckDuckGo HTML search + direct fetches of official vendor documentation (webfetch provider; raw tier LOW per classify-confidence, upgraded per-claim to HIGH only where an official vendor doc was read in full, MEDIUM for third-party corroboration).

---
*Feature research for: Traffic Check — website traffic intelligence reports (referring sites, Google advertisers/creatives, single readable report)*
*Researched: 2026-10-13*
