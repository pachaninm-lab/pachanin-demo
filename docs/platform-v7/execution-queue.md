# platform-v7 execution queue

CURRENT: VP-3.37 Runtime Persistence Postgres Repository Adapter Implementation.

GOAL: Реализовать server-only Prisma repository adapter для runtime persistence после merge #2244, без module/controller/API wiring, без применения production migration и без импорта Prisma в web/browser code.

CURRENT STATUS:
- VP-3.33 additive Prisma schema/migration is merged from #2241.
- VP-3.34 adapter plan is merged from #2242.
- VP-3.35 scope unlock is merged from #2243.
- VP-3.36 final gate is merged from #2244.
- Railway `brilliant-liberation - @pc/web` is green after #2244.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- apps/api/src/modules/runtime-persistence/runtime-persistence.repository.ts
- apps/api/src/modules/runtime-persistence/prisma-runtime-persistence.repository.ts
- apps/api/src/modules/runtime-persistence/runtime-persistence-repository.factory.ts
- apps/api/src/modules/runtime-persistence/runtime-persistence-repository.spec.ts
- apps/api/src/modules/runtime-persistence/prisma-runtime-persistence.repository.spec.ts

IMPLEMENTED:
- Typed API-side repository contract and sanitized repository errors.
- Explicit activation only for `PLATFORM_V7_RUNTIME_PERSISTENCE_REPOSITORY=prisma`.
- Fail-closed behavior for missing/unrelated mode and missing Prisma client.
- One `$transaction` creates canonical outbox, audit, fully-linked snapshot and committed attempt.
- Caller input has no trusted evidence database IDs.
- Identical replay returns `duplicate` without additional rows.
- Material identity mismatch returns `conflict` without additional rows.
- Transaction/database failures return sanitized `RUNTIME_PERSISTENCE_WRITE_FAILED`.
- Unit tests cover activation, atomic write, duplicate, conflict and failure behavior.

STILL LOCKED:
- runtime persistence Nest module/service provider;
- controller or external API endpoint;
- AppModule registration;
- web server-action bridge;
- production migration execution and rollback rehearsal;
- auth/tenant enforcement changes;
- UI/components;
- package and lockfiles;
- live bank/FGIS/EDO integrations.

GUARDRAILS:
- Prisma remains API-side only.
- No silent fallback to process memory.
- No caller-supplied outbox/audit IDs.
- No partial evidence outside `$transaction`.
- No raw database error exposure.
- No production DB activation claim.
- Critical forbidden zones remain unchanged.

NEXT:
- Layer: VP-3.38 Runtime Persistence Internal Service Wiring Plan.
- Goal: select exact server-only module/service provider wiring after VP-3.37 is merged and validated.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - adapter implementation and API tests are green;
  - no module/controller/API wiring is introduced in VP-3.37;
  - production migration remains unapplied;
  - critical forbidden zones remain unchanged;
  - maturity language does not claim active production Postgres writes.

AFTER NEXT:
- Layer: VP-3.39 Runtime Persistence Internal Service Wiring Scope Unlock.
- Goal: docs-only unlock exact Nest module/provider files selected by VP-3.38.
