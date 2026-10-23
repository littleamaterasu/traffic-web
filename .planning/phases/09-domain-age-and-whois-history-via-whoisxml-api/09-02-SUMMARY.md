---
phase: 09-domain-age-and-whois-history-via-whoisxml-api
plan: 02
status: complete
subsystem: whois
tags: [whois, whoisxml, cache, credit-cap, vitest]
requires: [09-01]
provides:
  - WhoisXML client (src/lib/whois.ts) with WhoisApiError, HISTORY_RECORD_CAP, fetchWhoisRecord, fetchWhoisHistory, getWhoisRecord, getWhoisHistory, clearWhoisCache
affects: [09-03, 09-04, 09-05]
tech-stack:
  added: []
  patterns: [injectable fetch, createCachedStore per endpoint, fixed base URL plus URLSearchParams]
key-files:
  created:
    - src/lib/whois.ts
    - src/lib/whois.test.ts
key-decisions:
  - "Three cached stores (record, preview, compact history) keyed by domain only"
  - "History getter loads preview via previewStore so over-cap retries cost zero upstream calls"
  - "History records are mapped through a 5-field whitelist; raw text and contacts never leave the lib"
requirements-completed: []
duration: 15min
completed: 2026-10-23
---

# Phase 9 Plan 02: WhoisXML client Summary

Server-only WhoisXML client: current WHOIS record mapped to a compact `WhoisRecord`, and a credit-aware history flow (preview, refuse above 100 records, otherwise purchase and compact), with 24h cached stores and in-flight dedup.

## Tasks

| Task | Commit | Files |
| ---- | ------ | ----- |
| 1. Request helper, error mapping, current record | 325a9e0 | src/lib/whois.ts, src/lib/whois.test.ts |
| 2. History preview/purchase, compaction, cached getters | 40d24ca | src/lib/whois.ts, src/lib/whois.test.ts |

## Verification

- `npx vitest run`: 18 files, 191 tests passed (no network, fake key `test-key-123`)
- `npx tsc --noEmit`: clean
- `npm run lint`: clean
- Only two URL literals in whois.ts (the base constants); no `console.`

## Deviations from Plan

None. VET-02 / VET-06 intentionally not marked complete until plan 09-05.

## Known Stubs

None.

## Self-Check: PASSED
