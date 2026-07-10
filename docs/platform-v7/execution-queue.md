# platform-v7 execution queue

CURRENT: VP-3.37 Runtime Persistence Postgres Repository Adapter Implementation.

GOAL: Реализовать API-side Prisma repository adapter после merge #2244, без module/controller/API/web wiring и без применения migration к production DB.

CURRENT STATUS:
- VP-3.33 additive Prisma schema/migration is merged from #2241.
- VP-3.36 final gate is merged from #2244.
- VP-3.37 implements the repository contract, Prisma adapter, explicit factory and unit tests in PR #2245.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- apps/api/src/modules/runtime-persistence/runtime-persistence.repository.ts
- apps/api/src/modules/runtime-persistence/prisma-runtime-persistence.repository.ts
- apps/api/src/modules/runtime-persistence/runtime-persistence-repository.factory.ts
- apps/api/src/modules/runtime-persistence/runtime-persistence-repository.spec.ts
- apps/api/src/modules/runtime-persistence/prisma-runtime-persistence.repository.spec.ts

IMPLEMENTED:
- Typed API-side repository contract and injection token.
- Fail-closed disabled repository; no process-store fallback.
- Exact `PLATFORM_V7_RUNTIME_PERSISTENCE_REPOSITORY=prisma` activation.
- Missing PrismaService fails loudly before writes.
- Caller input has no trusted outbox/audit database IDs.
- Existing idempotency identity is read before write:
  - matching snapshot/hash returns deterministic `duplicate`;
  - different snapshot/hash returns `conflict`.
- First write runs one Prisma `$transaction` and creates:
  - canonical `outbox_entries` evidence;
  - canonical `audit_events` evidence;
  - `fully_linked` runtime snapshot referencing generated evidence IDs;
  - committed transaction attempt.
- Any transaction failure returns controlled `database_write_failed`; raw DB errors are not exposed.
- Concurrent P2002 is re-read and classified as duplicate or conflict.
- Tests cover fail-closed selection, exact activation, atomic success, caller evidence injection, duplicate, conflict, concurrent winner, invalid input and rollback simulation.

IMPORTANT LIMITS:
- The adapter is implemented but not registered in a Nest module or active runtime path.
- Production migration is not applied.
- No controller, API endpoint or web action calls this repository.
- Tenant/auth identity is accepted by the internal contract but enforcement remains a later server wiring layer.
- No live bank callbacks, FGIS or EDO integration is claimed.

STILL LOCKED:
- runtime persistence module/service/controller/API endpoint;
- AppModule registration;
- web server-action bridge;
- production migration execution and rollback rehearsal;
- auth/tenant enforcement changes;
- UI/components;
- package and lockfiles;
- live bank/FGIS/EDO integrations.

NEXT:
- Layer: VP-3.38 Runtime Persistence Internal Service Wiring Plan.
- Goal: select exact server-only module/service/provider wiring after VP-3.37 is merged and tested.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - API and unit tests validate adapter behavior;
  - TypeScript and Prisma delegates compile;
  - no module/controller/web wiring occurs in VP-3.37;
  - no production migration application is claimed;
  - Railway `brilliant-liberation - @pc/web` is green after merge.

AFTER NEXT:
- Layer: VP-3.39 Runtime Persistence Internal Service Wiring Scope Unlock.
- Goal: docs-only unlock exact provider/module/service files after the plan is merged.
