# Stage 4 — MoneyTree / Document Matrix: Implementation Plan for Codex

## 1. Current Baseline After Stage 3

**Stage 3 RBAC accepted.**
- Merge commit: `fba1015cc1e93033c5c7d25dc21f8223050cca69`
- Canonical role model: `apps/web/lib/platform-v7/role-canonical.ts` (`PlatformV7CanonicalRole`)
- `assertPermission()` / `auditDeniedAccess()` / `PlatformRbacError` live in `apps/web/lib/platform-v7/access-control.ts`
- `EXPLICIT_DENY_RULES` enforced before allow rules
- Route guards on driver / bank / executive layouts
- `security-rbac.ts` and `security-contracts.ts` unified with canonical type

**Constraints that carry forward unchanged:**
- `apps/landing` — NEVER touch
- `pnpm-lock.yaml` — NEVER touch
- Global CSS, deploy config — NEVER touch
- Stage 4 scope: `apps/web/lib/platform-v7`, `apps/web/tests/unit`, `apps/web/app/platform-v7`, `apps/web/components/platform-v7`
- Stage 4 does NOT include: live external API adapters, logistics module rewrites, API server changes

**Forbidden copy** (must not appear in any user-facing string in Stage 4 files):
- "демо", "demo", "sandbox", "simulation", "MVP", "прототип"
- "production-ready", "fully live", "fully integrated"
- "платформа гарантирует оплату", "платформа сама выпускает деньги"

---

## 2. Files to Inspect First

Read these files in full before writing any code. They contain the current state and must not be replaced wholesale — extend or fix in place.

| File | What to look for |
|---|---|
| `apps/web/lib/platform-v7/money-tree.ts` | `PlatformV7MoneyTree`, `platformV7ValidateMoneyTree`, `platformV7ReleaseGate` — missing `bankConfirmationExists` in gate input |
| `apps/web/lib/platform-v7/document-matrix.ts` | `PlatformV7DocumentRole` uses short aliases (`'bank'`, `'logistics'`, `'elevator'`, `'lab'`) — must unify with canonical after Stage 3 |
| `apps/web/lib/platform-v7/bank-basis.ts` | `p7BuildBankBasis`, `p7MarkBankBasisSent` — missing `p7ConfirmBankRelease` function that updates MoneyTree |
| `apps/web/lib/platform-v7/idempotency-key-helper.ts` | `buildPlatformV7IdempotencyKey`, `validatePlatformV7IdempotencyKey` — already exists, must be wired into money operations |
| `apps/web/lib/platform-v7/access-control.ts` | `assertPermission`, `auditDeniedAccess`, `PlatformRbacError` — must be called by all Stage 4 money and document write paths |
| `apps/web/lib/platform-v7/domain/money.ts` | `calculateMoneyTree`, `calculateMoneyStateFromEvents` — parallel money model for `CanonicalDeal`; Stage 4 must not break this but also must not conflate it with `PlatformV7MoneyTree` |
| `apps/web/lib/platform-v7/domain/release-guard.ts` | `evaluateReleaseGuard` — uses `CanonicalDeal`; Stage 4 `platformV7ReleaseGate` is the authoritative gate for `PlatformV7MoneyTree` |
| `apps/web/tests/unit/money-formula.test.ts` | Existing tests for DL-9106 money formula — must continue to pass |
| `apps/web/tests/unit/document-matrix-completeness.test.ts` | Existing completeness tests — must continue to pass |
| `apps/web/tests/unit/bank-no-fake-release.test.ts` | Existing fake-release copy guard — must continue to pass |
| `apps/web/lib/platform-v7/domain/canonical.ts` | `MATURITY_STATUSES`, `CANONICAL_DEAL_STATUSES` — do not add new statuses here unless required |
| `apps/web/lib/platform-v7/domain/types.ts` | `CanonicalDeal`, `MoneyState`, `DocumentRef` — read before touching document types |

---

## 3. MoneyTree Target Model

### Interface (current — `money-tree.ts`)

