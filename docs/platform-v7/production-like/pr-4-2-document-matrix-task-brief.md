# PR 4.2 Task Brief — Document Matrix Blockers

## 1. Branch Name

```
feat/p7-document-matrix-blockers
```

**Base:** `fba1015cc1e93033c5c7d25dc21f8223050cca69`
(Stage 3 merge commit on `main` — do NOT base off `p7-rbac-core-foundation`)

---

## 2. Scope

Document Matrix only:

- Replace `PlatformV7DocumentRole` (short aliases) with canonical role type from `role-canonical.ts`
- Extend `PlatformV7DocumentRequirement` interface with missing fields
- Update `PLATFORM_V7_STANDARD_DOCUMENTS` to use canonical role names
- Rename `epd` documentId to `epd_transport_document` for precision
- Add context-aware conditional document logic (`discrepancy_act`, `arbitration_decision`)
- Harden `platformV7DocumentMatrixReadiness` — conditionals must not auto-pass release
- Add `normalizeDocumentOwnerRole` boundary helper
- Add or extend `isBankBasisReady` / `getMoneyBlockingDocuments` / `isDocumentReadyForStage`
- New test file covering all of the above

**Not in this PR:**
- MoneyTree invariant / release gate (`money-tree.ts`) → PR 4.1
- `p7ConfirmBankRelease` in `bank-basis.ts` → PR 4.3
- `assertPermission` RBAC wiring → PR 4.4
- External adapters, API endpoints, UI components, `apps/landing`, `pnpm-lock.yaml`

---

## 3. Files to Inspect First

Read these files in full before writing any code.

| File | What to look for |
|---|---|
| `apps/web/lib/platform-v7/document-matrix.ts` | Current `PlatformV7DocumentRole` union (line 3), `PlatformV7DocumentRequirement` interface (lines 5–14), `PLATFORM_V7_STANDARD_DOCUMENTS` entries (lines 29–39), `platformV7DocumentMatrixReadiness` (lines 45–59), `platformV7DocumentsBlockingStage` (lines 61–68) |
| `apps/web/lib/platform-v7/role-canonical.ts` | `PlatformV7CanonicalRole` type, `PLATFORM_V7_ROLE_ALIASES` map, `toPlatformV7CanonicalRole()` function |
| `apps/web/lib/platform-v7/bank-basis.ts` | How `PlatformV7DocumentRequirement` is consumed — `p7BuildBankBasis` filters by `affectsMoney` and `status` |
| `apps/web/lib/platform-v7/money-tree.ts` | `PlatformV7ReleaseGateDecision` shape — `platformV7DocumentMatrixReadiness` output feeds into this |
| `apps/web/tests/unit/platformV7DocumentMatrixFoundation.test.ts` | Existing tests — must keep passing |
| `apps/web/tests/unit/document-matrix-completeness.test.ts` | Tests `selectDealDocumentMatrix` from `deal-execution-source-of-truth` — must keep passing, unrelated to `document-matrix.ts` directly |
| `apps/web/tests/unit/platformV7BankBasis.test.ts` | Uses `PlatformV7DocumentRequirement` with short role aliases (`'seller'`, `'elevator'`, `'operator'`) — update fixtures after interface change |

---

## 4. Exact Risks Found in Current Code

### Risk 1 — `PlatformV7DocumentRole` uses short aliases (line 3, `document-matrix.ts`)

```typescript
// CURRENT — wrong after Stage 3 canonical alignment
export type PlatformV7DocumentRole =
  | 'seller' | 'buyer' | 'logistics' | 'driver' | 'elevator'
  | 'lab' | 'surveyor' | 'bank' | 'arbitrator' | 'operator';
```

`'logistics'`, `'elevator'`, `'lab'`, `'bank'` are short aliases, inconsistent with `PlatformV7CanonicalRole` established in Stage 3. Any code that compares document `responsibleRole` against a canonical role will silently fail to match.

### Risk 2 — `PLATFORM_V7_STANDARD_DOCUMENTS` stores short aliases (lines 33–38)

