# platform-v7 execution queue

CURRENT: VP-3.45 Physical Table RLS Policy Alignment and Rehearsal.

GOAL: Привести PostgreSQL RLS SQL к реальным physical table names Prisma, сделать политику идемпотентной и fail-closed, удалить legacy session-level context helper и добавить только rollback-safe non-production rehearsal.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- infra/sql/production-rls-policies.sql
- apps/api/src/common/prisma/rls-transaction.service.spec.ts
- scripts/platform-v7-rls-validate.mjs
- scripts/platform-v7-rls-apply-rehearsal.sh
- scripts/platform-v7-rls-rollback-rehearsal.sh

CURRENT CRITERIA:
- policy SQL targets `deals`, `organizations`, `audit_events`, `ledger_entries`, `integration_events`, `outbox_entries`, `deal_workspace_runtime_snapshots` and `deal_workspace_runtime_transaction_attempts`;
- all protected tables use `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`;
- PostgreSQL 16 compatible idempotency uses `DROP POLICY IF EXISTS` followed by `CREATE POLICY`;
- legacy three-argument `set_app_context` is removed;
- SQL does not create session-level context setters;
- role, user, organization, tenant and session settings are treated as mandatory trusted transaction context;
- rehearsal scripts refuse production mode, require a dedicated rehearsal URL and always roll back;
- static validation detects Prisma/RLS table drift and forbidden legacy constructs;
- no production database is modified.

DONE:
- #2241 VP-3.33 Runtime Persistence Prisma Schema and Migration Implementation
- #2245 VP-3.37 Runtime Persistence Postgres Repository Adapter Implementation
- #2250 VP-3.41 Runtime Persistence Internal Service Wiring Implementation
- #2252 VP-3.42 Runtime Persistence Authenticated Internal Command Boundary
- #2254 VP-3.43 Transaction-Local Trusted RLS Context
- #2256 VP-3.44 Runtime Persistence Trusted Transaction Binding

LOCKED:
- production migration execution;
- production RLS policy application;
- persistent identity/session/revocation/MFA files;
- controller/API/web wiring;
- bank reserve/release confirmation from user commands;
- live bank/FGIS/EDO integrations.

NEXT:
- Layer: VP-3.46 Ephemeral PostgreSQL RLS Integration Harness.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
  - apps/api/test/rls/**
  - scripts/platform-v7-rls-*.mjs
  - scripts/platform-v7-rls-*.sh
  - .github/workflows/platform-v7-rls-integration.yml
- Success criteria:
  - CI starts an isolated PostgreSQL 16 service with no production credentials;
  - schema and canonical RLS SQL are applied to the ephemeral database only;
  - two tenants and two organizations are seeded;
  - participant access succeeds only for its own deal;
  - cross-tenant deal, audit, outbox and runtime snapshot reads are denied;
  - incomplete trusted context is denied;
  - transaction-local context does not leak to a reused pooled connection;
  - test teardown destroys all data and credentials;
  - production-enabled claims remain forbidden.
- Readiness remains 85% honest architectural readiness.

AFTER NEXT:
- Persistent identity/session/revocation/MFA source of truth after blocker #2115.
- Authenticated DB-backed runtime action bridge without direct bank confirmation.
- Concurrency, retry, recovery, load, restore and security acceptance gates.
