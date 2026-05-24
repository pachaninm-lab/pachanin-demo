# PR 5.1 Review Checklist — Application Service Layer

**Stage:** controlled-pilot / pre-integration  
**Depends on:** PR 5.0 (inventory), PR 5.3 (persistence ports), PR 5.4 (DTO schemas) — all merged  
**PR title:** Application Service Layer (`P7ApplicationService`)  
**Verdict format:** `PASS` or `BLOCKED — <section> — <reason>`

---

## Section 1 — Scope guard

BLOCK immediately if any of the following appear in the diff:

| Forbidden path | Reason |
|---|---|
| `apps/landing/**` | Never touch landing |
| `apps/api/**` | Out of scope for Stage 5 web service layer |
| Any React component / Next.js page / route handler | UI is PR 5.2 |
| `external-adapters.ts` | Out of scope |
| `bank-webhooks.ts` | Out of scope |
| `integrations/**` | Out of scope |
| `simulated-external-actions.ts` | Out of scope |
| `money-tree.ts` | Stage 4 domain — immutable |
| `document-matrix.ts` | Stage 4 domain — immutable |
| `bank-basis.ts` | Stage 4 domain — immutable |
| `access-control.ts` | Stage 4 domain — immutable |
| `action-boundary.ts` | Stage 4 domain — immutable |
| `role-canonical.ts` | Stage 4 domain — immutable |
| `idempotency-key-helper.ts` | Stage 4 domain — immutable |
| `persistence-ports.ts` | PR 5.3 — do not modify |
| `dto-schemas.ts` | PR 5.4 — do not modify |

---

## Section 2 — Expected files

PASS only if the PR introduces exactly the following new files (or extends PR-5.0-inventory-classified `ALIGNED` files in-place with a recorded justification in the PR description):

**Required new files:**
```
apps/web/lib/platform-v7/runtime/application-service.ts
apps/web/lib/platform-v7/runtime/application-service-types.ts
apps/web/tests/unit/platform-v7-application-service.test.ts
```

**Allowed alternatives (only if PR 5.0 inventory classified them `ALIGNED`):**
- `usecase-service.ts` extended in-place (decision must be quoted verbatim from PR 5.0 inventory)
- `service-contracts.ts` extended in-place (same requirement)

BLOCK if:
- No test file is included
- New files are placed outside `apps/web/lib/platform-v7/runtime/` without justification
- The PR description does not reference the PR 5.0 skeleton inventory classification for any reused skeleton file

---

## Section 3 — Required service exports

The service layer must export all of the following functions (exact names may differ, but intent must be preserved — match by intent, not only by name):

**Money execution services:**
- [ ] `P7MoneyExecutionService` or equivalent — handles `requestRelease`, `confirmRelease`, `confirmRefund`, `confirmHold`

**Document execution service:**
- [ ] `P7DocumentExecutionService` or equivalent — handles `updateDocument`

**Bank basis execution services:**
- [ ] `P7BankBasisExecutionService` or equivalent — handles `sendBankBasis`, `confirmBankRelease`, `confirmBankRefund`, `confirmBankHold`, `rejectBankRelease`, `startBankManualReview`

**Release workflow service:**
- [ ] `P7ReleaseWorkflowService` or equivalent — orchestrates money + bank coordination for a release cycle

**Dispute settlement service:**
- [ ] `P7DisputeSettlementService` or equivalent — handles arbitration basis coordination

BLOCK if any of these five service categories is absent from the exports.

---

## Section 4 — Dependency injection (DI)

PASS only if:
- [ ] Every service function accepts `persistence: P7RuntimeUnitOfWork` (or a compatible sub-interface) as an explicit argument — injected by the caller, not imported at module scope
- [ ] No service file instantiates a persistence adapter directly (e.g., `new P7MockPersistenceAdapter()` at module scope)
- [ ] No module-level `Map`, `Set`, or array is used as a state store inside the service files
- [ ] No DB client, HTTP client, or external SDK is imported
- [ ] No hidden global state (no `let currentContext = {}` at module level that accumulates across calls)

