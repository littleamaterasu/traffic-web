---
phase: 09-domain-age-and-whois-history-via-whoisxml-api
reviewed: 2026-10-23T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/types/whois.ts
  - src/lib/whois-insights.ts
  - src/lib/whois.ts
  - src/lib/cached-store.ts
  - src/lib/format.ts
  - src/app/api/whois/route.ts
  - src/app/api/whois/history/route.ts
  - src/components/whois-panel.tsx
findings:
  critical: 0
  high: 2
  medium: 5
  low: 5
  total: 12
status: issues_found
---

# Phase 9: Code Review Report

Verified safe: the apiKey does not leak. `fetch` failures are caught with no `cause`, errors carry fixed Vietnamese text, `Response.url` is never read, and the key is not in any cache key. `domain` is validated by `normalizeDomain` and encoded by `URLSearchParams`, with a fixed base URL, so there is no SSRF or param injection. Raw WHOIS text is dropped before the response is built, except for finding H-1.

## High

### H-1: `/api/whois` returns the registrant organization (and, by fallback, a person's name) to the browser
**File:** `src/types/whois.ts:28`, `src/lib/whois.ts:163,176`, `src/app/api/whois/route.test.ts:96`
**Failure scenario:** `WhoisRecord.registrant_organization` carries upstream `registrant.organization` verbatim in the JSON response. The panel does not render it, but anyone can read it from the network tab or by calling the API directly. For individuals, WhoisXML frequently puts the personal or company name in this field. This contradicts the stated rule that only privacy-state labels, registrar, nameservers and dates reach the browser. The test pins the leak by asserting `registrant_organization: "Acme Co"`.
**Fix:** Remove the field from `WhoisRecord`, the fixture and the tests. Keep only `privacy_protected` (computed server-side). In `fetchWhoisRecord`, compute `detectPrivacy` and do not return the string.

### H-2: A GET endpoint that spends credits has no auth, rate limit or bound on distinct domains
**File:** `src/app/api/whois/history/route.ts:23-49`, `src/lib/whois.ts:295-306`
**Failure scenario:** Any unauthenticated caller, crawler or link prefetcher can hit `/api/whois/history?domain=X` for many distinct domains. Each one triggers a paid `mode=purchase` of up to 100 records. The 100-record cap is per request only, not per time window. The cache is keyed by hostname, so `www.x.com`, `a.x.com` and `x.com` are each purchased separately; `normalizeDomain` does not reduce to the registrable domain.
**Fix:** Do the following.
- Make the purchase a POST, or require a same-origin or CSRF token or the app's invite gate.
- Add a global daily purchase budget (counter in the store) and a per-IP limit.
- Normalize the key to the registrable domain, or at least strip a leading `www.`.

## Medium

### M-1: A failed or timed-out purchase after charge is re-bought on every retry
**File:** `src/lib/whois.ts:300-305`, `src/components/whois-panel.tsx:276`
**Failure scenario:** The preview count is cached, but the purchase result is cached only on success. If the purchase is charged and then the response fails (network error, non-JSON 200, or the 20s client abort that leaves the server request still running), the next "Thử lại" click issues a fresh purchase and charges again. Because failures are never cached, the user can loop-buy.
**Fix:** Cache a purchase-attempt marker, or a short negative TTL (for example 5 minutes) for purchase failures, and cap retries per domain.

### M-2: An upstream 200 with an error body is cached for 24h as "no history" or null
**File:** `src/lib/whois.ts:245-250,146-149`
**Failure scenario:** `fetchHistoryPurchase` treats any body without a `records` array as an empty list. A quota or error JSON returned with HTTP 200 becomes `compactHistory([])`, which `historyStore` caches for 24h. The user sees "chưa có lịch sử" and a retry is impossible until the TTL expires. `recordStore` likewise caches `null` for transient missing-data responses.
**Fix:** Throw `failure(502)` when `records` is not an array; accept an empty array only when `recordsCount === 0`. Use a short TTL for null.

