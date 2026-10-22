# Domain Vetting Framework — Coverage Analysis

**Source:** `Các chỉ số và cách lấy để check domain.md` (repo root, user-authored affiliate domain-vetting checklist)
**Analyzed:** 2026-10-14
**Purpose:** Map every metric in the source checklist against (a) what the app already shows, (b) what TabAPI can feed, (c) what is blocked or conflicts with current scope. This is input for future milestone scoping — it does **not** change v1 scope (Phases 2–4).

## Source Summary

The checklist evaluates a domain as an *affiliate offer* in four groups, then proposes a 6-table DB schema and derived scores:

1. Business & offer profile (domain age, business model, AOV, payment gateway, Trustpilot)
2. Traffic & audience (visits/trend, channel mix, geo, bounce/duration/pages-per-visit)
3. Paid advertising & competitor intelligence (advertiser density, active ads on Google/Meta/TikTok, ad longevity, paid keywords/CPC, landing pages)
4. Affiliate terms & unit economics (payout, cookie, EPC, brand-bidding/direct-linking policy)
5. Derived metrics: Projected EPC, Max CPC, Arbitrage Spread, Winning Ad Ratio, Advertiser Saturation Index (ASI), Tier-1 Dominance, Affiliate Reliance Score (ARS), Affiliate Opportunity Score (AOS, 0–100)

## Coverage Matrix

Legend: ✅ already in app · 🟢 in v1 roadmap · 🟡 feasible with TabAPI (new work) · 🟠 feasible, needs manual input or heuristics · 🔴 blocked (no data source) · ⛔ conflicts with current Out of Scope

| Checklist metric | Status | How / why |
|---|---|---|
| Monthly visits & MoM trend | ✅ | Existing overview + monthly visits |
| Channel breakdown (direct, organic, paid, referral) | ✅ | `traffic_sources` (13 channels) |
| Top geos | ✅ | `top_regions` |
| Bounce rate, avg session duration, pages/visit | ✅ | Overview metrics |
| Paid keywords, CPC, search volume | ✅ | `top_keywords` (brand vs non-brand split is a UI/heuristic addition, 🟠) |
| Referral traffic share | ✅ | `traffic_sources.referrals` / `paid_referrals` |
| Referring sites (affiliate partner sites) | 🟢 Phase 2 | Backlinks API — link-based, not visit-weighted (REFS-03) |
| Advertiser density (distinct advertisers) | 🟢 Phase 3 | SERP `paid_results` synthesis; coverage is sampled, not exhaustive |
| Ad creatives (Google text ads) + landing page | 🟢 Phase 3 | Client-side view of the same payload |
| Tier-1 geo share (US/UK/CA/AU %) | 🟡 | Pure derivation from `top_regions` — **zero credits**, cheapest win |
| Domain age / registration / expiry | 🟡 | TabAPI WHOIS/RDAP (1 credit); fits existing cache pattern |
| Tech stack / payment gateway | 🟠 | TabAPI Web Reader (1 credit) + HTML/script heuristics; no first-class endpoint; unverified |
| Business model, AOV, checkout flow | 🟠 | No data source; manual tag or LLM inference — accuracy risk |
| Wayback history, Trustpilot, Scamadviser, Reddit | 🔴 | No TabAPI endpoint; external scrape = ToS/fragility risk |
| Active ad volume — Google | 🟠 | Only via SERP snapshot count (v1) or SerpAPI Transparency (v2 CRTV-02b) |
| Active ad volume — Meta / TikTok | 🔴 ⛔ | No TabAPI endpoint; FEATURES.md lists social ads as an Anti-Feature |
| Ad longevity / winning creatives (>30/60/90d) | 🔴 | TabAPI returns one live snapshot, no history; needs persistence or SerpAPI Transparency dates |
| Backlinks with `?ref=` / `?aff=` params | 🟡 | Backlinks sample includes `to_url`; filter by query param is feasible but sample-limited |
| Affiliate program / payout / cookie / EPC / brand-bidding policy | 🔴 / 🟠 | Lives on external networks and ToS pages; at best manual input fields |
| Projected EPC, Max CPC, Arbitrage Spread | 🟠 | Needs user-supplied `payout_value` and assumed funnel CR; compare against known `avg_cpc` from keywords |
| Winning Ad Ratio, ASI | 🔴 | Depend on ad longevity and total active ads (see above) |
| Affiliate Reliance Score (ARS) | 🟠 | Needs `is_affiliate_site` flag per referrer — heuristic classification (already a v1.x idea in FEATURES.md) |
| AOS (0–100 composite) | 🟠 ⛔ | Needs all four score inputs; ranking across domains needs persistence + multi-domain mode |
| 6-table DB schema, time-series snapshots | ⛔ | Database/persistence is Out of Scope (PROJECT.md) |

