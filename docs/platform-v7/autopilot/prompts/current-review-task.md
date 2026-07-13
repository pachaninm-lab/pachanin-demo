# Review current task — IR-10.4 Settlement PostgreSQL Authority

Maturity: pre-integration / isolated PostgreSQL evidence only.
Do not imply live bank, nominal-account, credit, reserve or payout integration.
Do not auto-merge.

PR: `#2439`
Base: `f8b4b807223443736b012f355d30cc24e5815ff0`
Candidate head: pending final exact-head CI after Source of Truth synchronization.
Previous green implementation head: `194cc10bdf9f00d3b81c16c2f2b1c17d5a3d9fe9`.

## Required scope checks

- `apps/landing`, `apps/web`, package files, lockfiles and `packages/**` diff must be zero;
- no live provider activation, production credentials, production migration execution or fake-live claims;
- no temporary/self-modifying workflow and no direct push from Actions;
- every changed file must be present in `allowedCurrentScope`;
- state, queue, progress, prompts, PR body and actual diff must agree;
- final branch must be `behind_by=0` against current `main`.

## Automatic hard blockers

Return **BLOCKED** for any of the following:

1. Production Settlement uses RuntimeCore, ActionExecutor, optional Prisma, a repository factory or process-memory OutboxService.
2. Money authority is floating-point or legacy `amountRub` is readable/writable authority.
3. A human, operator, administrator or UI endpoint can confirm reserve, release or refund.
4. Financial HTTP mutations accept missing, stale, future or client-header-only MFA evidence.
5. ADMIN or SUPPORT_MANAGER can access Settlement without an exact active DealParticipant row.
6. Callback validation omits partner, key version, event ID, operation ID or payload fingerprint.
7. Confirmed money counters can change without one exact validated PENDING bank operation or by a different amount/type.
8. Exact replay creates a second effect or conflicting replay is accepted.
9. Reserve, release, refund, beneficiary allocation, hold or partial payout can exceed confirmed funds or become negative.
10. Payment, bank operation, ledger, audit or outbox can partially commit.
11. A callback can confirm while its exact durable bank-request outbox remains pending.
12. Confirmed ledger or callback facts can be updated or deleted.
13. Reconciliation mismatch changes confirmed authority instead of entering manual review.
14. Same-tenant outsider or cross-tenant access passes under restricted principals.
15. CI is made green by disabling RLS, triggers, constraints, tests or principal boundaries.
16. Live SberAPI, nominal-account, credit or real-money claims are introduced.

## Mandatory proof matrix

- reserve request and verified reserve callback;
- release request and verified release callback;
- partial payouts and multiple beneficiaries;
- holds and undisputed release bounds;
- refunds and refund bounds;
- exact replay and conflicting replay;
- two-instance command and callback races;
- restart persistence and durable receipt replay;
- strict recent financial MFA;
- same-tenant ADMIN/SUPPORT_MANAGER outsider denial;
- cross-tenant denial;
- direct confirmed-counter substitution denial for a human actor;
- direct confirmed-counter substitution denial for forged BANK_CALLBACK identity without transaction binding;
- negative amount, overflow and over-release denial;
- reconciliation match and mismatch/manual review;
- append-only denial;
- full rollback without partial payment/operation/ledger/audit/outbox effects;
- one-deal and restored database using the production Settlement path;
- migration, drift, typecheck, tests, build and security gates on one exact head.

## Evidence boundary

Passing proves only the isolated PostgreSQL-authoritative Settlement slice.
It does not prove live bank connectivity, an opened nominal account, real reserve/release, production capacity, HA, provider DR, production RTO/RPO or real-user operation.

## Decision format

Return `PASS` or `BLOCKED`.
For `BLOCKED`, state severity, exact file/object, financial risk and exact fix.
Industrial Integration-Ready remains **NO-GO** until IR-90 acceptance.