```typescript
{ documentId: 'epd', responsibleRole: 'logistics', ... },
{ documentId: 'acceptance_act', responsibleRole: 'elevator', ... },
{ documentId: 'lab_protocol', responsibleRole: 'lab', ... },
{ documentId: 'discrepancy_act', responsibleRole: 'elevator', ... },
{ documentId: 'bank_basis', responsibleRole: 'operator', ... }, // operator is fine
```

`'logistics'`, `'elevator'`, `'lab'` are stored as role values — any RBAC lookup against these will bypass canonical enforcement.

### Risk 3 — `conditional` status auto-passes release gate (line 66, `platformV7DocumentsBlockingStage`)

```typescript
&& document.status !== 'conditional'
```

`conditional` is excluded from blockers unconditionally. This means `discrepancy_act` (status `'conditional'` in `PLATFORM_V7_STANDARD_DOCUMENTS`) and `arbitration_decision` (same) are always treated as release-ready, regardless of whether a dispute is open, resolved, or absent. A deal with an active unresolved dispute would pass the document stage check.

### Risk 4 — `platformV7DocumentMatrixReadiness` has the same flaw (lines 46–50)

```typescript
const missingForRelease = releaseDocs.filter(
  (document) => document.status === 'missing'
    || document.status === 'draft'
    || document.status === 'uploaded'
    || document.status === 'sent'
);
```

`conditional` is not in the blocking list, so `discrepancy_act` and `arbitration_decision` always pass. A matrix where `discrepancy_act` has `status: 'conditional'` returns `releaseReady: true` even when the dispute is open.

### Risk 5 — `PlatformV7DocumentRequirement` is missing required fields

Current interface has: `documentId`, `title`, `responsibleRole`, `status`, `blockStages`, `affectsMoney`, `source`, `nextAction`.

Missing: `dealId`, `type`, `ownerRole` (canonical-typed), `deadline`, `signatureStatus`, `createdAt`, `updatedAt`.

`bank-basis.ts` imports `PlatformV7DocumentRequirement` — adding required fields will cause compile errors in the bank basis test fixtures. These must be fixed as part of this PR.

### Risk 6 — `epd` documentId is ambiguous

`documentId: 'epd'` matches neither the canonical name `'epd_transport_document'` used in the Stage 4 plan nor the title `'ЭПД/ТН'`. The existing test in `platformV7DocumentMatrixFoundation.test.ts` (line 17) asserts `'epd'` in the ID list. Rename to `'epd_transport_document'` and update that assertion.

---

## 5. Target Document Object

Extend `PlatformV7DocumentRequirement` to this interface. All new fields are required. No optional fields.

```typescript
import type { PlatformV7CanonicalRole } from './role-canonical';

export interface PlatformV7DocumentRequirement {
  readonly documentId: string;
  readonly dealId: string;                    // NEW — scope to specific deal
  readonly type: string;                      // NEW — document type key (equals documentId for standard docs)
  readonly title: string;
  readonly ownerRole: PlatformV7CanonicalRole; // NEW — canonical; replaces old short-alias responsibleRole
  readonly responsibleRole: PlatformV7CanonicalRole; // keep for compatibility, must equal ownerRole
  readonly status: PlatformV7DocumentStatus;
  readonly source: 'manual' | 'edo' | 'fgis' | 'epd' | 'bank' | 'lab' | 'elevator' | 'arbitration';
  readonly deadline: string | null;           // NEW — ISO 8601 or null
  readonly signatureStatus: 'not_required' | 'pending' | 'signed' | 'rejected'; // NEW
  readonly blockStages: readonly PlatformV7DocumentBlockStage[];
  readonly affectsMoney: boolean;
  readonly nextAction: string;
  readonly createdAt: string;                 // NEW — ISO 8601
  readonly updatedAt: string;                 // NEW — ISO 8601
}
```

