# platform-v7 Industrial Integration Readiness queue

CURRENT: IR-10.3 Labs PostgreSQL Authority

GOVERNING SPECIFICATION:
- `docs/platform-v7/autopilot/industrial-integration-readiness-v1.0.md`
- target gate: Industrial Integration-Ready;
- current gate: NO-GO;
- exact baseline: `a272a1e64b1a30d1e5b2a3052ca66653afd7b66f` on `main`.

BASELINE PROVEN:
- persistent identity, session rotation/revocation, MFA and one-time backup codes are merged with isolated PostgreSQL evidence (#2276, #2280, #2282, #2283);
- separate restricted auth and deal PostgreSQL principals are merged (#2287);
- canonical Deal command execution, idempotency, optimistic concurrency, bank-callback authority, transactional audit/outbox creation and isolated recovery evidence are merged (#2260, #2270, #2274, #2378, #2406, #2407);
- Documents PostgreSQL Authority is merged (#2410, merge `a485371e54b31fc787c061643c0068184e373c7b`);
- Logistics PostgreSQL Authority is merged (#2412, merge `a272a1e64b1a30d1e5b2a3052ca66653afd7b66f`);
- durable PostgreSQL outbox worker mechanics exist, but IR-20 remains open because the legacy process-memory relay still starts;
- PostgreSQL bank reconciliation and callback-key rotation/revocation are merged (#2379);
- CI-scale correctness and isolated backup/restore remain evidence only; they do not prove production capacity, HA or provider DR.

CURRENT GOAL:
- make Labs PostgreSQL-authoritative by construction;
- remove RuntimeCore, optional Prisma and repository factory selection from the production Labs graph;
- replace the read-only Prisma lab skeleton with a complete trusted-RLS repository;
- normalize laboratory, accreditation, authorized actor, sampler, custody, method, equipment and protocol authority in PostgreSQL;
- make laboratory facts, audit and PENDING outbox commit atomically;
- bind canonical `finalize_lab` to one valid server-authoritative custody and protocol basis;
- persist collection, custody, test, correction and protocol facts across restart and multiple API instances;
- keep live LIMS, accreditation registry and EDO activation outside this PR.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- apps/api/src/common/config/industrial-mode.ts
- apps/api/src/common/command-execution.context.ts
- apps/api/src/common/prisma/rls-transaction.service.ts
- apps/api/src/modules/deals/deal-command.service.ts
- apps/api/src/modules/deals/deal-command-payload.ts
- apps/api/src/modules/deals/postgresql-deal-command.service.ts
- apps/api/src/modules/deals/postgresql-deal-command.service.spec.ts
- apps/api/src/modules/labs/**
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260713*_labs_postgresql_authority/**
- apps/api/test/industrial/harness.ts
- apps/api/test/industrial/deal-command-no-fake-live.e2e-spec.ts
- apps/api/test/industrial/labs-postgresql-authority.e2e-spec.ts
- apps/api/test/one-deal/industrial-one-deal.e2e-spec.ts
- apps/api/test/one-deal/labs-postgresql-authority.e2e-spec.ts
- apps/api/test/one-deal/restored-database-acceptance.ts
- apps/api/test/one-deal/seed.ts
- infra/sql/postgresql-labs-authority-policies.sql
- scripts/platform-v7-forward-only-migration-check.mjs
- scripts/platform-v7-one-deal-e2e.sh
- .github/workflows/ci.yml

CURRENT CRITERIA:
- production bootstrap fails before traffic when the lab repository mode is missing, memory or unknown;
- production `LabsModule` binds a complete Prisma repository and contains no RuntimeCore or optional-Prisma path;
- direct active Deal participation, assigned laboratory actor or an explicit privileged staff path controls reads and writes;
- client-authored tenant, actor, role, laboratory, accreditation, sampler, custody, method, equipment, protocol or status authority is denied;
- canonical `finalize_lab` consumes one valid custody/protocol basis and commits atomically;
- collection, custody, test, correction and protocol facts survive restart and instance change;
- every mutation is idempotent, optimistic-concurrency protected and commits laboratory state, audit and outbox together or rolls back;
- no process-memory laboratory authority, fire-and-forget write or fake live provider success remains authoritative;
- empty/baseline migrations, zero drift, restricted-principal RLS, restart, concurrency, idempotency and exact-head CI pass.

LOCKED:
- IR-10.4 Settlement PostgreSQL Authority;
- IR-10.5 Disputes PostgreSQL Authority;
- IR-20 Canonical Durable Outbox;
- IR-21 Durable Integration Inbox;
- IR-22 Persistent Partner API and Outbound Webhooks;
- IR-30 through IR-90 in dependency order.

NEXT:
- Layer: IR-10.4 Settlement PostgreSQL Authority
- Success criteria:
  - production Settlement reads and commands bind complete PostgreSQL repositories with no RuntimeCore path;
  - payment, bank operation, callback and reconciliation authority is exclusive, durable and RLS-scoped;
  - money mutations, audit and outbox commit or roll back atomically;
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
