# platform-v7 execution queue

CURRENT: Industrial One Deal Ephemeral PostgreSQL E2E Harness.

GOAL: Доказать в CI на изолированном PostgreSQL 16, что одна каноническая сделка `DEAL-INDUSTRIAL-001` проходит всеми ролями от DRAFT до CLOSED без ручного изменения БД, fake-live и production credentials.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- apps/api/test/one-deal/**
- apps/web/tests/e2e/one-deal/**
- scripts/platform-v7-one-deal-*.mjs
- scripts/platform-v7-one-deal-*.sh
- .github/workflows/ci.yml

CURRENT CRITERIA:
- visible and mandatory `CI` workflow starts an isolated PostgreSQL 16 service with ephemeral credentials;
- schema, migrations and RLS policies are applied only to the ephemeral database;
- canonical seed creates one tenant, organizations, 12 human role memberships and one deal ID;
- all roles read the same facts and version of `DEAL-INDUSTRIAL-001`;
- exploitation runs through a separate `NOSUPERUSER NOBYPASSRLS` application principal;
- all 19 commands pass in order without direct database mutation;
- reserve and release advance only through signed callback fixtures bound to exact pending operations;
- duplicate command returns the original receipt;
- reused idempotency material, stale version, concurrent update and cross-tenant access fail deterministically;
- closed deal reconciles Deal, DealEvent, AuditEvent, outbox, payment, ledger, shipment, acceptance, lab and documents;
- evidence log uploads even when the gate fails;
- test teardown destroys all ephemeral data and credentials;
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
- production migration execution;
- production RLS policy application;
- persistent identity/session/revocation/MFA files;
- apps/landing;
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
  - concurrent bids and commands preserve one winner and one aggregate version;
  - duplicate and out-of-order bank callbacks are replay-safe;
  - worker/API restarts preserve pending operations and receipts;
  - transaction rollback leaves no partial Deal, event, audit, ledger or outbox state;
  - RLS connection reuse cannot leak tenant context;
  - recovery rerun is idempotent and deterministic.

AFTER NEXT:
- Persistent identity/session/revocation/MFA source of truth after blocker #2115 is removed.
- Durable outbox workers, bank reconciliation and partner key rotation.
- Truthful driver offline acknowledgement and conflict handling.
- Server-rendered RU/EN/ZH i18n and complete design-system migration.
- Load, restore, DR, accessibility and operational acceptance gates.