## Tensions With Current Scope (need a user decision)

1. **Persona shift.** The app is a *traffic intelligence report*; the checklist is an *affiliate offer evaluator* (payout, cookie, EPC, AOS). Adopting it changes the Core Value statement, not just the feature list.
2. **Database + multi-domain ranking.** Schema, snapshots, and AOS "rank domains" all require persistence and compare mode — both explicitly Out of Scope / Anti-Feature today.
3. **Meta / TikTok ads.** Previously ruled out because TabAPI has no social-ad endpoints. Needs either a second data source or a stay-out decision.
4. **Ad longevity.** The strongest signal in the checklist ("winning creatives") is the one TabAPI cannot provide. Only path: SerpAPI Google Ads Transparency (already parked as v2 CRTV-02b) or own snapshot history (needs persistence).
5. **Manual inputs.** Unit-economics metrics require data the researcher must type in (payout, cookie, target margin). The app currently has a single input (domain).

## Recommended Incremental Path (if adopted)

Ordered by cost/benefit; none of this alters v1 Phases 2–4.

1. **Zero-credit derivations** (can fold into Phase 4 or follow it): Tier-1 geo share, brand vs non-brand keyword split, referral + paid-search share callouts, threshold badges (e.g. visits > 50k/100k, bounce < 55%, Tier-1 > 65%) drawn from the checklist's own thresholds.
2. **Domain profile panel** (1 credit): WHOIS/RDAP age, registrar, expiry.
3. **Affiliate-link signal** from Backlinks sample (`?ref=`, `?via=`, `?aff=` in `to_url`).
4. **Unit-economics calculator** with manual inputs (payout, funnel CR, margin) → Projected EPC, Max CPC, Arbitrage Spread vs `top_keywords.cpc`. Stateless; no DB needed.
5. **Defer / re-decide:** Meta/TikTok, ad longevity, Trustpilot/Wayback, DB schema, AOS ranking.

## Decisions (2026-10-14)

1. **Direction changed** to affiliate-offer evaluator.
2. **Local DB accepted** (from Phase 5; engine TBD).
3. **Second source: SerpAPI Google Ads Transparency only.** Meta, TikTok, Trustpilot, Wayback deferred (SOCL-01..03).
4. **Manual inputs accepted, in three tiers:**
   - *Auto:* keyword CPC, Tier-1 share, WHOIS age, affiliate-program existence/link/network.
   - *Suggested (confirm required, shows source snippet):* payout, cookie, brand-bidding/direct-linking mentions, payment gateway, AOV — via on-demand Web Reader scan (~2–3 credits).
   - *Manual:* real payout/cookie after approval, network EPC, affiliate-manager answers, funnel CR (default 1.5–3%), target margin.
   Each stored field keeps `source`, `source_url`, `confirmed_at`. Network publisher APIs (Impact/CJ/ShareASale/PartnerStack) deferred (AFFL-04).

5. **Checklist section 1 (business sustainability) narrowed to WHOIS + Trustpilot (2026-10-15)**, answering two questions: domain age/volatility, and rating + review count.
   - *Age:* creation date from RDAP, plus a Vietnamese verdict against the 2–3 year threshold.
   - *Volatility:* RDAP exposes only the current record (registrar, nameservers, status, updated, expiry). Real ownership history needs a paid WHOIS-history provider (not adopted). Instead, changes are detected between our own stored snapshots (VET-06) and labeled with the tracking start date; a first lookup shows "chưa có lịch sử". Weak signals from the current record (recent update, short expiry horizon, privacy on) are shown as facts, not verdicts.
   - *Trustpilot:* score + review count (TRST-01/02). Source is unverified: official Business Units API (needs live check that arbitrary domains resolve) versus reading the public page through Web Reader (ToS/bot-protection risk). Decided at the Phase 5 planning gate; fails soft to an empty state.
   - Wayback, Scamadviser, Reddit remain deferred.

Resulting phases: 5 (persistence + profile), 6 (ad longevity), 7 (affiliate terms + unit economics). See ROADMAP.md.

---
*Framework analysis: 2026-10-14*
