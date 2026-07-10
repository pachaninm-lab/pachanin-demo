# platform-v7 execution queue

CURRENT: VP-3.26 Runtime Persistence Transaction and Idempotency Hardening Plan.

GOAL: Выбрать точный contract-level scope для monotonic linkage promotion, idempotency conflict detection, transaction coordination, retry и partial-failure semantics после merge #2233, без Prisma/migrations и без claims о реальной DB-транзакции.

CURRENT STATUS:
- VP-3.13 repository adapter is merged from #2221.
- VP-3.17 runtime action pipeline binding is merged from #2225.
- VP-3.21 typed outbox/audit linkage boundary is merged from #2229.
- VP-3.25 validated pipeline linkage binding is merged from #2233.
- Current repository returns the first receipt on duplicate idempotency and does not promote later validated linkage evidence.
- Existing generic runtime ports already define `P7RuntimeTransactionContext`, `P7IdempotencyStore` and `P7RuntimeUnitOfWork.runInTransaction`; the new layer must align with those contracts instead of creating a parallel transaction model.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

CANDIDATE IMPLEMENTATION FILES FOR LATER CODE PR:
- `apps/web/lib/platform-v7/deal-workspace-runtime-db-repository.ts`
- `apps/web/lib/platform-v7/deal-workspace-runtime-linkage.ts`
- `apps/web/lib/platform-v7/deal-workspace-runtime-transaction.ts`
- `apps/web/tests/unit/platformV7DealWorkspaceRuntimeRepositoryAdapter.test.ts`
- `apps/web/tests/unit/platformV7DealWorkspaceRuntimeLinkage.test.ts`
- `apps/web/tests/unit/platformV7DealWorkspaceRuntimeTransaction.test.ts`

HARDENING INVARIANTS:
- Same `idempotencyKey` and same `runtimeSnapshotId` may monotonically promote one existing record:
  - `outbox_required` → `audit_required` → `fully_linked`.
- Promotion must update the same record identity and must not append a second evidence record.
- Linkage state must never regress.
- Existing accepted outbox/audit IDs must not be replaced by different IDs on replay.
- Same `idempotencyKey` with a different `runtimeSnapshotId` or materially different contract must return conflict, not duplicate success.
- First record identity and original creation timestamp must remain stable during promotion.
- Duplicate replay without stronger evidence returns a duplicate-safe receipt without mutation.
- Contract-level transaction coordinator must define prepare, commit, rollback and failed outcomes.
- Partial failure must not expose a successful commit receipt.
- Retry after rollback or transient failure must be deterministic and use the original idempotency identity.
- No code may claim database atomicity before a real Postgres transaction exists.

STILL LOCKED:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**`
- `apps/web/app/platform-v7/**`
- `apps/web/components/platform-v7/**`
- `apps/web/app/api/**`
- `apps/api/src/modules/auth/**`
- package and lockfiles

NEXT:
- Layer: VP-3.27 Runtime Persistence Transaction and Idempotency Scope Unlock.
- Goal: docs-only unlock the exact six hardening files.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - candidate implementation files remain unchanged in VP-3.26;
  - critical forbidden zones remain unchanged;
  - Prisma schema and migrations remain locked;
  - guard, dry-run and security checks remain green;
  - maturity language remains platform-temporarily-without-external-integrations.

AFTER NEXT:
- Layer: VP-3.28 Runtime Persistence Transaction and Idempotency Final Gate.
- Goal: final docs-only gate before hardening implementation.
