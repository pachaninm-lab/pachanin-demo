# RuntimeCore Decomposition Audit (platform-v7)

Status: **controlled-pilot / pre-integration** · **docs-only, no behavior
change**. This audit maps the internal responsibilities of
`apps/api/src/modules/runtime-core/runtime-core.service.ts` (1075 lines) and
proposes a safe, ordered decomposition into focused engines. It is the planning
artifact that gates the (currently locked) RuntimeCore-decomposition and
MoneyEngine phases — no code is moved here.

Honest framing (do not overstate):
- No `production-ready` / `fully live` / `fully integrated` claims.
- The platform does **not** itself release money or guarantee payment; release
  stays bank-callback driven.
- The DB-backed path is **not active**; this audit changes no runtime behavior.

> Companion: `API_RUNTIME_SOT_AUDIT.md` (the per-domain repository-boundary phase
> — complete for Deal, Payment reads, Document, Shipment, Lab, Dispute). The
> repositories already abstract **data access**. This document is about the
> **logic** still fused inside RuntimeCore behind those reads.

## 1. What RuntimeCore actually is today

A single `@Injectable()` holding **in-memory state** for the whole deal
lifecycle plus all the derived/cross-domain logic. State (lines 43–53, arrays
seeded inline):

| Store | Field | Counter |
|---|---|---|
| Deals | `deals[]` | `dealCounter` |
| Documents | `documents[]` | `docCounter` |
| Shipments | `shipments[]` (+ `checkpoints`) | `shipmentCounter`, `checkpointCounter` |
| Lab samples | `samples[]` (+ `tests`) | `sampleCounter`, `testCounter` |
| Payments | `payments[]` | `paymentCounter` |
| Money events | `moneyEvents[]` | `eventCounter` |
| Bank callbacks | `bankCallbacks[]` | `callbackCounter` |
| Beneficiaries | `beneficiaries[]` | — |
| Evidence | `evidence[]` | `evidenceCounter` |

The six repository adapters (Deal/Payment/Document/Shipment/Lab/Dispute) call the
public methods below; they do **not** see the private engines.

## 2. Public surface, grouped by domain (already behind repositories)

- **Deals** — `listDeals`, `getDeal`, `createDeal`, `transitionDeal`,
  `dealWorkspace`, `dealPassport`, `dealTimeline` (284–400).
- **Documents** — `listDocuments`, `getDocument`, `uploadDocument`,
  `signDocument`, `generateDealPackage` (402–477).
- **Shipments** — `listShipments`, `getShipment`, `shipmentWorkspace`,
  `createShipment`, `transitionShipment`, `recordCheckpoint`, `verifyPin`,
  `appendGpsHeartbeat` (479–575, 792–795).
- **Lab samples** — `listSamples`, `getSample`, `createSample`, `collectSample`,
  `recordTest`, `finalizeSample` (577–652).
- **Payments / money** — `worksheet`, `listPayments`, `paymentDetail`,
  `confirmWorksheet`, `releasePayment`, `adjustWorksheet`,
  `importBankStatement`, `registerSafeDealsCallback`, `bankWorkspace`,
  `reservePrepayment` (654–790).
- **Integration** — `integrationHealth` (797–808): every connector reports
  `SANDBOX_ONLY` / `LIVE_SIMULATED` / `MANUAL`. No live integration.

## 3. Internal engines (decomposition candidates)

These private members are the real targets. They are **cross-domain** and are
what makes RuntimeCore hard to split.

### 3.1 StateMachine (transition legality)
- `assertAllowedTransition(from, to)` (1001–1022): the deal status transition map
  (DRAFT→…→CLOSED plus DISPUTE_OPEN / EXPERTISE / ARBITRATION_DECISION /
  PARTIAL_SETTLEMENT branches).
- `getAvailableShipmentTransitions(status)` (1024–…): shipment transition map.
- Pure-ish: depends only on `from`/`to` strings → **lowest-risk extraction**.

### 3.2 BlockerResolver (derived gating)
- `resolveBlockers(dealId)` (850–864): aggregates callback/document/shipment/
  sample/dispute/mismatch blockers.
- `resolveOwner(dealId)` (823–835) and `resolveNextAction(dealId)` (836–849):
  derive the human owner + next action from the same cross-domain state.
- `resolveShipmentBlockers(id)` (1037–…): pin / checkpoints / handoff.
- Reads deal+payment+shipment+sample+completeness; **no writes**.

### 3.3 CompletenessChecker (document gating)
- `documentCompleteness(dealId)` (878–892) + `requiredDocTypes()` (894–896):
  required vs present doc types, completion rate. Pure over `documents[]`.

### 3.4 MoneyEngine (the sensitive core)
- State helpers: `ensurePayment` (922–946), `moneyImpact` (866–876),
  `pushMoneyEvent` (903–912), `calculateSampleMoneyDelta` (898–901).
- Public money ops: `reservePrepayment`, `confirmWorksheet`, `releasePayment`,
  `adjustWorksheet`, `registerSafeDealsCallback`, `importBankStatement`,
  `bankWorkspace`, `worksheet`, `listPayments`, `paymentDetail`.
