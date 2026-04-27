# platform-v7 State of Product

**Updated:** 2026-04-27  
**Branch:** `main`  
**Production URL:** `https://pachanin-web.vercel.app/platform-v7/`  
**Current production commit after safe passes:** `5dc3565` (add operator audit quick link)  
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
| Live logistics / GPS | not claimed |
| Live scoring / credit | not claimed |

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
| #210 | Sandbox-only FGIS and logistics domain layer clean-transfer |
| #211 | Market/RFQ command palette entry |
| #212 | Market/RFQ sandbox page (`/platform-v7/market-rfq`) |
| #213 | Deal workspace tabs component |
| #214 | Bank audit route (`/platform-v7/bank/release-safety`) |
| #215 | Seller quick link to Market/RFQ |
| #216 | Bank quick link |
| #217 | Buyer financing page |
| #218 | Seller FGIS-parties page |
| #219 | Logistics page enhancement |
| #223 | Bank release-safety page |
| #224 | Release safety command entry |
| #225 | Add release safety command entry (production: `6a62e87`) |
| #226 | Operator cabinet audit quick link (production: `5dc3565`) |

> PRs #220, #221, #222 — closed without merge. **Do not count.**  
> PR #209 — old Claude mega-PR. Not merged as a whole. Domain code transferred incrementally.

**Absolute task progress after #226: 21/150 = 14.00% done / 86.00% remaining.**

---

## 3. Confirmed navigation landmarks (on main)

| Route | Status |
|---|---|
| `/platform-v7/market-rfq` | exists · sandbox · pre-deal intake |
| `/platform-v7/bank/release-safety` | exists · read-only audit |
| `/platform-v7/bank` | exists · bank circuit |
| `/platform-v7/seller` | exists · seller cabinet with Market/RFQ quick link |
| `/platform-v7/operator` | exists · operator cabinet with release-safety quick link |
| `/platform-v7/buyer` | exists · buyer cabinet (Market/RFQ quick link pending PR merge) |
| `/platform-v7/roles` | exists · roles hub (Market/RFQ entry pending PR merge) |
| `/platform-v7/control-tower` | exists · operator dashboard (release-safety link pending PR merge) |

Command palette entries confirmed: `sec-market-rfq`, `sec-release-safety`.

---

## 4. PRs open for review (not yet merged, not counted)

| Branch | Task | GitHub PR |
|---|---|---|
| `codex-safe/buyer-market-link` | Buyer cabinet quick link to Market/RFQ | #227 |
| `codex-safe/roles-market-entry` | Roles page Market/RFQ entry card | #228 |
| `codex-safe/control-release-safety-link` | Control Tower release-safety signal | #233 |
| `codex-safe/market-rfq-contract-test` | Route contract test for Market/RFQ | #234 |
| `codex-safe/release-safety-contract-test` | Route contract test for release-safety | #235 |
| `codex-safe/ui-primitives-runtime` | Shared UI primitives (used in release-safety) | #236 |

Progress counter advances only after each PR is merged and deployed to production.

---

## 5. Claude Code PR handling

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

- Seller FGIS-first UI (full)
- Buyer financing UI (full)
- Logistics orchestrator UI
- Bank Hub panels
- Deal Workspace tabs
- Market/RFQ UI (full)

---

## 6. Protected zones

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

## 7. Current architecture backbone

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

## 8. Remaining safe order

1. Buyer quick link (pending PR #227 merge).
2. Roles Market/RFQ entry (pending PR #228 merge).
3. Control Tower release-safety link (pending PR #233 merge).
4. Route contract tests (pending PRs #234, #235 merge).
5. UI primitives runtime (pending PR #236 merge).
6. Seller FGIS-first UI, adapted to sandbox labels.
7. Buyer financing UI, buyer-only and sandbox-labelled.
8. Logistics orchestrator UI, deal-linked and guarded.
9. Bank Hub panels, no live-bank claims.
10. Deal Workspace tabs, wired to guarded actions.
11. Market/RFQ UI, pre-deal status, no automatic deal creation.
12. Field execution foundation.
13. Dispute decision engine.
14. Security and anti-fraud layer.
15. Investor / AI / reputation layer.
16. World-class final gate.

---

## 9. Honesty labels

| Label | Meaning |
|---|---|
| `sandbox` | Simulated/demo data; no real external system connected |
| `manual` | Human process; no automation claim |
| `controlled-pilot` | Limited pilot-ready flow with operator supervision |
| `live` | Real external system connected and verified |

Current rule: if live access is not proven, label the module `sandbox` or `controlled-pilot`, never `live`.