`PLATFORM_V7_STANDARD_DOCUMENTS` is a template — it uses a shared placeholder `dealId: ''`, `createdAt: ''`, `updatedAt: ''` since it is not deal-scoped. `platformV7CreateDocumentMatrix` fills `dealId` from its argument.

---

## 6. Required Document Types

`PLATFORM_V7_STANDARD_DOCUMENTS` must contain exactly these 9 entries, in this order:

| documentId | title | ownerRole | blockStages | affectsMoney | source | status in template |
|---|---|---|---|---|---|---|
| `contract` | Договор | `seller` | `deal_creation`, `release` | true | `edo` | `missing` |
| `specification` | Спецификация | `seller` | `shipment`, `release` | true | `edo` | `missing` |
| `sdiz` | СДИЗ | `seller` | `shipment`, `release` | true | `fgis` | `missing` |
| `epd_transport_document` | ЭПД/ТН | `logistics_manager` | `acceptance`, `release` | true | `epd` | `missing` |
| `acceptance_act` | Акт приёмки | `elevator_operator` | `release` | true | `elevator` | `missing` |
| `lab_protocol` | Протокол лаборатории | `lab_specialist` | `release`, `dispute` | true | `lab` | `missing` |
| `discrepancy_act` | Акт расхождений | `elevator_operator` | `release`, `dispute` | true | `elevator` | `conditional` |
| `arbitration_decision` | Решение арбитра | `arbitrator` | `release` | true | `arbitration` | `conditional` |
| `bank_basis` | Основание для банка | `operator` | `release` | true | `bank` | `missing` |

Changes from current:
- `epd` → `epd_transport_document`
- `'logistics'` → `'logistics_manager'`
- `'elevator'` → `'elevator_operator'` (two entries: `acceptance_act`, `discrepancy_act`)
- `'lab'` → `'lab_specialist'`
- `contract` gains `release` in `blockStages` (currently only `deal_creation`)
- `specification` gains `release` in `blockStages` (currently only `shipment`)

---

## 7. Status Rules

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

No new statuses. Do not add.

### What blocks a stage

A document blocks a stage if it appears in `blockStages` for that stage AND its status is NOT in the pass set for that stage.

**Pass set — `release` stage:**

| Status | Passes release? | Condition |
|---|---|---|
| `confirmed` | yes | always |
| `signed` | yes | always |
| `conditional` | **context-dependent** | see §8 |
| `missing` | no | always blocks |
| `draft` | no | always blocks |
| `uploaded` | no | always blocks |
| `sent` | no | always blocks |
| `rejected` | no | always blocks |
| `expired` | no | always blocks |
| `manual_review` | no | always blocks |

**Pass set — `shipment` stage:**
`confirmed`, `signed`, `sent` pass. All others block.

**Pass set — `deal_creation` stage:**
`confirmed`, `signed` pass. All others block.

**Pass set — `acceptance` stage:**
`confirmed`, `signed`, `sent` pass. All others block.

**Pass set — `dispute` stage:**
`confirmed`, `signed`, `conditional` pass. All others block.

---

## 8. Conditional Document Rules

`conditional` status must not be treated as a universal pass. It is context-dependent and requires a `DocumentConditionalContext` argument.

### Add `DocumentConditionalContext` type

```typescript
export interface DocumentConditionalContext {
  readonly disputeStatus: 'none' | 'open' | 'decision_issued' | 'resolved';
  readonly hasWeightDiscrepancy: boolean;
  readonly hasQualityDiscrepancy: boolean;
  readonly arbitrationDecisionHasBankEffect: boolean;
}
```

### Rules per conditional document

**`discrepancy_act` with `status: 'conditional'`:**
- Passes `release` stage if: `hasWeightDiscrepancy === false && hasQualityDiscrepancy === false` (no discrepancy — document is conditional but irrelevant)
- Passes `release` stage if: `(hasWeightDiscrepancy || hasQualityDiscrepancy) && disputeStatus === 'resolved'`
- Blocks `release` stage if: `(hasWeightDiscrepancy || hasQualityDiscrepancy) && disputeStatus === 'open'`
- Blocks `release` stage if: `(hasWeightDiscrepancy || hasQualityDiscrepancy) && disputeStatus === 'none'` (discrepancy exists but no dispute opened — manual review required)
- Does NOT by itself unlock release — it is one condition among many

