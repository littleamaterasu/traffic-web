# Phase 2: Referring Sites (Backlinks Slice) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-14
**Phase:** 2-referring-sites-backlinks-slice
**Areas discussed:** Lookup trigger & credit discipline, API contract & probe safety, Panel placement, Table content & row cap, Empty state behavior

---

## Lookup trigger & credit discipline

| Option | Description | Selected |
|--------|-------------|----------|
| Automatic on search (24h cached) | Backlinks fetch fires with the main search; 5-credit call bounded by per-domain cache | ✓ |
| On-demand button ("Xem backlinks") | Explicit user action before any 5-credit spend | |

**User's choice:** [auto] Automatic on search (recommended default)
**Notes:** ROADMAP SC1/SC4 imply the table appears on lookup; the explicit-action gate is reserved for pricier Phase 7 page-scans.

---

## API contract & probe safety

| Option | Description | Selected |
|--------|-------------|----------|
| Sibling route + own contract | New `/api/referring-sites` route + types; `/api/traffic` frozen | ✓ |
| Extend `/api/traffic` | Add backlinks fields to the existing payload | |

**User's choice:** [auto] Sibling route (recommended default; also the standing milestone decision — carried forward, not re-asked)
**Notes:** D-03 hard-gates planning on a one-call live Backlinks probe before locking response shapes (STATE blocker); empty-first design if the probe is impossible.

---

## Cache instantiation

| Option | Description | Selected |
|--------|-------------|----------|
| Per-resource store instance | `createCachedStore<BacklinksResponse>()` with `backlinks:`-prefixed keys | ✓ |
| Share the traffic store | Reuse `trafficStore` with composite keys | |

**User's choice:** [auto] Per-resource store (recommended default; per-resource isolation is the T-01-03 cache-poisoning guard)
**Notes:** WR-04 (apiKey missing from traffic-store key) tracked separately — not a Phase 2 blocker.

---

## Panel placement

| Option | Description | Selected |
|--------|-------------|----------|
| After traffic sources | Groups acquisition-channel intelligence together | ✓ |
| After countries | Keeps geo data adjacent | |
| After keywords | Groups search-intelligence data | |

**User's choice:** [auto] After traffic sources (recommended default)
**Notes:** Phase 4 sets the canonical report order later; interim placement is cheap to change.

---

## Table content & row cap

| Option | Description | Selected |
|--------|-------------|----------|
| Top 10 domains, DR + count + anchor | Compact; only fields the API provides (pending probe) | ✓ |
| Top 20 domains, full field set | Denser table, more credits visible per view | |
| Top 5 domains, DR only | Minimal slice | |

**User's choice:** [auto] Top 10 domains, DR + count + anchor (recommended default)
**Notes:** Exact columns finalized after the D-03 live probe confirms which fields exist.

---

## Empty state behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Vietnamese empty state, report continues | `EmptyCell` + `PANEL_INFO`; failure isolated to this section | ✓ |
| Hide the panel entirely | Cleaner but hides the section's existence | |
| Show error state | Treats missing data as failure | |

**User's choice:** [auto] Vietnamese empty state, report continues (recommended default; REFS-04 mandates it)

---

## Honesty labeling

| Option | Description | Selected |
|--------|-------------|----------|
| Badge + "i" explainer | Visible "link-based" label plus `PANEL_INFO` dialog | ✓ |
| "i" explainer only | Less prominent labeling | |

**User's choice:** [auto] Badge + "i" explainer (recommended default; REFS-03 + milestone decision)

---

## the agent's Discretion

- Backlinks endpoint path/params and response-shape mapping (researcher + live probe)
- Internal module layout for the new client module(s)

## Deferred Ideas

None — discussion stayed within phase scope.
