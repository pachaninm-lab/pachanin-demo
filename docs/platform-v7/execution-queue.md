# platform-v7 execution queue

CURRENT: VP-3.35 Runtime Persistence Postgres Repository Adapter Scope Unlock.

GOAL: Docs-only разблокировать пять точных API-side repository/test файлов после merge #2242, не создавая adapter code и не применяя migration.

CURRENT STATUS:
- VP-3.33 additive Prisma schema/migration is merged from #2241.
- VP-3.34 Postgres repository adapter plan is merged from #2242.
- Railway `brilliant-liberation - @pc/web` is green after #2242.
- Adapter remains server-only under `apps/api`.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

UNLOCKED IMPLEMENTATION FILES FOR LATER CODE PR:
- `apps/api/src/modules/runtime-persistence/runtime-persistence.repository.ts`
- `apps/api/src/modules/runtime-persistence/prisma-runtime-persistence.repository.ts`
- `apps/api/src/modules/runtime-persistence/runtime-persistence-repository.factory.ts`
- `apps/api/src/modules/runtime-persistence/runtime-persistence-repository.spec.ts`
- `apps/api/src/modules/runtime-persistence/prisma-runtime-persistence.repository.spec.ts`

MANDATORY IMPLEMENTATION RULES:
- API-side only; no Prisma import through web/browser paths.
- Explicit activation only with `PLATFORM_V7_RUNTIME_PERSISTENCE_REPOSITORY=prisma`.
- Default and unrelated modes fail closed; no silent runtime-store fallback.
- Active Prisma adapter requires `PrismaService` and fails loudly when unavailable.
- Caller input contains no trusted `outboxEntryId` or `auditEventId`.
- One `$transaction` owns canonical outbox, audit, snapshot and attempt creation.
- Successful first write is `fully_linked` only after both canonical evidence rows exist inside the same transaction.
- Duplicate and conflict paths create no additional evidence rows.
- Any write failure rolls back all transaction writes.
- Controlled outcomes do not expose raw DB errors.

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
- Layer: VP-3.36 Runtime Persistence Postgres Repository Adapter Final Gate.
- Goal: final docs-only gate before writing adapter code.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - the five implementation files remain unchanged in VP-3.35;
  - transaction, idempotency and fail-closed rules remain explicit;
  - critical forbidden zones remain unchanged;
  - guard, dry-run and security checks remain green.

AFTER NEXT:
- Layer: VP-3.37 Runtime Persistence Postgres Repository Adapter Implementation.
- Goal: implement the exact five API-side repository/test files after the final gate is merged.
