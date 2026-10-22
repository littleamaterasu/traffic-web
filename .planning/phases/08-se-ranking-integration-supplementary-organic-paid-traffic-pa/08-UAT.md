---
status: testing
phase: 08-se-ranking-integration-supplementary-organic-paid-traffic-pa
source: [08-VERIFICATION.md]
started: 2026-10-22T13:35:00Z
updated: 2026-10-22T13:35:00Z
---

## Current Test

number: 1
name: Visual adequacy of the four SE Ranking panels in the running dashboard
expected: |
  Run `npm run dev`, search a domain with data, inspect the SE Ranking section below the TabAPI report — brutalist styling consistency, responsive competitors-table stacking on a phone-width viewport, and the "i" info dialogs for all four panels. Section reads as part of the existing report; tables stack on mobile via td[data-label]; info dialogs open with the SE Ranking / TabAPI-difference explanations.
awaiting: user response

## Tests

### 1. Visual adequacy of the SE Ranking section
expected: Run `npm run dev`, search a domain with data, inspect the SE Ranking section below the TabAPI report — brutalist styling consistency, responsive competitors-table stacking on a phone-width viewport, "i" info dialogs for all four panels open with the SE Ranking / TabAPI-difference explanations.
result: [pending]

### 2. Live end-to-end with a real SE_RANKING_API_KEY
expected: Put a real key in `.env.local`, search a domain known to have SE Ranking data: overview/keyword/competitor figures appear alongside TabAPI figures, clearly labeled "SE Ranking · toàn cầu". Click "Tải backlink" → backlinks summary renders (burns ~100 SE Ranking credits). With the key removed, the section shows "Chưa cấu hình SE_RANKING_API_KEY trên máy chủ." while the TabAPI report still renders.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