**`arbitration_decision` with `status: 'conditional'`:**
- Passes `release` stage if: `disputeStatus === 'none'` (no dispute — document is conditional but irrelevant)
- Passes `release` stage if: `disputeStatus === 'decision_issued' || disputeStatus === 'resolved'`
- Blocks `release` stage if: `disputeStatus === 'open'`
- `arbitrationDecisionHasBankEffect` is informational only — it affects whether this document appears in `basisDocumentIds` for bank basis, but does NOT change the release gate pass/block decision
- Arbitrator's decision NEVER itself confirms bank release — it is evidence for the bank basis, not a release trigger

**`bank_basis` with any status:**
- `bank_basis` is not evaluated as a conditional — it is a required document with `status: 'missing'` by default
- Its readiness is governed by `isBankBasisReady` (see §11), not the conditional logic

### How to pass context

Add a `context` parameter to the affected functions:

```typescript
platformV7DocumentMatrixReadiness(matrix, context?: DocumentConditionalContext)
platformV7DocumentsBlockingStage(matrix, stage, context?: DocumentConditionalContext)
isDocumentReadyForStage(document, stage, context?: DocumentConditionalContext)
```

When `context` is not provided, treat `conditional` as blocking for `release` stage (safe default). This preserves backward compatibility — existing call sites without context will not accidentally pass.

---

## 9. Block Stages Per Required Document

Final expected mapping after this PR:

| documentId | deal_creation | shipment | acceptance | release | dispute |
|---|---|---|---|---|---|
| `contract` | blocks | — | — | blocks | — |
| `specification` | — | blocks | — | blocks | — |
| `sdiz` | — | blocks | — | blocks | — |
| `epd_transport_document` | — | — | blocks | blocks | — |
| `acceptance_act` | — | — | — | blocks | — |
| `lab_protocol` | — | — | — | blocks | blocks |
| `discrepancy_act` | — | — | — | blocks (conditional) | blocks (conditional) |
| `arbitration_decision` | — | — | — | blocks (conditional) | — |
| `bank_basis` | — | — | — | blocks | — |

---

## 10. Canonical Roles — What to Change

### Replace `PlatformV7DocumentRole` type

**Current (line 3, `document-matrix.ts`):**
```typescript
export type PlatformV7DocumentRole = 'seller' | 'buyer' | 'logistics' | 'driver' | 'elevator' | 'lab' | 'surveyor' | 'bank' | 'arbitrator' | 'operator';
```

**Replace with re-export from canonical:**
```typescript
export type { PlatformV7CanonicalRole as PlatformV7DocumentRole } from './role-canonical';
```

### Update all `PLATFORM_V7_STANDARD_DOCUMENTS` role values

| Old value | Canonical replacement |
|---|---|
| `'logistics'` | `'logistics_manager'` |
| `'elevator'` | `'elevator_operator'` |
| `'lab'` | `'lab_specialist'` |
| `'bank'` | `'bank_officer'` (not present in current data, but type must allow it) |
| `'seller'` | unchanged |
| `'buyer'` | unchanged |
| `'driver'` | unchanged |
| `'surveyor'` | unchanged |
| `'arbitrator'` | unchanged |
| `'operator'` | unchanged |

### Add `normalizeDocumentOwnerRole`

This is the boundary mapper — use it only when reading role values from external input (API response, legacy data). Never use it inside `PLATFORM_V7_STANDARD_DOCUMENTS` or any internal function — those must store canonical names directly.

```typescript
import { toPlatformV7CanonicalRole } from './role-canonical';
import type { PlatformV7CanonicalRole } from './role-canonical';

export function normalizeDocumentOwnerRole(role: string): PlatformV7CanonicalRole | null {
  return toPlatformV7CanonicalRole(role);
}
```