BLOCK if:
- A service creates its own persistence internally (dependency is not injected)
- Module-level `Map`/`Set` variables act as an implicit in-memory store within the service itself (the mock adapter is PR 5.5 — it does not belong here)
- Any hardcoded empty idempotency context: `{ processedKeys: [], processedBankEventIds: [], processedOperationIds: [] }` is constructed inline within the service

---

## Section 5 — Boundary rule (no direct domain calls)

PASS only if the service files contain **zero** direct calls to any of the following domain mutation functions:

| Forbidden direct call | Must go through instead |
|---|---|
| `platformV7ApplyMoneyOperation(...)` | `executePlatformV7MoneyAction(...)` |
| `p7ConfirmBankRelease(...)` | `executePlatformV7BankBasisAction(...)` |
| `p7MarkBankBasisSent(...)` | `executePlatformV7BankBasisAction(...)` |
| `p7CreateDocumentRequirement(...)` | `executePlatformV7DocumentAction(...)` |
| `p7UpdateDocumentStatus(...)` | `executePlatformV7DocumentAction(...)` |
| Any other direct mutation in `money-tree.ts`, `document-matrix.ts`, or `bank-basis.ts` | Always via action-boundary |

BLOCK if:
- `grep -r "platformV7Apply\|p7ConfirmBank\|p7MarkBankBasis\|p7CreateDocument\|p7UpdateDocument" apps/web/lib/platform-v7/runtime/application-service.ts` returns any match
- The service imports from `money-tree.ts`, `document-matrix.ts`, or `bank-basis.ts` for mutation purposes (read-only type imports are allowed)

---

## Section 6 — DTO validation first

PASS only if DTO validation happens **before** any of the following in every service function:

1. Persistence load (`persistence.moneyTree.loadByDealId`, etc.)
2. Idempotency reserve (`persistence.idempotency.reserveKey`)
3. Action-boundary execution (`executePlatformV7MoneyAction`, etc.)
4. Audit append (`persistence.audit.append`)

Validation must use the validators exported from `dto-schemas.ts` (PR 5.4):
- `validateP7MoneyActionRequestDto`
- `validateP7DocumentActionRequestDto`
- `validateP7BankBasisSendRequestDto`
- `validateP7BankConfirmationRequestDto`
- Other validators as appropriate

BLOCK if:
- A service function calls `persistence.*` or `executePlatformV7*` before validating the input DTO
- Validation is skipped and delegated to the action-boundary (the boundary enforces domain invariants, not request shape)
- Raw input is passed directly to the action-boundary without going through a `P7ValidationResult`-returning validator first

---

## Section 7 — Idempotency lifecycle (7-step)

Each service function must implement the following sequence in order:

1. **Validate DTO** — call the appropriate `validateP7*RequestDto`; return `validation_error` if `ok: false`
2. **Load idempotency context** — call `persistence.idempotency.loadContext(scope)` to obtain the full `P7ActionIdempotencyContext`; never construct `{ processedKeys: [], processedBankEventIds: [], processedOperationIds: [] }` inline
3. **Check for duplicate** — call `persistence.idempotency.hasProcessedKey(key)` (or `hasProcessedBankEventId` / `hasProcessedOperationId` as appropriate); if already processed, load via `persistence.idempotency.loadDuplicateResult(key)` and return `duplicate` result with the cached payload — do not re-execute
4. **Reserve key before mutation** — call `persistence.idempotency.reserveKey(...)` before calling the action-boundary; if reservation fails (conflict), return `conflict` result without executing
5. **Execute action-boundary** — call `executePlatformV7MoneyAction` / `executePlatformV7DocumentAction` / `executePlatformV7BankBasisAction` with the loaded idempotency context
6. **Record result** — call `persistence.idempotency.recordResult(...)` after a successful or denied boundary call
7. **Append audit** — call `persistence.audit.append(...)` (or `appendMany` for bank multi-event arrays) on all paths: `applied`, `denied`, `duplicate`

