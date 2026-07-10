# platform-v7 execution queue

CURRENT: VP-3.32 Runtime Persistence Prisma Schema and Migration Final Gate.

GOAL: Финально зафиксировать manual code PR gate для additive Prisma schema, migration, rollback и validation test после merge #2239, без применения migration и без runtime Postgres wiring.

CURRENT STATUS:
- VP-3.29 transaction/idempotency hardening is merged from #2237.
- VP-3.30 Prisma schema/migration plan is merged from #2238.
- VP-3.31 schema/migration scope unlock is merged from #2239.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

MANUAL CODE PR SCOPE AFTER THIS GATE:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/contracts/deal_workspace_runtime_snapshots.sql`
- `apps/api/prisma/migrations/20260710060000_deal_workspace_runtime_persistence/migration.sql`
- `apps/api/prisma/migrations/20260710060000_deal_workspace_runtime_persistence/rollback.sql`
- `apps/web/tests/unit/platformV7DealWorkspaceRuntimePrismaSchema.test.ts`

MANDATORY RULES:
- Additive schema only; canonical Deal/OutboxEntry/AuditEvent are reused.
- Runtime snapshot and append-only transaction attempt models require explicit unique, check, foreign-key and index constraints.
- Linkage state and outbox/audit foreign keys must be DB-consistent.
- Restrictive deletion preserves evidence.
- Existing data requires no mandatory backfill for deployment.
- Rollback removes only migration-owned objects in dependency-safe order.
- Merged migration files are not an applied production migration.

STILL LOCKED:
- runtime Postgres repository adapter;
- runtime action/API wiring;
- auth/tenant enforcement changes;
- UI/components;
- package and lockfiles;
- live bank/FGIS/EDO integrations.

NEXT:
- Layer: VP-3.33 Runtime Persistence Prisma Schema and Migration Implementation.
- Goal: prepare the manual schema/migration implementation layer after this gate is merged.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - final gate closes without schema/migration code changes;
  - next manual code PR explicitly expands current scope to the five approved files;
  - critical forbidden zones remain unchanged;
  - maturity language does not claim an applied production migration.

AFTER NEXT:
- Layer: VP-3.34 Runtime Persistence Postgres Repository Adapter Plan.
- Goal: select exact DB-backed repository adapter scope after schema/migration implementation is merged and validated.