### M-3: `too_many_records` is recomputed from a cached preview, and preview and purchase counts can disagree
**File:** `src/lib/whois.ts:284,301-304`
**Failure scenario:** The error is not cached in `historyStore`, which is correct for credits. However, the preview count is cached for 24h, so a domain that has fallen under the cap is still refused. Conversely, the purchase can return more than `cap` records if the count grew since the preview, and nothing enforces the cap on the purchased payload.
**Fix:** Use a shorter TTL for previews (or skip caching previews above the cap). Truncate or validate `records.length` after purchase.

### M-4: Silently dropping records with unparsable `audit` dates
**File:** `src/lib/whois-insights.ts:130-133`, `src/lib/whois.ts:196-205`
**Failure scenario:** WhoisXML audit dates such as `2020-01-01 00:00:00 UTC` are not guaranteed to parse in `Date.parse` on every runtime. Such records are filtered out, so `records`, `first_seen` and the change events are all understated with no signal. The `Date.parse` dependence is also not locale-safe.
**Fix:** Parse explicitly (a regex for `YYYY-MM-DD HH:mm:ss`, then `Date.UTC`). Report a `skipped` count, or fall back to `createdDateISO8601`.

### M-5: Age fields are inconsistent, and `age_days` ignores a future `created_date`
**File:** `src/lib/whois.ts:161-170`
**Failure scenario:** `age_years` is derived from `createdDate` first, then from the estimate. `age_days` prefers `estimatedDomainAge` over `createdDate`. The two can disagree. When `created` is in the future, `age_years` is null but `age_days` still shows the estimate.
**Fix:** Derive both from the same source: `age_days = Math.floor(ageYears * 365.25)`, or use the estimate for both.

## Low

### L-1: Privacy regex false positives and the history privacy signal
**File:** `src/lib/whois-insights.ts:32-33,107-112`
**Failure scenario:** `/privacy|proxy/i` marks organizations such as "Privacy Matters Ltd" or "Proxy Engineering Inc" as private. In history, any non-empty name, including a person's name, becomes "public". An organization changing from "REDACTED" to a blank value does not register as a change. The result is noisy `privacy` events.
**Fix:** Anchor to known provider names and `redacted for privacy`. Treat these as heuristics in the copy, which is already hedged in the record view only.

### L-2: `yearsBetween` leap-day handling
**File:** `src/lib/whois-insights.ts:35-54`
**Failure scenario:** `Date.UTC(y+1, 1, 29)` rolls to 1 March, so for a Feb 29 anniversary in a non-leap year the whole count switches a day late. The effect is at most one day.
**Fix:** Clamp to the last day of the month before calling `Date.UTC`. Low impact.

### L-3: Config name disclosure in client-visible messages
**File:** `src/lib/whois.ts:58`, `src/app/api/whois/route.ts:35`
**Failure scenario:** The message "WHOIS_API_KEY không hợp lệ" and the 500 "Chưa cấu hình WHOIS_API_KEY" reveal server config details to every visitor.
**Fix:** Use neutral wording and keep the specifics in operator docs.

### L-4: Panel has no unmount abort for history, and a formatting slip
**File:** `src/components/whois-panel.tsx:185-223,112`
**Failure scenario:** `HistorySection.load` has no abort on unmount or domain change. The `key={data.domain}` remount and `requestedDomain` guard keep stale data from showing, so this is harmless today, but it is fragile. Separately, `?TIMEOUT_MESSAGE` is missing a space, which suggests the file was not formatted.
**Fix:** Hold the controller in a ref and abort it in an effect cleanup.

### L-5: Test quality gaps
**File:** `src/lib/whois.test.ts`, `src/app/api/whois/route.test.ts:96`, `src/lib/whois-insights.test.ts`
**Failure scenario:**
- Route tests mock `fetch` with fixtures that contain the sentinel, so "not contain" assertions only prove the mapping of those fixtures. No test covers a purchase that fails after charge, a 200 error body, an unparsable audit date, or a Feb 29 or month-end age.
- The route test locks in the H-1 leak.
- Panel tests never exercise a domain change mid-request.
**Fix:** Add those cases and remove the `registrant_organization` assertion.
