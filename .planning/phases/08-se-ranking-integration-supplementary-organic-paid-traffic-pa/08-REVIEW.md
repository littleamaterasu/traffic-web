---
phase: 08-se-ranking-integration-supplementary-organic-paid-traffic-pa
reviewed: 2026-10-22T13:30:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - .env.example
  - src/app/api/seranking/backlinks/route.test.ts
  - src/app/api/seranking/backlinks/route.ts
  - src/app/api/seranking/route.test.ts
  - src/app/api/seranking/route.ts
  - src/components/seranking-panel.test.tsx
  - src/components/seranking-panel.tsx
  - src/components/traffic-dashboard.test.tsx
  - src/components/traffic-dashboard.tsx
  - src/lib/seranking.test.ts
  - src/lib/seranking.ts
  - src/test/seranking-fixture.ts
  - src/types/seranking.ts
findings:
  critical: 1
  warning: 3
  info: 4
  total: 8
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-10-22T13:30:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 08 adds a SE Ranking integration: two server API routes (`/api/seranking`, `/api/seranking/backlinks`), an upstream client with per-endpoint 24h caches (`src/lib/seranking.ts` on the shared `cached-store`), a large client panel component with on-demand backlinks loading, typed contracts (`src/types/seranking.ts`), fixtures, and extensive tests. The `traffic-dashboard.tsx` change is minimal and correct (2 lines: import + `<SerankingPanel key={data.domain} domain={data.domain} />` — remount-per-domain prevents stale state).

Verification evidence: `npm test` 127/127 pass, `npm run lint` clean, `npx tsc --noEmit` clean.

The implementation quality is generally high: the API key stays in the server-only `Authorization` header (never in URLs, never echoed in errors — asserted by tests), upstream data is defensively normalized field-by-field, `source` is regex-validated and URL-encoded, client-side hrefs are http(s)-allowlisted with `rel="noopener noreferrer"`, per-slice error degradation is well designed, and error results are correctly not cached. Conventions (Vietnamese strings, English snake_case codes, `import type`, no comments, SCREAMING_SNAKE_CASE constants) are followed throughout.

However, one critical security issue was found in the phase's own diff: the sanitization of `.env.example` (commit `08cfb9e`) removed **real-looking API keys from the working tree only — both keys remain retrievable in git history** (introduced in commit `300b113`). Three warnings cover client-side robustness gaps in the new panel's fetch lifecycle and runtime validation.

## Narrative Findings (AI reviewer)

### Critical Issues

### CR-01: Real API keys remain retrievable in git history — sanitization only cleaned HEAD

**File:** `.env.example:1,7` (in history: commit `300b113`; "sanitized" in commit `08cfb9e`)
**Severity:** CRITICAL (security — hardcoded secrets / leaked credentials)

**Issue:** The phase diff for `.env.example` shows the previously committed values were live-looking keys:

- `TABAPI_KEY=sk__LamnedOTxn5Dpvb_pNz6FtZwoL-AP_YgPdi6-aSYaI`
- `SERPAPI_KEY=iFGL8QXpqLC1jqzn4LU2w9qF`

Commit `08cfb9e` ("sanitize .env.example template keys") replaced them with empty values in the current tree, but git history is immutable: both keys are fully retrievable via `git show 300b113:.env.example` (verified during this review) and are present in every commit from `300b113` through `08cfb9e^`. `git log --all -S` confirms no other file in history contains them. The TabAPI key bills credits (direct financial exposure); the SerpApi key is likewise a paid credential. If this repo is ever pushed to a remote, or anyone gains access to the local `.git`, both keys are compromised. Sanitizing the current file does not un-leak a secret.

**Fix:**
1. **Rotate/revoke both keys immediately** with TabAPI and SerpApi and issue new ones into `.env.local` (gitignored — verified). Treat the old values as compromised regardless of whether the repo has been pushed.
2. Optionally rewrite history before any remote push (e.g., `git filter-repo --path .env.example --invert-paths` for the affected range, or BFG), followed by a force-push if a remote already exists — only safe locally since this repo has no remote.
3. Prevent recurrence: add a pre-commit secret scan (e.g., `gitleaks`) and keep `.env.example` as placeholders only.

```bash
# Verify exposure (already confirmed):
git show 300b113:.env.example
# After rotation, optionally purge:
git filter-repo --invert-paths --path .env.example --refs 300b113..HEAD
```

### Warnings

### WR-01: Shallow runtime response validation can crash the React tree on envelope-valid payloads

