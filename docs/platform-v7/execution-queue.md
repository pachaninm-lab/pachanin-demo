# platform-v7 Industrial Integration Readiness queue

CURRENT: IR-10.4 Settlement PostgreSQL Authority — synchronized with current `main`, final exact-head CI and manual review pending.

## Governing state

- specification: `docs/platform-v7/autopilot/industrial-integration-readiness-v1.0.md`;
- target gate: Industrial Integration-Ready;
- current gate: **NO-GO**;
- current `main` base: `f8b4b807223443736b012f355d30cc24e5815ff0`;
- draft PR: `#2439`;
- previous green implementation head: `194cc10bdf9f00d3b81c16c2f2b1c17d5a3d9fe9`;
- current candidate: final security-hardening head after Source of Truth synchronization.

## Baseline already merged

- persistent identity, rotation/revocation, MFA and one-time backup codes: #2276, #2280, #2282, #2283;
- restricted auth/deal PostgreSQL principals: #2287;
- canonical Deal command core and isolated recovery: #2260, #2270, #2274, #2378, #2406, #2407;
- Documents PostgreSQL Authority: #2410;
- Logistics PostgreSQL Authority: #2412;
- Labs PostgreSQL Authority: #2426;
- bank reconciliation and callback-key rotation mechanics: #2379.

## IR-10.4 isolated slice

- direct PostgreSQL production Settlement binding;
- no RuntimeCore, optional Prisma, repository factory, ActionExecutor memory authority or process-memory OutboxService in production Settlement DI;
- versioned payment terms and beneficiary allocations;
- reserve, partial release, refund and hold accounting in integer minor units;
- verified callback-only confirmation with partner/key/event/operation/fingerprint binding;
- strict recent server-derived MFA for financial HTTP mutations;
- exact active DealParticipant scope for every human actor, including ADMIN and SUPPORT_MANAGER;
- confirmed counter delta bound in PostgreSQL to one exact validated PENDING bank operation;
- atomic payment, bank-operation, audit, ledger and durable outbox effects;
- exact durable bank-request outbox closure in the callback transaction;
- restart-safe command receipts, replay protection, CAS and two-instance race safety;
- append-only callback and balanced hash-chained ledger facts;
- reconciliation mismatch to manual review;
- one-deal and isolated backup/restore through the same Settlement path.

## Final proof required on one exact head

- Node CI: typecheck, unit tests and build;
- forward-only empty/baseline migrations and zero Prisma drift;
- industrial Settlement E2E, races, outbox, reconciliation and load proof;
- strict MFA unit proof;
- same-tenant ADMIN/SUPPORT_MANAGER outsider denial;
- forged callback and human direct confirmed-counter substitution denial;
- 12 roles / 19 commands one-deal;
- isolated backup/restore preserving Settlement facts, grants, RLS, ledger chain and outbox fingerprint;
- persistent auth exploitation gate;
- web-unit, dependency review, Security Scan and Security Quality Gate.

## Exact scope

Use only `allowedCurrentScope` in `docs/platform-v7/autopilot/autopilot-state.json`.
Forbidden-zone diff must remain zero for `apps/landing`, `apps/web`, packages, lockfiles, live integrations, production credentials and production migration execution.

## Locked until merge and post-merge transition

- IR-10.5 Disputes PostgreSQL Authority;
- IR-20 Canonical Durable Outbox;
- IR-21 Durable Integration Inbox;
- IR-22 Persistent Partner API and Outbound Webhooks;
- IR-30 through IR-90 in dependency order.

## Evidence boundary

PR #2439 does not activate or prove live SberAPI, an opened nominal account, real reserve/payout/refund, production deployment acceptance, production capacity, HA, provider PITR/DR, production RTO/RPO or operation by real users.

Industrial Integration-Ready remains **NO-GO** until every mandatory gate through IR-90 has accepted evidence.
