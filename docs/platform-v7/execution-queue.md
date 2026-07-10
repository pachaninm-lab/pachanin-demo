# platform-v7 execution queue

CURRENT: Industrial One Deal Concurrency, Replay and Recovery Matrix.

BASELINE PROVEN:
- PR #2270 merged to `main` as `45a7fd7826eade875b81c1c631eb3a049c3fba94`;
- eight forward-only migrations apply to clean PostgreSQL 16 with zero schema drift;
- strict tenant/object RLS is enforced through a non-owner `NOSUPERUSER NOBYPASSRLS` application role;
- one canonical Deal has 12 ACTIVE DealParticipant assignments;
- all 19 commands execute to `CLOSED` with signed bank callbacks and full reconciliation.

GOAL:
Prove that the same canonical transaction remains correct under concurrency, replay, application restart, transaction failure and PostgreSQL connection reuse. No production readiness claim is allowed from this isolated CI proof.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- apps/api/test/one-deal/**
- scripts/platform-v7-one-deal-*.mjs
- scripts/platform-v7-one-deal-*.sh
- .github/workflows/ci.yml

CURRENT CRITERIA:
- simultaneous commands preserve one aggregate version and exactly one valid winner;
- a duplicate bank callback returns the original receipt without a second event, ledger entry or state transition;
- an out-of-order callback is rejected before any mutation;
- a fresh Prisma/API runtime continues from persisted Deal, pending BankOperation, outbox receipt and audit state;
- a forced transaction failure rolls back Deal, DealEvent, AuditEvent, ledger and outbox writes atomically;
- sequential and parallel transaction-local RLS contexts cannot leak tenant, organization, role or session values through the connection pool;
- a full recovery rerun with original command fingerprints is deterministic and idempotent after `CLOSED`;
- evidence counts remain stable after every replay and restart;
- production readiness, live integrations, production load and DR remain unclaimed.

LOCKED:
- production migration or RLS execution;
- persistent identity/session/revocation/MFA implementation;
- live bank, ФГИС, ЭДО and signature activation;
- platform UI implementation during this recovery proof;
- apps/landing;
- package and lockfiles;
- production load, restore and disaster-recovery claims.

NEXT:
- Layer: Persistent Identity, Session, Refresh-Family Revocation and MFA.
- Required outcome: role, tenant, session and MFA state become server-derived persistent truth; URL, cookie and localStorage cannot grant authority.

AFTER NEXT:
- Durable outbox workers, bank reconciliation and partner-key rotation.
- Truthful driver offline acknowledgement and conflict handling.
- Server-rendered RU/EN/ZH i18n.
- Complete mobile-first design-system and role-cabinet migration:
  - one server-derived shell;
  - one visual hierarchy;
  - one primary action per state;
  - status, blocker reason and next step visible without interpretation;
  - removal of URL-derived role, client authority and CSS/hotfix cascade;
  - accessibility and visual-regression acceptance.
- Load, restore, DR and operational acceptance gates.
