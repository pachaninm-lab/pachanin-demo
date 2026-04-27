# platform-v7 State of Product

**Updated:** 2026-04-27  
**Branch:** `main`  
**Production URL:** `https://pachanin-web.vercel.app/platform-v7/`  
**Current production commit after safe passes:** `959dd29d773b70985596d48432f69eb7e5c92069`  
**Scope:** controlled-pilot execution layer for off-exchange grain deal execution.

---

## 1. Current confirmed status

| Area | Status |
|---|---|
| Web production | READY |
| API production | success |
| OVDC API production | success |
| External integrations | sandbox unless separately proven |
| Live FGIS calls | not claimed |
| Live bank payments | not claimed |
| Live EDO / ETRN | not claimed |

---

## 2. Safe passes already merged

| PR | Result |
|---:|---|
| #202 | Release gate guards for irreversible money release |
| #203 | Release guard summary in deal side panel model |
| #204 | Guarded state in platform action buttons |
| #205 | Action target bridge to deal workspace actions |
| #206 | Guarded reason affordance in action button |
| #207 | UI props adapter for guarded action buttons |
| #208 | Reusable guarded action button wrapper |
| #210 | Sandbox-only FGIS and logistics domain layer clean-transfer from Claude Code |

Absolute task progress after #210: **8/150 = 5.33% done / 94.67% remaining**.

---

## 3. Claude Code PR handling

Claude Code PR #209 is not merged as a whole. It is large and touches runtime UI zones that overlap with guarded money-release work.

Safe handling rule:

1. Transfer domain code first.
2. Keep all external integrations sandbox-labelled.
3. Move UI slices only after adaptation to `P7GuardedActionButton`, Gate Matrix, and release guards.
4. Do not merge UI that bypasses money/document/FGIS/evidence/compliance gates.

Transferred from Claude Code so far:

- `apps/web/lib/platform-v7/fgis-lot-passport.ts`
- `apps/web/lib/platform-v7/logistics-chain.ts`
- `apps/web/tests/unit/platformV7FgisDomain.test.ts`
- `apps/web/tests/unit/platformV7LogisticsDomain.test.ts`

Not transferred yet:

- Seller FGIS-first UI
- Buyer financing UI
- Logistics orchestrator UI
- Bank Hub panels
- Deal Workspace tabs
- Market/RFQ UI

---

## 4. Protected zones

| Zone | Rule |
|---|---|
| Money release | No direct release without full Gate Matrix |
| Deal Workspace | Extend only through compatible models/adapters |
| Bank Hub | No live-bank claims without live integration |
| FGIS / SDIZ | Sandbox until live connector and validation exist |
| Logistics | Sandbox until carrier/GPS/document integrations exist |
| Evidence | No immutable archive/hash claim without implementation |
| Persistence | No production DB substitution without migration plan |
| Routes | No route changes without redirect/deep-link checks |

---

## 5. Current architecture backbone

```
FGISParty
 -> LotPassport
 -> MarketLot / RFQ
 -> Offer
 -> Deal
    -> MoneyPlan / ReleaseGuard
    -> LogisticsOrder
       -> TransportPack
       -> RouteLeg
       -> DriverTask
       -> FieldEvent
       -> LogisticsIncident
    -> DocumentRegistry
    -> LabProtocol
    -> EvidencePack
    -> DisputeDecision
    -> AuditEvent
```

Every module must trace back to Deal or be explicitly marked as pre-deal intake.

---

## 6. Remaining safe order

1. Seller FGIS-first UI, adapted to sandbox labels and no live FGIS claims.
2. Buyer financing UI, buyer-only and sandbox-labelled.
3. Logistics orchestrator UI, deal-linked and guarded by transport status.
4. Bank Hub panels, with no live-bank claims and no bypass of release guards.
5. Deal Workspace tabs, wired to existing guarded actions.
6. Market/RFQ UI, with explicit pre-deal status and no automatic deal creation without gates.
7. Field execution foundation.
8. Dispute decision engine.
9. Security and anti-fraud layer.
10. Investor / AI / reputation layer.
11. World-class final gate.

---

## 7. Honesty labels

| Label | Meaning |
|---|---|
| `sandbox` | Simulated/demo data; no real external system connected |
| `manual` | Human process; no automation claim |
| `controlled-pilot` | Limited pilot-ready flow with operator supervision |
| `live` | Real external system connected and verified |

Current rule: if live access is not proven, label the module `sandbox` or `controlled-pilot`, never `live`.