BLOCK if:
- `processedKeys`, `processedBankEventIds`, or `processedOperationIds` are hardcoded as `[]` in any service function
- The idempotency reserve step is missing (key is not reserved before the boundary call)
- `loadDuplicateResult` is not called on a detected duplicate — the service re-executes instead
- Audit is appended only on success and omitted on `denied` or `duplicate`
- `persistence.idempotency.recordResult` is missing (result not persisted after execution)

---

## Section 8 — Audit lifecycle (all paths)

PASS only if:
- [ ] `persistence.audit.append(...)` or `persistence.audit.appendMany(...)` is called on every code path:
  - `applied` — append the action audit payload from the boundary result
  - `denied` — append the denied-access audit payload (`P7BankAuditPayload` or `PlatformV7ActionBoundaryAuditPayload`)
  - `duplicate` — append a duplicate-detection audit event (must not re-append the original result payload)
- [ ] Bank confirmation functions that can produce multiple audit events use `appendMany` (not individual `append` calls in a loop without error aggregation)
- [ ] The audit payload type narrows correctly: `PlatformV7ActionBoundaryAuditPayload` for money/document actions; `P7BankAuditPayload` for bank basis actions (as defined in `persistence-ports.ts`)
- [ ] Audit append errors are not silently swallowed — they must surface in the returned `P7ServiceResult`

BLOCK if:
- Any service function skips audit on `denied` or `duplicate` paths
- Audit append errors are caught and discarded with `catch(() => {})` or equivalent

---

## Section 9 — Unit of work (MoneyTree + BankBasis atomicity)

PASS only if:
- [ ] Operations that touch both MoneyTree and BankBasis (e.g., bank confirmation that updates release state) use `persistence.runInTransaction(...)` from `P7RuntimeUnitOfWork`
- [ ] No service function calls `saveMoneyTree` and `saveBankBasis` independently outside a transaction when both must succeed or both must fail
- [ ] The unit of work is not instantiated inside the service — it is always injected via the `persistence` parameter
- [ ] No fake transaction implementation (e.g., `runInTransaction: async (fn) => fn(persistence)` without actual rollback semantics) is asserted to be "durable" or "atomic" in comments or test assertions

BLOCK if:
- MoneyTree and BankBasis saves are performed in separate `await` calls without a wrapping `runInTransaction` on code paths where both must be consistent
- The service creates a partial `P7RuntimeUnitOfWork` object inline instead of accepting the injected port

---

## Section 10 — Service result contract

Every service function must return a typed discriminated union. PASS only if:

- [ ] The return type is a named exported type from `application-service-types.ts` (or equivalent) — not `any`, not `unknown`, not `object`
- [ ] The discriminated union covers all of the following `status` values:
  - `ok` — action applied and persisted
  - `validation_error` — DTO validation failed; `errors: readonly P7ValidationError[]` present
  - `denied` — action-boundary returned `denied`; denial reason present
  - `duplicate` — idempotency check found existing result; cached payload returned
  - `conflict` — optimistic concurrency conflict on persistence save; `currentVersion?` present
  - `not_found` — referenced resource (deal, bank basis, document) not found in persistence
  - `domain_blocked` — action-boundary returned a terminal domain error (e.g., already released)
  - `persisted` — reserved for future use; may be omitted if all terminal states are covered above
- [ ] No service function throws a plain string or untyped Error as its primary error signaling mechanism — errors must flow through the `status` discriminant
- [ ] No `as any` cast is used to satisfy the return type

BLOCK if:
- Return type is `any` or not explicitly typed
- `throw new Error(...)` is used as the primary error path instead of returning a typed result
- Any `status` value not listed above is used without documentation in the PR description

---

## Section 11 — Tests

