# Codex current task — IR-10.4 Settlement PostgreSQL Authority

Maturity: pre-integration / isolated PostgreSQL evidence only.
Do not imply live bank, nominal-account, credit, reserve or payout integration.
Do not auto-merge, activate providers, execute production migrations or push directly to `main`.

## Current status

PR `#2439` is draft and synchronized with current `main` base `f8b4b807223443736b012f355d30cc24e5815ff0`.

Previous implementation evidence was green on `194cc10bdf9f00d3b81c16c2f2b1c17d5a3d9fe9`. Manual review then added three mandatory hardening layers that require a new full exact-head run:

1. recent server-derived MFA for every financial HTTP mutation;
2. exact active DealParticipant scope for all human roles, including ADMIN and SUPPORT_MANAGER;
3. PostgreSQL binding of confirmed counter changes to one exact validated PENDING bank operation.

IR-10.5 remains locked until PR #2439 receives final exact-head green evidence, manual PASS, merge and post-merge Source of Truth transition.

## Implemented isolated slice

- direct PostgreSQL production Settlement binding;
- versioned payment terms and beneficiary allocations;
- reserve, partial release, refund and hold state in integer minor units;
- verified callback-only confirmation;
- partner/key/event/operation/payload-fingerprint binding;
- recent server-derived financial MFA at the authenticated HTTP boundary;
- exact human DealParticipant scope without ADMIN/SUPPORT_MANAGER bypass;
- confirmed counter delta bound to one exact callback operation at the database layer;
- durable idempotency, CAS, restart and multi-instance safety;
- append-only callbacks and balanced hash-linked ledger facts;
- reconciliation mismatch to manual review;
- atomic payment, bank-operation, ledger, audit and durable outbox effects;
- one-deal and isolated backup/restore through the same Settlement path.

## Mandatory final checks

- Node CI: typecheck, unit tests and build;
- forward-only empty/baseline migrations and zero Prisma drift;
- Settlement industrial E2E including races, replay, partial payouts, beneficiaries, holds, refunds and reconciliation;
- direct confirmed-counter substitution denial;
- ADMIN/SUPPORT_MANAGER same-tenant outsider denial under restricted PostgreSQL principal;
- strict financial MFA unit proof;
- 12 roles / 19 commands one-deal;
- isolated PostgreSQL backup/restore with Settlement fingerprint, grants, RLS, ledger chain and durable outbox proof;
- persistent auth exploitation gate;
- web-unit, dependency review, Security Scan and Security Quality Gate.

## Exact corrected scope

Use only `allowedCurrentScope` from `docs/platform-v7/autopilot/autopilot-state.json`.
The final support additions are:

- migrations `20260713147000_settlement_participant_scope_hardening` and `20260713148000_settlement_confirmed_counter_guard`;
- `apps/api/test/industrial/settlement-participant-scope.e2e-spec.ts`;
- `apps/api/test/industrial/settlement-confirmed-counter-guard.e2e-spec.ts`.

This adds no web, landing, package, live-integration, production credential or production migration-execution scope.

## Non-negotiable invariants

- no RuntimeCore, ActionExecutor, optional Prisma, repository factory or process-memory OutboxService in production Settlement DI;
- no human/operator path can confirm money movement;
- no float or `amountRub` authority;
- no direct substitution of confirmed money state;
- no ADMIN/SUPPORT_MANAGER participant bypass;
- no client-header or missing-claim MFA acceptance;
- no negative balance, reserve inflation, double release, over-release or beneficiary overflow;
- exact replay has one effect; conflicting replay is rejected;
- payment, operation, ledger, audit and outbox commit or roll back together;
- confirmed callback and ledger facts are append-only;
- reconciliation mismatch does not repair money automatically;
- no RLS, trigger, constraint or fixture bypass;
- no live SberAPI, nominal account, credit or real-money claim.

Industrial Integration-Ready remains **NO-GO** until IR-90 acceptance.
