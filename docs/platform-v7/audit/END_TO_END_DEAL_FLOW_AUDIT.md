# End-to-End Sandbox Deal Flow Audit (platform-v7)

Status: **controlled-pilot / pre-integration · docs-only audit · NO code change**.
Read-only trace of the full sandbox deal lifecycle — from deal creation through
loading, transit, quality, settlement, dispute/arbitration and close — across the
backend runtime core, the money path, documents, logistics, quality and disputes.
Every claim below is verified against source (`file:line`).

Honest framing (do not overstate):
- This traces the **sandbox / runtime** flow. The only active persistence is the
  **in-memory `RuntimeCore`**; DB-backed (Prisma) adapters exist but are disabled
  behind explicit flags. No live bank / ФГИС / ЭДО / ЭПД integration is wired.
- The money path is **bank-callback driven by design** — the platform never
  self-confirms a reserve or self-releases funds. In the sandbox there is no real
  bank: the "callback" is an internal endpoint, gated behind an env flag.
- Do not describe this as a live or settled money path. It is a *simulated*
  end-to-end flow whose contracts are shaped for real integration later.

---

## 1. The deal lifecycle (verified state machine)

Single source of deal-status legality:
`apps/api/src/modules/runtime-core/runtime-state-machine.ts:13` (`DEAL_TRANSITIONS`).
The happy path and its branches:

```
DRAFT → AWAITING_SIGN → SIGNED → PREPAYMENT_RESERVED → LOADING → IN_TRANSIT
      → ARRIVED → QUALITY_CHECK → ACCEPTED → FINAL_PAYMENT → SETTLED → CLOSED
```

Branches off the spine (all in the same map):
- **Cancellation**: `DRAFT|AWAITING_SIGN|SIGNED → CANCELLATION` (and from
  `ARBITRATION_DECISION`).
- **Dispute**: almost every executing state can go `→ DISPUTE_OPEN`
  (`SIGNED … FINAL_PAYMENT`).
- **Dispute resolution**: `DISPUTE_OPEN → EXPERTISE → ARBITRATION_DECISION →
  FINAL_PAYMENT | PARTIAL_SETTLEMENT | CANCELLATION`.
- **Partial settlement**: `ACCEPTED|PARTIAL_SETTLEMENT|DISPUTE_OPEN|EXPERTISE|
  ARBITRATION_DECISION → PARTIAL_SETTLEMENT → FINAL_PAYMENT`.

Shipment lifecycle is a second map
(`runtime-state-machine.ts:32`, `SHIPMENT_TRANSITIONS`):
`PENDING → IN_TRANSIT → AT_UNLOADING → DELIVERED → COMPLETED`, with
`IN_TRANSIT → ROUTE_DEVIATION_ALERT → IN_TRANSIT` and `CANCELLED` terminals.

Transition legality is enforced server-side: `RuntimeStateMachine.assertDealTransition`
(`:48`) throws `BadRequestException("Переход X → Y не разрешён")` on any illegal
edge. Illegal transitions cannot be forced through the API.

## 2. Entry + transition path (server-side, verified)

- **Create**: `POST /deals` → `DealsController.create`
  (`apps/api/src/modules/deals/deals.controller.ts:42`). `EXECUTIVE` is rejected
  (read-only, `:44`). Goes through `DealsService.create`
  (`deals.service.ts:49`) wrapped in `ActionExecutorService.execute` with action
  `deal.create` and an org-scoped `deal` object scope.
- **Transition**: `PATCH /deals/:id/transition` (+ a `/:id/status` compat alias,
  `:62`). `DealsService.transition` (`deals.service.ts:59`) computes **state
  gates** before allowing release-type targets: for `SETTLED` / `FINAL_PAYMENT`
  it requires `documentsComplete`, `!disputeOpen`, and `reserveConfirmed`
  (`:72-78`) — so money-releasing transitions are gated on documents + no dispute
  + a confirmed reserve, not merely on the state edge.
- **RBAC is server-side here**: `DealsController` is guarded by `RolesGuard` and a
  `@Roles('FARMER','BUYER','SUPPORT_MANAGER','EXECUTIVE','ADMIN','ACCOUNTING')`
  allow-list (`:11-12`), plus per-object `assertObjectScope` (owner/counterparty
  org) in the service (`deals.service.ts:20,31`). **Note the contrast with the
  web cabinets**, where the role-lock is client-only (see
  `ROLE_COCKPIT_AUDIT.md` §2) — the API layer does enforce roles + object scope;
  the *cabinet isolation* gap is a frontend concern.

## 3. Money path — bank-callback driven (verified)

