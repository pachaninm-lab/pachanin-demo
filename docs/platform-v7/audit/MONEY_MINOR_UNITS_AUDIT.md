# Money → Minor Units (Kopecks) Migration Audit (platform-v7)

Status: **controlled-pilot / pre-integration · docs-only plan · NO migration
performed**. This document inventories every monetary field in the API / Prisma
/ runtime and lays out a safe path to move money arithmetic from rouble
`Float`/`number` values to **integer kopecks**, without changing behavior and
without migrating anything yet.

Honest framing (do not overstate):
- This is a **migration plan only**. The money runtime is **not
  production-grade**: it uses floating-point roubles, has no idempotency, no
  persistence, and does not enforce money invariants. Nothing here is live.
- No `production-ready` / `fully live` / `bank connected` claims. Release stays
  bank-callback driven and the platform never self-releases money.
- This change touches **documentation only** — no runtime code, no Prisma
  schema, no migration, no MoneyEngine / SettlementEngine edits, no UI, no
  DB-backed adapters, no live integrations.

---

## 1. Inventory — every money field using roubles / float

### 1.1 Prisma schema (`apps/api/prisma/schema.prisma`)
All monetary columns are `Float` today (IEEE-754 — unsafe for money at scale):

| Model | Field | Type | Line |
|---|---|---|---|
| `Deal` | `pricePerTon` | `Float?` | 21 |
| `Deal` | `totalRub` | `Float?` | 22 |
| `Deal` | `currency` | `String @default("RUB")` | 23 |
| `Payment` | `amountRub` | `Float?` | 119 |
| `Payment` | `holdAmountRub` | `Float?` | 122 |
| `LabSample` | `moneyDeltaRub` | `Float?` | 145 |
| `LabTest` | `priceDelta` | `Float?` | (lab tests) |
| `Dispute` | `claimAmountRub` | `Float?` | 199 |
| `DisputeMoneyHold` | `amountRub` | `Float` | 219 |

### 1.2 Runtime store (`apps/api/src/modules/runtime-core/runtime-core.service.ts`)
In-memory payment object (`ensurePayment`) and deal/sample seeds:

| Owner | Field | Notes |
|---|---|---|
| `payment` | `amountRub`, `reservedRub`, `releasedRub`, `disputedAmountRub`, `undisputedAmountRub` | float rubles, mutated in place |
| `payment.releaseJournal[]` | `amountRub` | append-only journal entries |
| `deal` (seed) | `totalRub`, `pricePerTon` | float rubles |
| `sample` (seed) | `moneyDeltaRub` (e.g. `-250000`) | quality delta |
| `moneyEvents[]` | `amountRub` (`pushMoneyEvent`) | event amounts |

### 1.3 MoneyEngine (`runtime-core/runtime-money-engine.ts`)
- `sampleMoneyDelta` → `failed * -125000` (rouble constant `FAILED_TEST_PENALTY_RUB`).
- `moneyImpact` → projects `amountRub` / `disputedAmountRub` / `undisputedAmountRub` / `qualityDeltaRub`.
- Decision ladder reads `releasedRub` (`> 0`) — a float comparison.

### 1.4 SettlementEngine math (`settlement-engine/settlement-calculation.ts`)
The densest float surface. `round2(x) = Math.round(x * 100) / 100` is applied
everywhere, and percentages are divided inline:
- `baseAmount = round2(price * volumeTons)` (89).
- `logisticsAmount`, `idleAmount`, `qualityDelta`, `platformFee` — all `round2`.
- `platformFee = (baseAmount * percent) / 100 + volumeTons * perTon + fixedRub`, clamped to min/max (81–84).
- `disputeHold = round2(baseAmount * (disputeHoldPercent / 100))` (100).
- `reservePlanned = round2(baseAmount * (reservePercent / 100))` (102).
- `netFundingTarget`, `fundingTarget = Math.max(0, …)`, `releaseCandidate = round2(fundingTarget - disputeHold)` (103–105).

### 1.5 Disputes money (`disputes/disputes.service.ts`)
- `moneyHold.amountRub`, `claimAmountRub`.
- `MoneyInstruction`: `amountRub`, `sellerShareRub`, `buyerRefundRub`.
- SPLIT: `sellerShare = Math.round(holdAmount * 0.5)`, `buyerRefund = holdAmount - sellerShare` (conserves total — a pattern to preserve).

