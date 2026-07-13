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
- Logistics PostgreSQL Authority is merged (#2412, merge `a272a1e64b1a30d1e5b2a3052ca66653afd7b66f`, verified head `4c880433811adc70c3fcb4b76edf1bbe81556c99`);
- durable PostgreSQL outbox worker mechanics exist, but IR-20 remains open because the legacy process-memory relay still starts;
- PostgreSQL bank reconciliation and callback-key rotation/revocation are merged (#2379);
- CI-scale correctness and isolated backup/restore remain evidence only; they do not prove production capacity, HA or provider DR.

CURRENT GOAL:
- make Labs PostgreSQL-authoritative by construction;
- remove RuntimeCore, optional Prisma and repository factory selection from the production Labs graph;
- replace `any`-based repository contracts and the incomplete Prisma skeleton with typed trusted-RLS persistence;
- normalize laboratory assignment, sample custody, method, equipment, accreditation basis and protocol authority in PostgreSQL;
- implement explicit sample collection, handoff, receipt, testing and finalization transitions;
- make lab mutations, custody facts, audit and `PENDING` outbox commit atomically;
- persist sample/test/protocol facts across restart and multiple API instances;
- prove idempotency, optimistic concurrency, exact participant scope, same-tenant outsider denial and cross-tenant denial;
- keep live laboratory/accreditation/provider activation outside this PR.

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
- apps/api/src/modules/deals/deal-command.service.ts
- apps/api/src/modules/deals/postgresql-deal-command.service.ts
- apps/api/src/modules/deals/postgresql-deal-command.service.spec.ts
- apps/api/src/modules/labs/**
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260713*_labs_postgresql_authority/**
- apps/api/test/industrial/harness.ts
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
- direct active Deal participation, assigned laboratory scope or an explicit privileged staff path controls reads and writes;
- client-authored tenant, actor, laboratory, accreditation, method, equipment, custody, status or protocol authority is denied;
- collection, handoff, receipt, testing and finalization use explicit state transitions;
- sample/test/custody facts survive restart and instance change;
- every mutation is idempotent, optimistic-concurrency protected and commits business state, audit and outbox together or rolls back;
- finalized protocols and confirmed test facts are immutable and evidence-linked;
- corrections create explicit superseding facts rather than overwrite confirmed facts;
- no process-memory laboratory authority, fake accreditation or fake external provider success remains;
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
  - production Settlement module is PostgreSQL-authoritative with no process-memory authority;
  - payment terms, reserve/release basis, callbacks, reconciliation, holds and partial payouts are normalized and atomic;
  - restricted-principal RLS, idempotency, optimistic concurrency, restart, multi-instance and exact-head CI pass.
- Readiness remains NO-GO.

TRANSITION RULE:
- one narrow PR at a time in dependency order;
- no auto-merge;
- advance only after exact-head checks and diff review;
- update state, queue, progress and prompts after merge before opening the next work package;
- mock, simulator and CI-scale evidence must remain explicitly labelled and cannot be used as live or production acceptance.

READINESS:
Industrial Integration-Ready remains NO-GO until every mandatory gate through IR-90 has commit-, deployment- and operations-linked evidence.