```typescript
export interface PlatformV7MoneyTree {
  readonly dealId: string;
  readonly currency: 'RUB';
  readonly reservedAmount: number;
  readonly readyToReleaseAmount: number;
  readonly heldAmount: number;
  readonly manualReviewAmount: number;
  readonly releasedAmount: number;
  readonly refundedAmount: number;
  readonly platformFee: number;
  readonly bankFee: number;
  readonly status: PlatformV7MoneyStatus;
}
```

All fields are present. **Do not add new fields** to `PlatformV7MoneyTree` in Stage 4 unless explicitly listed here.

### Invariant

```
reservedAmount =
  readyToReleaseAmount
  + heldAmount
  + manualReviewAmount
  + releasedAmount
  + refundedAmount
```

`platformFee` and `bankFee` are separate and are NOT part of the invariant sum. They are accrued on top of `reservedAmount`, not deducted from it.

### Validation gaps to fix in `platformV7ValidateMoneyTree`

Current implementation checks only the invariant sum. Stage 4 must also enforce:

1. **No negative amounts** — reject if any bucket is `< 0`
2. **No double-count** — `heldAmount + manualReviewAmount` must not exceed `reservedAmount`
3. **Released cannot exceed reserved** — `releasedAmount <= reservedAmount`
4. **Refunded cannot exceed reserved** — `refundedAmount <= reservedAmount`
5. **Released + refunded cannot exceed reserved** — `releasedAmount + refundedAmount <= reservedAmount`
6. **platformFee and bankFee cannot be negative**

Add these checks to `platformV7ValidateMoneyTree`. Return a specific `reason` string for each failed check. The function signature stays the same — `PlatformV7MoneyTreeValidation` already has `valid`, `reason`, `expectedReservedAmount`, `actualReservedAmount`.

---

## 4. Money Operations

### Operation type (already in `money-tree.ts`)

```typescript
export type PlatformV7MoneyOperationType =
  | 'reserve_requested'
  | 'reserve_confirmed'
  | 'reserve_failed'
  | 'hold_created'
  | 'hold_released'
  | 'release_requested'
  | 'release_confirmed'
  | 'release_failed'
  | 'refund_requested'
  | 'refund_confirmed'
  | 'manual_review_started'
  | 'manual_review_resolved'
  | 'reconciliation_failed';
```

All 13 types exist. Do not add new types in Stage 4.

### Per-operation specification

