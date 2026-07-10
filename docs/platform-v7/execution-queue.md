# platform-v7 execution queue

CURRENT: PostgreSQL One Deal Recovery Matrix.

STATUS: READY FOR MERGE.

BASELINE PROVEN:
- PR #2270 merged to `main` as `45a7fd7826eade875b81c1c631eb3a049c3fba94`;
- eight forward-only migrations apply to clean PostgreSQL 16 with zero schema drift;
- strict tenant/object RLS is enforced through a non-owner `NOSUPERUSER NOBYPASSRLS` application role;
- one canonical Deal has 12 ACTIVE DealParticipant assignments;
- all 19 commands execute to `CLOSED` with signed bank callbacks and full reconciliation.

RECOVERY EVIDENCE PROVEN IN PR #2274:
- simultaneous commands preserve one aggregate version and exactly one valid winner;
- successful bank callbacks use stable verified partner + event identity rather than mutable Deal version;
- duplicate callback returns the original receipt without a second event, ledger entry, outbox write or transition;
- same partner event ID with changed material payload fails as `BANK_EVENT_REPLAY_MISMATCH`;
- out-of-order release callback fails before any mutation;
- fresh Prisma/service/gateway instances continue from persisted Deal, pending BankOperation, outbox and receipt state;
- forced failure rolls back Deal, DealEvent, AuditEvent, ledger and outbox atomically;
- sequential and parallel transaction-local RLS contexts do not leak tenant, organization, role or session through the pool;
- full command and callback rerun after `CLOSED` is deterministic and idempotent;
- evidence snapshots remain byte-for-byte stable across replay and restart checks.

CORRECTED PRODUCT DEFECT:
- previous generic callback fingerprint included mutable `expectedUpdatedAt`;
- the same verified event therefore missed its original receipt after `RESERVE_REQUESTED → RESERVED`;
- correction keeps event identity stable by verified partner + event ID and binds the material payload hash to commandId;
- HMAC verification, exact pending operation binding and state-machine rules remain unchanged.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- apps/api/src/modules/deals/industrial-deal-command.gateway.ts
- apps/api/src/modules/deals/industrial-deal-command.gateway.spec.ts
- apps/api/test/one-deal/**
- scripts/platform-v7-one-deal-*.mjs
- scripts/platform-v7-one-deal-*.sh
- .github/workflows/ci.yml

LOCKED:
- every production file outside the exact gateway and unit-spec listed above;
- production migration or RLS execution;
- persistent identity/session/revocation/MFA implementation until this PR merges;
- live bank, ФГИС, ЭДО and signature activation;
- platform UI implementation during this recovery proof;
- apps/landing;
- package and lockfiles;
- production load, restore and disaster-recovery claims.

NEXT:
- Layer: Persistent Identity, Session, Refresh-Family Revocation and MFA.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/20260710150000_persistent_identity_sessions/migration.sql
  - apps/api/src/modules/auth/**
  - apps/api/src/common/guards/**
  - apps/api/src/common/types/request-user.ts
  - apps/api/test/auth/**
  - .github/workflows/ci.yml
- Success criteria:
  - persistent PostgreSQL users, memberships, sessions and refresh-token families replace process memory as identity truth;
  - access tokens carry only opaque session identity and are re-authorized against persistent session and membership state;
  - refresh rotation invalidates the previous token and reuse revokes the complete token family;
  - logout, password reset, organization suspension and administrator revoke invalidate affected sessions deterministically;
  - privileged roles and threshold financial actions require verified MFA state from the persistent session;
  - role, tenant and organization are derived from server-side membership, never URL, request DTO, localStorage or client cookies;
  - login, refresh, MFA verify, logout, revoke, reuse detection and denied access produce immutable audit evidence;
  - horizontal API instances share the same PostgreSQL session truth and survive process restart;
  - migration deploy, zero drift, unit, integration, security and restart tests are mandatory;
  - production readiness and live identity-provider integration remain unclaimed.
- Readiness remains 87% honest architectural readiness until persistent identity, live integrations, production load, restore and DR are independently proven.

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
