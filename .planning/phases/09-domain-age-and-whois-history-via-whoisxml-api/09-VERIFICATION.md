---
phase: 09-domain-age-and-whois-history-via-whoisxml-api
verified: 2026-10-23T00:00:00Z
status: human_needed
score: 3/3 success criteria verified in code (2 with documented warnings)
overrides_applied: 0
gaps: []
warnings:
  - "Current-record response (/api/whois) includes registrant_organization (e.g. 'Domains By Proxy, LLC') in the browser payload; not rendered, but contradicts CONTEXT decision 'Registrant values never exposed to the browser' (quick 261023-fs0 only stripped it from history)."
  - "Expiry-date CHANGES are not in the history timeline (WhoisChangeField = registrar | name_servers | privacy). ROADMAP SC2 and VET-06 text list expiry changes; dropped deliberately in quick 261023-fs0 (renewal noise). Expiry itself is shown in the current record. Suggest override."
  - "Known limitation: privacy heuristic can classify provider-redacted strings (e.g. 'Registrant State/Province: New York') as public, yielding spurious privacy-change events (gohighlevel.com replay: 3 privacy events, 2 possibly spurious)."
human_verification:
  - test: "Run dev server with real WHOIS_API_KEY, analyze gohighlevel.com, scroll to 'Tuổi thọ & lịch sử domain (WhoisXML)'"
    expected: "Panel auto-loads: age ~9.8 năm, 'Domain lâu năm', GoDaddy.com, LLC, created 11/01/2017, nameservers/status, privacy indicator; network tab shows only /api/whois (no /history)"
    why_human: "Visual layout and live provider response"
  - test: "Click 'Tải lịch sử domain'"
    expected: "Loading text, then Vietnamese volatility summary and timeline; network response contains no registrant names/emails/rawText"
    why_human: "Live credits spend and visual/network inspection in the browser"
  - test: "Analyze a domain with >100 history records (or temporarily lower cap)"
    expected: "Vietnamese too_many_records message in the history alert, no purchase call, 'Thử lại' button"
    why_human: "Needs live provider record counts"
  - test: "Unset WHOIS_API_KEY and reload a report"
    expected: "Only the WHOIS panel shows the missing-key error; the rest of the report renders"
    why_human: "Visual isolation of failure in the running app"
  - test: "Mobile/narrow viewport check of panel and timeline"
    expected: "Readable, no overflow"
    why_human: "Responsive visual"
---

# Phase 9 Verification: Domain age and WHOIS history via WhoisXML API

**Goal:** Researcher sees how old the domain is and how stable it has been, from WhoisXML WHOIS and History APIs, with credit-conscious on-demand history.
**Status:** human_needed (automated checks pass; warnings recorded; browser checks outstanding)

## Automated checks (run by verifier)

| Check | Result |
|---|---|
| `npx vitest run` | 21 files, 225 tests passed |
| `npx tsc --noEmit` | clean (no output) |
| `npm run lint` | clean |
| TBD/FIXME/XXX in phase files | none |

