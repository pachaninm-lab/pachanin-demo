# platform-v7 execution queue

CURRENT: VP-3.39 Runtime Persistence Internal Service Wiring Scope Unlock.

GOAL: Docs-only разблокировать точный four-file scope для server-only Nest wiring после merge #2246, без implementation code, controller/API/web route и production migration application.

CURRENT STATUS:
- VP-3.33 additive Prisma schema/migration is merged from #2241.
- VP-3.37 API-side Postgres repository adapter is merged from #2245.
- VP-3.38 internal service wiring plan is merged from #2246.
- Railway `brilliant-liberation - @pc/web` is green after #2246.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

UNLOCKED IMPLEMENTATION FILES FOR LATER CODE PR:
- `apps/api/src/modules/runtime-persistence/runtime-persistence.service.ts`
- `apps/api/src/modules/runtime-persistence/runtime-persistence.module.ts`
- `apps/api/src/modules/runtime-persistence/runtime-persistence.service.spec.ts`
- `apps/api/src/app.module.ts`

IMPLEMENTATION INVARIANTS:
- Service injects `RUNTIME_PERSISTENCE_REPOSITORY` and delegates one typed internal persist operation.
- Module provides the token using existing global `PrismaService` and `selectRuntimePersistenceRepository`.
- AppModule import is server dependency-graph registration only.
- Module contains no controller and exposes no route.
- Exact `prisma` mode remains required; default disabled mode remains fail-closed.
- No HTTP request object or caller-supplied evidence IDs enter the service.
- Repository failures are not converted into success.
- No package/lockfile or migration change.

STILL LOCKED:
- controller/API endpoint;
- web server-action bridge;
- production migration execution and rollback rehearsal;
- request auth/tenant derivation;
- UI/components;
- package and lockfiles;
- live bank/FGIS/EDO integrations.

NEXT:
- Layer: VP-3.40 Runtime Persistence Internal Service Wiring Final Gate.
- Goal: final docs-only gate before writing the four internal wiring files.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - exact four-file scope remains unchanged;
  - future module has no controllers;
  - critical forbidden zones remain unchanged;
  - production migration remains unapplied;
  - maturity language does not claim externally exposed runtime persistence.

AFTER NEXT:
- Layer: VP-3.41 Runtime Persistence Internal Service Wiring Implementation.
- Goal: implement and test server-only service/module/AppModule wiring after the final gate is merged.
