# platform-v7 execution queue

CURRENT: VP-3.45 Physical Table RLS Policy Alignment and Rehearsal.

GOAL: Привести PostgreSQL RLS policies к физическим таблицам Prisma, сделать policy apply/rollback идемпотентными и fail-closed, добавить статическую drift-проверку и контролируемую non-production rehearsal без изменения production DB.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- infra/sql/production-rls-policies.sql
- infra/sql/production-rls-policies.rollback.sql
- scripts/platform-v7-rls-verify.mjs
- scripts/platform-v7-rls-rehearsal.sh
- apps/api/src/common/prisma/rls-policy-contract.spec.ts

DONE:
- #2241 VP-3.33 Runtime Persistence Prisma Schema and Migration Implementation
- #2245 VP-3.37 Runtime Persistence Postgres Repository Adapter Implementation
- #2250 VP-3.41 Runtime Persistence Internal Service Wiring Implementation
- #2252 VP-3.42 Runtime Persistence Authenticated Internal Command Boundary
- #2254 VP-3.43 Transaction-Local Trusted RLS Context
- #2256 VP-3.44 Runtime Persistence Trusted Transaction Binding

IMPLEMENTED IN VP-3.45:
- policies use canonical physical tables: `deals`, `organizations`, `audit_events`, `ledger_entries`, `integration_events`, `outbox_entries`, `deal_workspace_runtime_snapshots`, `deal_workspace_runtime_transaction_attempts`;
- each protected table has both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`;
- tenant context is mandatory for every visible deal-linked record;
- organization and participant checks are explicit;
- `EXECUTIVE` is read-only;
- `ACCOUNTING` has no global ledger or bank authority;
- audit, ledger and runtime transaction attempts are append-only;
- outbox is service-only and remains tenant/deal-scoped;
- obsolete `set_app_context` helpers are removed instead of recreated;
- policies use `DROP POLICY IF EXISTS` followed by `CREATE POLICY`, not unsupported `CREATE POLICY IF NOT EXISTS`;
- rollback removes only VP-3.45 policies and RLS flags, never data or schema;
- static verifier detects physical-table drift, unsafe SQL, missing rollback and authority regressions;
- rehearsal requires an explicit non-production environment, exact database name and confirmation flag;
- rehearsal applies, validates and rolls back policies on the named non-production database;
- CI does not receive a database URL and performs static verification only.

LOCKED:
- production migration execution;
- production RLS policy application;
- persistent identity/session/revocation/MFA files until blocker #2115 is resolved;
- controller/API/web wiring;
- bank reserve/release confirmation from user commands;
- live bank/FGIS/EDO integrations;
- claims that all repositories are RLS-bound.

GUARDRAILS:
- no model table names such as `"Deal"` or `"AuditEvent"` in physical policy SQL;
- no `$executeRawUnsafe`;
- no session-level `set_config(..., false)`;
- no swallowed policy application failure;
- no production-like rehearsal database names;
- no destructive rollback;
- no global `ACCOUNTING` policy;
- no user-driven bank confirmation;
- critical forbidden zones remain unchanged.

NEXT:
- Layer: VP-3.46 Persistent Identity Session Revocation MFA and Tenant Source of Truth.
- Goal: replace in-process identity/session stores with persistent records and issue verified JWT claims containing user, organization, tenant, role, session and MFA state.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Execution rule:
  - resolve blocker #2115 before modifying auth source-of-truth files;
  - perform one read-only audit followed by one exact manually scoped code PR;
  - privileged and bank roles remain non-self-registerable;
  - no controller or money confirmation route is introduced as part of identity persistence.
- Success criteria:
  - persistent users, memberships and sessions are the authority source;
  - access-token verification resolves current membership and revocation state;
  - tenantId and sessionId are mandatory trusted claims;
  - logout, role change, suspension and anonymization revoke active sessions across instances;
  - privileged roles require MFA state;
  - in-process session maps are removed from the production path;
  - demo users remain explicit non-production fixtures only.

AFTER NEXT:
- Safe one-deal execution workspace integration without tenant bypass or synthetic bank confirmation.
- Trusted bank callback/reconciliation boundary.
- Offline acknowledgement, concurrency, retry, recovery, load, restore and security acceptance gates.
