# platform-v7 execution queue

CURRENT: VP-3.28 Runtime Persistence Transaction and Idempotency Final Gate.

GOAL: Финально зафиксировать manual code PR gate для contract-level monotonic linkage promotion, idempotency conflict detection, transaction coordination, retry и partial-failure semantics после merge #2235, без Prisma/migrations и без claims о реальной DB-транзакции.

CURRENT STATUS:
- VP-3.25 validated pipeline linkage binding is merged from #2233.
- VP-3.26 transaction and idempotency hardening plan is merged from #2234.
- VP-3.27 hardening scope unlock is merged from #2235.
- Current repository still requires monotonic promotion and contract conflict protection.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

MANUAL CODE PR SCOPE AFTER THIS GATE:
- `apps/web/lib/platform-v7/deal-workspace-runtime-db-repository.ts`
- `apps/web/lib/platform-v7/deal-workspace-runtime-linkage.ts`
- `apps/web/lib/platform-v7/deal-workspace-runtime-transaction.ts`
- `apps/web/tests/unit/platformV7DealWorkspaceRuntimeRepositoryAdapter.test.ts`
- `apps/web/tests/unit/platformV7DealWorkspaceRuntimeLinkage.test.ts`
- `apps/web/tests/unit/platformV7DealWorkspaceRuntimeTransaction.test.ts`

MANDATORY IMPLEMENTATION RULES:
- Same idempotency key and same runtime snapshot may only promote one existing record monotonically.
- Promotion must preserve record identity and original creation timestamp.
- State and accepted evidence IDs must never regress or be replaced.
- Same idempotency key with different snapshot or material contract mismatch must return conflict.
- Duplicate replay without stronger evidence remains read-only.
- Prepare, commit, rollback and failed outcomes must be explicit.
- Partial failure must not expose a committed receipt.
- Retry after rollback must be deterministic.
- Implementation remains contract-level and must not claim database atomicity.

STILL LOCKED:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**`
- `apps/web/app/platform-v7/**`
- `apps/web/components/platform-v7/**`
- `apps/web/app/api/**`
- `apps/api/src/modules/auth/**`
- package and lockfiles

NEXT:
- Layer: VP-3.29 Runtime Persistence Transaction and Idempotency Hardening Implementation.
- Goal: prepare the manual implementation layer after this final gate is merged.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - final gate closes without hardening code changes;
  - next manual code PR explicitly expands current scope to the six approved files;
  - critical forbidden zones remain unchanged;
  - Prisma schema and migrations remain locked;
  - maturity language remains platform-temporarily-without-external-integrations.

AFTER NEXT:
- Layer: VP-3.30 Runtime Persistence Prisma Schema and Migration Plan.
- Goal: assess exact production DB schema, indexes, constraints and migration scope after hardening implementation is merged.