| Operation | Allowed actor roles | State change on MoneyTree | Audit payload | Idempotency key required | Blocker condition |
|---|---|---|---|---|---|
| `reserve_requested` | `buyer`, `operator` | `status → reserve_requested` | `actorId`, `dealId`, `amount`, `currency`, `correlationId` | yes — `boundaryId: 'reserve_request'` | amount ≤ 0; status ≠ `not_requested` |
| `reserve_confirmed` | `bank_officer` only | `status → reserved`; sets `reservedAmount` | `actorId`, `dealId`, `amount`, `bankReference`, `correlationId`, `auditId` | yes — `boundaryId: 'reserve_confirm'` | not preceded by `reserve_requested`; idempotency collision |
| `reserve_failed` | `bank_officer`, `operator` | `status → reserve_failed` | `actorId`, `dealId`, `reason`, `correlationId` | yes | not preceded by `reserve_requested` |
| `hold_created` | `bank_officer`, `operator` | increments `heldAmount`; decrements `readyToReleaseAmount` | `actorId`, `dealId`, `heldAmount`, `reason`, `correlationId`, `auditId` | yes — `boundaryId: 'hold_create'` | `heldAmount` would exceed `reservedAmount`; invariant would break |
| `hold_released` | `bank_officer`, `operator` | decrements `heldAmount`; increments `readyToReleaseAmount` | `actorId`, `dealId`, `releasedHoldAmount`, `correlationId`, `auditId` | yes | `heldAmount` already 0 |
| `release_requested` | `seller`, `buyer`, `operator` | `status → release_requested`; sets `readyToReleaseAmount` | `actorId`, `dealId`, `amount`, `basisDocumentIds`, `correlationId`, `auditId` | yes — `boundaryId: 'release_request'` | release gate blocked; `heldAmount > 0`; open dispute; bank basis not `sent_to_bank`; missing required documents |
| `release_confirmed` | `bank_officer` only | `status → released`; moves `readyToReleaseAmount → releasedAmount` | `actorId`, `dealId`, `amount`, `bankReference`, `correlationId`, `auditId` | yes — `boundaryId: 'release_confirm'` | not preceded by `release_requested`; no bank confirmation event; idempotency collision |
| `release_failed` | `bank_officer`, `operator` | `status → release_failed` | `actorId`, `dealId`, `reason`, `correlationId` | yes | not preceded by `release_requested` |
| `refund_requested` | `buyer`, `operator`, `arbitrator` | `status → refund_requested` | `actorId`, `dealId`, `amount`, `reason`, `correlationId`, `auditId` | yes — `boundaryId: 'refund_request'` | `releasedAmount + refundAmount` would exceed `reservedAmount`; `release_confirmed` already final |
| `refund_confirmed` | `bank_officer` only | moves `readyToReleaseAmount → refundedAmount` | `actorId`, `dealId`, `amount`, `bankReference`, `correlationId`, `auditId` | yes — `boundaryId: 'refund_confirm'` | not preceded by `refund_requested`; no bank confirmation event |
| `manual_review_started` | `bank_officer`, `operator` | `status → manual_review`; sets `manualReviewAmount` | `actorId`, `dealId`, `amount`, `reason`, `correlationId` | yes | invariant would break |
| `manual_review_resolved` | `bank_officer`, `operator` | clears `manualReviewAmount`; routes to `readyToReleaseAmount` or `refundedAmount` | `actorId`, `dealId`, `resolution`, `correlationId`, `auditId` | yes | not preceded by `manual_review_started` |
| `reconciliation_failed` | `bank_officer`, `operator` | `status → reconciliation_failed` | `actorId`, `dealId`, `discrepancy`, `expectedAmount`, `actualAmount`, `correlationId` | yes | — |

**Key invariant for all write operations:** After every state change, call `platformV7ValidateMoneyTree` and reject the operation if the result is `valid: false`. The caller must never proceed with a broken invariant.

---

## 5. Release Gate

### Current state (`money-tree.ts`)

`platformV7ReleaseGate` accepts `PlatformV7ReleaseGateInput` and checks:
- `dealStatus === 'release_basis_ready'`
- `moneyStatus === 'reserved'`
- `requiredDocumentsConfirmed === true`
- `tripStatus === 'completed'`
- `acceptanceStatus === 'confirmed'`
- `disputeStatus === 'none' | 'resolved'`
- `bankReviewStatus !== 'blocked'`

**Missing check — Stage 4 must add:**

```typescript
export interface PlatformV7ReleaseGateInput {
  // ... existing fields ...
  readonly bankConfirmationExists: boolean; // NEW — must be true for release_confirmed
}
```

The gate must return `blocked` if `bankConfirmationExists === false` when the operation is `release_confirmed`. Add a new blocker reason: `'Bank confirmation event required for release.'`

`release_requested` does NOT require `bankConfirmationExists`. Only `release_confirmed` does. The gate is called twice with different checks depending on whether the operation is a request or a confirmation. Document this distinction clearly in the function's JSDoc-free inline logic.

### Complete release gate sequence (informational — for Codex's mental model)

```
1. All deal conditions met → platformV7ReleaseGate({ ..., bankConfirmationExists: false }) → allowed
2. release_requested fired → bank_basis sent to bank
3. Bank sends confirmation event (external, via webhook/callback)
4. platform receives bank_confirmed → p7ConfirmBankRelease() called
5. release_confirmed operation fires → platformV7ReleaseGate({ ..., bankConfirmationExists: true }) → allowed
6. MoneyTree: readyToReleaseAmount → releasedAmount
```

Platform never skips step 3–4. If there is no bank confirmation event, `release_confirmed` is blocked at step 5.

---

## 6. Document Matrix Target Model

### Current state (`document-matrix.ts`)

