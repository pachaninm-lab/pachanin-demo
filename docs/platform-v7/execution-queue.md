# platform-v7 execution queue

CURRENT: VP-3.41 Runtime Persistence Internal Service Wiring Implementation.

GOAL: Реализовать и проверить server-only контур `AppModule → RuntimePersistenceModule → RuntimePersistenceService → repository` без controller/API/web route и без применения migration к production DB.

CURRENT STATUS:
- VP-3.33 additive Prisma schema/migration is merged from #2241.
- VP-3.37 API-side Postgres repository adapter is merged from #2245.
- VP-3.38 internal service wiring plan is merged from #2246.
- Duplicate docs-only scope PRs #2248 and #2249 are closed without merge.
- PR #2250 implements the working internal service path directly.
- Railway `brilliant-liberation - @pc/web` is green after #2246.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- apps/api/src/modules/runtime-persistence/runtime-persistence.service.ts
- apps/api/src/modules/runtime-persistence/runtime-persistence.module.ts
- apps/api/src/modules/runtime-persistence/runtime-persistence.service.spec.ts
- apps/api/src/app.module.ts

IMPLEMENTED:
- `RuntimePersistenceService` injects `RUNTIME_PERSISTENCE_REPOSITORY` and delegates one typed `persist` operation.
- `RuntimePersistenceModule` uses existing global `PrismaService` and `selectRuntimePersistenceRepository`.
- Module exports the internal service and repository token and declares no controller.
- `AppModule` imports `RuntimePersistenceModule` for server dependency-graph/startup validation.
- Default mode remains disabled and fail-closed; exact `prisma` feature flag remains required.
- One canonical test deal `deal-canonical-001` validates the internal service path.
- Tests verify exact delegation, unchanged receipts, failed receipt preservation, exception propagation, no caller evidence IDs, no controllers and default fail-closed provider graph.

STILL LOCKED:
- controller or external API endpoint;
- web server-action bridge;
- production migration execution and rollback rehearsal;
- request-derived actor/tenant/organization enforcement;
- UI/components;
- package and lockfiles;
- live bank/FGIS/EDO integrations.

GUARDRAILS:
- No HTTP request object enters the persistence service.
- No caller-supplied outbox/audit database IDs.
- No disabled or failed receipt is converted into success.
- No repository exception is swallowed.
- No process-memory fallback.
- No production Postgres activation claim.
- Critical forbidden zones remain unchanged.

NEXT:
- Layer: VP-3.42 Runtime Persistence Authenticated Internal Command Boundary.
- Goal: after #2250 merge, perform a read-only audit of existing server auth/RLS context and open one manually scoped code PR that derives actor, role, tenant and organization exclusively from trusted server context before invoking `RuntimePersistenceService`.
- Autopilot-safe allowed files before that manual scope is selected:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Execution rule:
  - no separate docs-only gate PR;
  - exact code files are selected by read-only audit and added to the code branch state before writes;
  - no controller or web route until authenticated command tests are green;
  - production migration remains unapplied.

AFTER NEXT:
- Production migration dry-run and rollback rehearsal against a controlled non-production PostgreSQL database.
- DB-backed runtime action bridge with concurrency, retry and recovery tests.
- Removal of process runtime store only after parity and rollback evidence are complete.
