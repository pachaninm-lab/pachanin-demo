# platform-v7 execution queue

CURRENT: VP-3.38 Runtime Persistence Internal Service Wiring Plan.

GOAL: Выбрать точный server-only scope для Nest service/module wiring после merge #2245, без AppModule registration, controller/API endpoint, web bridge и production migration application.

CURRENT STATUS:
- VP-3.33 additive Prisma schema/migration is merged from #2241.
- VP-3.37 API-side Prisma repository adapter is merged from #2245.
- Railway `brilliant-liberation - @pc/web` is green after #2245.
- Repository adapter exists but is not registered in a Nest provider graph.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

CANDIDATE IMPLEMENTATION FILES FOR LATER PR:
- `apps/api/src/modules/runtime-persistence/runtime-persistence.service.ts`
- `apps/api/src/modules/runtime-persistence/runtime-persistence.module.ts`
- `apps/api/src/modules/runtime-persistence/runtime-persistence.service.spec.ts`
- `apps/api/src/modules/runtime-persistence/runtime-persistence.module.spec.ts`

WIRING REQUIREMENTS:
- `RuntimePersistenceService` depends only on the repository injection token.
- `RuntimePersistenceModule` provides the token through the existing repository selector and global `PrismaService`.
- Exact `PLATFORM_V7_RUNTIME_PERSISTENCE_REPOSITORY=prisma` activation remains required.
- Disabled mode remains fail-closed and never writes to process memory.
- Service validates internal caller context before delegating.
- No controller or externally callable route is introduced.
- No AppModule registration is introduced in the implementation layer.
- Raw database errors and Prisma details remain hidden.
- Unit tests verify disabled mode, Prisma mode, missing Prisma failure and delegation behavior.

STILL LOCKED:
- `apps/api/src/app.module.ts`;
- runtime persistence controller or public endpoint;
- web server-action bridge;
- production migration execution and rollback rehearsal;
- auth/tenant enforcement changes outside internal input validation;
- UI/components;
- package and lockfiles;
- live bank/FGIS/EDO integrations.

NEXT:
- Layer: VP-3.39 Runtime Persistence Internal Service Wiring Scope Unlock.
- Goal: docs-only unlock the exact four service/module/test files.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - candidate files are exact and minimal;
  - AppModule/controller/API/web files remain locked;
  - critical forbidden zones remain unchanged;
  - production migration remains unapplied;
  - maturity language does not claim active runtime wiring.

AFTER NEXT:
- Layer: VP-3.40 Runtime Persistence Internal Service Wiring Final Gate.
- Goal: final docs-only gate before writing the four internal wiring files.
