# platform-v7 Industrial Integration Readiness queue

CURRENT: IR-10.2 Logistics PostgreSQL Authority

GOVERNING SPECIFICATION:
- `docs/platform-v7/autopilot/industrial-integration-readiness-v1.0.md`
- target gate: Industrial Integration-Ready;
- current gate: NO-GO;
- exact baseline: `a485371e54b31fc787c061643c0068184e373c7b` on `main`.

BASELINE PROVEN:
- persistent identity, session rotation/revocation, MFA and one-time backup codes are merged with isolated PostgreSQL evidence (#2276, #2280, #2282, #2283);
- separate restricted auth and deal PostgreSQL principals are merged (#2287);
- canonical Deal command execution, idempotency, optimistic concurrency, bank-callback authority, transactional audit/outbox creation and isolated recovery evidence are merged (#2260, #2270, #2274, #2378, #2406, #2407);
- Documents PostgreSQL Authority is merged (#2410, merge `a485371e54b31fc787c061643c0068184e373c7b`);
- durable PostgreSQL outbox worker mechanics exist, but IR-20 remains open because the legacy process-memory relay still starts;
- PostgreSQL bank reconciliation and callback-key rotation/revocation are merged (#2379);
- CI-scale correctness and isolated backup/restore remain evidence only; they do not prove production capacity, HA or provider DR.

CURRENT GOAL:
- make Logistics PostgreSQL-authoritative by construction;
- remove RuntimeCore, optional Prisma and repository factory selection from the production Logistics graph;
- replace the incomplete Prisma shipment skeleton with a complete trusted-RLS repository;
- normalize carrier, driver, vehicle, route and Deal admission authority in PostgreSQL;
- make shipment facts, audit and PENDING outbox commit atomically;
- persist checkpoint, GPS and driver-verification facts across restart and multiple API instances;
- prove idempotency, optimistic concurrency, exact participant scope and cross-tenant denial;
- keep live GPS/telematics and GIS EPD activation outside this PR.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- apps/api/src/common/config/industrial-mode.ts
- apps/api/src/common/command-execution.context.ts
- apps/api/src/common/prisma/rls-transaction.service.ts
- apps/api/src/modules/deals/deal-command-payload.ts
- apps/api/src/modules/deals/deals.module.ts
- apps/api/src/modules/deals/logistics-admission-context.ts
- apps/api/src/modules/deals/logistics-admission.service.ts
- apps/api/src/modules/deals/postgresql-deal-command.service.ts
- apps/api/src/modules/deals/postgresql-deal-command.service.spec.ts
- apps/api/src/modules/logistics/**
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260713*_logistics_postgresql_authority/**
- apps/api/test/industrial/logistics-postgresql-authority.e2e-spec.ts
- apps/api/test/one-deal/logistics-postgresql-authority.e2e-spec.ts
- apps/api/test/one-deal/seed-logistics-admission.ts
- apps/api/test/one-deal/seed.ts
- infra/sql/postgresql-logistics-authority-policies.sql
- scripts/platform-v7-forward-only-migration-check.mjs
- scripts/platform-v7-one-deal-e2e.sh
- .github/workflows/ci.yml

CURRENT CRITERIA:
- production bootstrap fails before traffic when the shipment repository mode is missing, memory or unknown;
- production LogisticsModule binds a complete Prisma repository and contains no RuntimeCore or optional-Prisma path;
- direct active Deal participation, assigned-driver scope or an explicit privileged staff path controls reads and writes;
- client-authored tenant, actor, role, carrier, driver, vehicle, route, admission or status authority is denied;
- canonical `assign_logistics` consumes one valid admission and binds the Shipment atomically;
- checkpoint, GPS and driver-verification facts survive restart and instance change;
- every mutation is idempotent, optimistic-concurrency protected and commits shipment state, audit and outbox together or rolls back;
- no process-memory GPS track, fire-and-forget write, fake telematics or fake GIS EPD success remains authoritative;
- empty/baseline migrations, zero drift, restricted-principal RLS, restart, concurrency, idempotency and exact-head CI pass.

LOCKED:
- IR-10.3 Labs PostgreSQL Authority;
- IR-10.4 Settlement PostgreSQL Authority;
- IR-10.5 Disputes PostgreSQL Authority;
- IR-20 Canonical Durable Outbox;
- IR-21 Durable Integration Inbox;
- IR-22 Persistent Partner API and Outbound Webhooks;
- IR-30 through IR-90 in dependency order.

NEXT:
- Layer: IR-10.3 Labs PostgreSQL Authority
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/autopilot/progress.json
  - docs/platform-v7/autopilot/prompts/current-codex-task.md
  - docs/platform-v7/autopilot/prompts/current-review-task.md
  - docs/platform-v7/execution-queue.md
  - apps/api/src/common/config/industrial-mode.ts
  - apps/api/src/modules/labs/**
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/20260713*_labs_postgresql_authority/**
  - apps/api/test/industrial/labs-postgresql-authority.e2e-spec.ts
  - apps/api/test/one-deal/labs-postgresql-authority.e2e-spec.ts
  - infra/sql/postgresql-labs-authority-policies.sql
  - scripts/platform-v7-forward-only-migration-check.mjs
  - scripts/platform-v7-one-deal-e2e.sh
  - .github/workflows/ci.yml
- Success criteria:
  - production LabsModule binds a complete Prisma repository with no RuntimeCore or optional-Prisma path;
  - sample custody, laboratory actor, method/equipment and protocol authority are server-derived under trusted RLS;
  - lab mutations, audit and outbox commit or roll back atomically;
  - restart, multi-instance, idempotency, optimistic-concurrency and cross-tenant tests pass;
  - empty/baseline migrations, drift, RLS and exact-head CI are green.
- Readiness remains NO-GO.

TRANSITION RULE:
- one narrow PR at a time in dependency order;
- no auto-merge;
- advance only after exact-head checks and diff review;
- update state, queue, progress and prompts after merge before opening the next work package;
- mock, simulator and CI-scale evidence must remain explicitly labelled and cannot be used as live or production acceptance.

READINESS:
Industrial Integration-Ready remains NO-GO until every mandatory gate in IR-90 has commit- and deployment-linked evidence.