This is the most sensitive leg; the design intent is honest and consistent:

- **Reserve**: `SettlementEngineService.requestReserve` creates an **outbox**
  entry for the bank; the payment stays `RESERVE_PENDING` until a bank callback
  arrives — *"Platform never self-confirms a reserve"*
  (`settlement-engine.service.ts:82-101`).
- **Release**: `requestRelease` likewise queues an outbox entry and returns
  *"Release request queued for bank. Awaiting bank callback."*; the payment stays
  `CALLBACK_PENDING` — *"Platform never self-releases money"* (`:110-150`).
- **Only confirm path is the bank callback**: `registerSafeDealsCallback`
  (`:190`) is the single route that confirms a reserve or release. The two legacy
  `confirmReserve` / `releasePayment` methods are `@deprecated` and restricted to
  accounting/admin override (`:158-176`).
- **Callback ingress**: `POST /bank-callbacks/safe-deals`
  (`bank-callbacks.controller.ts:11`) is `@Public({ envFlag:
  'ENABLE_PUBLIC_RUNTIME_MUTATIONS' })` — i.e. **off unless an env flag is set**.
  In the sandbox there is no real bank; this endpoint simulates the bank's
  callback.
- **Decision ladder**: `RuntimeMoneyEngine.decideDealRuntime`
  (`runtime-money-engine.ts:77`) is a pure, ordered ladder —
  `MISMATCH_HOLD → DISPUTE_HOLD → RELEASED (only if releasedRub>0 AND
  callbackState==='CONFIRMED') → READY_FOR_RELEASE → RESERVE_PENDING →
  HOLD_BLOCKERS → REQUIRES_BANK`. Release requires a **confirmed bank callback**;
  the engine itself mutates nothing (storage/id-gen stay in RuntimeCore by
  design, `:11-19`).
- **Settlement math**: `buildSettlementSnapshot`
  (`settlement-engine/settlement-calculation.ts:108`) computes base, logistics,
  idle/demurrage, quality delta, platform fee, dispute hold and reserve in
  **integer kopecks** then returns rouble fields (float-safe; PR-A/PR-B
  groundwork). **It is standalone — not yet wired into the live money path**
  (`:13`), and the live-arithmetic switch (PR-B) and the schema migration (PR-C)
  remain **owner-gated** (see `execution-queue.md` GATED, `MONEY_MINOR_UNITS_AUDIT.md`).

**Honest money verdict:** the money flow is a correctly-shaped, blocker-gated,
callback-driven *simulation*. The invariant "platform never moves money itself"
is real in code. There is no live bank, no nominal account, no real settlement.

## 4. Release gates — documents, quality, logistics, dispute (verified)

A deal cannot reach release while any blocker stands. Two pure engines own this:

- **Document completeness** (`runtime-completeness-checker.ts:14`): four required
  types — `contract`, `transport_waybill`, `quality_certificate`,
  `acceptance_act` — each "present" only when `SIGNED|GENERATED|UPLOADED`
  (`:22`). Missing → `bankRequiredMissing` / `releaseRequiredMissing` and a
  completion rate.
- **Blocker resolver** (`runtime-blocker-resolver.ts:63`) gates release on:
  no bank callback (`callbackState==='PENDING'`), missing documents, shipment not
  handed to receiving (`AT_UNLOADING|DELIVERED|COMPLETED`), no final quality
  protocol (`FINALIZED|ANALYZED`), open dispute, or a bank `MISMATCH`. It also
  derives **owner** (Контроль / Лаборатория / Логистика / Документы / Банк /
  Сделка, `:38`) and the **next action** (`:48`) — this is what drives the
  cockpit "who owns this / what's next" surfaces.

So the spine is genuinely cross-functional: documents (Документы), quality
(Лаборатория), logistics (Логистика) and bank (Банк) each contribute a real,
release-gating blocker computed from runtime state — not cosmetic badges.

## 5. The legs (modules) — all runtime-adapter-backed (verified)

