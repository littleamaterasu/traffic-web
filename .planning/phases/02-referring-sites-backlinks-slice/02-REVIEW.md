---
phase: 02-referring-sites-backlinks-slice
reviewed: 2026-10-26T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/types/referring-sites.ts
  - src/lib/backlink-sanitize.ts
  - src/lib/referring-sites.ts
  - src/test/referring-sites-fixture.ts
  - src/app/api/referring-sites/route.ts
  - src/components/referring-sites-panel.tsx
  - src/components/traffic-dashboard.tsx
  - src/lib/cached-store.ts
  - tests (referring-sites.test.ts, backlink-sanitize.test.ts, route.test.ts, referring-sites-panel.test.tsx)
findings:
  critical: 0
  high: 0
  warning: 6
  info: 6
  total: 12
status: issues_found
---

# Phase 02: Code Review Report

Severity mapping used: critical 0, high 0, medium 3 (WR-01..03), low 9 (WR-04..06 + IN-01..06).

## Summary

No critical or high issues. Positive checks that held up: TABAPI_KEY appears only in the Authorization header (never in URL, cache key, thrown messages or responses; upstream error bodies are discarded and messages are static). URL is a fixed base plus encodeURIComponent'd domain, redirect:"error", AbortSignal.timeout covers body reading, size cap is enforced in bytes while streaming, failures are not cached, in-flight dedup lives in cached-store (client abort does not cancel the server fetch, so StrictMode/double-click cannot re-bill). http/https allow-list, credentials rejection and React text-only rendering are correct. SE Ranking ads and competitors panels are intact; no dead backlink exports or fixtures remain (grep clean in src, README, .env.example).

## Medium

### WR-01: No server-side guard on the 5-credit endpoint; cache eviction allows re-billing

**File:** `src/app/api/referring-sites/route.ts:23-48`, `src/lib/cached-store.ts:23-33`
**Scenario:** The route has no throttle. Any client that can reach it can request many distinct valid domains, each costing 5 credits. With cache max 100 entries (oldest-first eviction) and a per-process cache, cycling >100 domains evicts and re-bills earlier ones. Dev HMR/restart also drops the cache. The 10-minute empty cache is similarly bounded at 100.
**Fix:** Add a small per-process request budget (e.g. max N upstream loads per hour, return 429 `rate_limited` slice error) and/or raise `maxEntries` for this store; document that the credit cost is bounded.

### WR-02: Bidi/control characters not stripped from untrusted title and anchor

**File:** `src/lib/backlink-sanitize.ts:1-5`, rendered at `src/components/referring-sites-panel.tsx:96,104`
**Scenario:** A hostile site sets title/anchor to contain U+202E (RLO), zero-width or newline/control chars. React escapes HTML, but text can be visually reordered or spoofed (e.g. make a title display like a trusted domain, or reverse the DR badge context). `slice(0,max)` can also cut a surrogate pair, leaving a lone surrogate.
**Fix:**
```ts
const cleaned = value.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, " ").replace(/\s+/g, " ").trim();
return cleaned ? Array.from(cleaned).slice(0, max).join("") : null;
```

### WR-03: Long unbroken anchor can overflow on mobile (flex item)

**File:** `src/components/referring-sites-panel.tsx:102-105`
**Scenario:** The anchor `<span class="break-words">` is a flex item in a `flex flex-wrap` row. `overflow-wrap: break-word` does not reduce a flex item's min-content width, so a 120-char unbroken anchor (URL-like anchors are common) widens the row beyond the card on a narrow viewport. The `min-w-0` on the parent does not help the child item.
**Fix:** Use `break-all` or `[overflow-wrap:anywhere]` plus `min-w-0 max-w-full` on the anchor span.

## Low

### WR-04: Duplicate referring domains in the 20-item sample are not handled

**File:** `src/lib/referring-sites.ts:107-115`, key at `src/components/referring-sites-panel.tsx:251`
**Issue:** Panel titled "Tên miền giới thiệu" can list the same `from_domain` several times (each is a distinct backlink), which reads as duplicates and wastes the 10-row view. Keys use `index-from_domain`, which is unique but index-based (fine only because the list never reorders).
**Fix:** Either label rows as backlinks (not domains) or de-duplicate by `from_domain` keeping the highest DR; key by `from_url`.

### WR-05: Response shape guard is shallow; malformed `data` can crash the render

