# platform-v7 State of Product

**Generated:** 2026-04-27
**Branch:** `claude/platform-v7-safe-codex-OFx2n`
**Production commit:** `ee310446fa8ca6d8c4c84d4ee0ae23d5d137c791`
**Scope:** Baseline snapshot for controlled-pilot execution layer.

---

## 1. Production status

| Context | Status |
|---|---|
| pachanin-canonical-web | ✅ success |
| pachanin-demo-api | ✅ success |
| pachanin-demo-api-ovdc | ✅ success |

Production URL: `https://pachanin-web.vercel.app/platform-v7/`

---

## 2. Open PRs (do not merge stacked directly)

| PR | Title | Branch | Base | Status |
|---|---|---|---|---|
| #208 | Codex-safe: add guarded action button wrapper | `codex-safe/guarded-action-button` | main | open, green CI |
| #169 | E1.6/E2: design foundation | `feat/e16-source-of-truth-design-foundation` | `feat/canonical-platform-task-v2` | draft, stacked — do not merge directly |
| #168 | E0/E1: canonical domain layer | `feat/canonical-platform-task-v2` | main | draft, stacked — do not merge directly |

**Rule:** #168/#169 must be clean-transferred via separate PRs from fresh main, not merged directly.

---

## 3. Protected zones (do not rewrite, only extend)

| Zone | Files | Rule |
|---|---|---|
| E7 Money Safety | `lib/platform-v7/money-safety*.ts`, `bank-*.ts` | Extend via new event types/adapters. Regression tests required. |
| E8 Persistence | `lib/platform-v7/persistence-*.ts` | No production DB substitution. Append-only queue only. |
| E9 Evidence | `lib/platform-v7/evidence-*.ts`, `dispute-evidence-pack.ts` | No live binary hashing/archive claims without implementation. |
| Domain types | `lib/platform-v7/domain/*` | Backward-compatible extensions only. |
| Routes | `app/platform-v7/**` | No path changes without redirect tests. |
| Stores | `stores/use*Store.ts` | No deletion without migration PR + regression tests. |

---

## 4. Existing modules — factual state

### Domain layer
| Module | File | Maturity |
|---|---|---|
| Canonical deal statuses (24) | `domain/canonical.ts` | controlled-pilot |
| Domain types (ParticipantRole, MoneyState, etc.) | `domain/types.ts` | controlled-pilot |
| Money event model | `money-safety.ts` | controlled-pilot |
| Bank ledger | `bank-ledger.ts` | controlled-pilot |
| Bank reconciliation | `bank-reconciliation.ts` | controlled-pilot |
| Bank manual review queue | `bank-manual-review.ts` | controlled-pilot |
| Bank webhooks | `bank-webhooks.ts` | sandbox |
| Bank release decision | `bank-release-decision.ts` | controlled-pilot |
| Evidence pack | `evidence-pack.ts` | controlled-pilot |
| Evidence ledger | `evidence-ledger.ts` | controlled-pilot |
| Evidence release guard | `evidence-release-guard.ts` | controlled-pilot |
| Persistence queue | `persistence-queue.ts` | controlled-pilot |
| Persistence snapshot | `persistence-snapshot.ts` | controlled-pilot |
| Deal workspace | `deal-workspace*.ts` | controlled-pilot |
| Action log | `action-log.ts` | controlled-pilot |
| Action button state | `action-button-state.ts` | controlled-pilot |
| Quality gates | `quality-*.ts` | controlled-pilot |
| Logistics gates | `logistics-*.ts` | controlled-pilot |
| Audit trail | `audit-trail.ts` | controlled-pilot |
| Onboarding/KYC | `onboarding-*.ts` | sandbox |
| Investor dashboard | `investor-*.ts` | sandbox |
| Design tokens | `design/tokens.ts` | controlled-pilot |

### UI components
| Component | File | Maturity |
|---|---|---|
| P7Page, P7Section, P7Toolbar | `components/platform-v7/P7Page.tsx` | controlled-pilot |
| P7ActionButton | `components/platform-v7/P7ActionButton.tsx` | controlled-pilot |
| P7ActionLog | `components/platform-v7/P7ActionLog.tsx` | controlled-pilot |
| P7Badge | `components/platform-v7/P7Badge.tsx` | controlled-pilot |
| P7Card, P7MetricCard, P7MetricLinkCard | `components/platform-v7/P7Card.tsx` | controlled-pilot |
| P7EvidenceProjectionPanel | `components/platform-v7/P7EvidenceProjectionPanel.tsx` | controlled-pilot |
| P7MoneySafetyAuditStrip | `components/platform-v7/P7MoneySafetyAuditStrip.tsx` | controlled-pilot |
| P7PersistenceQueueStatus | `components/platform-v7/P7PersistenceQueueStatus.tsx` | controlled-pilot |
| AppShellV3 | `components/v7r/AppShellV3.tsx` | controlled-pilot |
| CommandPalette | `components/v7r/CommandPalette.tsx` | controlled-pilot |
| BankRuntime | `components/v7r/BankRuntime.tsx` | sandbox |
| DealDetailRuntime | `components/v7r/DealDetailRuntime.tsx` | controlled-pilot |
| DisputeDetailRuntime | `components/v7r/DisputeDetailRuntime.tsx` | controlled-pilot |

