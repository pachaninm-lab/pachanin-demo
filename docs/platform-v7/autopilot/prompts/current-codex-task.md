# Codex current task — Persistent Identity, Session, Refresh-Family Revocation and MFA.

Maturity: controlled-pilot / pre-integration.
Do not overstate maturity or imply live external integrations.
Do not change apps/landing, production UI, visual/theme/onboarding, adapters, server actions, AI gateway runtime, DB/migrations or lockfiles unless the current step explicitly allows it.
Do not auto-merge. Human review and green checks are required.

## Source of truth

- State: `docs/platform-v7/autopilot/autopilot-state.json`
- Queue: `docs/platform-v7/execution-queue.md`
- Progress: `docs/platform-v7/autopilot/progress.json`

## Current step

Persistent Identity, Session, Refresh-Family Revocation and MFA.

## Next candidate

durable outbox worker bank reconciliation and partner-key rotation

## Transition guard

- BLOCKED: Persistent Identity, Session, Refresh-Family Revocation and MFA. is not green/closed/mergeable. Dispatcher will not advance to durable outbox worker bank reconciliation and partner-key rotation.

## Allowed current scope

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260710150000_persistent_identity_sessions/migration.sql
- apps/api/src/modules/auth/**
- apps/api/src/common/guards/**
- apps/api/src/common/types/request-user.ts
- apps/api/test/auth/**
- apps/api/test/one-deal/seed.ts
- .github/workflows/ci.yml

## Forbidden zones

- apps/landing
- apps/web/app/platform-v7
- apps/web/components/platform-v7
- apps/web/components/v7r
- apps/web/lib/platform-v7
- apps/web/app/api
- package.json
- package-lock.json
- pnpm-lock.yaml
- .env files
- production migration execution

## Active queue

# platform-v7 execution queue

CURRENT: Persistent Identity, Session, Refresh-Family Revocation and MFA.

GOAL:
Replace process-memory authentication and client-selected authority with persistent PostgreSQL identity, membership, session, refresh-family, revocation and MFA truth shared by all API instances.

BASELINE PROVEN:
- #2270 proves the canonical 12-role / 19-command Deal lifecycle on isolated PostgreSQL 16;
- #2274 proves concurrency, replay, restart, rollback and RLS pool isolation;
- merge baseline is `cc10110293d9716c2f93790e7756589ead017afd`.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260710150000_persistent_identity_sessions/migration.sql
- apps/api/src/modules/auth/**
- apps/api/src/common/guards/**
- apps/api/src/common/types/request-user.ts
- apps/api/test/auth/**
- apps/api/test/one-deal/seed.ts
- .github/workflows/ci.yml

CURRENT CRITERIA:
- PostgreSQL User and UserOrg are the only identity and membership source of truth;
- persistent Session records contain status, current refresh family, MFA state, last activity and revocation reason;
- refresh tokens are one-time opaque secrets stored only as hashes;
- every refresh rotates the token; reuse revokes the entire family and creates audit evidence;
- access tokens identify an opaque session and user, while role, tenant and organization are re-derived from current DB membership;
- logout, password reset, user block, organization suspension and administrator revoke invalidate affected sessions;
- ADMIN, COMPLIANCE_OFFICER and ARBITRATOR require MFA; financial actions at or above the configured threshold require recent MFA;
- TOTP secrets are encrypted at rest and backup codes are stored only as hashes;
- login, refresh, MFA verify, logout, revoke, refresh reuse and denied authorization are audited;
- two fresh API instances observe the same session status and refresh-family rotation;
- migration deploy and zero schema drift pass on clean PostgreSQL 16;
- unit, integration, restart, concurrency and security tests pass;
- production identity-provider and production deployment claims remain forbidden.

LOCKED:
- all platform UI and client role-selection changes;
- apps/landing;
- package and lockfiles;
- live ESIA, bank, ФГИС, ЭДО and signature activation;
- production migration execution;
- production load, restore and DR claims.

NEXT:
- Layer: Durable Outbox Workers, Bank Reconciliation and Partner-Key Rotation.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/20260710160000_durable_outbox_reconciliation/migration.sql
  - apps/api/src/modules/outbox/**
  - apps/api/src/modules/settlement-engine/**
  - apps/api/src/modules/integrations/**
  - apps/api/test/outbox/**
  - apps/api/test/settlement/**
  - .github/workflows/ci.yml
- Success criteria:
  - outbox claiming uses database leases and `SKIP LOCKED` semantics;
  - retries, dead-letter transition and restart recovery are deterministic;
  - bank reconciliation compares platform operations, callbacks and ledger without mutating history;
  - partner keys support versioning, overlap and revocation;
  - duplicate workers and callbacks remain idempotent;
  - production integration remains unclaimed.
- Readiness remains 87% until persistent identity and subsequent operational layers are proven.

AFTER NEXT:
- Truthful driver offline acknowledgement and conflict handling.
- Server-rendered RU/EN/ZH i18n.
- Complete mobile-first design-system and role-cabinet migration with one server-derived shell, one primary action, visible blocker reason and next step, accessibility and visual regression gates.
- Load, restore, DR and operational acceptance.


## Implementation brief

Implement Persistent Identity, Session, Refresh-Family Revocation and MFA. strictly inside the state allowed scope.
