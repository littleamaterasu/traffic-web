# Phase 02: Review Resolution

Resolves findings from `02-REVIEW.md`.

## Resolved

| Finding | Resolution | Commit |
|---------|-----------|--------|
| WR-02 | `capString` removes bidi/zero-width characters (U+200B-200F, U+202A-202E, U+2060-2064, U+2066-2069, U+FEFF), replaces control characters (U+0000-001F, U+007F-009F) with a space, collapses whitespace, and truncates by code points (no split surrogate pairs). Tests: bidi, zero-width, control chars, emoji at the cap boundary. | db60db5 |
| WR-04 | Normalizer keeps only the first backlink per `from_domain` (case-insensitive) before applying the 20-item cap; list key is now `from_url` + index. Tests for duplicates and cap ordering. | db60db5 |
| WR-03 | Anchor chip and target link use `min-w-0 max-w-full break-all` (+ `[overflow-wrap:anywhere]`); title paragraph uses `[overflow-wrap:anywhere]`. Test asserts the class names. | c264cb9 |
| WR-05 | Panel validates `fetched_at`, `overview` shape (null or numeric/null fields), `backlinks` array and each item before rendering; otherwise shows the fallback error. Malformed `error.message` also falls back. Tests with 8 malformed bodies. | c264cb9 |
| WR-06 | Toggle has `aria-expanded` and `aria-controls` (list id from `useId`); outer `aria-live` removed so `role="alert"` / `role="status"` are the only announcements. Tests for both. | c264cb9 |
| IN-01 | DR badge uses `formatNumber` (e.g. 83.5 renders `DR 83,5`). Test added. | c264cb9 |
| IN-05 (copy) | Info note and idle hint now state: results cached 24 hours, empty results only 10 minutes. Test updated. | c264cb9 |

## Accepted / not fixed

- **WR-01**: no throttle on the 5-credit endpoint. The cache is in-process, lost on restart (and on dev HMR) and FIFO-evicted beyond 100 entries, so cycling many domains can re-bill. Accepted for a local, invite-only tool.
- **IDN hosts shown as punycode** (IN-03): kept as an anti-homograph measure.
- **IPv6 initial**: `domainInitial` yields a digit for bracketed IPv6 hosts; cosmetic.
- **Loopback/private hosts accepted as links** (IN-03): only http/https and credential checks are applied.
- **`to_path` keeps the query string and hides the host** (IN-02).
- **Type looseness** (IN-04): `from_url` remains typed nullable and the `to_path ?? to_url` fallback stays as defence in depth.
- **Mid-stream read failure** reported as `invalid_response` instead of `network_error` (IN-05).
- **Remaining test gaps** (IN-06): client 45 s timeout via fake timers, stale response arriving after a domain change, concurrent dedup of empty results.
