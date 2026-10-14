---
phase: "01"
slug: "groundwork-reusable-primitives-cache-factory"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-10-14"
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client bundle ← panel.tsx | Extracted presentational primitives render in the browser; any secret or raw-HTML vector introduced here reaches the client | Vietnamese report content strings (props) — no secrets, no upstream data |
| Node runtime ← cached-store instances | Server-side cache state; keys are built from already-normalized server-side values — nothing faces the browser directly | Cached `TrafficResponse` payloads keyed by `{normalized domain}:{months}` |
| upstream TabAPI ← tabapi.ts | Raw HTTP client, unchanged by this phase; `TABAPI_KEY` crosses here server-side only, passed as a parameter | `Authorization: Bearer ${apiKey}` header; estimated traffic JSON back |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Information Disclosure | src/components/panel.tsx | low | mitigate | Presentational-only primitives — no `process.env`, no `fetch(` (grep-verified 2026-10-14); frozen route test secret-absence assertion guards regression (route.test.ts:58) | closed |
| T-01-02 | Tampering (XSS) | extracted components | low | mitigate | Verbatim move; React default escaping preserved; no `dangerouslySetInnerHTML`/`innerHTML`/`srcdoc`/`eval` anywhere in src/ (grep-verified 2026-10-14) | closed |
| T-01-03 | Tampering (cache poisoning) | createCachedStore instances | medium | mitigate | Stateless factory — both Maps live per-call closures (no module-level state, grep-verified); per-resource isolation pinned by `cached-store.test.ts` "hai store độc lập" case; Phase 2+ adds prefixed keys | closed |
| T-01-04 | Information Disclosure | TABAPI_KEY | low | mitigate | Key handling untouched — read only server-side in route.ts:23, passed as parameter into tabapi.ts; secret-absence assertion `expect(body).not.toContain(secret)` (route.test.ts:58); cache keys contain only domain + months | closed |
| T-01-05 | Denial of Service (unbounded state) | store eviction | low | mitigate | Bounded prune-before-insert with FIFO eviction at exactly `maxEntries` (cached-store.ts `prune()` runs before `entries.set`); pinned by `cached-store.test.ts` FIFO-cap case | closed |
| T-01-SC | Tampering | npm installs | low | accept | Zero package installs this phase — `git diff 22ed104..HEAD -- package.json package-lock.json` empty (RESEARCH Package Legitimacy Audit: none) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-01 | T-01-SC | Zero package installs this phase — nothing to gate | Phase planning (01-01-PLAN, 01-02-PLAN threat models) | 2026-10-13 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-14 | 6 | 6 | 0 | gsd-security-auditor (orchestrator L1 short-circuit: threats_open 0, register authored at plan time, ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-14
