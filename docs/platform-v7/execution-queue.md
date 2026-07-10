# platform-v7 execution queue

CURRENT: VP-3.34 Runtime Persistence Postgres Repository Adapter Plan.

GOAL: Выбрать точный API-side Prisma repository adapter scope после merge #2241, без adapter code, AppModule/controller/web wiring и без применения migration к production DB.

CURRENT STATUS:
- VP-3.29 transaction/idempotency hardening is merged from #2237.
- VP-3.33 additive Prisma schema/migration implementation is merged from #2241.
- Railway `brilliant-liberation - @pc/web` is green after #2241.
- `PrismaService` already exists as a global NestJS provider in `apps/api`.
- Prisma must not be imported into the Next.js client or shared browser bundle.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

CANDIDATE IMPLEMENTATION FILES FOR LATER CODE PR:
- `apps/api/src/modules/runtime-persistence/runtime-persistence.repository.ts`
- `apps/api/src/modules/runtime-persistence/prisma-runtime-persistence.repository.ts`
- `apps/api/src/modules/runtime-persistence/runtime-persistence-repository.factory.ts`
- `apps/api/src/modules/runtime-persistence/runtime-persistence-repository.spec.ts`
- `apps/api/src/modules/runtime-persistence/prisma-runtime-persistence.repository.spec.ts`

TARGET ADAPTER CONTRACT:
- Repository is API-side and depends on the existing global `PrismaService`.
- No browser/client import path may reference Prisma or the API repository implementation.
- Activation is explicit only through `PLATFORM_V7_RUNTIME_PERSISTENCE_REPOSITORY=prisma`.
- Default and unrelated flag values are fail-closed; there is no silent fallback to the process runtime store.
- Missing PrismaService fails loudly before a write is attempted.
- Public/API callers cannot supply trusted outbox or audit database IDs.
- Input carries business identity and payload only: runtime snapshot identity, deal/intent, actor, correlation, audit identity, idempotency key and contract hash.

ATOMIC WRITE SEMANTICS:
- One `PrismaService.$transaction` owns snapshot, canonical outbox, canonical audit and transaction-attempt writes.
- First successful write creates canonical outbox and audit rows, then a `fully_linked` runtime snapshot and a committed transaction attempt inside the same DB transaction.
- Any failure rolls back all four writes; partial evidence is forbidden.
- Existing idempotency key with identical runtimeSnapshotId and contractHash returns deterministic duplicate without additional rows.
- Existing idempotency key with another runtimeSnapshotId or contractHash returns explicit conflict.
- Existing accepted outbox/audit linkage cannot be replaced.
- Repository result distinguishes `persisted`, `duplicate`, `conflict` and `failed`.
- Database unique/FK/CHECK violations are mapped to controlled repository outcomes; raw database errors are not exposed to clients.

TEST REQUIREMENTS:
- factory defaults fail-closed and selects Prisma only for exact `prisma` mode;
- PrismaService is mandatory for active mode;
- successful path uses exactly one `$transaction`;
- first write creates outbox, audit, snapshot and committed attempt;
- duplicate path creates no rows;
- conflict path creates no rows;
- injected failure proves rollback/no partial writes;
- caller cannot inject outboxEntryId/auditEventId as trusted evidence;
- no package or lockfile change is required.

STILL LOCKED:
- runtime persistence module/controller/API endpoint;
- AppModule registration;
- web server-action bridge;
- production migration execution and rollback rehearsal;
- auth/tenant enforcement changes;
- UI/components;
- package and lockfiles;
- live bank/FGIS/EDO integrations.

NEXT:
- Layer: VP-3.35 Runtime Persistence Postgres Repository Adapter Scope Unlock.
- Goal: docs-only unlock the exact five adapter/test files.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - adapter remains API-side;
  - activation and failure behavior are explicit;
  - transaction/idempotency invariants are complete;
  - no adapter code is written in VP-3.34;
  - guard, dry-run and security checks remain green.

AFTER NEXT:
- Layer: VP-3.36 Runtime Persistence Postgres Repository Adapter Final Gate.
- Goal: final docs-only gate before adapter implementation.
