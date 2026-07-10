# platform-v7 execution queue

CURRENT: VP-3.27 Runtime Persistence Transaction and Idempotency Scope Unlock.

GOAL: Docs-only разблокировать точные files для monotonic linkage promotion, idempotency conflict detection, transaction coordination, retry и partial-failure semantics после merge #2234, без Prisma/migrations и без claims о реальной DB-транзакции.

CURRENT STATUS:
- VP-3.25 validated pipeline linkage binding is merged from #2233.
- VP-3.26 transaction and idempotency hardening plan is merged from #2234.
- Current repository still returns the first receipt on duplicate idempotency and does not promote stronger later linkage evidence.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

UNLOCKED IMPLEMENTATION FILES FOR LATER CODE PR:
- `apps/web/lib/platform-v7/deal-workspace-runtime-db-repository.ts`
- `apps/web/lib/platform-v7/deal-workspace-runtime-linkage.ts`
- `apps/web/lib/platform-v7/deal-workspace-runtime-transaction.ts`
- `apps/web/tests/unit/platformV7DealWorkspaceRuntimeRepositoryAdapter.test.ts`
- `apps/web/tests/unit/platformV7DealWorkspaceRuntimeLinkage.test.ts`
- `apps/web/tests/unit/platformV7DealWorkspaceRuntimeTransaction.test.ts`

MANDATORY INVARIANTS:
- Same idempotency key and same runtime snapshot may only promote one existing record monotonically.
- Promotion must not append a second record or change original record identity/creation timestamp.
- Linkage state and accepted evidence IDs must not regress or be replaced.
- Same idempotency key with a different snapshot or material contract mismatch must return conflict.
- Duplicate replay without stronger evidence must remain read-only.
- Prepare/commit/rollback/failure outcomes must be explicit and deterministic.
- Partial failure must not expose committed state.
- This remains contract-level hardening, not a real database transaction.

STILL LOCKED:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**`
- `apps/web/app/platform-v7/**`
- `apps/web/components/platform-v7/**`
- `apps/web/app/api/**`
- `apps/api/src/modules/auth/**`
- package and lockfiles

NEXT:
- Layer: VP-3.28 Runtime Persistence Transaction and Idempotency Final Gate.
- Goal: final docs-only gate before writing hardening code in the six exact files.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - hardening files remain unchanged in VP-3.27;
  - critical forbidden zones remain unchanged;
  - Prisma schema and migrations stay locked;
  - guard, dry-run and security checks remain green;
  - maturity language remains platform-temporarily-without-external-integrations.

AFTER NEXT:
- Layer: VP-3.29 Runtime Persistence Transaction and Idempotency Hardening Implementation.
- Candidate code files are the six exact files listed above.