Every domain follows the **same repository pattern**: a `*-repository.factory.ts`
selects the **runtime adapter by default**, with a Prisma adapter present but
**disabled behind flags** (`runtime-deal.repository.ts:8-12` — *"the only active
adapter in controlled-pilot / pre-integration mode"*):

| Leg | Module | Active adapter | Role in flow |
|---|---|---|---|
| Deal | `modules/deals` | `RuntimeDealRepository` | lifecycle, workspace, passport, timeline |
| Settlement | `modules/settlement-engine` | `RuntimePaymentRepository` | reserve/release via outbox + bank callback |
| Documents | `modules/documents` | `RuntimeDocumentRepository` | matrix, upload policy, completeness inputs |
| Logistics | `modules/logistics` | runtime | shipments, route deviations, handoff |
| Quality | `modules/labs` | `RuntimeLabRepository` | samples, tests, protocol finalization |
| Disputes | `modules/disputes` | `RuntimeDisputeRepository` | dispute open → expertise → decision |
| Evidence | `modules/evidence-pack` | service (no repo split) | evidence pack assembly for disputes |

The **outbox** (`common/outbox/outbox.service.ts`, used at
`settlement-engine.service.ts:30,103`) is the integration seam: reserve/release
emit outbox entries that a real bank adapter would later drain. Today the loop is
closed by the simulated `/bank-callbacks/safe-deals` endpoint.

## 6. End-to-end walkthrough (sandbox, what actually happens)

1. **Create** (`POST /deals`) → deal `DRAFT`, org-scoped, audited.
2. **Sign** → `AWAITING_SIGN → SIGNED` (transition gates: legal edge only).
3. **Reserve** → `requestReserve` emits outbox; payment `RESERVE_PENDING`;
   `→ PREPAYMENT_RESERVED` only confirmable by a (simulated) bank callback.
4. **Loading → transit → arrived**: shipment lifecycle drives
   `LOADING → IN_TRANSIT → ARRIVED`; route-deviation alerts feed idle/demurrage
   cost into the settlement snapshot.
5. **Quality check** (`QUALITY_CHECK`): lab samples/tests; protocol must reach
   `FINALIZED|ANALYZED` or the quality blocker stands; failed tests apply a money
   delta (`runtime-money-engine.ts:25`, `-125000`/failed test, and the per-ton
   discount path in settlement-calculation).
6. **Accepted**: documents must be complete (4 required types) — else the
   document blocker stands.
7. **Release** (`requestRelease`) → outbox; payment `CALLBACK_PENDING`; the deal
   reaches `FINAL_PAYMENT → SETTLED` only after a confirmed bank callback and with
   no open dispute / mismatch.
8. **Close**: `SETTLED → CLOSED`.
9. **Dispute fork** at any executing state → `DISPUTE_OPEN → EXPERTISE →
   ARBITRATION_DECISION`, with evidence assembled by `evidence-pack`, resolving to
   `FINAL_PAYMENT | PARTIAL_SETTLEMENT | CANCELLATION`.

## 7. Gaps / risks (honest)

1. **No live persistence**: in-memory RuntimeCore is the only active store —
   process restart loses state; Prisma adapters are flag-disabled, schema
   migration (PR-C) is owner-gated. (Scaling target, not a sandbox bug.)
2. **No real bank / settlement**: the money path is callback-shaped but the
   callback is a flag-gated internal endpoint; live arithmetic in kopecks (PR-B)
   is gated and the snapshot math is **not yet wired** into the live path.
3. **Web cabinet isolation is client-only** (`ROLE_COCKPIT_AUDIT.md` §2) — the
   *API* enforces roles + object scope, but the cabinet lock in the browser is
   not server-enforced. Server-side cabinet RBAC stays in roadmap.
4. **Idempotency / durable outbox** not yet introduced on the money path
   (explicitly noted as locked in `runtime-money-engine.ts:19`); duplicate
   callbacks are a real-integration concern to harden before going live.
5. **Quality/logistics cost inputs** rely on heuristic env defaults
   (`LOGISTICS_RATE_PER_SHIPMENT`, `QUALITY_DELTA_PER_TON_DEFAULT`, …) when deal
   data is absent — fine for sandbox, must be contract-driven for a real deal.

## 8. What is genuinely solid (do not undersell)

- A single, server-enforced **state machine** with legal-transition guards.
- A **release-gate** system where documents, quality, logistics and bank each
  contribute a real blocker, and money-releasing transitions are gated on all of
  them.
- A money path with a **real, honest invariant**: the platform never confirms or
  releases on its own — only a bank callback does.
- A **uniform repository seam** across all seven legs, so swapping the in-memory
  store for a DB/real adapter is a wiring change, not a rewrite.
- **Server-side RBAC + object scope** on the deal API (distinct from the web
  cabinet-lock gap).

## 9. Honesty gate

Do not claim: "live deal flow", "real settlement", "money is released",
"bank-connected", "production deal pipeline", "persistent". Allowed framing:
*controlled-pilot; a complete, server-enforced sandbox deal lifecycle; money path
is callback-shaped and blocker-gated but simulated (no live bank, no nominal
account); persistence is in-memory; DB and live integrations are planned and
gated, not done.*

This document changes no code. It is a verified trace of the sandbox deal flow.