`PlatformV7DocumentRequirement` exists with: `documentId`, `title`, `responsibleRole`, `status`, `blockStages`, `affectsMoney`, `source`, `nextAction`.

**Missing fields — Stage 4 must add to the interface:**

```typescript
export interface PlatformV7DocumentRequirement {
  readonly documentId: string;
  readonly dealId: string;         // NEW — scope to deal
  readonly type: string;           // NEW — document type key (matches documentId for standard docs)
  readonly status: PlatformV7DocumentStatus;
  readonly ownerRole: PlatformV7CanonicalRole;  // NEW — canonical role (replaces PlatformV7DocumentRole)
  readonly source: 'manual' | 'edo' | 'fgis' | 'epd' | 'bank' | 'lab' | 'elevator' | 'arbitration';
  readonly deadline: string | null; // NEW — ISO 8601 or null
  readonly signatureStatus: 'not_required' | 'pending' | 'signed' | 'rejected'; // NEW
  readonly blockStages: readonly PlatformV7DocumentBlockStage[];
  readonly affectsMoney: boolean;
  readonly nextAction: string;
  // responsibleRole kept for backward compatibility — but must equal ownerRole
  readonly responsibleRole: PlatformV7CanonicalRole; // TYPE change: was PlatformV7DocumentRole (short aliases)
}
```

### Fix `PlatformV7DocumentRole` — canonical alignment

Current `PlatformV7DocumentRole` in `document-matrix.ts`:
```typescript
// CURRENT (wrong — short aliases)
export type PlatformV7DocumentRole = 'seller' | 'buyer' | 'logistics' | 'driver' | 'elevator' | 'lab' | 'surveyor' | 'bank' | 'arbitrator' | 'operator';
```

Replace with re-export from canonical:
```typescript
// CORRECT
export type { PlatformV7CanonicalRole as PlatformV7DocumentRole } from './role-canonical';
```

Update all `PLATFORM_V7_STANDARD_DOCUMENTS` entries accordingly:
- `'logistics'` → `'logistics_manager'`
- `'elevator'` → `'elevator_operator'`
- `'lab'` → `'lab_specialist'`
- `'bank'` → `'bank_officer'`

`seller`, `buyer`, `driver`, `surveyor`, `arbitrator`, `operator` stay unchanged.

### Required documents (canonical list)

Verify `PLATFORM_V7_STANDARD_DOCUMENTS` contains all 9 entries below. If missing, add. If present with wrong `responsibleRole`, fix.

| documentId | title | responsibleRole | blockStages | affectsMoney | source |
|---|---|---|---|---|---|
| `contract` | Договор | `seller` | `deal_creation` | true | `edo` |
| `specification` | Спецификация | `seller` | `shipment` | true | `edo` |
| `sdiz` | СДИЗ | `seller` | `shipment`, `release` | true | `fgis` |
| `epd_transport_document` | ЭПД/ТН | `logistics_manager` | `acceptance`, `release` | true | `epd` |
| `acceptance_act` | Акт приёмки | `elevator_operator` | `release` | true | `elevator` |
| `lab_protocol` | Протокол лаборатории | `lab_specialist` | `release`, `dispute` | true | `lab` |
| `discrepancy_act` | Акт расхождений | `elevator_operator` | `release`, `dispute` | true | `elevator` |
| `arbitration_decision` | Решение арбитра | `arbitrator` | `release` | true | `arbitration` |
| `bank_basis` | Основание для банка | `operator` | `release` | true | `bank` |

### Document statuses

```typescript
export type PlatformV7DocumentStatus =
  | 'missing'
  | 'draft'
  | 'uploaded'
  | 'signed'
  | 'sent'
  | 'confirmed'
  | 'rejected'
  | 'expired'
  | 'manual_review'
  | 'conditional';
```

All 10 statuses exist. Do not add new statuses.

**Status semantics for release gate:**
- `confirmed`, `signed` → passes release gate for this document
- `conditional` → passes release gate ONLY if the specific document's rule allows conditional (e.g., `discrepancy_act` and `arbitration_decision`)
- All other statuses → blocks release

