# Pitfalls Research

**Domain:** Traffic intelligence dashboard — adding referring-sites and advertisers/creatives sections to an existing TabAPI-backed report (brownfield Next.js BFF)
**Researched:** 2026-10-13
**Confidence:** MEDIUM overall — HIGH for all TabAPI API-behavior claims (verified today against TabAPI's official full reference at `tabapi.com/llms-full.txt`); MEDIUM for ad-platform legality claims (vendor docs not directly fetchable; cross-reasoned); MEDIUM for UX practices.

**Research context:** All search providers were disabled in this environment; findings come from direct fetches of TabAPI's official endpoint reference and homepage (2026-10-13) plus clearly-tagged training knowledge. Ad-platform claims should be re-verified in the advertisers phase (see Pitfall 2).

---

## Critical Pitfalls

### Pitfall 1: Building "referring sites" from backlink data — the referral-sources vs backlinks confusion

**What goes wrong:**
The team implements "top external sites sending referral traffic" by calling the Backlinks API (`GET /domains/{domain}/backlinks`, 5 credits) and rendering its `referring_domains` / `backlinks[]` sample. The panel then shows sites that **link to** the domain (SEO link graph: `from_url`, `anchor`, `domain_rating`), not sites that actually **send** referral sessions. The researcher reads "top referring sites", compares them to the `traffic_sources.referrals` share (6.7% in TabAPI's own example), and draws wrong acquisition conclusions. Worse: `backlinks[]` is explicitly "a top-link sample" with no traffic weighting and no pagination — so it isn't even a complete link list.

**Why it happens:**
Vocabulary trap. "Referring domains" is SEO/backlink vocabulary (Ahrefs, Semrush); "referral traffic" is analytics vocabulary (GA4). TabAPI amplifies the trap by naming the backlink field `referring_domains`. And crucially — **TabAPI has no endpoint that returns top referral-traffic sources per domain.** The only referral-traffic data is the aggregate `traffic_sources.referrals` share. The Backlinks endpoint is simply the nearest-looking thing, and it is the only 5-credit domain-data endpoint in the catalog.

**How to avoid:**
- Make the data-source decision explicit before planning the phase: either (a) ship the panel as a **link profile** ("Trang web trỏ liên kết" — SEO context, dofollow %, domain rating), or (b) derive traffic-origin candidates another way, or (c) descope to the existing aggregate referral share. Never label the backlink sample "các trang gửi traffic" (sites sending traffic).
- Cross-display the panel next to the aggregate referral share so numbers can't be misread as a breakdown of each other.
- Write the Vietnamese copy with distinct terms for "referral traffic source" vs "backlink" and pin them in `PANEL_INFO`.

**Warning signs:**
- Panel sums to far more than the referral share; the two numbers sit side by side with no reconciliation.
- Sites are ranked by `domain_rating` while the UI implies traffic rank.
- Someone asks "why does nodejs.org appear but send no visits?"

**Phase to address:** Referring-sites phase — the decision must be made at that phase's planning gate, before any UI work; copy/label verification again in the consolidated-report phase.

---

### Pitfall 2: Assuming an advertisers/creatives endpoint exists — it does not

**What goes wrong:**
The milestone names "related Google advertisers" and "ad creatives view", which sound like features of commercial ad-intelligence products (Semrush Ads, SpyFu, Meta Ad Library). Verified against TabAPI's complete official reference (2026-10-13): **there is no advertisers or creatives endpoint.** The catalog is exactly nine endpoints: Traffic, WHOIS, RDAP, DNS, Backlinks, Google Search, Reverse AdSense, Web Reader, Screenshot. Teams that skip this verification build plans around imaginary endpoints, then improvise scrapers at execution time.

The only obtainable building blocks, each with real constraints:
- **Google Search API** (`GET /search/google`, 1 credit per query, each *page* is a separate billed query): `paid_results[]` carries position, placement (top/bottom), title, link, snippet — text ads only, no images, no dates, no advertiser identity. Note TabAPI's own example response has `paid_results: []` — SERP ads are sparse for many queries.
- **Reverse AdSense API** (3 credits): returns domains observed sharing one AdSense publisher id — but the dashboard would first need the pub-id, which must be scraped from the analyzed domain's homepage (Web Reader, +1 credit). That's a 3-hop chain (read homepage → extract pub-id → reverse lookup) with independent failure modes, and results are observational ("not proof of ownership", lag on add/remove, sample possibly incomplete).
- **Google Ads Transparency Center** (`adstransparency.google.com`) is a client-rendered app with no public API surfaced; scraping it conflicts with Google's terms. Meta Ad Library API exists but is a different platform with app-review gating (MEDIUM confidence on both — re-verify before relying).

**Why it happens:**
Feature language ("advertisers", "creatives") is borrowed from competitor products; nobody maps the words to the actual provider catalog until the phase plan is written.

**How to avoid:**
- Treat endpoint availability as a hard planning gate (PROJECT.md already flags "endpoint availability unverified" — keep that flag until a live probe succeeds).
- Define the section from data actually obtainable, e.g. "Quảng cáo Google liên quan" built from `paid_results` for 1–2 chosen queries related to the domain. Decide the query strategy explicitly (brand query? category keywords?) because it drives both cost and sparsity.
- If true creative-level data (images, variants, flight dates) is required, that is a new data-source decision — do it as its own research item, not as a scraper written mid-phase.

**Warning signs:**
- A plan or discussion references paths like `/advertisers` or `/creatives` that appear nowhere in TabAPI's OpenAPI spec (`/api/v1/openapi.json` — public, free — is the arbiter).
- Any task description containing the word "scrape" for an ad surface.
- The section design assumes image creatives exist in the data model.

**Phase to address:** Feasibility spike at the start of the advertisers/creatives phase (or a dedicated verification step in the referring-sites phase); decision must precede planning that phase.

---

### Pitfall 3: Treating sparse-data responses as errors — the 200-with-nulls and 422-unprocessable trap

**What goes wrong:**
TabAPI's documented semantics (verified): "A domain with no traffic coverage is **not an error**: it returns 200 with null overview fields and empty arrays." Additionally, the traffic endpoint returns **422 unprocessable when fewer than 3 months are available** — i.e., exactly for new and tiny domains, the dashboard's error handler fires even though the request itself was fine. Every field is nullable: `title`, `description`, all `overview.*` fields, every `traffic_sources` key ("null when unknown"), `ai_traffic`. Teams that test only with `vercel.com` build error paths that fire for most of the long tail, making small-domain lookups look broken.

**Why it happens:**
Developers equate "no data" with failure, and 4xx status codes are usually taught as errors. TabAPI deliberately distinguishes `invalid_domain` (400 — malformed input), `unprocessable` (422 — valid input the service can't fulfil), and success-with-nulls (200 — real answer: "no coverage").

**How to avoid:**
- Model four distinct states in the shared contract (`src/types/traffic.ts`): `data`, `partial-data` (history shorter than requested), `no-coverage` (nulls/empties or 422), and `error` (4xx/5xx from the single error shape). Map 422-on-traffic to `no-data`, never to `error`.
- Design Vietnamese empty-state copy up front: "Chưa có dữ liệu cho tên miền này" distinct from "Không thể tải dữ liệu — thử lại".
- For the backlinks endpoint on small domains, expect a small or empty `backlinks[]` sample and possibly `overview.backlinks: 0` — render a meaningful empty state, not a spinner followed by an empty box.

**Warning signs:**
- Error-rate dashboards spike when researchers enter long-tail or newly registered domains.
- Vitest suites only use high-traffic fixture domains.
- UI shows toast errors for domains the user knows exist.

**Phase to address:** Referring-sites phase (API layer + empty states) and consolidated-report phase (empty states composed into one report). Contract shape decided in `src/types/traffic.ts` at the first data phase.

---

### Pitfall 4: Credit-cost blow-up from per-month billing plus multi-endpoint fan-out

**What goes wrong:**
A "full report" view composes: traffic at 1 credit **per month returned** (3–12), backlinks (5), SERP pages (1 credit per page — "pulling 30 results costs 3 credits"), Reverse AdSense (3), homepage read for pub-id extraction (1). That's 10–22+ credits per domain view. Costs multiply when the client component fetches panels independently (the existing dashboard is a monolithic 571-line client component), when panels double-fetch on mount/remount, or when failures trigger retries — **"A retry is a new request and is metered independently if it succeeds."**

**Why it happens:**
$0.001–0.012 per call feels free until multiplied by fan-out × panels × retries × every lookup. The existing 24h cache + in-flight dedup was built for one endpoint; each new endpoint tempts a new ad-hoc code path that forgets the pattern.

**How to avoid:**
- Compute a per-domain credit budget per report and log actual spend (TabAPI returns `request-id` headers and dashboard usage history — use them in dev).
- Extend the existing BFF `/api/traffic` pattern into a single aggregation path so the client triggers one request, while the BFF caches each endpoint's response separately.
- Request `months` deliberately: default 3; go to 12 only when the trend panel needs it (billing follows months **actually returned**, so a domain with 5 months of coverage bills 5).
- No client-driven retries of billable calls; retries live in the BFF with capped attempts and only for free-error codes (502/504/503).

**Warning signs:**
- Credit balance drains visibly faster than lookups performed (check TabAPI dashboard history).
- Multiple distinct upstream `request-id`s per single user action.
- DevTools shows several `/api/*` calls firing per panel render.

**Phase to address:** Referring-sites phase (generalize the cache/fetch pattern for a second endpoint — cheapest moment to refactor); consolidated-report phase (enforce the one-aggregation-path rule).

---

### Pitfall 5: Cache mistakes — wrong key scope, cached errors, unbounded growth

**What goes wrong:**
Four recurring variants when adding endpoints to an existing cached integration:
1. **Key scope too coarse:** keying by domain only, so `months=3` vs `months=12` collide (or `country`/`language`/`page` collide on SERP lookups) and silently serve wrong data.
2. **Normalization mismatch double-bills:** TabAPI endpoints differ in scope — traffic reduces to the registrable root and normalizes to punycode lowercase; backlinks is "scoped to that hostname and its subdomains"; DNS queries the hostname **as given** (`www.vercel.com` ≠ `vercel.com`). Reusing the wrong normalization means the same site is billed twice under two cache keys, with confusingly different data.
3. **Cached-error serving:** caching an upstream failure and later rendering it as data; or the inverse — not caching the legitimate 200-empty responses for small domains, so each view of a small domain re-bills 5 credits for backlinks.
4. **Unbounded Map growth:** a long-lived local Next.js server accumulating entries forever (memory leak; today it's one endpoint, tomorrow four).

**Why it happens:**
The 24h success cache was written for a single endpoint's shape; new sections copy-paste instead of generalize.

**How to avoid:**
- Generalize the existing cache now: key = (endpoint, normalized-domain, canonical-params); cache **successful responses only — including empty-data 200s**; per-endpoint TTL is fine (24h is reasonable for all TabAPI data given monthly granularity; SERP could be shorter).
- Never cache the `{ error: … }` shape; errors are free upstream, so refetching them is harmless and avoids serving stale failures.
- Bound the cache (max entries with LRU eviction) even for a local tool.
- Reuse the single `domain` normalization module for every new endpoint call; document which endpoints accept subdomains.

**Warning signs:**
- Dev-server memory grows across sessions; cache inspection shows entries for both `www.` and apex forms.
- Same domain produces different panels between visits or between panels.
- 5-credit backlink charges repeat within one 24h window for the same domain.

**Phase to address:** Referring-sites phase (do the generalization refactor while adding the first new endpoint); every subsequent endpoint inherits it.

---

### Pitfall 6: Error propagation — one flaky upstream panel destroys the "one readable report"

**What goes wrong:**
With 4–6 TabAPI endpoints composing a report, the classic failure: BFF `Promise.all` aborts everything when one sub-fetch 502s; or the client renders an all-or-nothing error screen discarding successfully loaded panels; or a 402 `insufficient_credits` is treated as transient and retried (it never recovers by retrying); or a 503's `Retry-After` header is ignored, hammering upstream. The report — whose whole point is reading as one coherent document — flickers or blanks.

**Why it happens:** Naive aggregate-fetch patterns and homogeneous error handling. TabAPI's errors *are* well-shaped (single `{ error: { code, message, status, request_id, docs_url } }` shape, all codes documented), but only if the BFF discriminates them.

**How to avoid:**
- Per-panel partial success: BFF returns per-section status (`ok | empty | error + request_id`); each panel renders its own state. One failing endpoint must never blank the report.
- Never auto-retry 402 — surface a balance/limit message instead. Honor `Retry-After` on 503. Treat 502/504 as retryable with small capped backoff.
- Log TabAPI's `request_id` in the BFF response so failures are traceable against the dashboard's usage history.
- Map every code in TabAPI's documented error set (400 invalid_domain/invalid_request, 401, 402, 404, 405, 422, 500, 502, 503, 504) — unknown codes fall back to a generic error, not a crash.

**Warning signs:**
- One slow endpoint delays the entire report; whole-page spinners.
- Duplicate `request_id`s in logs for one click (retry storms).
- Users see errors for panels whose data actually arrived.

**Phase to address:** Referring-sites phase establishes the per-endpoint error contract; consolidated-report phase encodes partial-success in the aggregate response shape.

---

### Pitfall 7: The consolidated report becomes a wall of raw tables — overload, false precision, and null soup

**What goes wrong:**
Three sections added to an already dense dashboard produce the exact opposite of "one readable report":
- **Overload:** 13 traffic-source channels + keywords + countries + referrers + advertisers, each a table, no narrative. Researchers skim and miss the story.
- **False precision:** modeled estimates formatted to look exact — "30 173 255 visits" (an estimate!) beside "CPC $1.10" (another estimate) with no signal of which numbers are rougher. All TabAPI metrics are estimates; rendering them to full significant digits manufactures confidence the data doesn't have.
- **Null soup:** the API marks `title`/`description`/`overview.*`/`ai_traffic` nullable and every `traffic_sources` key "null when unknown" (all 13 keys always present). Naive rendering shows `null`, `undefined`, `0`, `—`, or `NaN` interchangeably — each reading as a different kind of broken.
- **Partial history unflagged:** `monthly_visits` may return fewer entries than requested (and <3 available months is a 422) — a 12-month chart silently showing 4 points misleads.

**Why it happens:** Panels are built independently (each correct in isolation) and then concatenated. Existing per-panel "i" explainers (`PANEL_INFO`) were never designed to carry a report-level precision/estimate disclaimer.

**How to avoid:**
- Lead with a short narrative summary (2–4 sentences in Vietnamese) generated from the data — trend direction, dominant channel, notable referrers — then supporting tables. Tables support the summary; they don't replace it.
- One rounding policy applied everywhere for estimates (e.g. `≈30,2 tr` with `vi-VN` formatters) plus a visible "số liệu ước tính" convention; extend `PANEL_INFO` so every new panel's explainer states the estimate nature explicitly.
- Explicit empty states per panel (see Pitfall 3); collapse zero/null rows in channel tables into "Khác".
- Flag partial history on charts ("3/12 tháng có dữ liệu").
- Navigation: anchor/summary nav at top of the report so density never hides structure.

**Warning signs:**
- More than ~8–10 metrics visible without scrolling; every panel is a table.
- Any user-visible cell that can literally read `null`/`undefined`/`NaN`.
- Users ask whether numbers are exact (they never are).
- Panels disagree (backlink panel "top referrer" ≠ anything in traffic sources) with no reconciling copy.

**Phase to address:** Consolidated-report phase owns the aggregate design; each data phase must still ship its panel with the shared precision/empty-state conventions so the final assembly is composition, not rework.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Copy-pasting `/api/traffic` cache/fetch code for each new endpoint | Faster first panel | 4 divergent cache implementations; the bugs in Pitfalls 4–6 multiply | Never — generalize at the second endpoint |
| Hand-writing types for new endpoint responses | No tooling setup | Contract drift; TabAPI publishes a free OpenAPI 3.1 spec (`/api/v1/openapi.json`) that would generate exact types | Never — generate or verify against the spec |
| Skipping domain normalization reuse for new endpoints | Fewer imports | Same site billed twice under `www.` vs apex keys; confusing cross-panel data | Never |
| Inline Vietnamese strings in the 571-line component | Speed | Missing `PANEL_INFO` entries; untranslatable panels; drift from vi-VN formatters | Only if strings are still centralized in the same pass |
| Client-side per-panel fetching | Simpler BFF | Credit multiplication; key exposure risk if someone "simplifies" the BFF later | Never — BFF-only (also keeps `TABAPI_KEY` server-side) |
| `any`-typed `paid_results[]` | Quick render | Ads schema drifts silently; refactors break at runtime | Only in a throwaway spike, never merged |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| TabAPI Backlinks (5 cr) | Assuming default fetch timeouts (~10–30s) suffice; cold lookups take **~15s**; treating `backlinks[]` as complete | Use generous timeout or the SSE stream (`Accept: text/event-stream`); label the panel as a *sample*; `overview.domain_rating` is canonical |
| TabAPI Traffic months billing | Hardcoding `months=12` "for completeness" | Bill follows months *returned*; request only what the trend panel shows; default 3 |
| TabAPI Traffic no-coverage | Treating 200-with-nulls or 422 as errors | Both mean "no/partial coverage" → empty-state UI (Pitfall 3) |
| TabAPI Google Search pages | Assuming 1 query = whole result set | Each page (of 10) is a separate 1-credit query; page param 1–10 |
| Reverse AdSense | Assuming it finds the analyzed domain's advertisers | It maps one *publisher id* → sites; you must first obtain the pub-id (scrape homepage via Web Reader, +1 credit); matches are observational, not ownership proof |
| SERP ads sparsity | Designing a rich creatives gallery around `paid_results` | `paid_results` is frequently empty (TabAPI's own example is `[]`); design for empty-first, text-only ads |
| TabAPI 402 insufficient_credits | Retrying on 402 as transient | Never retry; surface balance state once |
| TabAPI 503 | Immediate refetch | Honor `Retry-After` header |
| API key handling | Adding "just one more call" outside the BFF | All new endpoints behind the existing BFF proxy; `TABAPI_KEY` never reaches the client |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Backlinks cold latency (~15s) inside request lifecycle | Panel spinner or BFF timeout for first view of any domain | Stream via SSE, set long BFF timeout for this endpoint, or accept first-hit latency with 24h cache | Every cold backlinks call |
| Unbounded in-memory cache | Slow dev server, eventually OOM after long sessions | Bound entries (LRU) when generalizing the cache | Weeks of local use with many domains |
| Monolithic 571-line client component gains 3 more sections | Refetch loops, stale renders, unmaintainable file | Extract per-section components with co-located `.test.tsx` (PROJECT.md already allows this) | Immediately as sections are added |
| Per-panel parallel client fetches to BFF | N upstream calls per view; credit drain | One BFF aggregation call per report load; BFF fans out and dedups via in-flight map | From the first multi-endpoint view |
| Re-charting monthly data without date sort | Reversed/garbled trend charts | Note TabAPI's own warning: history arrays are "newest first today" — sort by date before charting | Any history field, any endpoint, any time upstream flips order |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Calling new TabAPI endpoints from the client component directly | API key exposure; bypasses dedup/cache | All calls via the existing BFF route; extend it, don't fork it |
| Passing arbitrary user-supplied URLs into Web Reader/Screenshot for creative capture | SSRF-adjacent behavior and unvalidated content rendering | Normalize to registrable domain first; only fetch the analyzed site's homepage; TabAPI itself rejects private/local URLs — don't defeat that by pre-fetching yourself |
| Hot-linking ad creative assets (images from ad CDNs / `files.tabapi.com` screenshots) | Broken images after expiry (screenshot URLs guaranteed only 24h); third-party tracking | Treat any creative imagery as ephemeral; prefer text-only creatives for MVP |
| Rendering scraped ad content verbatim at scale | Trademark/brand-content concerns even for a local tool | Attribution + "dữ liệu quảng cáo quan sát được" disclaimer; keep the report single-user/local |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Backlink panel labeled as "top sites sending traffic" | Researcher believes links = traffic sources; wrong acquisition strategy | Honest labeling: link profile ("trang web trỏ liên kết") vs traffic origin; state the distinction in the "i" dialog |
| Mixed precision (estimates rendered as exact ints) | False confidence in modeled data | Consistent rounding, `≈` prefix, and a report-level "ước tính" note (all TabAPI data is modeled estimates) |
| `null`/`0`/`—`/`undefined` rendered interchangeably | "Is this broken or just empty?" | Three distinct renderings: no-data string ("chưa có dữ liệu"), true zero ("0"), and error state |
| 12-month chart with 3 real points | Trend looks collapsed or invented | Flag partial history; chart only returned months |
| All 13 channels always displayed (many are `0` or `null`) | Table noise buries the real story | Render significant channels; fold near-zero into "Khác" with a count |
| Ads section designed as a gallery of creatives | Mostly-empty gallery for most domains | Text-list-first design with honest empty state; gallery only if data actually exists |
| Report sections added with no shared navigation | Scrolling chaos; researchers lose their place | Anchor nav / summary header on the consolidated report |

## "Looks Done But Isn't" Checklist

- [ ] **Referring-sites panel:** decision documented — link profile vs traffic origin; Vietnamese label matches what the data actually is; reconciled (or explicitly contrasted) with `traffic_sources.referrals` share.
- [ ] **Referring-sites panel:** tested with a small/empty-domain fixture (nulls + empty arrays + 422 traffic case), not just `vercel.com`.
- [ ] **Advertisers section:** the real upstream endpoint(s) named in the plan and verified against `/api/v1/openapi.json` — no invented paths; a live probe done before UI build.
- [ ] **Ad creatives:** designed empty-first (`paid_results: []` is common); no assumption of image creatives.
- [ ] **Cache:** generalized key = (endpoint, domain, params); empty 200s cached; errors never cached; bounded size; cache hit/miss observable (log or header).
- [ ] **Credits:** per-report spend logged; no client-driven retries; 402 surfaces balance state; 503 honors `Retry-After`.
- [ ] **Error isolation:** one panel's upstream failure leaves other panels rendered; TabAPI `request_id` logged on failure.
- [ ] **Report assembly:** narrative summary present; partial-history flagged; every nullable field has a Vietnamese no-data rendering; all new strings in Vietnamese with `PANEL_INFO` entries added.
- [ ] **Types:** new endpoint responses typed and checked against TabAPI's OpenAPI 3.1 spec.
- [ ] **Normalization:** every new endpoint call goes through the shared `domain` lib; subdomain-scope differences (backlinks vs traffic) documented.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Backlinks panel shipped as "referring sites" | MEDIUM | Rename + reframe copy and `PANEL_INFO`; keep the data (still useful) but reposition as link profile; add reconciliation note vs referral share. Contract/UI change is localized to the panel. |
| Advertisers data source infeasible via TabAPI | LOW | Descope to `paid_results`-based "related Google ads" or remove the section; PROJECT.md already marks the decision "Pending (endpoint availability unverified)" — flip to Out-of-Scope with reasoning rather than improvising a scraper. |
| Credit blow-up discovered mid-phase | LOW | Add per-endpoint caching + single aggregation path; reduce `months`; TabAPI credits never expire, so overspend is permanent but bounded — log spend to prevent recurrence. |
| Cached-wrong-params bug (e.g., months collision) | LOW | Purge in-memory cache (server restart); fix key construction; add regression test with two param sets asserting distinct data. |
| Normalization double-billing (www vs apex) | LOW | Route all endpoint calls through shared normalizer; existing cache absorbs the duplicate keys after restart. |
| Whole-report blanking on one upstream failure | LOW | Switch BFF composition to per-section results; panel error states already exist once Pitfall 6's contract is in place. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Backlinks-as-referrals confusion | Referring-sites phase (planning gate) | Panel copy + `PANEL_INFO` reviewed against actual data source; small-domain fixture test |
| 2. Missing advertisers endpoint | Advertisers/creatives phase (feasibility spike **before** planning) | Live probe of the chosen TabAPI endpoint(s) recorded; no invented paths vs OpenAPI spec |
| 3. Sparse data as errors | Referring-sites phase (contract) | Vitest fixtures: nulls, empty arrays, 422 → empty-state UI, not error |
| 4. Credit fan-out | Referring-sites phase (cache generalization); consolidated-report phase (aggregation path) | Upstream `request-id` count per user action = expected; spend logged |
| 5. Cache key scope | Referring-sites phase (generalize once) | Param-collision test (months=3 vs 12 distinct); bounded cache test |
| 6. Error propagation | Referring-sites phase (error contract); consolidated-report phase (aggregate shape) | Fault-injection test: one section 502s, others render; `request_id` in error payloads |
| 7. Report overload / nulls / precision | Consolidated-report phase (owns design); each data phase ships shared conventions | Narrative summary exists; no literal `null` renders; rounding policy applied; all new panels have `PANEL_INFO` |

## Sources

- **TabAPI official full API reference** — `https://tabapi.com/llms-full.txt` (fetched 2026-10-13; HIGH confidence for all TabAPI behavior, pricing, error, and nullability claims) and `https://tabapi.com/` (endpoint catalog, pricing table, FAQ).
- **TabAPI OpenAPI 3.1 contract** — `https://tabapi.com/api/v1/openapi.json` (advertised by official docs as the machine-readable contract; use for type generation).
- **Google Ads Transparency Center** — `https://adstransparency.google.com/` (fetched 2026-10-13; observed as a client-rendered shell with no API docs surfaced — MEDIUM confidence that no official public API exists; re-verify at the advertisers phase).
- **Meta Ad Library API** — official programmatic access exists with developer app review and content restrictions (MEDIUM confidence; official doc URLs were not fetchable in this environment — verify at phase time if Meta data is ever considered; it is out of scope for this TabAPI-only project).
- **Traffic-intelligence product conventions** (SimilarWeb/Semrush-style "insufficient data" handling; referral-sources vs backlinks vocabulary) — MEDIUM confidence, from training knowledge and product UX conventions; not independently verified this session.
- **Report-UX practices** (narrative-first summaries, estimate labeling, empty states) — MEDIUM confidence, general established practice; no external fetch succeeded in this environment.

---
*Pitfalls research for: Traffic intelligence report — referring sites, advertisers/creatives, consolidated report, TabAPI integration*
*Researched: 2026-10-13*
