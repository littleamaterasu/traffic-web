---
phase: 10-trustpilot-panel-via-local-scraper-service
reviewed: 2026-10-23T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/types/trustpilot.ts
  - src/lib/trustpilot.ts
  - src/lib/trustpilot-stars.ts
  - src/lib/format.ts
  - src/app/api/trustpilot/route.ts
  - src/components/trustpilot-panel.tsx
  - src/components/traffic-dashboard.tsx
  - src/test/trustpilot-fixture.ts
  - src/lib/trustpilot.test.ts
  - src/app/api/trustpilot/route.test.ts
findings:
  critical: 0
  high: 1
  medium: 4
  low: 8
  total: 13
status: issues_found
---

# Phase 10: Code Review Report

Depth: standard. No critical issues. Scraper URL handling is sound: origin-only extraction drops userinfo and path, the scheme is restricted to http/https, `redirect: "error"` is set, and error messages never include upstream text or the URL. Normalization is a strict whitelist. The main gaps are the response-size cap, unbounded scrape triggering, and caching of empty profiles.

## High

### HI-01: Response size cap is enforced after full buffering, and its test cannot fail
**File:** `src/lib/trustpilot.ts:212-225`; test `src/lib/trustpilot.test.ts:251-260`
**Failure scenario:** `await response.text()` reads the whole body into memory, and only then is `text.length > MAX_RESPONSE_CHARS` checked. A misbehaving or compromised scraper can stream hundreds of MB, and the cap does not prevent that (memory pressure up to the 45 s timeout). The cap also counts UTF-16 chars, not bytes. The "huge" test sends `"x".repeat(1_000_001)`, which is not JSON. It passes with `invalid_response` even if the cap code is deleted, so the cap is effectively untested.
**Fix:** Check `content-length` first. Then stream with `response.body.getReader()`, accumulate a byte count, `reader.cancel()` and throw `invalidResponse()` once it exceeds the limit. In the test, use a valid JSON body larger than the cap, for example `{"success":true,"pad":"xxx..."}`. Assert that a cap-sized body is rejected and one just under the cap is accepted.

## Medium

### ME-01: Empty profile (`profile: null`) is cached for 24 h, and `success:false` is always an error
**File:** `src/lib/trustpilot.ts:139, 239-248`
**Failure scenario:** A `success:true` response without `business` (a transient scraper parse miss, a Trustpilot layout change, or a rate-limit page) is stored for 24 h. Retrying then returns "Chưa có hồ sơ" without ever hitting the scraper, and the panel hides the retry button once the state is `ready`. Conversely, if the scraper reports an unknown domain as `success:false` (the failure cases are uncharacterised in CONTEXT), the user sees a generic error with "Thử lại" instead of the empty state, and every retry costs a ~21 s scrape.
**Fix:** Give the null-profile result a short TTL (for example 10-15 min), or do not cache it. `createCachedStore` takes only a single global TTL, so either add a per-entry TTL or throw for the uncached case. Characterise the scraper's not-found shape and map it to the empty state.

### ME-02: No concurrency or rate bound on a ~21 s scrape triggered by any caller
**File:** `src/app/api/trustpilot/route.ts:23-47`; `src/lib/cached-store.ts`
**Failure scenario:** In-flight dedup is per domain only. Anyone who can reach `/api/trustpilot` (the app is exposed via ngrok per `next.config.ts`) can request many distinct domains. That starts many parallel headless scrapes against the local service and risks a Trustpilot ban or resource exhaustion. Failures are not cached, so each error is retryable at full cost. The 100-entry LRU can also be churned out.
**Fix:** Add a global semaphore (for example max 2 concurrent scrapes, otherwise 429/503 with a Vietnamese message). Optionally add a short negative cache (30-60 s) for failures per domain.

### ME-03: Cache key ignores `baseUrl`; the config error is inconsistent
**File:** `src/lib/trustpilot.ts:246-247`; `src/app/api/trustpilot/route.ts:33-40, 44-47`
**Failure scenario:** The cache is keyed by domain only. If the env changes in the same process (dev HMR, tests), stale data from another scraper is served. Separately, a missing URL returns HTTP 500, but an invalid URL (`invalid_scraper_url`, status 500) is flattened into an HTTP 200 slice error. Clients and monitoring see two different shapes for the same class of misconfiguration. The route also hard-codes the name `TRUSTPILOT_SCRAPER_URL` in browser-visible messages, which leaks config naming (minor).
**Fix:** Validate the URL in the route before the cache (or always return the slice form), and use one status convention. Keep config names out of user-facing text.

