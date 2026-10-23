---
phase: 10-trustpilot-panel-via-local-scraper-service
verified: 2026-10-23
status: human_needed
score: 3/3 success criteria verified in code (browser-only checks pending)
gaps: []
human_verification:
  - test: "Compare panel header layout with the real Trustpilot header"
    expected: "Name, TrustScore, star boxes, review count, links look acceptable (logo/claimed/categories/distribution absent)"
    why_human: "Visual fidelity"
  - test: "Click the button on a domain and watch the ~21 s load (live scraper observed ~21-32 s)"
    expected: "Loading status text stays visible, no UI freeze, result renders"
    why_human: "Real-time feel"
  - test: "Unset TRUSTPILOT_SCRAPER_URL (or stop the scraper) and click the button"
    expected: "Vietnamese error in the panel, rest of the report unaffected"
    why_human: "Failure shapes of the scraper are uncharacterized"
  - test: "Mobile width (~375 px)"
    expected: "Panel and review cards stack without overflow"
    why_human: "Responsive layout"
---

# Phase 10 Verification

**Goal:** Researcher loads a domain's Trustpilot profile and latest reviews from the local scraper and sees them Trustpilot-style, with honest empty/unavailable states.

## Automated checks (run by verifier)

| Check | Result |
|---|---|
| `npx vitest run` | 25 files / 303 tests pass (a first run showed one failure from a transient untracked `src/zz-tp-smoke.test.ts` that printed a live gohighlevel.com response; the file was gone on rerun and is not part of the phase) |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | 0 errors, 1 warning (`@next/next/no-img-element` at `src/components/trustpilot-panel.tsx:152`, logo `<img>`; intentional, non-blocking) |
| TBD/FIXME/XXX in phase files | none |

## Success criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Click loads data; server calls scraper (fixed base URL from env, validated domain, fixed limits); panel shows name, TrustScore, stars, review count, Trustpilot link, visit-website link | VERIFIED | `route.ts` calls `normalizeDomain` (400 on invalid) then `getTrustpilotProfile(domain, baseUrl)`. `lib/trustpilot.ts` sends `max_pages: 1` (`TRUSTPILOT_MAX_PAGES`) and `limit: 5` (`TRUSTPILOT_REVIEW_LIMIT`), 45 s timeout. Panel renders name, TrustScore, `StarBoxes`, links (`safeHref`). Fetch lives only in `load()` triggered by button `onClick`; the `useEffect` only manages mounted ref, so no request before click. |
| 2 | Up to 5 Trustpilot-style review cards (stars, heading, body, author, location, date) | VERIFIED | Limit fixed at 5 in client; cards in panel; covered by panel tests; live contract returned 5 reviews with those fields for gohighlevel.com. |
| 3 | Scraper down/slow/`success:false`/no page gives Vietnamese state, report unaffected, URL never sent to browser | VERIFIED (code + tests); live failure shapes unverified | `TrustpilotApiError` mapped into `trustpilot.error` slice with Vietnamese messages; panel shows `role="alert"` message; missing env gives 500 Vietnamese `missing_scraper_url` that names only the variable, not its value. `process.env.TRUSTPILOT_SCRAPER_URL` is read only in `src/app/api/trustpilot/route.ts:33` (grep over non-test `src`). No `NEXT_PUBLIC_`. Panel is mounted as a sibling (`traffic-dashboard.tsx:307`, `key={data.domain}`), so errors are isolated. |

## Other checks

- Panel mounted: `traffic-dashboard.tsx` imports and renders `TrustpilotPanel`.
- `.env.example` ends with `TRUSTPILOT_SCRAPER_URL=` (empty value), with a Vietnamese comment.
- Panel is labeled with source ("Nguồn: Trustpilot (scraper nội bộ)") and has info modal text; fetch time is carried in the result (`fetched_at`).
- Requirements: TRST-01 and TRST-02 are marked Complete in REQUIREMENTS.md; the code behaviors above are present, so the marking is justified for implementation. Browser-only confirmation remains below.
- No Trustpilot data is persisted client-side; 24h server cache follows the existing pattern.

## Honest limitations

- Live scraper contract was verified for ONE domain only (gohighlevel.com): ~21-32 s response, fields as above.
- Failure shapes of the scraper (no-page domain, `success:false`, 4xx/5xx bodies) are uncharacterized live; handling is verified only against assumed shapes in unit tests.
- Logo, claimed date, categories and rating distribution are not provided by the scraper yet. The panel supports them optionally (`logo_url`, `categories`, `rating_distribution`) but they will be absent, so the header cannot be pixel-identical to Trustpilot.
- Untracked `10-REVIEW.md` exists in the phase directory (not reviewed by this verification).

## Human verification required

1. Layout vs the real Trustpilot header.
2. The ~21 s (up to ~45 s) loading experience.
3. Behaviour with `TRUSTPILOT_SCRAPER_URL` unset or the scraper stopped.
4. Mobile width.

## Gaps Summary

No blocking gaps found in code. Status is `human_needed` solely because of the browser-only items above.
