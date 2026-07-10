# platform-v7 execution queue

CURRENT: VP-3.38 Runtime Persistence Internal Service Wiring Plan.

GOAL: Выбрать точный server-only Nest service/module scope после merge #2245, без controller/API/web route и без применения migration к production DB.

CURRENT STATUS:
- VP-3.33 additive Prisma schema/migration is merged from #2241.
- VP-3.37 API-side Postgres repository adapter is merged from #2245.
- Railway `brilliant-liberation - @pc/web` is green after #2245.
- `PrismaModule` is global and already imported by `AppModule`.
- `AppAuthGuard` is global, but this layer intentionally creates no controller.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

CANDIDATE IMPLEMENTATION FILES FOR LATER CODE PR:
- `apps/api/src/modules/runtime-persistence/runtime-persistence.service.ts`
- `apps/api/src/modules/runtime-persistence/runtime-persistence.module.ts`
- `apps/api/src/modules/runtime-persistence/runtime-persistence.service.spec.ts`
- `apps/api/src/app.module.ts`

TARGET INTERNAL WIRING:
- `RuntimePersistenceService` injects `RUNTIME_PERSISTENCE_REPOSITORY` and delegates one internal `persist` operation.
- Service accepts only the typed internal repository input; it does not accept HTTP request objects or client-provided evidence IDs.
- `RuntimePersistenceModule` creates the repository provider with the existing global `PrismaService` and `selectRuntimePersistenceRepository`.
- Module exports `RuntimePersistenceService` and the repository token for future server-only consumers.
- `AppModule` imports `RuntimePersistenceModule` so dependency graph/startup validation occurs in deployed API builds.
- No controller, route, DTO, public decorator, SSE stream or web server action is added.
- Default startup remains safe because non-`prisma` mode binds the disabled fail-closed repository.
- Exact `prisma` mode with missing PrismaService fails startup rather than silently degrading.

TEST REQUIREMENTS:
- Service delegates the exact typed input once and returns repository receipt unchanged.
- Service does not synthesize or accept trusted evidence IDs.
- Disabled repository result remains visible to internal caller; service must not convert it into success.
- Repository exception is not swallowed or reclassified as a successful receipt.
- API typecheck confirms AppModule import and provider graph compile without package changes.

STILL LOCKED:
- controller/API endpoint;
- web server-action bridge;
- production migration execution and rollback rehearsal;
- request auth/tenant derivation;
- UI/components;
- package and lockfiles;
- live bank/FGIS/EDO integrations.

NEXT:
- Layer: VP-3.39 Runtime Persistence Internal Service Wiring Scope Unlock.
- Goal: docs-only unlock the exact four service/module/test/AppModule files.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - future module has no controllers;
  - AppModule registration is server-only;
  - fail-closed activation remains unchanged;
  - no implementation files change in VP-3.38;
  - guard, dry-run and security checks remain green.

AFTER NEXT:
- Layer: VP-3.40 Runtime Persistence Internal Service Wiring Final Gate.
- Goal: final docs-only gate before internal wiring implementation.