### Fix `platformV7BankBasis.test.ts` fixtures

This test file constructs `PlatformV7DocumentRequirement` objects with short aliases (`'elevator'`, `'seller'`, `'operator'`). After this PR changes the `responsibleRole` / `ownerRole` type to `PlatformV7CanonicalRole`, those fixtures will fail to type-check. Update the fixtures:
- `'elevator'` → `'elevator_operator'`
- `'seller'` → `'seller'` (unchanged)
- `'operator'` → `'operator'` (unchanged)

Also add the new required fields (`dealId`, `type`, `ownerRole`, `deadline`, `signatureStatus`, `createdAt`, `updatedAt`) to all fixture objects in that test file.

---

## 11. Functions to Implement or Harden

Check existing function names before creating new ones. Extend existing where possible.

### Extend `platformV7DocumentMatrixReadiness`

Signature change:
```typescript
export function platformV7DocumentMatrixReadiness(
  matrix: PlatformV7DocumentMatrix,
  context?: DocumentConditionalContext,
): PlatformV7DocumentMatrixReadiness
```

Behavior change: for documents with `status: 'conditional'` that block `release`, call `isDocumentReadyForStage(document, 'release', context)` to decide whether they block. Without context, `conditional` blocks release (safe default).

### Extend `platformV7DocumentsBlockingStage`

Signature change:
```typescript
export function platformV7DocumentsBlockingStage(
  matrix: PlatformV7DocumentMatrix,
  stage: PlatformV7DocumentBlockStage,
  context?: DocumentConditionalContext,
): readonly PlatformV7DocumentRequirement[]
```

### Add `isDocumentReadyForStage`

```typescript
export function isDocumentReadyForStage(
  document: PlatformV7DocumentRequirement,
  stage: PlatformV7DocumentBlockStage,
  context?: DocumentConditionalContext,
): boolean
```

Implements the pass/block rules from §7 and §8. Returns `true` if the document passes the given stage, `false` if it blocks.

### Add `getMoneyBlockingDocuments`

```typescript
export function getMoneyBlockingDocuments(
  matrix: PlatformV7DocumentMatrix,
  context?: DocumentConditionalContext,
): readonly PlatformV7DocumentRequirement[]
```

Returns all documents where `affectsMoney === true` AND `isDocumentReadyForStage(document, 'release', context) === false`.

### Add `isBankBasisReady`

```typescript
export interface BankBasisReadinessContext {
  readonly releaseGateAllowed: boolean;
  readonly disputeResolved: boolean;
  readonly conditionalContext?: DocumentConditionalContext;
}

export function isBankBasisReady(
  matrix: PlatformV7DocumentMatrix,
  context: BankBasisReadinessContext,
): boolean
```

Returns `true` only when:
1. `context.releaseGateAllowed === true`
2. `context.disputeResolved === true`
3. All `affectsMoney === true` documents that block `release` are ready (via `getMoneyBlockingDocuments` returning empty)

`bank_basis` itself being `missing` does NOT block `isBankBasisReady` — this function checks prerequisites, not the `bank_basis` document's own status.

---

## 12. Tests Required

### New file: `apps/web/tests/unit/platformV7DocumentMatrix.test.ts`

**Matrix generation:**
```
✓ createDocumentMatrix generates all 9 required documentIds in correct order
✓ documentId list is: contract, specification, sdiz, epd_transport_document, acceptance_act, lab_protocol, discrepancy_act, arbitration_decision, bank_basis
✓ all ownerRole values are PlatformV7CanonicalRole values (no short aliases)
✓ no ownerRole equals 'logistics', 'elevator', 'lab', 'bank', 'executive', 'compliance'
✓ logistics_manager is ownerRole of epd_transport_document
✓ elevator_operator is ownerRole of acceptance_act and discrepancy_act
✓ lab_specialist is ownerRole of lab_protocol
```

