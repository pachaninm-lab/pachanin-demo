# platform-v7 execution queue

CURRENT: VP-3.30 Runtime Persistence Prisma Schema and Migration Plan.

GOAL: Выбрать точную additive Prisma schema и migration-модель для DB-backed runtime persistence после merge #2237, не применяя migration и не подключая runtime repository к Postgres в этом слое.

CURRENT STATUS:
- VP-3.29 contract-level transaction and idempotency hardening is merged from #2237.
- Existing Prisma schema already contains canonical `Deal`, `OutboxEntry` and `AuditEvent` models.
- Existing `apps/api/prisma/contracts/deal_workspace_runtime_snapshots.sql` is contract-only and has not been applied as a production migration.
- A parallel outbox or audit table is forbidden; runtime persistence must link to the existing canonical tables.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

CANDIDATE IMPLEMENTATION FILES FOR LATER CODE PR:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/contracts/deal_workspace_runtime_snapshots.sql`
- `apps/api/prisma/migrations/20260710060000_deal_workspace_runtime_persistence/migration.sql`
- `apps/api/prisma/migrations/20260710060000_deal_workspace_runtime_persistence/rollback.sql`
- `apps/web/tests/unit/platformV7DealWorkspaceRuntimePrismaSchema.test.ts`

TARGET DATA MODEL:
- New canonical model/table `DealWorkspaceRuntimeSnapshot` / `deal_workspace_runtime_snapshots`.
- New append-only model/table `DealWorkspaceRuntimeTransactionAttempt` / `deal_workspace_runtime_transaction_attempts`.
- `DealWorkspaceRuntimeSnapshot` links to existing:
  - `Deal` through `dealId`;
  - `OutboxEntry` through optional unique `outboxEntryId`;
  - `AuditEvent` through optional unique `auditEventId`.
- `OutboxEntry` and `AuditEvent` receive additive correlation/runtime linkage fields rather than duplicate replacement tables.

REQUIRED SNAPSHOT FIELDS:
- internal primary key;
- unique `runtimeSnapshotId`;
- unique `idempotencyKey`;
- `dealId`, `intentId`, `state`, `snapshotState`, `statusLabel`;
- `runtimeStoreRecordId`, `runtimeStoreVersion`;
- `actorId`, `actorRole`, `correlationId`, `auditId`;
- material `contractHash` for DB conflict detection;
- JSON payload;
- optional unique outbox/audit foreign keys;
- optimistic `version` greater than zero;
- immutable `createdAt` and mutable `updatedAt`.

REQUIRED TRANSACTION ATTEMPT FIELDS:
- unique `transactionId`;
- snapshot foreign key;
- idempotency and correlation identity;
- stage/outcome/failure code/failure reason;
- replay flag;
- started/completed timestamps;
- JSON metadata for operational recovery.

DATABASE CONSTRAINTS:
- state CHECK: `ready_to_persist | outbox_required | audit_required | fully_linked`.
- snapshot state CHECK: `updated | blocked | duplicate | failed`.
- transaction stage CHECK: `created | prepared | committed | rolled_back | failed`.
- linkage consistency CHECK:
  - no audit link without outbox link;
  - `ready_to_persist` and `outbox_required` have no links;
  - `audit_required` has outbox and no audit;
  - `fully_linked` has both links.
- unique runtime snapshot, idempotency key, outbox link, audit link and transaction id.
- foreign keys use restrictive deletion for evidence preservation.
- indexes cover deal timeline, intent/state, correlation, transaction stage and retry/recovery lookup.

MIGRATION RULES:
- Additive only; no destructive rename or drop.
- Existing deals/outbox/audit rows require no backfill to deploy the new tables.
- Added columns on existing outbox/audit tables must be nullable initially and indexed where operationally required.
- Migration SQL must be idempotency-aware and include explicit CHECK/FK/index names.
- `rollback.sql` is operational documentation and must remove only objects introduced by this migration in dependency-safe order.
- Applying migration to production is a separate controlled deployment step with backup, dry-run and rollback readiness.

STILL LOCKED:
- runtime repository Postgres adapter;
- runtime action/API wiring;
- auth and tenant enforcement changes;
- UI/components;
- package and lockfiles;
- live bank/FGIS/EDO integrations.

NEXT:
- Layer: VP-3.31 Runtime Persistence Prisma Schema and Migration Scope Unlock.
- Goal: docs-only unlock the exact five schema/migration validation files.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - schema and migration files remain unchanged in VP-3.30;
  - existing canonical Deal/OutboxEntry/AuditEvent models are reused;
  - critical forbidden zones remain unchanged;
  - guard, dry-run and security checks remain green;
  - maturity language does not claim an applied production migration.

AFTER NEXT:
- Layer: VP-3.32 Runtime Persistence Prisma Schema and Migration Final Gate.
- Goal: final docs-only gate before schema/migration implementation.