`conditional` documents that block release:
- `discrepancy_act` blocks release if condition is `disputed_and_unresolved`
- `arbitration_decision` blocks release if condition is `dispute_open`

This logic lives in `platformV7DocumentMatrixReadiness`. The current implementation treats `conditional` as passing. **Stage 4 must introduce a `conditionalRule` field** or pass a `dealContext` to correctly evaluate conditionals for these two documents.

### Block stages

```typescript
export type PlatformV7DocumentBlockStage =
  | 'deal_creation'
  | 'shipment'
  | 'acceptance'
  | 'release'
  | 'dispute'
  | 'none';
```

All 6 exist. No changes needed.

---

## 7. Bank Basis Rules

### Current state (`bank-basis.ts`)

`p7BuildBankBasis` — evaluates whether basis is ready to send to bank.
`p7MarkBankBasisSent` — marks `sent_to_bank`, sets `canSendToBank: false`.

**Missing function — Stage 4 must add:**

```typescript
export function p7ConfirmBankRelease(
  decision: P7BankBasisDecision,
  confirmation: { bankReference: string; confirmedAt: string; auditId: string; correlationId: string }
): P7BankBasisDecision
```

This function:
- Only accepts `decision` where `status === 'sent_to_bank'`
- Returns `{ ...decision, status: 'bank_confirmed' }` with confirmation fields merged
- Does NOT update MoneyTree directly — it returns the updated basis; the caller is responsible for firing `release_confirmed` on MoneyTree as a separate step
- If `status !== 'sent_to_bank'`, returns the decision unchanged with `status: 'manual_review'` and a blocker code `'CANNOT_CONFIRM_UNSENT_BASIS'`

### Bank basis invariants

1. `bank_basis` document in the matrix cannot be `confirmed` while `P7BankBasisDecision.status` is `blocked` or `draft`
2. `bank_basis` requires at minimum: `contract` (confirmed/signed), `sdiz` (confirmed/signed), `acceptance_act` (confirmed), `lab_protocol` (confirmed/signed) — all with `affectsMoney: true`
3. `sent_to_bank` is a one-way transition — `p7MarkBankBasisSent` sets `canSendToBank: false` and this cannot be reversed
4. `bank_confirmed` is the ONLY event that allows MoneyTree `release_confirmed` operation
5. An arbitration decision can be included in `basisDocumentIds` but the arbitrator role does not trigger money release — only `bank_officer` can fire `release_confirmed`
6. A dispute decision can inform a hold split (`platformV7SplitDisputedMoney`) but does not itself release money

---

## 8. RBAC Hooks From Stage 3

Every write operation in Stage 4 — money operations, document status changes, bank basis state changes — must call `assertPermission` from `access-control.ts` before mutating state.

### Import pattern

```typescript
import { assertPermission, auditDeniedAccess } from '@/lib/platform-v7/access-control';
import type { PlatformV7AccessRequest } from '@/lib/platform-v7/access-control';
```

### How to call

```typescript
// Before any money write:
const request: PlatformV7AccessRequest = {
  actor: { userId, organizationId, roles: [actorRole], activeRole: actorRole },
  resource: { resourceType: 'money', resourceId: dealId, scope: 'deal' },
  action: 'release', // or 'request', 'confirm', etc.
  correlationId,
};
assertPermission(request); // throws PlatformRbacError if denied
```

`assertPermission` throws `PlatformRbacError`. Catch it at the operation boundary, call `auditDeniedAccess`, and return a structured error — do not swallow.

### Critical actions and required roles per Stage 3 RBAC

| Operation | resource | action | Allowed roles |
|---|---|---|---|
| `reserve_requested` | `money` | `request` | `buyer`, `operator` |
| `reserve_confirmed` | `money` | `confirm` | `bank_officer` |
| `hold_created` | `money` | `hold` | `bank_officer`, `operator` |
| `release_requested` | `money` | `request` | `seller`, `buyer`, `operator` |
| `release_confirmed` | `money` | `CONFIRM_BANK_RELEASE` | `bank_officer` only |
| `refund_requested` | `money` | `request` | `buyer`, `operator`, `arbitrator` |
| `refund_confirmed` | `money` | `CONFIRM_BANK_REFUND` | `bank_officer` only |
| `document_uploaded` | `document` | `create` | role-specific (see Document Matrix) |
| `document_confirmed` | `document` | `confirm` | `operator`, `bank_officer` (for bank_basis) |
| `bank_basis_sent` | `bank` | `CONFIRM_BANK_RESERVE` | `operator` |