**File:** `src/components/referring-sites-panel.tsx:56-64, 175-179, 194-195`
**Issue:** `isReferringSitesResponse` only checks that `referring_sites` has a `data` or `error` key. If `data` lacks a `backlinks` array (proxy/ngrok interstitial JSON, version skew), `result.backlinks.length` throws during render and takes down the dashboard (no error boundary).
**Fix:** Validate `Array.isArray(data.backlinks)` and `typeof data.fetched_at === "string"` before setting `ready`.

### WR-06: "Xem thêm"/"Ẩn bớt" toggle lacks disclosure semantics

**File:** `src/components/referring-sites-panel.tsx:254-258`
**Issue:** AGENTS.md convention requires `aria-expanded`/`aria-controls` on disclosure buttons; the label changes but state is not exposed. The whole panel is also wrapped in `aria-live="polite"` (line 201), so expanding announces up to 20 list items, and `role="alert"`/`role="status"` nested inside produce double announcements.
**Fix:** Add `aria-expanded={expanded}` and `aria-controls` pointing at the `<ul id>`; restrict the live region to the status/error elements.

### IN-01: DR badge shows unformatted float

**File:** `src/components/referring-sites-panel.tsx:89`
**Issue:** `DR {item.domain_rating}` prints raw clamped number (e.g. `87.3333333`) while the overview uses `formatNumber`. Fix: `DR {formatNumber(item.domain_rating)}` or round in `clampScore` consumer.

### IN-02: `to_path` hides the target host

**File:** `src/lib/backlink-sanitize.ts:42-48`, `src/components/referring-sites-panel.tsx:109`
**Issue:** Only path+query is shown; if `to_url` is on a different host/subdomain than the analyzed domain (not validated against the queried domain), users cannot tell. Query strings (possibly tracking tokens) are shown too. Fix: show host when it differs from the queried domain, or drop `search`.

### IN-03: Host extraction edge cases untested/unusual

**File:** `src/lib/backlink-sanitize.ts:31-40`
**Issue:** IDN hosts show punycode (acceptable, anti-homograph) but is undocumented; IPv6 hosts return `[::1]` and `domainInitial` yields "1"; private/loopback hosts (localhost, 192.168.x) are accepted as links; `www.` stripped for display only while the link keeps it; `hostname.slice(0,253)` is a no-op after URL parsing. Tests lack IDN/IPv6/port/trailing-dot/uppercase/`@` cases (credentials rejection is only implicitly covered). Fix: add those test cases and decide on IP-host handling.

### IN-04: Type contract looser than runtime

**File:** `src/types/referring-sites.ts:20`, `src/components/referring-sites-panel.tsx:71`
**Issue:** `from_url: string | null` but normalize never emits null; panel re-runs `safeHttpUrl` on already-sanitized values (defensible defence-in-depth, but then `item.to_path ?? item.to_url` fallback at line 109 is unreachable). Tighten type to `string` and drop the unreachable fallback, or keep and comment the intent.

### IN-05: Misleading/overstated copy and error mapping

**File:** `src/components/referring-sites-panel.tsx:30,206`, `src/lib/referring-sites.ts:195`, `src/app/api/referring-sites/route.ts:40-43`
**Issue:** Copy says "lưu cache 24 giờ" but empty results are cached 10 minutes and the cache is lost on restart; "Thử lại" is shown on an empty/ready result although the server returns the cached empty for 10 min. A mid-stream network reset during body read is reported as `invalid_response` rather than `network_error`. Slice errors (401/402/429) are returned as HTTP 200, which is consistent with other slices but hides errors from any monitoring.

### IN-06: Test quality gaps

**File:** `src/lib/referring-sites.test.ts:94`, `src/components/referring-sites-panel.test.tsx`
**Issue:** `expect(error.message).toMatch(/[ạảã...]|TabAPI|Tên miền/)` is nearly vacuous. No test for concurrent dedup of an empty result (signal path), for the 45s client timeout via fake timers, for StrictMode single-fetch (StrictMode is imported at line 1 of the panel test; verify it is actually used by a test), for a stale response arriving after domain change, or for `aria-expanded`. Panel tests mock `fetch` with `{ok, json}` stubs rather than `Response`, so `response.json()` failure paths are untested. No real network is used (good).

---

_Reviewed: 2026-10-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
