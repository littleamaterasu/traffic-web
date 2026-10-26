---
phase: 02-referring-sites-backlinks-slice
verified: 2026-10-26T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (automated); browser-only checks pending
overrides_applied: 0
human_verification:
  - test: "Visual resemblance of the Top backlink list to the AITDK extension"
    expected: "Metric strip plus list items (letter badge, domain, DR badge, title, anchor chip, arrow, target path) look and read like AITDK"
    why_human: "Visual appearance cannot be verified by grep or jsdom"
  - test: "Mobile width layout"
    expected: "Metric grid and list items stack without overflow at about 375px"
    why_human: "Responsive rendering needs a real browser"
  - test: "Dev server restarted, click Tải backlink for a real domain"
    expected: "Data loads once; a second click or reload within 24h does not re-bill; no request fires before the click"
    why_human: "Real network and process-level cache lifetime"
  - test: "Run with TABAPI_KEY missing"
    expected: "Panel shows the Vietnamese 'Chưa cấu hình TABAPI_KEY' error with Thử lại; the rest of the report still renders"
    why_human: "Needs a restarted server with a modified environment"
  - test: "Live lookup for a domain with no backlink data"
    expected: "Vietnamese empty state; report unaffected"
    why_human: "This behavior was never observed live; only fixtures and unit tests cover it"
---

# Phase 2: Referring Sites (Backlinks Slice) Verification Report

**Phase Goal:** The researcher sees the top external sites linking to the analyzed domain, presented as a ranked panel in the Vietnamese dashboard and honestly labeled as link-based referring domains, never as visit-weighted traffic.
**Status:** human_needed. All automated and code-level checks pass; no gaps found.
**Re-verification:** No, initial verification.

## Command results (run by verifier)

| Command | Result |
|---|---|
| `npx vitest run` | 28 files, 387 tests passed |
| `npx tsc --noEmit` | no errors |
| `npm run lint` | 0 errors, 1 warning (`<img>` in `trustpilot-panel.tsx`, not Phase 2 code) |

## Success criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| SC1 | Click-to-load; overview metrics plus top-backlinks list | VERIFIED | `referring-sites-panel.tsx`: `load()` runs only from the button `onClick`. There is no fetch on mount; the effect only manages a mounted flag. Five `MetricCard`s: DR, Backlinks, Tên miền giới thiệu, Dofollow backlink, Dofollow tên miền. `BacklinkItem` renders letter badge, `from_domain`, `DR n` badge, title (link), anchor chip, arrow and `to_path` (link to the full `to_url`). `VISIBLE_BACKLINKS = 10` plus "Xem thêm N backlink" / "Ẩn bớt". Mounted at `traffic-dashboard.tsx:307`. Dashboard test (line 178) asserts no `/api/referring-sites` call before the click, exactly one call after, and a single "Tải backlink" button. The panel test "ban đầu ... chưa gọi fetch" also passes. Route and lib call `GET tabapi.com/api/v1/domains/{domain}/backlinks` with the Bearer key. |
| SC2 | Labeled link-based, distinct from referral traffic (A-07) | VERIFIED | Panel badge "Backlink — không phải lượt truy cập". The info text says the data is backlink-based from TabAPI, not visit-weighted, and differs from the "Giới thiệu" share. It also covers DR on a 0-100 scale, the list being a sample of 20 and not the full index, and the 5 credits plus 24h cache. |
| SC3 | Empty state in Vietnamese; the report keeps rendering | VERIFIED (unit level) | `isEmptyReferringSites` and the route return `data` with an empty result as success, not an error. The panel shows `EmptyCell` "Chưa phát hiện backlink nào…" plus a retry button. Covered by panel, lib and route tests. Error states are Vietnamese (`role="alert"`, "Thử lại", timeout and fallback messages). Failures live in the section's own slice and the panel is independent, so the report is not affected. Live no-data behavior NOT observed (see human items). |
| SC4 | 24h cache plus in-flight dedup; failures uncached | VERIFIED | `getReferringSites` uses `createCachedStore` under key `backlinks:{domain}`. That store has a 24h TTL and an `inFlight` map (`cached-store.ts`). Tests cover sequential calls with different case (one upstream call), concurrent calls (one call) and error-then-success (two calls). One design note: empty results use a separate 10-minute cache (`EMPTY_RESULT_TTL_MS`). This is a deliberate deviation from 24h for the empty case and does not hurt SC4 for real data. |
| SC5 | SE Ranking backlink feature removed; ads and competitors remain | VERIFIED | `src/app/api/seranking/` contains only `ads` and `competitors`. `grep -i backlink` over `seranking.ts`, `types/seranking.ts`, `seranking-panel.tsx` and `src/test` finds nothing outside the referring-sites fixture. The dashboard has exactly one "Tải backlink" button (Phase 2's). The SE Ranking ads and competitors buttons still exist, and the full suite is green including `seranking.test.ts` and `seranking-panel.test.tsx`. |

## Security and conventions

- `TABAPI_KEY` appears in non-test `src` only in `app/api/referring-sites/route.ts` and `app/api/traffic/route.ts`. The key is passed as a parameter to the lib, and the route test asserts it is not echoed in the response.
- The sanitizer allows only http/https URLs, caps title and anchor length, clamps numbers and drops unknown fields. Response size is capped (1 MB) and `redirect: "error"` is set. Rendering uses React text only, with `rel="noopener noreferrer"`.
- No `abort()` on cleanup. Only a timeout abort is used, with mounted and controller guards. A StrictMode test passes.
- No debt markers (TBD/FIXME/XXX) found in the Phase 2 files read.

## Requirements

| Req | Status | Basis |
|---|---|---|
| REFS-01 | SATISFIED | Click-to-load, overview metrics, sampled list, cache. |
| REFS-02 | SATISFIED | Per-item fields rendered safely; no favicons (neutral letter badge, per A-02). |
| REFS-03 | SATISFIED | Badge plus info text. |
| REFS-04 | SATISFIED (tests) | Empty state exists in code and tests; live no-data not observed. |
| REFS-05 | SATISFIED | Cache and dedup tests. |
| SERK-04 | Correctly marked Dropped | Replaced by REFS-01/02; no SE Ranking backlink code remains. |

REQUIREMENTS.md marks REFS-01..05 `[x]` / Complete, and the code supports that. No orphaned requirements.

## Honest caveats

- Live TabAPI probe on 2026-10-26 for canva.com matched AITDK (DR 93, 58.35M backlinks, 449.6K referring domains, 91%/89% dofollow). A live smoke through `src/lib/referring-sites.ts` returned the same figures and 20 sampled backlinks. (Recorded from the task brief; the verifier did not re-run live calls, to avoid spending credits.)
- The list is limited to 20 sampled items, so it cannot show the full backlink index. This is stated in the info text. REFS-07 (pagination) is out of scope for v1.
- There are no favicons, by decision A-02.
- Live behavior for domains with no backlink data was not observed.
- The pre-click idle text says "Tải khi bạn bấm nút". Once data is shown, the load button disappears, so a refresh requires a domain re-search. This is acceptable given the 24h cache.

## Human verification required

1. Visual resemblance to the AITDK list.
2. Mobile width layout.
3. Behavior after a dev-server restart (cache is in-process and resets).
4. Behavior with `TABAPI_KEY` missing.
5. A live lookup of a no-backlink-data domain.

## Gaps Summary

None. Status is `human_needed` solely because of the browser-only items above.

---

_Verified: 2026-10-26_
_Verifier: Claude (gsd-verifier)_
