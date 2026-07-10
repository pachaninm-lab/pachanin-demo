# platform-v7 execution queue

CURRENT: VP-3.42 Runtime Persistence Authenticated Internal Command Boundary.

GOAL: Добавить trusted server-auth boundary перед `RuntimePersistenceService`, чтобы actor, role, tenant и organization не принимались из command payload и неполный контекст блокировался до repository write.

CURRENT STATUS:
- VP-3.33 additive Prisma schema/migration is merged from #2241.
- VP-3.37 API-side Postgres repository adapter is merged from #2245.
- VP-3.41 internal service/module wiring is merged from #2250.
- Railway `brilliant-liberation - @pc/web` is green after #2250.
- Draft #2251 is merge-blocked: it permits user-driven bank confirmations, synthetic bank references and cross-tenant visibility.
- PR #2252 implements only the safe authenticated internal boundary and no public route.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- apps/api/src/modules/runtime-persistence/runtime-persistence-command.service.ts
- apps/api/src/modules/runtime-persistence/runtime-persistence-command.service.spec.ts
- apps/api/src/modules/runtime-persistence/runtime-persistence.module.ts

IMPLEMENTED:
- Command input omits `actorId`, `actorRole`, `tenantId` and `organizationId` at the type boundary.
- Trusted identity fields are populated only from verified `RequestUser`.
- Runtime identity fields supplied through an untyped payload are overwritten by trusted context.
- Missing authenticated user, session, organization or tenant blocks before repository delegation.
- `GUEST` role blocks before repository delegation.
- Failed repository receipts remain failed and are returned unchanged.
- `RuntimePersistenceCommandService` is internal, registered in `RuntimePersistenceModule` and has no controller/route.

STILL LOCKED:
- controller or external API endpoint;
- web server-action bridge;
- bank reserve/release confirmation from user commands;
- production migration execution and rollback rehearsal;
- persistent identity/session/MFA implementation;
- UI/components;
- package and lockfiles;
- live bank/FGIS/EDO integrations.

GUARDRAILS:
- No HTTP request object enters the repository layer.
- No caller-supplied identity or evidence database IDs.
- No missing tenant/session fallback.
- No `ACCOUNTING → bank` authority substitution.
- No synthetic bank references.
- No disabled/failed receipt conversion to success.
- Critical forbidden zones remain unchanged.

NEXT:
- Layer: VP-3.43 RLS Trusted Context Hardening.
- Goal: fix the existing RLS middleware so it reads `orgId`, eliminates `$executeRawUnsafe`, stops silently ignoring context failure and establishes transaction-safe trusted context semantics.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Execution rule:
  - no separate docs-only gate PR;
  - exact middleware/context/test files are selected by read-only audit and added to one manually scoped code PR;
  - auth source-of-truth files remain locked until blocker #2115 is resolved;
  - no controller or money command is introduced.

AFTER NEXT:
- Persistent identity/session/revocation/MFA source of truth.
- Controlled non-production migration dry-run and rollback rehearsal.
- Authenticated DB-backed runtime action bridge without direct bank confirmation.
- Concurrency, retry, recovery, load and restore acceptance gates.
