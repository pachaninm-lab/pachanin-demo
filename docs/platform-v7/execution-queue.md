# platform-v7 execution queue

CURRENT: Industrial One Deal Ephemeral PostgreSQL E2E Harness.

GOAL: Доказать в CI на изолированном PostgreSQL 16, что одна каноническая сделка `DEAL-INDUSTRIAL-001` проходит всеми ролями от DRAFT до CLOSED без ручного изменения БД, fake-live и production credentials.

CURRENT FAILURE:
- Восемь миграций применяются на чистом PostgreSQL 16, zero drift подтверждён.
- Legacy allow-all policies удалены; SQL и Prisma wrong-tenant proof возвращают ноль строк.
- 12 ACTIVE `DealParticipant` назначений подтверждены; руководитель имеет только READ.
- Полный exploitation gate с 19 командами до CLOSED зелёный.
- Остался legacy unit fixture gateway: он не передавал verified tenant и не моделировал transaction-local DealParticipant/Organization/Deal reads.
- Correction: обновить ровно этот spec под fail-closed DB-derived scope.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- infra/sql/production-rls-policies.sql
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/migration_lock.toml
- apps/api/prisma/migrations/20260522083644_init/migration.sql
- apps/api/prisma/migrations/20260522120000_add_core_tables/migration.sql
- apps/api/prisma/migrations/20260710114000_prepare_schema_reconciliation/migration.sql
- apps/api/prisma/migrations/20260710114500_reconcile_postgresql_schema/migration.sql
- apps/api/prisma/migrations/20260710120000_deal_participants/migration.sql
- apps/api/src/modules/deals/canonical-test-deal.seed.ts
- apps/api/src/modules/deals/industrial-deal-command.gateway.ts
- apps/api/src/modules/deals/industrial-deal-command.gateway.spec.ts
- apps/api/test/one-deal/**
- apps/web/tests/e2e/one-deal/**
- scripts/platform-v7-one-deal-*.mjs
- scripts/platform-v7-one-deal-*.sh
- .github/workflows/ci.yml

CURRENT CRITERIA:
- migration history applies through `prisma migrate deploy` and produces zero schema drift;
- legacy allow-all policies are absent;
- application datasource is a separate non-owner `NOSUPERUSER NOBYPASSRLS` role;
- SQL-level and Prisma-level wrong-tenant reads return zero rows;
- each role sees Deal only through an ACTIVE `DealParticipant` assignment or an explicit server-only bank callback path;
- user/org/role are derived from DB membership and DealParticipant, not URL/cookie/client storage;
- EXECUTIVE receives READ access; operational roles receive WORK/APPROVE only where required;
- all 19 commands pass in order without direct database mutation;
- reserve and release advance only through signed callback fixtures bound to exact pending operations;
- duplicate, reused idempotency material, stale version and concurrent update fail deterministically;
- CLOSED reconciles Deal, participants, events, audit, outbox, payment, ledger, shipment, acceptance, lab and documents;
- legacy unit tests enforce the same fail-closed gateway contract;
- production readiness and live integration completion remain unclaimed.

DONE:
- #2241 VP-3.33 Runtime Persistence Prisma Schema and Migration Implementation
- #2245 VP-3.37 Runtime Persistence Postgres Repository Adapter Implementation
- #2250 VP-3.41 Runtime Persistence Internal Service Wiring Implementation
- #2252 VP-3.42 Runtime Persistence Authenticated Internal Command Boundary
- #2254 VP-3.43 Transaction-Local Trusted RLS Context
- #2256 VP-3.44 Runtime Persistence Trusted Transaction Binding
- #2258 VP-3.45 Physical Table RLS Policy Alignment and Rehearsal
- #2263 Industrial One Deal Foundation scope unlock
- #2260 Industrial one-deal foundation
- #2267 Canonical gateway consolidation

LOCKED:
- production migration and RLS execution;
- persistent identity/session/revocation/MFA files;
- platform UI and apps/landing during this proof layer;
- package and lockfiles;
- live bank/FGIS/EDO/signature integrations;
- production load, restore or disaster-recovery claims.

NEXT:
- Layer: Industrial One Deal Concurrency, Replay and Recovery Matrix.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
  - apps/api/test/one-deal/**
  - scripts/platform-v7-one-deal-*.mjs
  - scripts/platform-v7-one-deal-*.sh
  - .github/workflows/ci.yml
- Success criteria:
  - concurrent commands preserve one aggregate version and one valid winner;
  - duplicate and out-of-order bank callbacks are replay-safe;
  - API and worker restart preserve pending operations, receipts and audit continuity;
  - transaction rollback leaves no partial Deal, event, audit, ledger or outbox state;
  - RLS connection reuse cannot leak tenant context;
  - recovery rerun is idempotent and deterministic;
  - production readiness remains unclaimed.

AFTER NEXT:
- Persistent identity/session/revocation/MFA source of truth after blocker #2115 is removed.
- Durable outbox workers, bank reconciliation and partner key rotation.
- Truthful driver offline acknowledgement and conflict handling.
- Server-rendered RU/EN/ZH i18n and complete mobile-first design-system migration.
- Load, restore, DR, accessibility and operational acceptance gates.