**Roles blocked from all money write operations by EXPLICIT_DENY_RULES (already in Stage 3):**
- `support_agent` — denied all `money` resources
- `arbitrator` — denied all `money` resources and all `BANK_CONFIRMATION_ACTIONS`
- `driver` — denied all `money` resources
- `lab_specialist` — denied all `money` resources
- `executive_viewer`, `investor` — read-only, denied write on money
- `seller`, `buyer` — denied `CONFIRM_BANK_RELEASE`, `CONFIRM_BANK_RESERVE`, `CONFIRM_BANK_REFUND`

Do not duplicate these rules in Stage 4 code. They are enforced by `assertPermission`. Stage 4 just needs to call it.

---

## 9. Tests Required

All tests go in `apps/web/tests/unit/`. Use `vitest`. Import from `@/lib/platform-v7/...` aliases.

### 9.1 MoneyTree tests (`platformV7MoneyTree.test.ts`)

```
✓ invariant passes when all buckets sum to reservedAmount
✓ invariant fails when buckets do not sum to reservedAmount
✓ rejects negative reservedAmount
✓ rejects negative readyToReleaseAmount
✓ rejects negative heldAmount
✓ rejects negative releasedAmount
✓ rejects negative refundedAmount
✓ rejects releasedAmount > reservedAmount
✓ rejects refundedAmount > reservedAmount
✓ rejects releasedAmount + refundedAmount > reservedAmount
✓ rejects heldAmount + manualReviewAmount > reservedAmount (double-count)
✓ platformV7SplitDisputedMoney: held + ready = reserved
✓ platformV7SplitDisputedMoney: disputed > reserved clamps to reservedAmount
```

### 9.2 Release gate tests (`platformV7ReleaseGate.test.ts`)

```
✓ blocked when dealStatus !== 'release_basis_ready'
✓ blocked when moneyStatus !== 'reserved'
✓ blocked when requiredDocumentsConfirmed === false
✓ blocked when tripStatus !== 'completed'
✓ blocked when acceptanceStatus !== 'confirmed'
✓ blocked when disputeStatus is 'open'
✓ blocked when bankReviewStatus === 'blocked'
✓ blocked when bankConfirmationExists === false (for release_confirmed path)
✓ allowed when all conditions met and bankConfirmationExists === true
✓ release_requested does NOT require bankConfirmationExists
```

### 9.3 Document Matrix tests (`platformV7DocumentMatrix.test.ts`)

```
✓ createDocumentMatrix generates all 9 standard documents for a dealId
✓ document ownerRole values use canonical names (no short aliases)
✓ missing doc blocks release (status: 'missing')
✓ draft doc blocks release (status: 'draft')
✓ uploaded doc blocks release (status: 'uploaded')
✓ sent doc blocks release (status: 'sent')
✓ rejected doc blocks release (status: 'rejected')
✓ expired doc blocks release (status: 'expired')
✓ confirmed doc passes release gate
✓ signed doc passes release gate
✓ conditional discrepancy_act blocks release when dispute is open
✓ conditional discrepancy_act passes release when dispute resolved
✓ conditional arbitration_decision blocks release when dispute is open
✓ conditional arbitration_decision passes release when dispute resolved
✓ affectsMoney: true creates a money blocker in readiness check
✓ moneyBlockingCount equals the correct count of blocking docs
✓ bank_basis readiness depends on: gate allowed + required docs confirmed
```

### 9.4 Bank basis tests (`platformV7BankBasis.test.ts`)

