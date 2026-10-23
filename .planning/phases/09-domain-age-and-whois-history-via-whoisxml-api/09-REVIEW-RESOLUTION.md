# Phase 9 Review Resolution

Review: 09-REVIEW.md. Fixes delivered by quick task 261023-fw6.

## Resolved

- H-1: `registrant_organization` removed from `WhoisRecord`, mapper and fixtures; only boolean `privacy_protected` reaches the browser (261023-fw6).
- H-2: process-wide budget of 10 history purchases per rolling 24h (`history_budget_exceeded`, HTTP 429 in the history slice), and `www.` stripped from cache keys and upstream calls so variants share one purchase (261023-fw6).
- M-2: purchase body is shape-validated; non-object, error body, or `recordsCount > 0` without `records` is a 502 `whois_error` and is never cached (261023-fw6).
- M-3: purchased records above `HISTORY_RECORD_CAP` throw `too_many_records` before compaction and nothing is cached (261023-fw6).
- M-5: `age_days` and `age_years` derive from the same source (`created_date` first, else estimate); a future `created_date` yields null for age and verdict (261023-fw6).
- L-1: privacy detection uses whole-phrase provider names; ordinary names containing "privacy" or "proxy" are public; provider-redacted `Registrant State/Province` and `Registrant Country` fragments, empty `Registrant Organization:` labels and asterisks are private (261023-fw6).
- L-4: history request in `WhoisPanel` is aborted on unmount and domain change, late responses never set state, and the `?TIMEOUT_MESSAGE` formatting slip is fixed (261023-fw6).

## Known limitations (accepted)

- M-1: a purchase charged upstream but failed or timed out client-side may be re-bought on retry; each retry still counts against the daily purchase budget.
- M-4: history records whose audit date cannot be parsed are silently dropped from counts and events.
- L-2: the Feb 29 anniversary age calculation is off by at most one day.
- L-3: client-visible error messages name `WHOIS_API_KEY`.
- Preview record counts are cached for the standard 24h TTL, so the preview count can lag the real purchase count.
