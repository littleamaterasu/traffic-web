---
phase: quick-261023-fs0
plan: 01
status: complete
completed: 2026-10-23
commits: [03de3ba, 052ec67, 63fffef]
---

# Quick 261023-fs0: WHOIS history noise and registrant exposure

Registrar compared case/punctuation-insensitively; history events are now registrar, name_servers and privacy (private/public state transitions between known states only). Registrant text and expiry are no longer in compact results; renewals are not counted. Panel maps privacy states to Vietnamese labels.

## Changes
- src/types/whois.ts, src/lib/whois-insights.ts (+tests): classifyPrivacyState, normalizeRegistrar, new compactHistory/summarizeVolatility, privacy_changes.
- src/components/whois-panel.tsx, fixtures, whois-panel/whois/route tests: privacy labels, PII sentinel assertions ("Acme Co", "sentinel@example.test").
- 09-CONTEXT.md decision note.

## Deviations
Live-pattern regression fixture uses its own data (privacy 3, total 4) rather than the plan's example numbers; behavior assertions otherwise as planned.

## Verification
vitest 225 passed, tsc clean, lint clean.