```
✓ p7BuildBankBasis: blocked when releaseGate not allowed
✓ p7BuildBankBasis: blocked when money documents incomplete
✓ p7BuildBankBasis: blocked when dispute not resolved
✓ p7BuildBankBasis: blocked when amount <= 0
✓ p7BuildBankBasis: blocked when correlationId or auditId missing
✓ p7BuildBankBasis: ready when all conditions met
✓ p7MarkBankBasisSent: status → 'sent_to_bank', canSendToBank → false
✓ p7MarkBankBasisSent: returns blocked if decision.canSendToBank was false
✓ p7ConfirmBankRelease: status → 'bank_confirmed' when input status is 'sent_to_bank'
✓ p7ConfirmBankRelease: returns manual_review with blocker when status !== 'sent_to_bank'
✓ p7ConfirmBankRelease: does not update MoneyTree (caller responsibility)
✓ sent_to_bank → bank_confirmed is one-way (cannot go back to sent_to_bank)
✓ bank note does not contain forbidden copy (production-ready, fully live, etc.)
```

### 9.5 RBAC integration tests (`platformV7MoneyRbac.test.ts`)

```
✓ seller can call release_requested (assertPermission does not throw)
✓ buyer can call release_requested
✓ operator can call release_requested
✓ bank_officer can call release_confirmed
✓ seller cannot call release_confirmed (assertPermission throws PlatformRbacError)
✓ buyer cannot call release_confirmed
✓ arbitrator cannot call refund_confirmed (throws PlatformRbacError)
✓ support_agent cannot call release_requested (throws PlatformRbacError)
✓ driver cannot call reserve_requested (throws PlatformRbacError)
✓ executive_viewer cannot call any money write (throws PlatformRbacError)
✓ auditDeniedAccess emits event with role/resource/action/reason when denied
```

### 9.6 Forbidden copy tests (`platformV7Stage4ForbiddenCopy.test.ts`)

These tests scan the `note` and `reason` strings produced by Stage 4 functions for forbidden copy.

```
✓ p7BuildBankBasis note does not contain 'production-ready'
✓ p7BuildBankBasis note does not contain 'fully live'
✓ p7BuildBankBasis note does not contain 'fully integrated'
✓ p7BuildBankBasis note does not contain 'платформа гарантирует оплату'
✓ p7BuildBankBasis note does not contain 'платформа сама выпускает деньги'
✓ platformV7ReleaseGate reason strings do not contain forbidden copy
✓ platformV7ValidateMoneyTree reason strings do not contain forbidden copy
```

### 9.7 Idempotency tests (`platformV7MoneyIdempotency.test.ts`)

```
✓ buildPlatformV7IdempotencyKey produces deterministic key for same inputs
✓ same operation with same key is detected as duplicate (caller rejects)
✓ different attemptId produces different key
✓ isPlatformV7MoneyIdempotencyKey returns true only when amount + currency are set
✓ validatePlatformV7IdempotencyKey rejects key with missing actor
✓ validatePlatformV7IdempotencyKey rejects key with missing entity
✓ validatePlatformV7IdempotencyKey rejects key with wrong part count
```

---

## 10. Implementation Order for Codex

Each PR is independent and reviewable on its own. Do not merge PRs out of order.

### PR 4.1 — MoneyTree invariant hardening

**Branch:** `feat/p7-money-tree-invariant`

Files to change:
- `apps/web/lib/platform-v7/money-tree.ts` — extend `platformV7ValidateMoneyTree` with 6 new checks; add `bankConfirmationExists` to `PlatformV7ReleaseGateInput`
- `apps/web/tests/unit/platformV7MoneyTree.test.ts` — new file, all MoneyTree + release gate tests

**Acceptance:** All MoneyTree and release gate tests green. Existing `money-formula.test.ts` still passes.

---

### PR 4.2 — Document Matrix canonical alignment + conditional logic

**Branch:** `feat/p7-document-matrix-canonical`

Files to change:
- `apps/web/lib/platform-v7/document-matrix.ts` — replace `PlatformV7DocumentRole` with canonical re-export; add `ownerRole`, `dealId`, `type`, `deadline`, `signatureStatus` to `PlatformV7DocumentRequirement`; update all `PLATFORM_V7_STANDARD_DOCUMENTS` entries to canonical role names; add conditional evaluation to `platformV7DocumentMatrixReadiness`
- `apps/web/tests/unit/platformV7DocumentMatrix.test.ts` — new file, all document matrix tests