**File:** `src/components/seranking-panel.tsx:99-119` (validators), crash sites at `:248-261` and `:386-400`
**Severity:** WARNING (robustness — the component's own validation intent is not fulfilled)

**Issue:** `isSeRankingResponse` / `isSeRankingBacklinksResponse` only check that `domain`/`source` are strings and that each slice has a `data` **or** `error` key (`isSliceShape`, line 99-101). They never validate the inner shape. If `keywords.data` is ever a truthy non-array (e.g., a string), `slice.data?.slice(0, LIST_LIMIT)` (line 248) returns a substring, `ads.length` is truthy, and `ads.map(...)` (line 260) throws `TypeError: ads.map is not a function`. Similarly, a non-object `backlinks.data` reaching line 400 (`data.top_anchors_by_backlinks.length`) throws on `undefined.length`. There is no error boundary, so either throw unmounts the whole report. With the current trusted server this is unreachable, but the validators exist precisely to guard malformed bodies — and the test suite only exercises a completely different shape (`{ khong_dung: true }`, line 285-293), not an envelope-valid but deeply malformed one. The defense is thus narrower than its stated purpose.

**Fix:** Validate the slice payload shape in the type guards:

```ts
function isSliceShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  return "data" in value || "error" in value;
}

function isSeRankingResponse(body: unknown): body is SeRankingResponse {
  // ...existing checks, plus:
  const overview = candidate.overview as { data?: unknown } | null;
  return isSliceShape(candidate.overview) && (overview?.data === null || typeof overview.data === "object");
}
// For keywords/competitors slices require Array.isArray(data) or data === null.
```

Alternatively, guard at the render sites (`Array.isArray(slice.data) ? slice.data : []`) or wrap `Results` in a React error boundary so a bad payload degrades to the existing fallback alert instead of a blank page.

### WR-02: BacklinksPanel in-flight request is never aborted on unmount or domain change

**File:** `src/components/seranking-panel.tsx:325-363` (contrast with the effect cleanup at `:481-484`)
**Severity:** WARNING (resource/cost waste + inconsistent fetch lifecycle)

**Issue:** `load()` creates an `AbortController` that only ever fires via the 20s timeout — nothing aborts it when the component unmounts or `domain` changes. The same file's `SerankingPanel` effect correctly aborts on cleanup (lines 481-484), so the lifecycle is inconsistent within one file. Consequences: (a) an abandoned backlinks request keeps running for up to 20 seconds and still completes server-side — and the panel's own copy states each backlinks load **costs SE Ranking credits** (`:373-375`), so this is a paid waste; (b) after unmount, `setState` is invoked on a dead component (a silent no-op in React 19, but the pattern masks future bugs); (c) the `requestedDomain` render guard (`:365`) makes stale results invisible, which is why this is not a correctness bug — but wasted-credits network calls should not outlive their consumer.

**Fix:** Track the controller in a ref and abort on unmount/domain change:

```tsx
const controllerRef = useRef<AbortController | null>(null);

useEffect(() => () => controllerRef.current?.abort(), []);

async function load() {
  controllerRef.current?.abort();
  const controller = new AbortController();
  controllerRef.current = controller;
  // ... pass signal: controller.signal, and in catch: if (controller.signal.aborted) return;
}
```

### WR-03: Effect catch treats an intentional cleanup abort as a real failure

**File:** `src/components/seranking-panel.tsx:469-476`
**Severity:** WARNING (false error state; user-visible in dev)

**Issue:** When the effect's cleanup aborts an in-flight fetch (StrictMode's mount→cleanup→remount cycle in dev, or a domain change), the resulting `AbortError` falls into the catch and is written as `{ status: "error", ... }` — indistinguishable from a genuine network failure. In React StrictMode dev, every mount aborts fetch #1 immediately, so the panel renders the `role="alert"` fallback ("Không thể tải dữ liệu SE Ranking lúc này.") for the entire duration of fetch #2 — a false error flash on each mount. In production, a domain change writes the error state under the old `requestedDomain` (masked by the `requestedDomain === domain` guard at `:487`, so final state is never wrong), but the state machine still passes through a bogus "error" transition.

**Fix:** One-line guard in the catch (and mirror it in `BacklinksPanel.load`):

```tsx
} catch (cause) {
  if (controller.signal.aborted) return; // intentional cancel, not a failure
  setState({ requestedDomain: domain, status: "error", data: null, error: ... });
}
```

### Info

### IN-01: No timeout on upstream SE Ranking HTTP calls

**File:** `src/lib/seranking.ts:129-135`
**Severity:** INFO

**Issue:** `requestSeRanking` passes no `signal` to `fetchImpl`, so a hung upstream holds the route open (bounded only by undici defaults). This exactly mirrors the pre-existing `tabapi.ts:42-51` pattern, so it is a systemic convention rather than a new defect — noting it once for both clients.

**Fix:** Add `signal: AbortSignal.timeout(15_000)` to both upstream clients and map `TimeoutError` to the existing `network_error` (502) branch.

### IN-02: Duplicated helpers, constants, and near-identical strings across the new files