## Success criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Creation date, age (years), registrar, expiry, last-updated, status, nameservers, privacy indicator, Vietnamese age verdict; 1 credit, cached 24h with dedup | VERIFIED | `src/lib/whois.ts` `fetchWhoisRecord` maps all fields (created/updated/expires, estimatedDomainAge, registrarName, status, nameServers, `detectPrivacy`, `classifyAge`); `getWhoisRecord` uses `createCachedStore` (recordStore). `src/components/whois-panel.tsx` `RecordView` renders MetricCards for age+verdict, registrar, created, updated, expiry, privacy, plus TextLists for nameservers and status. Mounted at `traffic-dashboard.tsx:305` (`<WhoisPanel key={data.domain} …/>`). Record loads in `useEffect` on mount; history fetch not triggered (test asserts one fetch, no `/history`; dashboard test asserts no history URL). Real-API facts from orchestrator: gohighlevel.com created 2017-01-11, 9.78y, "Domain lâu năm", GoDaddy.com, LLC. |
| 2 | Click-to-load history; preview first; refuse above fixed cap; compact change timeline; never raw WHOIS text | VERIFIED (with warning on expiry changes) | `HISTORY_RECORD_CAP = 100`; `fetchHistoryPreview` (mode=preview) then `loadHistory` throws 422 `too_many_records` if `count > cap` before any purchase, count 0 short-circuits; purchase only otherwise. Tests: `whois.test.ts:259-263` (no "purchase" mode when over cap), `:281` modes `["preview","purchase"]`, route test `:127-136`. Panel calls `/api/whois/history` only inside `load()` from button onClick. `toHistoryInput` keeps only audit, registrar, nameservers, a registrant string used internally for privacy state, and expiry; `compactHistory` emits only registrar/name_servers/privacy events (privacy values mapped to private/public state, never text). Route tests assert "Acme Co" and "sentinel@example.test" absent. WARNING: expiry changes are not emitted (deliberate, quick fs0), diverging from SC wording. |
| 3 | Vietnamese volatility summary (changes count, first record date), honest empty/error states, key never in browser, failure only affects this section | VERIFIED | `summarizeVolatility` (Vietnamese; 0/1/few/many branches, includes first_seen via `formatDate` and changes_total). Empty states: "WhoisXML chưa có dữ liệu WHOIS…", "WhoisXML chưa có lịch sử WHOIS…"; `role="alert"` errors with retry. Routes return per-slice errors; panel is self-contained component fetching its own endpoints, so failures do not affect other panels. `WHOIS_API_KEY` read only in `src/app/api/whois/route.ts:33` and `src/app/api/whois/history/route.ts:33` (the `whois.ts` hit is just an error message string); no `NEXT_PUBLIC_`; `.env.example` has `WHOIS_API_KEY=` (empty). Cache-Control `private, max-age=0, must-revalidate` on both routes. |

## Requirements

| Req | Status | Note |
|---|---|---|
| VET-02 | SATISFIED | Covered by SC1. Browser display needs human confirmation. |
| VET-06 | SATISFIED with warning | Click-only, preview + cap, volatility summary, no raw text. Expiry-change events omitted by decision (REQUIREMENTS text lists them); suggested override below. |

## Warnings

1. **Registrant organization in current-record payload.** `WhoisRecord.registrant_organization` (types/whois.ts:28, set at whois.ts:176) is returned by `/api/whois` and asserted in `route.test.ts:96` and `whois.test.ts:83`. Not rendered in the UI, and it is a field name only (contacts, emails, raw text are not sent), but for non-private domains it may be an individual/company name. This contradicts the "no registrant text reaches the browser" intent; privacy_protected already carries the needed signal. Recommend removing the field from the type, mapper, fixtures and tests (small follow-up).
2. **Expiry changes omitted.** Suggested override if accepted:
   ```yaml
   overrides:
     - must_have: "change timeline includes expiry changes"
       reason: "Renewals are routine noise; expiry date still shown in current record (quick 261023-fs0)"
       accepted_by: "<name>"
       accepted_at: "<ISO timestamp>"
   ```
3. **Known limitation (honest record):** `classifyPrivacyState` is a heuristic over the registrant organization string; provider-redacted values like "Registrant State/Province: New York" may be classified `public`, producing spurious private/public transitions. Observed on gohighlevel.com replay of 44 real records: changes_total 5 (registrar 0, nameserver 2, privacy 3), 2 of the 3 privacy events possibly spurious; no registrant strings leaked. Panel info note already states the privacy indicator is an estimate.

## Anti-patterns
None blocking. No debt markers in phase files.

## Gaps
None blocking the goal. Status is `human_needed` because browser/live-provider behaviors (listed in frontmatter) cannot be confirmed from code alone.

_Verified by Claude (gsd-verifier)_