### ME-04: Rendering of stars when `stars` is 0 or inconsistent with `trust_score`
**File:** `src/components/trustpilot-panel.tsx:139-140, 160`
**Failure scenario:** `computeStarFills(0)` returns a length-5 array, so the `stars.length ? … : trust_score` fallback never triggers for `stars: 0`. If the scraper emits `stars: 0` as a placeholder, the header shows 5 grey boxes next to a TrustScore of 4.9. `clampNumber` also turns a garbage negative into 0. The aria-label uses `business.stars ?? business.trust_score`, which can disagree with the boxes shown.
**Fix:** Treat `stars` as valid only when it is greater than 0 (or null it in normalization when it is 0 and `trust_score` is present). Derive the label from the same source as the fills.

## Low

### LO-01: Review rating of 0 is clamped up to 1
**File:** `src/lib/trustpilot.ts:103` (test asserts it at `trustpilot.test.ts:81`)
`clampNumber(raw.rating, 1, 5)` maps invalid or zero ratings to 1 star, which fabricates a "1 star" review. Return null when the value is outside 1-5 rather than clamping. The test locks in the wrong behaviour.

### LO-02: Safe URL helpers return the raw string, not the parsed one; hosts are unrestricted
**File:** `src/lib/trustpilot.ts:52-62`; `src/components/trustpilot-panel.tsx:141-143`
Scheme is allow-listed (good), but `https://user:pw@host/` (userinfo, phishing-style) passes and the trimmed original is returned. `logo_url` can point at any host, so the browser makes a third-party request (IP leak or tracking pixel; `no-referrer` helps). `trustpilot_url` is not required to be a `trustpilot.com` host. Return `parsed.href`, reject userinfo, and restrict `trustpilot_url` and `logo_url` to expected hosts or an `img-src` CSP.

### LO-03: `normalizeDate` does not validate the date
**File:** `src/lib/trustpilot.ts:64-68`
`2026-99-99` passes the regex. `formatDate` then returns "—" (safe) but the bad string is kept in the payload. Validate with `Date.parse` or a stricter regex.

### LO-04: `isTimeout` treats a generic `AbortError` as a timeout, and the `DOMException` instance check is environment-sensitive
**File:** `src/lib/trustpilot.ts:158-162`
Only our own signal can abort the fetch, so this is acceptable today. If undici surfaces the timeout as a non-DOMException (an Error with `name: "TimeoutError"`, which happens in some Node versions), the case falls through to `scraper_unreachable`. Check `error.name` on any `Error`.

### LO-05: Server and client timeouts overlap too tightly with the shared in-flight request
**File:** `src/lib/trustpilot.ts:12`; `src/components/trustpilot-panel.tsx:16, 236`
45 s vs 60 s is coherent. However, a client retry joins the same in-flight promise (correct), but the joiner's wait is not bounded by its own time since the start. This is fine today, but note the server timer starts at the first request only. No fix is needed beyond a comment-free constant relationship such as `CLIENT = SERVER + 15_000`.

### LO-06: Panel timeout timer and fetch are not cancelled on unmount (intentional), and the `aria-live` wrapper is broad
**File:** `src/components/trustpilot-panel.tsx:223-229, 282-283, 291`
The no-abort policy is per CONTEXT and fine. The `aria-live="polite"` wrapper around the entire panel, combined with an inner `role="status"` and `role="alert"`, causes double announcements, and the whole review list is re-announced on load. Limit the live region to the status message.

### LO-07: Magic number duplicates the review limit
**File:** `src/components/trustpilot-panel.tsx:306` (`slice(0, 5)`) vs `TRUSTPILOT_REVIEW_LIMIT`
Client importing from `@/lib/trustpilot` pulls server code, so move the constant to a shared module (or `src/types`) and reuse it.

### LO-08: Test-quality gaps
**File:** `src/lib/trustpilot.test.ts:175-188`; `src/app/api/trustpilot/route.test.ts:114-130`; `src/components/trustpilot-panel.test.tsx:236-257`
- The `try { normalizeTrustpilotBody("text") } catch { expect(...) }` blocks pass silently if nothing is thrown (no `expect.assertions` or `toThrow` for the second case). Use `expect(() => …).toThrowError(...)` / `toMatchObject`.
- The "unknown error" route test mocks `getTrustpilotProfile` with a synchronous throw, which is not the realistic rejected-promise path.
- The unmount test asserts `console.error` was not called, but React 19 no longer warns on setState after unmount, so that assertion is vacuous. Assert instead that no state update or DOM change occurs.
- No test covers StrictMode double-invoke, a stale response after a domain change mid-flight, or the logged-output (privacy) requirement.

## Notes (no action required)
- Privacy: no logging anywhere in the phase code; review text and author names live only in the in-process 24 h cache (matches CONTEXT). The cache holds personal data (author names) for 24 h, so restating this in the info text is advisable.
- XSS: all scraped strings render as React text; hrefs are scheme-checked on both server and client; links use `noopener noreferrer`; `<img>` uses `referrerPolicy="no-referrer"`. ESLint `@next/next/no-img-element` is a warning in this config, so it is not reported separately.
- Failures are not cached (verified in `cached-store.ts`: `.finally` deletes in-flight, `.then` only sets on success).

---
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
