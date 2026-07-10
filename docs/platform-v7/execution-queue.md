# platform-v7 execution queue

CURRENT: VP-3.31 Runtime Persistence Prisma Schema and Migration Scope Unlock.

GOAL: Docs-only разблокировать точные schema, migration, rollback и validation files после merge #2238, не меняя их содержимое в этом слое и не заявляя применённую production migration.

CURRENT STATUS:
- VP-3.29 transaction/idempotency hardening is merged from #2237.
- VP-3.30 Prisma schema and migration plan is merged from #2238.
- Existing canonical Deal, OutboxEntry and AuditEvent models must be reused.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

UNLOCKED IMPLEMENTATION FILES FOR LATER CODE PR:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/contracts/deal_workspace_runtime_snapshots.sql`
- `apps/api/prisma/migrations/20260710060000_deal_workspace_runtime_persistence/migration.sql`
- `apps/api/prisma/migrations/20260710060000_deal_workspace_runtime_persistence/rollback.sql`
- `apps/web/tests/unit/platformV7DealWorkspaceRuntimePrismaSchema.test.ts`

MANDATORY IMPLEMENTATION RULES:
- Migration is additive and reuses existing Deal/OutboxEntry/AuditEvent tables.
- New runtime snapshot and transaction attempt tables require explicit checks, foreign keys, unique keys and operational indexes.
- No audit link without an outbox link.
- Linkage columns and state must be DB-consistent.
- Foreign keys preserve evidence with restrictive deletion.
- Existing outbox/audit rows need no data backfill.
- Rollback removes only migration-owned objects in dependency-safe order.
- Merge of migration files does not mean production migration has been applied.

STILL LOCKED:
- runtime Postgres repository adapter;
- runtime action/API wiring;
- auth/tenant enforcement changes;
- UI/components;
- package and lockfiles;
- live bank/FGIS/EDO integrations.

NEXT:
- Layer: VP-3.32 Runtime Persistence Prisma Schema and Migration Final Gate.
- Goal: final docs-only gate before writing schema and migration code.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - unlocked implementation files remain unchanged in VP-3.31;
  - critical forbidden zones remain unchanged;
  - guard, dry-run and security checks remain green;
  - maturity language does not claim an applied migration.

AFTER NEXT:
- Layer: VP-3.33 Runtime Persistence Prisma Schema and Migration Implementation.
- Candidate code files are the five exact files listed above.
