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
- Required outcome: role, tenant, organization, session, refresh family, revocation and MFA state become persistent server-derived truth; URL, cookie values and localStorage cannot grant authority.
- Required evidence:
  - persistent users, memberships, sessions and refresh families;
  - access token rotation and refresh reuse detection;
  - logout and administrator revocation invalidate the complete session family;
  - mandatory MFA for privileged and threshold financial actions;
  - tenant and role projection comes only from verified server session plus DB membership;
  - client-selected role and organization are ignored;
  - audit trail for login, refresh, MFA, revoke and denied access;
  - horizontal API instances share the same session truth.

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
