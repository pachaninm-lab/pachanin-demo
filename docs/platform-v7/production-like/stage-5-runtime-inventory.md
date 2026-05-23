# Stage 5 Runtime Inventory

Status: inventory only. This document does not start PR 5.1+ runtime implementation.

Base assumption: Stage 4 domain-level and action-boundary logic has landed on `main`. Stage 5 should make that logic executable through explicit runtime services, persistence ports, idempotency storage and audit sinks without bypassing the Stage 4 boundaries.

## Ready Domain And Boundary Modules

| Area | Module | Current readiness |
| --- | --- | --- |
| MoneyTree | `apps/web/lib/platform-v7/money-tree.ts` | Internal money invariant, release gate, operation validation and money mutation primitive are ready for service wrapping. |
| Document Matrix | `apps/web/lib/platform-v7/document-matrix.ts` | Required documents, canonical roles, stage blockers, conditional readiness and bank-basis readiness checks are ready for service wrapping. |
| Bank Basis | `apps/web/lib/platform-v7/bank-basis.ts` | Bank-basis send, bank confirmation paths, arbitration basis payload and audit payload generation are ready for service wrapping. |
| RBAC/ACL | `apps/web/lib/platform-v7/access-control.ts` | Deny-by-default decision helpers, explicit denies, role scopes and denied access payloads are available. |
| Action Boundary | `apps/web/lib/platform-v7/action-boundary.ts` | Money, document and bank boundary executors enforce idempotency, duplicate checks, permission decision, domain preconditions and audit payload output. |
| Role Canonicalization | `apps/web/lib/platform-v7/role-canonical.ts` | Canonical role mapping exists and should remain the source for Stage 5 runtime services. |
| Idempotency Key Shape | `apps/web/lib/platform-v7/idempotency-key-helper.ts` | Deterministic key build/validation exists, but persistent key storage does not. |

## Missing Service / Runtime Layers

- `MoneyExecutionService`: should load current MoneyTree, call `executePlatformV7MoneyAction`, persist the resulting tree and append audit/idempotency records.
- `DocumentExecutionService`: should load a document/matrix snapshot, call `executePlatformV7DocumentAction`, persist the document state and append audit/idempotency records.
- `BankBasisExecutionService`: should load bank basis decision state and MoneyTree, call `executePlatformV7BankBasisAction`, persist bank decision state and MoneyTree movement atomically.
- `ReleaseWorkflowService`: should orchestrate release request, bank-basis send and bank confirmation through the boundary services instead of direct domain calls.
- `DisputeSettlementService`: should orchestrate arbitration basis, hold/refund/release split and bank confirmations through the boundary services.
- `Stage5RuntimeContext`: should carry actor, resource scope, idempotency context, audit metadata and correlation metadata across service calls.

## Missing Server Actions / API Wrappers

Stage 5 still needs wrappers that call service-layer methods, not domain primitives directly:

- release request wrapper for seller/buyer/operator scoped release request.
- bank basis send wrapper for operator/bank-basis submission.
- bank release confirmation wrapper for bank officer confirmation.
- bank refund confirmation wrapper for bank officer confirmation.
- bank hold confirmation wrapper for bank officer confirmation.
- document upload/sign/send/confirm/reject wrappers.
- arbitration basis submission wrapper.
- dispute split settlement wrapper.
- read wrappers for current blockers, audit trail, idempotency status and external-call status.

These wrappers are not API endpoint implementation in PR 5.0. They are inventory items for later PRs.

## Persistence Port Needs

Stage 5 should introduce interfaces before adapters:

- `MoneyTreeRepository`: get/save MoneyTree by deal id with optimistic version or transaction token.
- `DocumentMatrixRepository`: get/save matrix and individual document requirements by deal id.
- `BankBasisRepository`: get/save bank-basis decision, sent state and bank confirmation metadata.
- `DisputeSettlementRepository`: get/save arbitration decision and split settlement state.
- `ActionExecutionRepository`: store action execution envelope, before/after state references and status.
- `ExternalCallRepository`: store future adapter call envelopes without connecting real external systems.

## Idempotency Store Interface Needs

Stage 4 accepts caller-supplied context:

```ts
type P7ActionIdempotencyContext = {
  readonly processedKeys: readonly string[];
  readonly processedBankEventIds: readonly string[];
  readonly processedOperationIds: readonly string[];
};
```

Stage 5 needs a persistent interface that can produce this context and record successful or blocked attempts:

- lookup by idempotency key.
- lookup by bank event id.
- lookup by money operation id.
- reserve/check key before mutation.
- record action result after mutation.
- return deterministic duplicate result without re-running mutation.
- support transaction boundary with MoneyTree and bank-basis persistence.

No module-level `Set` or `Map` should be used as persistence.

## Audit Event Sink Interface Needs

Stage 4 returns audit payloads but does not persist them. Stage 5 needs:

- `AuditEventSink.append(payload)`.
- append for allowed, denied, blocked and duplicate paths.
- correlation id and audit id preservation.
- before/after state references or snapshots according to storage decision.
- ability to append multiple bank audit payloads, including `arbitration_decision_used_as_basis`.
- no console-only audit path for critical actions.

## Mock Persistence Adapter Needs

External integrations remain out of scope, but Stage 5 can use mock persistence adapters that implement repository contracts:

- in-memory test adapter only for unit/integration tests.
- file-backed or deterministic fixture adapter only if explicitly scoped in a later PR.
- no hidden singleton state in production-facing modules.
- reset hooks only in test harnesses.
- persistence behavior must be visible through interfaces and passed dependencies.

## Tests Needed For Stage 5

- Service tests proving money/document/bank services call action-boundary executors, not domain primitives directly.
- Idempotency-store tests for duplicate key, duplicate bank event id and duplicate operation id.
- Audit-sink tests for allowed, denied, blocked and duplicate paths.
- Persistence-port tests for atomic MoneyTree + bank-basis updates.
- Negative tests proving denied permission does not persist state mutation.
- Negative tests proving invalid idempotency does not persist state mutation.
- Dispute settlement service tests for arbitration basis plus release/refund/hold split.
- Clean release service tests from documents ready to release confirmed.
- No module-level state tests for service/runtime modules.
- Forbidden-copy tests confirming Stage 5 runtime docs and user-facing wrappers do not claim live integrations or automatic bank confirmation.

## Open Questions For PR 5.1+

- Which service layer location should own runtime orchestration: `apps/web/lib/platform-v7` or `apps/web/lib/domain`?
- Should Stage 5 wrappers be server actions first, API wrappers first, or service-only first?
- What is the transaction model for MoneyTree plus BankBasis persistence before a real DB adapter?
- Which audit payload fields should be snapshots versus references?
- How should mock persistence be reset in tests without exposing production code to test-only state?