- **Money invariants that MUST survive any split** (verified in code + the
  settlement money-flow spec):
  - `releasePayment` is **blocker-gated**: if `resolveBlockers(dealId)` is
    non-empty it sets `MANUAL_REVIEW` and does **not** release (692–709).
  - Release/refund to `RELEASED`/`REFUNDED` happens only via a bank callback
    (`registerSafeDealsCallback`, 751–763) — the platform never self-confirms.
  - `releasedRub` only becomes non-zero on an explicit release/callback path;
    the bank-cockpit `releasedRub === 0` invariant in pilot must hold.

### 3.5 TimelineBuilder / card decoration (presentation)
- `dealTimeline(id)` (390–400): synthetic timeline derived from current status
  (not event-sourced — honest "derived" data).
- `dealPassport(id)` (362–388) and `decorateDealCard(deal)` (810–822):
  read-only projections.

### 3.6 EvidenceLog (append-only, in-memory)
- `appendEvidence(event)` (914–920): simple append to `evidence[]`. Distinct
  from the DB-first hash-chain `EvidencePackService` (see SOT audit: Evidence is
  N/A for the repository-boundary pattern).

## 4. The coupling hub: `refreshDealRuntime` (948–999)

This is the single most important and most entangled method. On any state change
it **co-mutates payment status AND deal `owner`/`nextAction`** from a priority
ladder that mixes three engines:

1. sample quality delta → `payment.disputedAmountRub` / `undisputedAmountRub`;
2. `MISMATCH` → manual review (Bank owner);
3. `DISPUTE_OPEN` → `HOLD_ACTIVE` (Контроль owner);
4. released+confirmed → `RELEASED` (close deal);
5. reserve confirmed & no blockers → `READY_FOR_RELEASE`;
6. reserve requested, not confirmed → `RESERVE_PENDING`;
7. blockers present → `HOLD_ACTIVE` (owner/next-action via BlockerResolver);
8. else → `REQUIRES_BANK`.

It is called from `transitionDeal`, `dealWorkspace`, `confirmWorksheet`,
`adjustWorksheet`, `registerSafeDealsCallback`, and `refreshDealRuntime`'s own
document/shipment refresh callers. **Decomposition risk concentrates here**: it
is simultaneously a MoneyEngine state machine, a BlockerResolver consumer, and a
deal-runtime writer. Any split must keep this ladder's ordering and outputs
byte-identical, or money status / owner routing will drift.

## 5. Proposed decomposition order (each = 1 narrow PR, behavior-preserving)

Ordered low-risk → high-risk. Every step keeps RuntimeCore as the façade,
extracting an engine it delegates to (same pattern as the repository boundaries:
extract, delegate, prove unchanged via existing specs + a new engine spec). No
DB activation, no money behavior change.

1. **StateMachine** (§3.1) — ✅ **DONE**. `assertAllowedTransition` and
   `getAvailableShipmentTransitions` extracted verbatim into a stateless
   `RuntimeStateMachine` (`runtime-state-machine.ts`) with `DEAL_TRANSITIONS` /
   `SHIPMENT_TRANSITIONS` maps and a focused spec; RuntimeCore delegates via a
   single private instance. Maps and thrown messages unchanged; all existing
   apps/api specs stay green.
2. **CompletenessChecker** (§3.3) — ✅ **DONE**. Extracted into a stateless,
   source-agnostic `RuntimeCompletenessChecker` (`runtime-completeness-checker.ts`)
   that computes completeness from the documents passed in; RuntimeCore retains
   only the `documents[]` filter and delegates. Required types / present
   statuses / missing set / completion rate unchanged, with a focused spec.
   Designed to run over a DB-backed document source later without a rewrite.
3. **BlockerResolver** (§3.2) — read-only aggregator. Extract once StateMachine
   + CompletenessChecker exist (it consumes both). Snapshot-test owner /
   next-action / blockers across the seeded deals.
4. **TimelineBuilder** (§3.5) — read-only projections; low risk, deferrable.
5. **MoneyEngine** (§3.4) **including** `refreshDealRuntime` (§4) — **last and
   most careful**. Extract behind an interface, keep the priority ladder
   verbatim, and gate the PR on the **unchanged** settlement money-flow spec
   plus the `releasedRub === 0` pilot invariant. Idempotency / DB-backed money
   writes remain **out of scope** and locked.

## 6. Invariants the decomposition must not break

- Release stays **bank-callback driven**; `releasePayment` stays blocker-gated;
  no self-confirm / self-release.
- `refreshDealRuntime`'s ladder ordering and outputs (payment status, deal
  owner, next action) stay identical.
- All existing apps/api specs stay green unchanged; each extraction adds its own
  engine spec rather than rewriting behavior.
- No new live integration; `integrationHealth` stays SANDBOX/SIMULATED/MANUAL.
- No DB provider switch, no secrets, no lockfile changes.

## 7. Out of scope / still locked

`lockedUntilCurrentGreen` (unchanged): DB-backed activation, MoneyEngine
idempotency + persistence, minor-units (integer kopecks) migration, and any
live bank / FGIS / EDO / signature integration. Those need an explicit owner
decision and are larger than a single narrow PR. This audit does **not** start
them; it only sequences the in-memory engine extraction that can proceed safely
when the owner green-lights step 1.