**Acceptance:** Document matrix tests green. Existing `document-matrix-completeness.test.ts` still passes. No short aliases in document roles.

---

### PR 4.3 — Bank basis `p7ConfirmBankRelease`

**Branch:** `feat/p7-bank-basis-confirm`

Files to change:
- `apps/web/lib/platform-v7/bank-basis.ts` — add `p7ConfirmBankRelease` function
- `apps/web/tests/unit/platformV7BankBasis.test.ts` — new file, all bank basis tests

**Acceptance:** Bank basis tests green. Existing `bank-no-fake-release.test.ts` still passes.

---

### PR 4.4 — RBAC + idempotency wiring

**Branch:** `feat/p7-money-rbac-idempotency`

Files to change:
- `apps/web/tests/unit/platformV7MoneyRbac.test.ts` — new file, RBAC integration tests calling `assertPermission` per operation
- `apps/web/tests/unit/platformV7MoneyIdempotency.test.ts` — new file, idempotency tests
- `apps/web/tests/unit/platformV7Stage4ForbiddenCopy.test.ts` — new file, copy guard tests

**Note:** This PR adds tests only. If wiring `assertPermission` into library functions requires changes to `money-tree.ts` or `bank-basis.ts`, those changes go here (not in earlier PRs). Keep changes minimal.

**Acceptance:** All 4.4 tests green. All Stage 3 tests (`platformV7AccessControl.test.ts`) still pass.

---

### PR 4.5 — Stage 4 cleanup and acceptance

**Branch:** `feat/p7-stage4-cleanup`

Scope:
- Remove any dead code introduced during 4.1–4.4
- Ensure all existing tests continue to pass: `money-formula.test.ts`, `document-matrix-completeness.test.ts`, `bank-no-fake-release.test.ts`, `bank-compliance-115-pdn.test.ts`, `dispute-money-impact.test.ts`
- Final `pnpm typecheck && pnpm test && pnpm build` run
- Confirm `apps/landing` is untouched

---

## 11. Acceptance Criteria for Stage 4

Stage 4 is accepted ONLY when ALL of the following are true:

| # | Criterion | Verification |
|---|---|---|
| 1 | `platformV7ValidateMoneyTree` rejects any tree that violates the invariant or has negative/overcounted amounts | Unit tests 9.1 pass |
| 2 | `platformV7ReleaseGate` blocks `release_confirmed` when `bankConfirmationExists === false` | Unit tests 9.2 pass |
| 3 | Document matrix uses canonical role names (`bank_officer`, `logistics_manager`, `elevator_operator`, `lab_specialist`) — no short aliases | Grep: `role: '(bank|logistics|elevator|lab)'` returns empty in `document-matrix.ts` |
| 4 | `platformV7DocumentMatrixReadiness` correctly evaluates conditional documents based on dispute status | Unit tests 9.3 pass |
| 5 | `p7ConfirmBankRelease` exists and is the only path to `bank_confirmed` status | Unit tests 9.4 pass |
| 6 | `assertPermission` is called before every money write and throws `PlatformRbacError` on denial | Unit tests 9.5 pass |
| 7 | `buildPlatformV7IdempotencyKey` is used for all critical money operations | Unit tests 9.7 pass |
| 8 | No forbidden copy in any Stage 4 function output strings | Unit tests 9.6 pass |
| 9 | All pre-existing tests continue to pass | `pnpm test` exit 0 (excluding pre-existing failures unrelated to Stage 4) |
| 10 | `pnpm typecheck` passes — both `apps/web` and `apps/api` | `pnpm typecheck` exit 0 |
| 11 | `pnpm build` passes | `pnpm build` exit 0 |
| 12 | `apps/landing` diff is empty | `git diff main...HEAD -- apps/landing/` returns 0 lines |
| 13 | Stage 5 (State Machines) is NOT started | No commits touching `execution-state-machine.ts` or deal status transitions |
