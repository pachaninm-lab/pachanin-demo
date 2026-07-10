# platform-v7 execution queue

CURRENT: VP-3.36 Runtime Persistence Postgres Repository Adapter Final Gate.

GOAL: Финально зафиксировать manual code PR gate для пяти API-side repository/test файлов после merge #2243, без adapter code, module/controller/API wiring и production migration application.

CURRENT STATUS:
- VP-3.33 additive Prisma schema/migration is merged from #2241.
- VP-3.34 adapter plan is merged from #2242.
- VP-3.35 scope unlock is merged from #2243.
- Railway `brilliant-liberation - @pc/web` is green after #2243.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

MANUAL CODE PR SCOPE AFTER THIS GATE:
- `apps/api/src/modules/runtime-persistence/runtime-persistence.repository.ts`
- `apps/api/src/modules/runtime-persistence/prisma-runtime-persistence.repository.ts`
- `apps/api/src/modules/runtime-persistence/runtime-persistence-repository.factory.ts`
- `apps/api/src/modules/runtime-persistence/runtime-persistence-repository.spec.ts`
- `apps/api/src/modules/runtime-persistence/prisma-runtime-persistence.repository.spec.ts`

FINAL IMPLEMENTATION INVARIANTS:
- API-side only; Prisma is never imported by web/browser code.
- Exact `PLATFORM_V7_RUNTIME_PERSISTENCE_REPOSITORY=prisma` activation.
- Default and unrelated modes are fail-closed with no silent process-store fallback.
- Missing PrismaService fails before a write.
- Caller cannot submit trusted evidence database IDs.
- One `$transaction` owns canonical outbox, audit, snapshot and attempt writes.
- First write becomes `fully_linked` only inside that successful transaction.
- Identical replay returns duplicate with no additional rows.
- Material identity mismatch returns conflict with no additional rows.
- Transaction failure leaves no partial evidence.
- Raw database errors are not exposed.

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
- Layer: VP-3.37 Runtime Persistence Postgres Repository Adapter Implementation.
- Goal: prepare the manual code implementation after this gate is merged.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - final gate closes without adapter code changes;
  - next manual code PR explicitly expands current scope to the exact five files;
  - critical forbidden zones remain unchanged;
  - maturity language does not claim an active Postgres adapter.

AFTER NEXT:
- Layer: VP-3.38 Runtime Persistence Internal Service Wiring Plan.
- Goal: select server-only module/service provider wiring after the repository adapter implementation is merged and validated.