### 1.6 DTO / API surface
- `disputes/dto/create-dispute.dto.ts` → `claimAmountRub`.
- `settlement-engine.service.ts` worksheet/bank rows expose `amountRub`,
  `holdAmountRub`, `undisputedAmountRub` (56–57, 97, 142, 224–238).

---

## 2. Risk map (rounding / double-release / over-release / partial / dispute hold)

| Risk | Where | Detail |
|---|---|---|
| **Float rounding drift** | `settlement-calculation.ts` (`round2`, all percentage divisions) | `Math.round(x*100)/100` accumulates IEEE-754 error; sums of many deals diverge at scale. |
| **Fractional kopecks from %** | `platformFee`, `disputeHold`, `reservePlanned` | `baseAmount * pct / 100` produces sub-kopeck values rounded inconsistently. |
| **Over-release / no available-balance check** | `runtime-core.releasePayment` | sets `releasedRub = amountRub` when no blockers; never checks `released <= amount - disputed - held`. |
| **Double release** | `runtime-core.releasePayment` + `registerSafeDealsCallback` | release is **not idempotent**; a second `releasePayment` (or a duplicate `release_confirmed` callback) can re-emit a release event / re-set `releasedRub`. |
| **Negative / unclamped adjust** | `runtime-core.adjustWorksheet` | `amountRub += delta` and `undisputedAmountRub += delta` with no floor — can drive amounts negative. |
| **Partial release** | not modelled as integers | `PARTIAL_RELEASE_ALLOWED` / `PARTIAL_RELEASED` statuses exist but no integer partial-amount accounting. |
| **Dispute hold invariant** | `disputes` + `runtime-core.refreshDealRuntime` | `disputedAmountRub` derived from `sample.moneyDeltaRub`; no global check that `disputed + held + released <= total`. |
| **Float equality** | MoneyEngine decision ladder (`releasedRub > 0`) | float `> 0` is fragile vs `-0` / tiny residue. |

---

## 3. Target fields (rubles → kopecks, integer)

Primary renames (as scoped):

| Current (Float/number rubles) | Target (Int kopecks) |
|---|---|
| `amountRub` | `amountKopecks` |
| `totalRub` | `totalKopecks` |
| `holdAmountRub` | `holdAmountKopecks` |
| `releasedRub` | `releasedKopecks` |
| `disputedAmountRub` | `disputedAmountKopecks` |
| `moneyDeltaRub` | `moneyDeltaKopecks` |

Additional money fields that must migrate for consistency (same rule):
`reservedRub → reservedKopecks`, `undisputedAmountRub → undisputedAmountKopecks`,
`claimAmountRub → claimAmountKopecks`, `pricePerTon → pricePerTonKopecks`,
`priceDelta → priceDeltaKopecks`, `sellerShareRub → sellerShareKopecks`,
`buyerRefundRub → buyerRefundKopecks`, and all SettlementEngine intermediates
(`baseAmount`, `logisticsAmount`, `idleAmount`, `qualityDelta`, `platformFee`,
`disputeHold`, `reservePlanned`, `fundingTarget`, `netFundingTarget`,
`releaseCandidate`). `currency` stays `"RUB"`.

Rule: **store and compute in integer kopecks; 1 RUB = 100 kopecks.** No float in
the money path after migration.

---

## 4. DTO / API mapping (UI shows rubles, backend stores kopecks)

Introduce one tiny pure helper module (no behavior change on its own):

```
toKopecks(rub: number): number   // Math.round(rub * 100), guards NaN/Infinity
fromKopecks(kopecks: number): number   // kopecks / 100, for display
formatRub(kopecks: number): string     // "1 234,56 ₽" presentation
splitKopecks(total, ratio): [a, b]     // conserving split: a = round(total*ratio), b = total - a
```

Mapping contract during transition:
- **Inbound DTOs** (e.g. `CreateDisputeDto.claimAmountRub`) keep accepting
  rubles from the client and convert once at the boundary: `claimAmountKopecks = toKopecks(dto.claimAmountRub)`.
- **Outbound response DTOs** expose **both** for backward-compat: the canonical
  `*Kopecks` integer plus a derived `*Rub = fromKopecks(*Kopecks)` so the UI
  needs no immediate change. The `*Rub` mirror is removed only after the UI
  reads kopecks/formatted values.
- The mapping lives in a response-mapper / serializer layer — **not** inside
  MoneyEngine (which computes pure integer kopecks).

This keeps the UI on rubles while the backend becomes integer-exact.

---

## 5. Tests required BEFORE the code migration

A guard test-suite must exist and be green before any field is renamed:

1. **no-float-money-fields** — a static guard (grep/lint or a unit test over the
   money types/schema) asserting money fields are integer kopecks, not `Float` /
   fractional `number`.
2. **no-negative-release** — `releasedKopecks >= 0` always.
3. **no-double-release** — releasing an already-`RELEASED` payment (or a
   duplicate `release_confirmed` callback) is idempotent: `releasedKopecks` and
   the release journal do not grow.
4. **release ≤ available** — `releasedKopecks <= amountKopecks - disputedKopecks - heldKopecks`.
5. **conservation invariant** — `disputedKopecks + heldKopecks + releasedKopecks <= totalKopecks`.
6. **rounding rules** — `toKopecks`/`fromKopecks` round-trip; half-up rounding is
   deterministic; `splitKopecks` conserves the total (`a + b === total`).

These tests are written against the **current** behavior first (documenting the
gaps as `xit`/expected-to-fail where the runtime is not yet compliant), then
flipped on as the migration lands.

---

## 6. Migration roadmap & status

**PR-A — `money` kopecks helper + invariants (behavior-neutral, no renames):**
✅ **DONE** (merged). `apps/api/src/common/money/money.ts` ships `toKopecks` /
`fromKopecks` / `formatRub` / `splitKopecks` / `isWholeKopecks` and
`assertMoneyInvariants`, with `money.spec.ts` covering §5.6 rounding rules and
the §5.2–§5.5 invariants. No schema change, no field rename, no MoneyEngine edit;
nothing in the runtime imports it yet — behavior-neutral foundation.

**PR-B (NOT STARTED — requires a separate, explicit owner approval) —
MoneyEngine / SettlementEngine internal arithmetic in kopecks:** compute in
integer kopecks internally while still exposing `*Rub` via the mapper; the
settlement money-flow spec stays green. Still **no** Prisma migration. This is
the first step that **changes live money arithmetic**, so it is gated — see §8.

**PR-C (separate, explicitly approved, with data migration) — schema Float→Int
kopecks columns + backfill.** The only step that touches Prisma; stays **locked**
until PR-A and PR-B are merged and green.

---

## 7. Honest status (checkpoint after PR-A)

This is a **migration plan plus a tested foundation, not a migration**. As of
this checkpoint:
- ✅ minor-units audit complete; ✅ common money helper merged; ✅ money invariant
  tests merged.
- **Platform behavior is unchanged** — the helper is not wired into any runtime
  path; MoneyEngine and SettlementEngine are **untouched**.
- Money is still floating-point roubles end-to-end in the runtime; rounding
  drift, over/double release and unclamped adjustments remain **possible** (§2).
- There is no idempotency, no persistence, and no enforced
  `disputed + held + released <= total` in the runtime.
- The runtime money flow is **not production-grade** and remains sandbox /
  pre-integration. DB-backed activation, MoneyEngine persistence/idempotency and
  the schema migration stay **locked** pending explicit owner approval, in the
  order PR-A (done) → PR-B → PR-C.

---

## 8. Decision gate — PR-B (internal money arithmetic) requires owner approval

**Stop point.** PR-A is the agreed end of the autonomous run. PR-B is the first
change that touches **live money arithmetic** inside MoneyEngine /
SettlementEngine and therefore must NOT begin without a separate, explicit owner
decision.

PR-B may only start once **all** of the following admission conditions hold:

1. **All current tests are green** on `main` (apps/api + web, settlement
   money-flow spec included).
2. **No change to the external `*Rub` contract** — API responses keep exposing
   roubles; kopecks stay internal behind the mapper.
3. **A rollback path exists** — the change is revertible in a single PR with no
   data/schema dependency (PR-B introduces no migration).
4. **Characterization tests of the current behavior are added first** — ✅
   **DONE**. `settlement-calculation.characterization.spec.ts` and
   `money-flow.characterization.spec.ts` pin the current float behavior (reserve
   amount, release allowed/blocked, dispute hold, partial-release shape, quality
   delta, repeated callback/release non-idempotency, `round2` rounding, and the
   external `*Rub` contract shape), including known weak spots. PR-B must change
   these deliberately, never incidentally.
5. **No schema migration** (Prisma untouched; that is PR-C).
6. **No DB-backed activation** (adapters stay disabled behind their flags).
7. **No live integrations** (bank / FGIS / EDO / signature remain sandbox).

Until an owner explicitly approves PR-B against this gate, the money runtime
stays exactly as it is today. This document is the record of that boundary.