### Routes — existing
| Route | Page | Maturity |
|---|---|---|
| `/platform-v7/` | Role selector hub | controlled-pilot |
| `/platform-v7/control-tower` | Operator overview | controlled-pilot |
| `/platform-v7/seller` | Seller overview (manual-first, FGIS gap) | controlled-pilot |
| `/platform-v7/buyer` | Buyer overview + deal list | controlled-pilot |
| `/platform-v7/bank` | Bank hub (basic) | sandbox |
| `/platform-v7/logistics` | Dispatch view (static data) | sandbox |
| `/platform-v7/driver` | Driver page | sandbox |
| `/platform-v7/elevator` | Elevator page | sandbox |
| `/platform-v7/lab` | Lab page | sandbox |
| `/platform-v7/surveyor` | Surveyor page | sandbox |
| `/platform-v7/arbitrator` | Arbitrator page | sandbox |
| `/platform-v7/compliance` | Compliance page | sandbox |
| `/platform-v7/investor` | Investor page | sandbox |
| `/platform-v7/deals` | Deal list | controlled-pilot |
| `/platform-v7/deals/[id]` | Deal workspace | controlled-pilot |
| `/platform-v7/lots` | Lot list | controlled-pilot |
| `/platform-v7/lots/create` | Manual lot creation (FGIS-first gap) | sandbox |
| `/platform-v7/disputes` | Dispute list | controlled-pilot |
| `/platform-v7/disputes/[id]` | Dispute detail | controlled-pilot |
| `/platform-v7/connectors` | Integration hub | sandbox |

---

## 5. Gaps — what is missing or incomplete

### Critical gaps (blocking world-class)

| Gap | Impact | Next PR |
|---|---|---|
| No FGISParty / LotPassport domain types | Lot creation is manual-first, not FGIS-first | fgis-lot-passport-foundation |
| No Logistics Chain types (LogisticsOrder, TransportPack, RouteLeg, DriverTask, FieldEvent) | No transport-gate data model | logistics-chain-orchestrator |
| Buyer `/financing` page missing | No credit widget entry point | buyer-financing-credit-widget |
| Bank Hub lacks beneficiaries / smart contracts | Bank OS incomplete | bank-os-clean |
| Deal workspace has no tabs | Money/Logistics/Documents/FGIS/Evidence/Dispute not separable | deal-workspace-tabs |
| Logistics page uses static hardcoded routes | No deal-linked live view | logistics-chain-ui |
| Seller page is manual-first | Should start from FGIS parties | seller-fgis-first |
| No E3 command lexicon improvements | Navigation fragile | shell-navigation-clean |
| No Driver PWA offline queue | Field execution incomplete | field-execution-foundation |
| No full Dispute Decision Engine | Dispute creates no money/reputation effect | dispute-decision-engine |
| No Investor metrics page | Investor/Demo incomplete | investor-ai-observability |
| Integration labels (sandbox/manual/live) not visible on all pages | Honesty gap | various |

### Non-critical gaps
- Compliance page is a shell
- Executive page is a shell
- AI panel is global enhancer only, no role agents
- No Reputation module
- No 1C/export
- No Sentry/Web Vitals monitoring

---

## 6. Test coverage summary

| Layer | Count | Status |
|---|---|---|
| Unit tests | 98 files | passing (CI green on main) |
| E2E tests | 4 files | passing |
| Component tests | ~10 files | passing |

Tests live in `apps/web/tests/unit/` and `apps/web/tests/e2e/`.

---

## 7. Safe next PR order

1. ✅ This document (state-of-product baseline)
2. fgis-lot-passport-foundation — FGISParty, LotPassport, MarketLot domain types + sandbox labels + tests
3. seller-fgis-first — Seller page FGIS parties section + `/seller/fgis-parties` page
4. buyer-financing-credit-widget — `/buyer/financing` page + credit widget (buyer-only)
5. logistics-chain-orchestrator — LogisticsOrder, TransportPack, RouteLeg, DriverTask, FieldEvent types + tests + improved logistics page
6. bank-os-clean — Bank Hub beneficiaries, smart contracts, manual review (sandbox labels)
7. deal-workspace-tabs — Deal Workspace tabbed layout: Money, Logistics, Documents, FGIS, Evidence, Dispute
8. cleanup-168-clean-transfer — Sверка #168, clean-transfer unmerged parts, close as superseded
9. cleanup-169-e2-design-transfer — Сверка #169, clean-transfer tokens/primitives

---

## 8. Honesty labels in use

| Label | Meaning |
|---|---|
| `sandbox` | Not connected to real external system. Demo/simulated data. |
| `manual` | Human process, no automation. |
| `controlled-pilot` | Running with real data in limited scope. Not full production. |
| `live` | Connected to real external system. Full production. |

**Current state:** Most integrations (FGIS, Sber, SberKorus, credit, AI) are `sandbox`.
No `live` bank payments, `live` FGIS queries, `live` EDO/ETRN or immutable archive are claimed.

---

## 9. Architectural backbone (must be preserved)

```
FGISParty
 -> LotPassport
 -> MarketLot / RFQ
 -> Offer / Auction / BuyNow
 -> Deal
    -> MoneyPlan
    -> LogisticsOrder
       -> TransportPack
       -> RouteLeg
       -> DriverTask
       -> FieldEvent
       -> LogisticsIncident
    -> DocumentRegistry
    -> FGIS / SDIZ
    -> EDO / ETRN
    -> LabProtocol
    -> EvidencePack
    -> DisputeDecision
    -> ReputationEvent
    -> AuditEvent
```

Every new module must be a child of Deal. Standalone modules that don't trace back to Deal are not allowed.

---

*This document must be updated after each major PR merge.*
