# platform-v7 execution queue

CURRENT: Persistent Identity, Session, Refresh-Family Revocation and MFA.

GOAL: Заменить process-local identity/session/MFA на единый PostgreSQL source of truth без ослабления доказанного Deal/RLS/recovery-контура.

BASELINE PROVEN:
- PR #2270: восемь forward-only migrations, zero drift, strict tenant/object RLS, 12 DealParticipant и 19 команд до CLOSED;
- PR #2274 / main `cc10110293d9716c2f93790e7756589ead017afd`: один concurrent winner, callback replay safety, restart continuation, atomic rollback и отсутствие RLS pool leakage;
- production migration, live integrations, production load и DR по-прежнему не заявлены.

CURRENT DEFECTS:
- users, login attempts, refresh tokens, active sessions and revocation были process-local;
- access token не подтверждал текущую DB-сессию и membership;
- MFA setup возвращал secret, verify принимал secret от клиента, backup codes и elevation не были durable;
- MFA guard допускал undefined state и header bypass.

CURRENT IMPLEMENTATION PR: #2275.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260710150000_persistent_identity_sessions/migration.sql
- apps/api/src/modules/auth/**
- apps/api/src/modules/mfa/**
- apps/api/src/modules/deals/canonical-test-deal.seed.ts
- apps/api/src/common/guards/**
- apps/api/src/common/types/request-user.ts
- apps/api/test/auth/**
- .github/workflows/ci.yml

CURRENT CRITERIA:
- PostgreSQL User/UserOrg/Organization are the identity and membership truth;
- AuthSession has 30-day absolute limit and 12-hour idle timeout;
- access token TTL is 15 minutes and every request revalidates active DB session, user and membership;
- refresh tokens are opaque, stored only as SHA-256, rotated atomically inside a family;
- replay or concurrent reuse revokes the full refresh family and session;
- logout, role change, default organization change and anonymization revoke all affected sessions across API instances;
- login lockout is persistent and account identifiers/IP/user-agent are HMAC-fingerprinted;
- MFA secret is AES-GCM encrypted server-side;
- setup and step-up use short-lived server challenge IDs; verify never accepts a secret from the client;
- backup codes are hashed and transactionally single-use;
- MFA elevation is stored on the active session and expires after ten minutes;
- MFA guard is fail-closed and has no header bypass;
- canonical 12-role seed creates durable users/memberships directly through Prisma;
- migration deploy, zero drift, auth unit/integration, one-deal E2E, restart/replay and security checks remain green.

LOCKED UNTIL THIS LAYER IS GREEN:
- platform UI and design-system implementation;
- production identity migration execution;
- live bank, ФГИС, ЭДО and КЭП activation;
- production load, restore and DR claims;
- apps/landing and package/lockfiles.

NEXT:
- Server-Derived Mobile-First Shell and Design System:
  - verified server session as the only role/tenant/shell projection source;
  - one header, one bottom navigation, one Deal work surface;
  - removal of pathname, pc-role, Zustand and sessionStorage authority;
  - design tokens, WCAG 2.2 AA, visual regression and RU/EN/ZH-ready message keys;
  - controlled deletion of the 26 CSS/hotfix layers only after coverage.
- Durable outbox worker, bank reconciliation and partner-key rotation.
- Truthful driver offline acknowledgement.
- Load, restore, DR and operational acceptance.

MATURITY: isolated Deal lifecycle and recovery are proven. Persistent identity is under verification. Production exploitation remains NO-GO.
