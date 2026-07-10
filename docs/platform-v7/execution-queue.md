# platform-v7 execution queue

CURRENT: Industrial One Deal Foundation: explicit implementation scope unlock.

GOAL: Разрешить строго ограниченный промышленный проход одной канонической тестовой сделки через все роли, не открывая auth persistence, production migrations, landing, lockfiles, live integrations или неподтверждённые production claims.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- apps/api/src/common/action-executor/action-policy.ts
- apps/api/src/common/types/request-user.ts
- apps/api/src/modules/deals/**
- apps/api/src/modules/settlement-engine/settlement-engine.controller.ts
- apps/api/src/modules/settlement-engine/settlement-engine.module.ts
- apps/web/app/api/auth/login/route.ts
- apps/web/app/api/proxy/[...path]/route.ts
- apps/web/app/platform-v7/login/page.tsx
- apps/web/components/platform-v7/CanonicalDealWorkspace.tsx
- apps/web/components/platform-v7/PlatformV7ShellSwitch.tsx
- apps/web/components/platform-v7/RoleIntentDashboard.tsx
- apps/web/lib/platform-v7/verified-session.ts
- apps/web/tests/unit/platformV7CanonicalDealWorkspace.test.ts
- apps/web/tests/unit/platformV7VerifiedSession.test.ts
- .github/workflows/web-unit.yml

CURRENT CRITERIA:
- one canonical deal ID and one factual state are used by every role;
- client submits a command, idempotency key and expected version, never an arbitrary target state;
- canonical reads and writes require trusted user, session, role, organization and tenant context;
- Deal, side effects, DealEvent, AuditEvent, receipt and external outbox are committed through transaction-local RLS with Serializable command isolation;
- idempotency is derived from every material command field and no raw pre-transaction intent write exists;
- reserve and release confirmations are accepted only from a verified BANK_CALLBACK system actor;
- callback signature binds method, path, partner, key version, timestamp, event ID and canonical payload hash;
- callback is bound to the exact pending bank operation;
- legacy controller role allowlists remain intact;
- SURVEYOR is a first-class backend role;
- canonical UI has no synthetic bank reference, manual bank confirmation or fake successful backend response;
- test seed is explicit, idempotent and production-denied by default;
- API, web, build, CodeQL and security gates are green before merge.

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
- apps/landing;
- package and lockfiles;
- live bank/FGIS/EDO/signature integrations;
- production scale, restore or disaster-recovery claims.

NEXT:
- Layer: Industrial One Deal Ephemeral PostgreSQL E2E Harness.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
  - apps/api/test/one-deal/**
  - apps/web/tests/e2e/one-deal/**
  - scripts/platform-v7-one-deal-*.mjs
  - .github/workflows/platform-v7-one-deal-e2e.yml
- Success criteria:
  - CI starts isolated PostgreSQL 16 with no production credentials;
  - canonical schema, migrations and RLS policies are applied only to the ephemeral database;
  - all 12 human role memberships read one deal ID and one factual state;
  - all 19 commands pass in order without manual database changes;
  - reserve and release advance only through signed callback fixtures bound to pending operations;
  - duplicate, stale, concurrent and cross-tenant commands fail deterministically;
  - audit, outbox, documents, shipment, laboratory and money projections reconcile after close;
  - teardown destroys all data and credentials;
  - production readiness remains unclaimed.
- Readiness remains 85% honest architectural readiness until exploitation evidence exists.

AFTER NEXT:
- Persistent identity/session/revocation/MFA source of truth after blocker #2115 is removed.
- Durable outbox workers, bank reconciliation and replay-safe partner key rotation.
- Truthful driver offline acknowledgement and conflict handling.
- Server-rendered RU/EN/ZH i18n and complete design-system migration.
- Concurrency, load, restore, DR, accessibility and operational acceptance gates.
