# platform-v7 execution queue

CURRENT: VP-3.39 Runtime Persistence Internal Service Wiring Scope Unlock.

GOAL: Docs-only разблокировать четыре точных server-only service/module/test/AppModule файла после merge #2246, без implementation code, controller/API/web route и production migration application.

CURRENT STATUS:
- VP-3.37 Postgres repository adapter is merged from #2245.
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

MANDATORY IMPLEMENTATION RULES:
- Internal Nest module contains no controller or route.
- Service delegates the typed input to `RUNTIME_PERSISTENCE_REPOSITORY` exactly once.
- Disabled/failed repository receipts remain failed; the service cannot convert them into success.
- Repository exceptions propagate and are not swallowed.
- Provider uses existing global `PrismaService` and `selectRuntimePersistenceRepository`.
- AppModule import is server-only and adds no public surface.
- Default startup remains fail-closed; exact Prisma mode remains explicit.
- Request auth/tenant derivation is not implemented in this layer.

STILL LOCKED:
- controller/API endpoint;
- web server-action bridge;
- production migration execution and rollback rehearsal;
- auth/tenant request derivation;
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
  - four implementation files remain unchanged in VP-3.39;
  - no controller or public route is introduced;
  - fail-closed provider behavior remains explicit;
  - guard, loop dry-run, CodeQL, Qodana, Security Scan and Security Quality Gate all complete with `success` before merge.

AFTER NEXT:
- Layer: VP-3.41 Runtime Persistence Internal Service Wiring Implementation.
- Goal: implement the exact four server-only wiring files after the final gate is merged.
