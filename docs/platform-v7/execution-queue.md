# platform-v7 execution queue

CURRENT: VP-3.46 Ephemeral PostgreSQL RLS Integration Harness.

GOAL: Доказать поведение canonical RLS на чистой PostgreSQL 16 в CI, удалить permissive legacy policies из начальной миграции и проверить tenant isolation на одной физической сессии без production credentials.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- infra/sql/production-rls-policies.sql
- apps/api/test/rls/**
- scripts/platform-v7-rls-*.mjs
- scripts/platform-v7-rls-*.sh
- .github/workflows/platform-v7-rls-integration.yml

CURRENT DISCOVERY:
- `0001_postgresql_initial` создаёт permissive policies `deals_app_access`, `audit_insert_only`, `audit_select_all`, `ledger_insert_only`, `ledger_select_all`;
- permissive PostgreSQL policies складываются через OR, поэтому новые restrictive-by-content policies не защищают данные, пока legacy policies явно не удалены;
- clean local Docker bootstrap монтирует RLS SQL как init script до подтверждённого создания schema; это отдельный VP-3.47, а не повод применять что-либо в production.

CURRENT CRITERIA:
- canonical policy SQL explicitly drops every permissive legacy policy;
- CI starts a fresh PostgreSQL 16 service using only job-local credentials;
- only the initial schema migration and runtime persistence migration are applied to the ephemeral database;
- canonical RLS SQL is applied after schema creation;
- a non-superuser, non-owner, `NOBYPASSRLS` role executes all assertions;
- two tenants and four organizations are seeded with one deal per tenant;
- tenant A seller sees its own deal and linked audit, outbox, snapshot and attempt;
- tenant A seller cannot see tenant B deal or linked records;
- missing user, organization, tenant, role or session context yields zero visible protected rows;
- committing the context transaction clears all five settings on the same PostgreSQL session;
- no production secret, database or deploy target is referenced;
- failure of any assertion blocks merge.

DONE:
- #2241 VP-3.33 Runtime Persistence Prisma Schema and Migration Implementation
- #2245 VP-3.37 Runtime Persistence Postgres Repository Adapter Implementation
- #2250 VP-3.41 Runtime Persistence Internal Service Wiring Implementation
- #2252 VP-3.42 Runtime Persistence Authenticated Internal Command Boundary
- #2254 VP-3.43 Transaction-Local Trusted RLS Context
- #2256 VP-3.44 Runtime Persistence Trusted Transaction Binding
- #2258 VP-3.45 Physical Table RLS Policy Alignment and Rehearsal

LOCKED:
- production migration execution;
- production RLS policy application;
- persistent identity/session/revocation/MFA files;
- controller/API/web wiring;
- bank reserve/release confirmation from user commands;
- live bank/FGIS/EDO integrations.

NEXT:
- Layer: VP-3.47 Local Database Bootstrap Order and RLS Activation.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
  - docker-compose.yml
  - infra/sql/**
  - scripts/platform-v7-db-bootstrap-*.sh
  - scripts/platform-v7-db-bootstrap-*.mjs
- Success criteria:
  - a clean local volume creates schema before applying canonical RLS;
  - policy application is explicit and observable, not an unordered init mount;
  - application and worker roles are created with least privilege and `NOBYPASSRLS`;
  - local boot fails closed on schema or policy errors;
  - restart is idempotent and does not destroy data;
  - no production credentials or production database are touched.
- Readiness remains 85% honest architectural readiness.

AFTER NEXT:
- Persistent identity/session/revocation/MFA source of truth after blocker #2115.
- Authenticated DB-backed runtime action bridge without direct bank confirmation.
- Concurrency, retry, recovery, load, restore and security acceptance gates.