File: `apps/web/tests/unit/platform-v7-application-service.test.ts`

Required test cases (minimum — BLOCK if fewer than 10 are present):

- [ ] **DI contract** — injected persistence adapter can be replaced in tests without modifying the service (adapter is a mock implementing `P7RuntimeUnitOfWork`)
- [ ] **Applied path — money** — service calls `executePlatformV7MoneyAction` with idempotency context loaded from persistence (not hardcoded `[]`)
- [ ] **Save on applied** — service calls `persistence.moneyTree.saveMoneyTree(...)` when boundary returns `applied`
- [ ] **No save on denied** — service does NOT call `saveMoneyTree` when boundary returns `denied`; `beforeState === afterState`
- [ ] **No save on duplicate** — service does NOT call `saveMoneyTree` when idempotency check returns already-processed; `beforeState === afterState`
- [ ] **Audit on applied** — `persistence.audit.append(...)` is called on `applied` path
- [ ] **Audit on denied** — `persistence.audit.append(...)` is called on `denied` path
- [ ] **Audit on duplicate** — `persistence.audit.append(...)` is called on `duplicate` path
- [ ] **Idempotency reserve** — `persistence.idempotency.reserveKey(...)` is called before `executePlatformV7MoneyAction`
- [ ] **Record result** — `persistence.idempotency.recordResult(...)` is called after `applied` result
- [ ] **Duplicate return** — two calls with the same idempotency key return `status: 'duplicate'` on the second call without re-executing the boundary
- [ ] **Validation first** — service returns `validation_error` without calling persistence or boundary when DTO is invalid (fractional amount, invalid role, missing idempotency key)

BLOCK if:
- Fewer than 10 of the above cases are present
- Tests use `as any` to bypass type checking on service inputs
- Tests assert on internal implementation details (e.g., spy on action-boundary internal functions) rather than observable behavior
- `processedKeys: []` / `processedBankEventIds: []` / `processedOperationIds: []` are hardcoded in test setup rather than loaded from the mock adapter

---

## Section 12 — Commands

Run these commands against the PR head SHA before issuing verdict:

```bash
# 1. Type-check the entire web app
pnpm --filter web typecheck

# 2. Run application service unit tests
vitest run tests/unit/platform-v7-application-service.test.ts

# 3. Run all platform-v7 tests to catch regressions
vitest run tests/unit/ --reporter=verbose 2>&1 | grep -E "PASS|FAIL|platform-v7"

# 4. Verify no direct domain mutation calls in service files
grep -rn "platformV7Apply\|p7ConfirmBank\|p7MarkBankBasis\|p7CreateDocument\|p7UpdateDocument" \
  apps/web/lib/platform-v7/runtime/application-service.ts && echo "BLOCK: direct domain call found" || echo "OK"

# 5. Verify landing is untouched
git diff HEAD~1 -- apps/landing/ | wc -l | xargs -I{} sh -c 'test {} -eq 0 && echo "OK: landing untouched" || echo "BLOCK: landing modified"'
```

BLOCK if any command returns a non-zero exit code, type errors, test failures, or the grep in command 4 produces any match.

---

## Verdict

| Section | Status |
|---|---|
| 1 — Scope guard | |
| 2 — Expected files | |
| 3 — Required service exports | |
| 4 — Dependency injection | |
| 5 — Boundary rule | |
| 6 — DTO validation first | |
| 7 — Idempotency lifecycle | |
| 8 — Audit lifecycle | |
| 9 — Unit of work | |
| 10 — Service result contract | |
| 11 — Tests | |
| 12 — Commands | |

**Final verdict:** `PASS` or `BLOCKED — <section> — <reason>`

> PASS only if all 12 sections are satisfied with zero blocking findings.  
> A single BLOCK in any section is sufficient to reject the PR.  
> Do not claim the service "releases money" — it records a boundary outcome.  
> Do not claim "production-ready" — this is a controlled-pilot service layer.