**File:** `src/app/api/seranking/route.ts:22-24`, `src/app/api/seranking/backlinks/route.ts:13-25`, `src/components/seranking-panel.tsx:19-21,130-132`, `src/components/traffic-dashboard.tsx:325,344-348`
**Severity:** INFO

**Issue:** `errorResponse` is copy-pasted in three route files; `toSlice` (settled-result) and `toErrorSlice` (catch) implement the same mapping twice; `REQUEST_TIMEOUT_MS`, `TIMEOUT_MESSAGE`, and abort detection are duplicated between `seranking-panel.tsx` and `traffic-dashboard.tsx`; and the two fallback strings differ by one word (client "Không thể **tải** dữ liệu SE Ranking…" vs server "Không thể **lấy**…"). None of this is a bug, but it is drift-prone.

**Fix:** Extract `errorResponse` into a shared route helper module; keep one `REQUEST_TIMEOUT_MS`/`isAbortError` in `src/lib/` next to the fetch helpers; align the two fallback sentences (pick one verb) or share the constant.

### IN-03: Test gaps — timeout/abort path and envelope-valid malformed payloads untested

**File:** `src/components/seranking-panel.test.tsx` (whole file), `src/app/api/seranking/route.test.ts:150-161`
**Severity:** INFO

**Issue:** (a) `TIMEOUT_MESSAGE` is unreachable in tests — no test advances past 20s or rejects with a `DOMException("AbortError")`, so the branch `seranking-panel.tsx:358,474` is unverified. (b) The malformed-response test only covers a totally different shape; no test provides an envelope-valid body with e.g. `keywords.data = "garbage"` — exactly the WR-01 crash class. (c) The `source` validator's empty-string case (`?source=` → 400) is untested (uppercase and >2 chars are covered).

**Fix:** Add: a test rejecting with `Object.assign(new Error("aborted"), { name: "AbortError" })` (or a real `AbortController.abort()`) asserting the timeout copy; a test with `{ domain: "x", source: "us", overview: { data: null, error: null }, keywords: { data: "garbage", error: null }, competitors: { data: null, error: null } }` asserting the fallback alert (will fail until WR-01 is fixed — write it as the regression test); and a `?source=` route test.

### IN-04: `source` parameter supported by the API but never sent by the UI — region not disclosed for keywords/competitors

**File:** `src/app/api/seranking/route.ts:50-53`, `src/components/seranking-panel.tsx:29-77`
**Severity:** INFO

**Issue:** The route validates and accepts `source` (default `us`), but the client never sends it, so keywords and competitors always come from the `us` database. The overview panel discloses its scope ("SE Ranking · toàn cầu"), while the keywords/competitors panels and their info modals say nothing about the region — a researcher could reasonably assume global coverage parity with the overview. The API-level `source` capability is otherwise dead code from the UI's perspective.

**Fix (either):** Add a region disclosure to `SERANKING_INFO.keywords` / `SERANKING_INFO.competitors` (e.g., note: "Dữ liệu tính trên cơ sở dữ liệu khu vực `us` của SE Ranking"), or surface a source selector that passes `&source=` through. If `source` will stay permanently unused by this UI, consider documenting it as an API-only parameter in the route to avoid implying UI support.

---

## Per-File Pass Notes

- **`.env.example`** — current content is clean (empty placeholders, Vietnamese comments); see CR-01 for the history problem.
- **`src/app/api/seranking/route.ts`** — correct validation order (domain → source → key), `Promise.allSettled` per-slice degradation, key never echoed, cache headers set. Solid.
- **`src/app/api/seranking/backlinks/route.ts`** — same pattern; correctly isolated so credits-consuming backlinks are only fetched on demand.
- **`src/lib/seranking.ts`** — defensive normalization (`num`/`str`/`toAnchors`) handles every malformed upstream shape gracefully; errors are typed (`SeRankingApiError` with `name` set), never contain the key (tested), and error results are not cached (tested). Cache keys (`domain:source:limit`) are collision-safe given `normalizeDomain` output.
- **`src/components/seranking-panel.tsx`** — good a11y (roles, aria-live, labelled lists), Vietnamese copy, http(s)-allowlisted hrefs with `noopener noreferrer`, `data:`/`javascript:` correctly excluded. Issues WR-01/WR-02/WR-03 above.
- **`src/components/traffic-dashboard.tsx`** — the 2-line change is correct; `key={data.domain}` remount resets panel state per search.
- **`src/types/seranking.ts`**, **`src/test/seranking-fixture.ts`** — accurate contracts; fixture deliberately includes a non-http URL and 11 keyword rows to exercise slicing/allowlisting.
- **Test files** (`seranking.test.ts`, both route tests, `seranking-panel.test.tsx`, `traffic-dashboard.test.tsx`) — strong coverage of happy paths, partial failures, 401 mapping, key non-leakage, cache isolation/dedup, and dashboard wiring. Gaps noted in IN-03.

---

_Reviewed: 2026-10-22T13:30:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