**Stage blockers — required docs:**
```
✓ missing contract blocks deal_creation
✓ missing contract blocks release
✓ missing sdiz blocks shipment
✓ missing sdiz blocks release
✓ missing epd_transport_document blocks acceptance
✓ missing epd_transport_document blocks release
✓ missing acceptance_act blocks release
✓ missing lab_protocol blocks release
✓ missing bank_basis blocks release
```

**Status rules:**
```
✓ rejected document blocks release
✓ expired document blocks release
✓ manual_review document blocks release
✓ draft document blocks release
✓ uploaded document blocks release
✓ sent document blocks release for release stage
✓ confirmed document passes release
✓ signed document passes release
```

**Conditional documents — without context (safe default):**
```
✓ discrepancy_act with status 'conditional' blocks release when no context provided
✓ arbitration_decision with status 'conditional' blocks release when no context provided
✓ platformV7DocumentMatrixReadiness without context: releaseReady=false when conditionals present
```

**Conditional documents — discrepancy_act with context:**
```
✓ conditional discrepancy_act passes release when no discrepancy (hasWeightDiscrepancy=false, hasQualityDiscrepancy=false)
✓ conditional discrepancy_act passes release when discrepancy exists and dispute resolved
✓ conditional discrepancy_act blocks release when discrepancy exists and dispute open
✓ conditional discrepancy_act blocks release when discrepancy exists and disputeStatus=none (no dispute opened)
✓ discrepancy_act does not alone unlock release — other release blockers still apply
```

**Conditional documents — arbitration_decision with context:**
```
✓ conditional arbitration_decision passes release when disputeStatus=none
✓ conditional arbitration_decision passes release when disputeStatus=decision_issued
✓ conditional arbitration_decision passes release when disputeStatus=resolved
✓ conditional arbitration_decision blocks release when disputeStatus=open
✓ arbitration_decision with arbitrationDecisionHasBankEffect=true still does not change gate result
```

**Money blockers:**
```
✓ getMoneyBlockingDocuments returns all affectsMoney=true docs that block release
✓ getMoneyBlockingDocuments returns empty when all affectsMoney docs are confirmed/signed
✓ confirmed non-affectsMoney document does not appear in money blockers
✓ missing affectsMoney=true document appears in money blockers
```

**Bank basis readiness:**
```
✓ isBankBasisReady returns false when releaseGateAllowed=false
✓ isBankBasisReady returns false when disputeResolved=false
✓ isBankBasisReady returns false when money-blocking documents exist
✓ isBankBasisReady returns true when gate allowed, dispute resolved, all money docs confirmed
✓ bank_basis document itself missing does not block isBankBasisReady (it checks prerequisites)
✓ sent_to_bank status on bank_basis document does not equal bank_confirmed
```

**Canonical role tests:**
```
✓ PlatformV7DocumentRole type is identical to PlatformV7CanonicalRole (re-export)
✓ normalizeDocumentOwnerRole('bank') returns 'bank_officer'
✓ normalizeDocumentOwnerRole('logistics') returns 'logistics_manager'
✓ normalizeDocumentOwnerRole('elevator') returns 'elevator_operator'
✓ normalizeDocumentOwnerRole('lab') returns 'lab_specialist'
✓ normalizeDocumentOwnerRole('compliance') returns 'compliance_officer'
✓ normalizeDocumentOwnerRole('unknown_role') returns null
✓ normalizeDocumentOwnerRole is not called inside PLATFORM_V7_STANDARD_DOCUMENTS — canonical names are stored directly
```

**No fake-live copy:**
```
✓ no document title or nextAction contains 'production-ready', 'fully live', 'fully integrated'
✓ no document title or nextAction contains 'платформа гарантирует', 'платформа сама выпускает'
✓ isBankBasisReady does not imply platform releases money — it checks prerequisites only
```

### Updates to existing test files

**`apps/web/tests/unit/platformV7DocumentMatrixFoundation.test.ts` — update line 17:**

Change `'epd'` → `'epd_transport_document'` in the expected documentId array assertion.

