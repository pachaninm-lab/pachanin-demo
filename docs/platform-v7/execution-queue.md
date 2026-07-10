# platform-v7 execution queue

CURRENT: VP-3.46 Ephemeral PostgreSQL RLS Integration Harness.

GOAL: Доказать tenant isolation и transaction-local trusted context на реальной job-local PostgreSQL 16, не применяя production migrations/RLS и не изменяя one-deal commands, bank callback, UI или persistent auth.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- infra/sql/production-rls-policies.sql
- apps/api/test/rls/**
- scripts/platform-v7-rls-integration.sh
- scripts/platform-v7-rls-validate.mjs

DONE:
- #2241 Prisma schema and additive runtime migration artifacts
- #2245 Postgres runtime repository adapter
- #2250 server-only runtime persistence module
- #2252 authenticated internal command boundary
- #2254 transaction-local trusted RLS context
- #2256 trusted transaction binding
- #2258 physical table RLS policy alignment and rehearsal
- #2260 industrial one-deal foundation implementation
- #2263 exact one-deal scope unlock
- #2264 required PostgreSQL RLS workflow bootstrap

CURRENT CRITERIA:
- required `API Tests` workflow starts a fresh PostgreSQL 16 service with job-local credentials only;
- harness refuses production mode, non-local hosts, reused DATABASE_URL and non-empty databases;
- tests execute through `app_rls_test` with `NOSUPERUSER NOBYPASSRLS`;
- physical schema and canonical policy artifact are applied only to the ephemeral database;
- historical permissive policies `deals_app_access`, `audit_insert_only`, `audit_select_all`, `ledger_insert_only`, `ledger_select_all` are removed before canonical activation;
- all eight protected tables have `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`;
- tenant A can read only its own organization, deal, audit, outbox, runtime snapshot and transaction attempt;
- tenant B records are invisible;
- omitting user, organization, tenant, role or session denies access;
- context established with `set_config(..., true)` is absent after COMMIT on the same connection;
- failed SQL assertions fail the required job;
- the workflow uploads a dedicated `platform-v7-rls-integration-log` artifact;
- static validator blocks policy/schema drift and the return of permissive legacy policies.

LOCKED:
- production migration execution;
- production RLS policy application;
- persistent identity/session/revocation/MFA changes;
- live bank/FGIS/EDO/signature activation;
- package/lockfile/env changes;
- claims of production scale, restore or disaster-recovery acceptance.

NEXT:
- Layer: Canonical Deal Gateway Consolidation (#2267).
- Goal: remove the duplicate gateway and early raw-Prisma idempotency path while preserving signed BANK_CALLBACK-only money confirmation and one trusted Serializable RLS transaction.
- Success criteria:
  - one production DI gateway;
  - no raw pre-transaction intent or receipt write;
  - full command fingerprint reaches DealCommandService;
  - Deal, side effects, DealEvent, AuditEvent, receipt and external outbox commit atomically;
  - failed callbacks are bound to the exact pending bank operation;
  - no human role confirms reserve or release;
  - all API, web, build, CodeQL and security gates are green.

AFTER NEXT:
- Persistent identity, membership, session, refresh-family revocation, MFA and tenant source of truth.
- Durable outbox worker, reconciliation, replay protection and partner key rotation.
- Full one-deal PostgreSQL E2E across all roles and all 19 commands.
- Truthful offline acknowledgement and conflict resolution.
- Server-rendered RU/EN/ZH i18n and complete design-system migration.
- Concurrency, load, restore, DR, accessibility and operational acceptance gates.

MATURITY BOUNDARY:
- One-deal foundation is merged.
- VP-3.46 proves RLS behavior only on ephemeral PostgreSQL 16 in CI.
- Production RLS/migrations, persistent identity, live integrations and production-scale exploitation remain unproven.
