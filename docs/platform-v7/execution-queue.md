# platform-v7 execution queue

CURRENT: VP-3.33 Runtime Persistence Prisma Schema and Migration Implementation.

GOAL: Реализовать additive Prisma schema и migration-контракт для DB-backed runtime persistence после merge #2240, не применяя migration к production DB и не подключая runtime repository к Postgres в этом слое.

CURRENT STATUS:
- VP-3.29 transaction/idempotency hardening is merged from #2237.
- VP-3.30 Prisma schema/migration plan is merged from #2238.
- VP-3.31 scope unlock is merged from #2239.
- VP-3.32 final gate is merged from #2240.
- VP-3.33 prepares schema, migration, rollback and validation guard in PR #2241.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- apps/api/prisma/schema.prisma
- apps/api/prisma/contracts/deal_workspace_runtime_snapshots.sql
- apps/api/prisma/migrations/20260710060000_deal_workspace_runtime_persistence/migration.sql
- apps/api/prisma/migrations/20260710060000_deal_workspace_runtime_persistence/rollback.sql
- apps/web/tests/unit/platformV7DealWorkspaceRuntimePrismaSchema.test.ts

IMPLEMENTED:
- Added canonical `DealWorkspaceRuntimeSnapshot` Prisma model.
- Added append-only `DealWorkspaceRuntimeTransactionAttempt` Prisma model.
- Reused canonical `Deal`, `OutboxEntry` and `AuditEvent`; no parallel evidence tables were introduced.
- Added nullable correlation/runtime linkage columns to existing outbox and audit models.
- Added unique keys for runtime snapshot, idempotency, outbox link, audit link and transaction identity.
- Added restrictive foreign keys from runtime snapshot to deal/outbox/audit and from attempts to snapshot.
- Added DB CHECK constraints for snapshot state, runtime state, version and transaction stage.
- Added DB linkage consistency constraint:
  - `ready_to_persist` and `outbox_required`: no evidence links;
  - `audit_required`: outbox link only;
  - `fully_linked`: outbox and audit links.
- Added operational indexes for deal timeline, intent/state, correlation, recovery and evidence lookup.
- Added dependency-safe operational `rollback.sql`.
- Added unit guard that rejects duplicate runtime outbox/audit tables, missing constraints and destructive forward migration.

IMPORTANT LIMITS:
- Migration files are committed but are not an applied production migration.
- No production database was modified by this layer.
- Runtime repository still uses its current in-process/contract adapter path.
- No live outbox/audit persistence, bank callbacks, FGIS or EDO integration is claimed.

STILL LOCKED:
- runtime Postgres repository adapter;
- runtime action/API Postgres wiring;
- production migration execution and rollback rehearsal;
- auth/tenant enforcement changes;
- UI/components;
- package and lockfiles;
- live bank/FGIS/EDO integrations.

NEXT:
- Layer: VP-3.34 Runtime Persistence Postgres Repository Adapter Plan.
- Goal: select the exact Prisma-backed repository, transaction boundary and tests without writing adapter code.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - VP-3.33 schema parses and validates;
  - migration and rollback guard tests are green;
  - no production migration application is claimed;
  - critical forbidden zones remain unchanged;
  - Railway `brilliant-liberation - @pc/web` is green after merge.

AFTER NEXT:
- Layer: VP-3.35 Runtime Persistence Postgres Repository Adapter Scope Unlock.
- Goal: docs-only unlock the exact DB adapter implementation files after the plan is merged.
