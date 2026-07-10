# platform-v7 execution queue

CURRENT: Industrial One Deal Ephemeral PostgreSQL E2E Harness.

RESULT: GREEN — READY FOR MERGE.

PROVEN:
- eight forward-only migrations apply to clean PostgreSQL 16 through `prisma migrate deploy`;
- `prisma migrate diff --exit-code` proves zero schema drift;
- legacy permissive `USING (TRUE)` policies are removed before strict RLS;
- application datasource is a separate non-owner `NOSUPERUSER NOBYPASSRLS` role;
- `RLS` and `FORCE ROW LEVEL SECURITY` are enabled;
- SQL-level and Prisma-level wrong-tenant Deal and DealParticipant reads return zero rows;
- one canonical Deal has exactly 12 ACTIVE DealParticipant assignments;
- user, organization, role and access level are DB-derived;
- EXECUTIVE has READ only; operational roles have WORK/APPROVE where required;
- all 19 commands pass in deterministic order to CLOSED;
- reserve and release require signed bank callbacks bound to exact pending operations;
- invalid signature, human confirmation, duplicate, idempotency reuse, stale version and concurrent command cases fail deterministically;
- CLOSED projections reconcile Deal, participants, events, audit, outbox, documents, shipment, laboratory, acceptance, payment, bank operations and ledger;
- ephemeral database and credentials are destroyed after the gate.

NOT PROVEN:
- production migration or RLS deployment;
- persistent session, refresh-family rotation, revocation and MFA;
- live bank, ФГИС, ЭДО or signature integrations;
- production load, restore, DR or operational acceptance.

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