Add required new fields (`dealId`, `type`, `ownerRole`, `deadline`, `signatureStatus`, `createdAt`, `updatedAt`) to the test for "keeps every document actionable".

**`apps/web/tests/unit/platformV7BankBasis.test.ts` — update fixtures:**

Update `docs` fixture array: `'elevator'` → `'elevator_operator'`. Add new required fields to each fixture object (`dealId: 'deal-1'`, `type: documentId`, `ownerRole: <canonical>`, `deadline: null`, `signatureStatus: 'not_required'`, `createdAt: ''`, `updatedAt: ''`).

---

## 13. Commands to Run

```bash
pnpm typecheck
pnpm --filter @pc/web exec vitest run tests/unit/platformV7DocumentMatrix.test.ts
pnpm --filter @pc/web exec vitest run tests/unit/platformV7DocumentMatrixFoundation.test.ts
pnpm --filter @pc/web exec vitest run tests/unit/document-matrix-completeness.test.ts
pnpm --filter @pc/web exec vitest run tests/unit/platformV7BankBasis.test.ts
pnpm test
pnpm build
```

All must exit 0. Known pre-existing failure in `dealEvidencePackRoute.test.tsx` does not block this PR.

---

## 14. Out of Scope

| What | Where it belongs |
|---|---|
| MoneyTree invariant / release gate `bankConfirmationExists` | PR 4.1 (`money-tree.ts`) |
| `p7ConfirmBankRelease` | PR 4.3 (`bank-basis.ts`) |
| `assertPermission` wiring for document writes | PR 4.4 |
| `deal-execution-source-of-truth.ts` | Do not touch — `document-matrix-completeness.test.ts` tests this file, not `document-matrix.ts` |
| `domain/release-guard.ts` | Do not touch — separate `CanonicalDeal` model |
| Any UI component, route, or layout | Stage 4 is lib-only |
| `apps/api` | Out of web scope |
| `apps/landing` | Never touch |
| `pnpm-lock.yaml` | Never touch |

---

## 15. Acceptance Criteria

PR 4.2 is accepted when ALL of the following are true:

| # | Criterion | Verification |
|---|---|---|
| 1 | `PlatformV7DocumentRole` is a re-export of `PlatformV7CanonicalRole` from `role-canonical.ts` | Grep: `export type PlatformV7DocumentRole` in `document-matrix.ts` shows re-export, not union |
| 2 | No short alias stored in `PLATFORM_V7_STANDARD_DOCUMENTS` — grep `role: '(logistics\|elevator\|lab\|bank\|executive\|compliance)'` returns empty | `grep` check |
| 3 | `PLATFORM_V7_STANDARD_DOCUMENTS` contains `epd_transport_document`, not `epd` | Grep |
| 4 | `PlatformV7DocumentRequirement` has all 13 required fields including `ownerRole: PlatformV7CanonicalRole` | `pnpm typecheck` exit 0 |
| 5 | `conditional` status without context blocks release for `discrepancy_act` and `arbitration_decision` | Tests pass |
| 6 | `conditional discrepancy_act` passes release only when no discrepancy OR dispute resolved | Tests pass |
| 7 | `conditional arbitration_decision` passes release only when `disputeStatus !== 'open'` | Tests pass |
| 8 | `getMoneyBlockingDocuments` returns correct set | Tests pass |
| 9 | `isBankBasisReady` returns `false` unless gate allowed, dispute resolved, money docs confirmed | Tests pass |
| 10 | `normalizeDocumentOwnerRole('bank')` → `'bank_officer'`, same for other aliases | Tests pass |
| 11 | Pre-existing tests pass: `platformV7DocumentMatrixFoundation.test.ts`, `platformV7BankBasis.test.ts`, `document-matrix-completeness.test.ts` | `pnpm test` exit 0 |
| 12 | `pnpm typecheck` exit 0 | — |
| 13 | `pnpm build` exit 0 | — |
| 14 | `git diff fba1015c...HEAD -- apps/landing/` returns 0 lines | — |
| 15 | No forbidden copy in any function output string | Tests pass |
