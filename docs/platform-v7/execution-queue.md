# platform-v7 execution queue

CURRENT: VP-3.29 Runtime Persistence Transaction and Idempotency Hardening Implementation.

GOAL: Реализовать contract-level monotonic linkage promotion, idempotency conflict detection, transaction coordination, retry и partial-failure semantics после merge #2236, без Prisma/migrations и без claims о реальной DB-транзакции.

CURRENT STATUS:
- VP-3.25 validated pipeline linkage binding is merged from #2233.
- VP-3.26 transaction and idempotency hardening plan is merged from #2234.
- VP-3.28 final hardening gate is merged from #2236.
- VP-3.29 adds a strict hardened repository path and a separate contract-level transaction coordinator.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- apps/web/lib/platform-v7/deal-workspace-runtime-db-repository.ts
- apps/web/lib/platform-v7/deal-workspace-runtime-linkage.ts
- apps/web/lib/platform-v7/deal-workspace-runtime-transaction.ts
- apps/web/tests/unit/platformV7DealWorkspaceRuntimeRepositoryAdapter.test.ts
- apps/web/tests/unit/platformV7DealWorkspaceRuntimeLinkage.test.ts
- apps/web/tests/unit/platformV7DealWorkspaceRuntimeTransaction.test.ts

IMPLEMENTED:
- Backward-compatible `repository.write` remains duplicate-safe for the current runtime action pipeline.
- Strict `repository.writeHardened` supports one-record monotonic promotion:
  - `outbox_required` → `audit_required` → `fully_linked`.
- Promotion preserves original record identity and creation timestamp.
- Weaker replay cannot regress state or remove accepted linkage evidence.
- Accepted outbox and audit IDs cannot be replaced by different IDs.
- Same idempotency key with another runtime snapshot or material contract returns explicit conflict.
- Transaction coordinator exposes deterministic stages:
  - `created`;
  - `prepared`;
  - `committed`;
  - `rolled_back`;
  - `failed`.
- Prepare validates transaction correlation, audit and actor identity plus linkage validity.
- Commit uses the strict hardened repository path.
- Commit replay returns the same committed receipt without a second write.
- Rollback and pre-commit failure create no repository record.
- Deterministic retry after failure can commit using the original idempotency identity.

KNOWN LIMITATION:
- The current server action pipeline still uses backward-compatible `repository.write` because the process runtime store creates a new runtime snapshot version on every replay.
- Strict `writeHardened` is used by the new transaction coordinator and tests, but should not replace the action path until stable DB-backed snapshot identity is implemented.
- This layer does not provide database atomicity. It is a contract-level coordinator and in-process repository implementation.

STILL LOCKED:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**`
- `apps/web/app/platform-v7/**`
- `apps/web/components/platform-v7/**`
- `apps/web/app/api/**`
- `apps/api/src/modules/auth/**`
- package and lockfiles

NEXT:
- Layer: VP-3.30 Runtime Persistence Prisma Schema and Migration Plan.
- Goal: select exact production DB tables, columns, indexes, constraints, migration and rollback scope after VP-3.29 is merged and tested.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - VP-3.29 hardening is merged and tested;
  - no Prisma schema or migration changes occur in VP-3.29;
  - critical forbidden zones remain unchanged;
  - guard, dry-run, web-unit, CI and security checks stay green;
  - maturity language remains platform-temporarily-without-external-integrations.
