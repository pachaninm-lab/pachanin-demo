# platform-v7 Industrial Integration Readiness queue

CURRENT: IR-10.4 Settlement PostgreSQL Authority

GOVERNING SPECIFICATION:
- `docs/platform-v7/autopilot/industrial-integration-readiness-v1.0.md`
- target gate: Industrial Integration-Ready;
- current gate: NO-GO;
- exact baseline: `576d813c2d305efb645c9d26fa81a38fb6e4abbe` on `main`.

BASELINE PROVEN:
- persistent identity, session rotation/revocation, MFA and one-time backup codes are merged with isolated PostgreSQL evidence (#2276, #2280, #2282, #2283);
- separate restricted auth and deal PostgreSQL principals are merged (#2287);
- canonical Deal command execution, idempotency, optimistic concurrency, callback authority, transactional audit/outbox creation and isolated recovery evidence are merged (#2260, #2270, #2274, #2378, #2406, #2407);
- Documents PostgreSQL Authority is merged (#2410);
- Logistics PostgreSQL Authority is merged (#2412);
- Labs PostgreSQL Authority is merged (#2426, merge `576d813c2d305efb645c9d26fa81a38fb6e4abbe`, verified head `73149bb4fba09a33875311faea313bb2ad272503`);
- bank callback reconciliation and key rotation/revocation mechanics exist (#2379), but exclusive Settlement authority remains open;
- CI-scale correctness and isolated backup/restore remain evidence only and do not prove production capacity, HA or provider DR.

CURRENT GOAL:
- make settlement PostgreSQL-authoritative by construction;
- remove RuntimeCore, optional Prisma, repository factory, ActionExecutor memory authority and process-memory OutboxService from the production settlement graph;
- normalize versioned payment terms, beneficiaries, reserve/release/refund basis, holds, partial payouts, bank operations and reconciliation facts;
- store and calculate money only in integer kopecks;
- enforce participant, tenant and financial role scope through trusted RLS;
- commit payment state, bank operation, audit and PENDING outbox atomically;
- confirm reserve/release/refund only through verified callback authority;
- prove restart, multi-instance, command/callback replay, races, RLS denials and reconciliation mismatch handling;
- keep live SberAPI, nominal account, credit and money movement outside this PR.

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
- apps/api/src/modules/deals/deals.module.ts
- apps/api/src/modules/deals/industrial-deal-command.gateway.ts
- apps/api/src/modules/deals/postgresql-deal-command.service.ts
- apps/api/src/modules/deals/postgresql-deal-command.service.spec.ts
- apps/api/src/modules/settlement-engine/**
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260713*_settlement_postgresql_authority/**
- apps/api/test/industrial/harness.ts
- apps/api/test/industrial/settlement-postgresql-authority.e2e-spec.ts
- apps/api/test/industrial/industrial-core.e2e-spec.ts
- apps/api/test/industrial/reconciliation.e2e-spec.ts
- apps/api/test/industrial/durable-outbox.e2e-spec.ts
- apps/api/test/one-deal/industrial-one-deal.e2e-spec.ts
- apps/api/test/one-deal/restored-database-acceptance.ts
- apps/api/test/one-deal/seed.ts
- infra/sql/postgresql-settlement-authority-policies.sql
- scripts/platform-v7-forward-only-migration-check.mjs
- scripts/platform-v7-one-deal-e2e.sh
- .github/workflows/ci.yml

CURRENT CRITERIA:
- production startup fails before traffic when payment repository mode is missing, memory or unknown;
- production `SettlementEngineModule` has no RuntimeCore, optional Prisma, repository factory or process-memory money/outbox authority;
- payment, bank operation, beneficiary, ledger, hold, refund and reconciliation facts are PostgreSQL-authoritative under trusted RLS;
- money authority uses integer minor units only;
- payment terms and release basis are versioned Deal-linked facts;
- requests remain pending until verified callback confirmation;
- partial payouts, beneficiary allocations, holds and refunds cannot exceed confirmed reserve or become negative;
- every confirmed financial effect is append-only, balanced, idempotent and atomic with audit/outbox;
- reconciliation mismatch fails closed into manual review;
- restart, multi-instance, outsider/cross-tenant, replay and race tests pass;
- empty/baseline migrations, zero drift and exact-head CI pass.

LOCKED:
- IR-10.5 Disputes PostgreSQL Authority;
- IR-20 Canonical Durable Outbox;
- IR-21 Durable Integration Inbox;
- IR-22 Persistent Partner API and Outbound Webhooks;
- IR-30 through IR-90 in dependency order.

NEXT:
- Layer: IR-10.5 Disputes PostgreSQL Authority
- Allowed files:
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
  - apps/api/src/modules/deals/deals.module.ts
  - apps/api/src/modules/deals/industrial-deal-command.gateway.ts
  - apps/api/src/modules/deals/postgresql-deal-command.service.ts
  - apps/api/src/modules/deals/postgresql-deal-command.service.spec.ts
  - apps/api/src/modules/disputes/**
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/20260713*_disputes_postgresql_authority/**
  - apps/api/test/industrial/harness.ts
  - apps/api/test/industrial/disputes-postgresql-authority.e2e-spec.ts
  - apps/api/test/industrial/industrial-core.e2e-spec.ts
  - apps/api/test/one-deal/industrial-one-deal.e2e-spec.ts
  - apps/api/test/one-deal/restored-database-acceptance.ts
  - apps/api/test/one-deal/seed.ts
  - infra/sql/postgresql-disputes-authority-policies.sql
  - scripts/platform-v7-forward-only-migration-check.mjs
  - scripts/platform-v7-one-deal-e2e.sh
  - .github/workflows/ci.yml
- Success criteria:
  - production Disputes module binds complete PostgreSQL repositories with no RuntimeCore path;
  - claims, holds, evidence, decisions and financial consequences are tenant-scoped, immutable and atomic;
  - restart, multi-instance, idempotency, optimistic concurrency, RLS and exact-head CI pass.
- Readiness remains NO-GO.

TRANSITION RULE:
- one narrow PR at a time in dependency order;
- no auto-merge;
- no self-modifying workflow or direct push to `main`;
- advance only after exact-head checks and diff review;
- update state, queue, progress and prompts after merge before opening the next work package;
- mock, simulator and CI-scale evidence remain explicitly labelled and cannot be used as live or production acceptance.

READINESS:
Industrial Integration-Ready remains NO-GO until every mandatory gate through IR-90 has commit-, deployment- and operations-linked evidence.
