# Codex current task — PR 5.5 Mock Persistence Adapter

Current step: PR 5.5 Mock Persistence Adapter.
Maturity: controlled-pilot / pre-integration.
Human review is required before merge.

## Source of truth

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- docs/platform-v7/autopilot/progress.json

## Objective

Create a runtime persistence adapter without a database. It must be an explicit adapter instance that can later be replaced by a database adapter without rewriting application services.

## Allowed files

- apps/web/lib/platform-v7/runtime/mock-persistence-adapter.ts
- apps/web/tests/unit/platformV7RuntimeMockPersistenceAdapter.test.ts

## Forbidden zones

- apps/landing
- apps/web/app/platform-v7
- apps/web/components/platform-v7
- apps/web/components/v7r
- apps/web/lib/platform-v7/adapters
- apps/web/lib/platform-v7/ai
- apps/web/app/api
- package-lock.json

## Implement

- createP7MockRuntimeStore(seed)
- P7MoneyTreeRepository
- P7DocumentMatrixRepository
- P7BankBasisRepository
- P7DisputeSettlementRepository
- P7ActionExecutionRepository
- P7ExternalCallRepository
- P7IdempotencyStore
- P7AuditEventSink
- P7RuntimeUnitOfWork

Support:

- load/save MoneyTree
- load/save Document Matrix
- load/save Bank Basis
- load/save Dispute state
- load/save Action Execution
- load/save External Calls
- idempotency reserve and result replay
- audit append and appendMany
- conflict, not_found and duplicate event scenarios
- expectedVersion conflict
- seeded scenarios
- controlled reset only on explicit store instance

## Restrictions

Do not use module-level Map, module-level Set, global arrays, hidden singleton store, UI persistence, component state persistence or random runtime state.

Allowed: state inside explicit adapter instance, version tokens, seeded scenarios, controlled reset on the explicit adapter instance.

## Tests

Create:

- apps/web/tests/unit/platformV7RuntimeMockPersistenceAdapter.test.ts

Cover isolated stores, load/save, version update, expectedVersion conflict, document matrix, bank basis, idempotency replay, duplicate bank event, audit append/appendMany, unitOfWork transaction, no shared state between instances, source scan for hidden global persistence.

## Checks

Run node scripts/p7-autopilot-dispatcher.mjs, bash scripts/p7-autopilot-guard.sh, pnpm typecheck and pnpm test.

## PR title

feat(platform-v7): add mock persistence adapter
