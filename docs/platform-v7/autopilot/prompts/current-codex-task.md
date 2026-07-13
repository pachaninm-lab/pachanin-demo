# Codex current task — IR-10.4 Settlement PostgreSQL Authority

Maturity: pre-integration / isolated PostgreSQL evidence only.
Do not imply live bank, nominal-account, credit, reserve or payout integration.
Do not change `apps/landing`, `apps/web`, lockfiles, packages or production credentials.
Do not auto-merge, create self-modifying workflows or push directly to `main`.

## Source of truth

- State: `docs/platform-v7/autopilot/autopilot-state.json`
- Queue: `docs/platform-v7/execution-queue.md`
- Progress: `docs/platform-v7/autopilot/progress.json`
- Governing specification: `docs/platform-v7/autopilot/industrial-integration-readiness-v1.0.md`

## Current step

IR-10.4 Settlement PostgreSQL Authority

## Last completed

IR-10.3 Labs PostgreSQL Authority — PR #2426, merge `576d813c2d305efb645c9d26fa81a38fb6e4abbe`, verified head `73149bb4fba09a33875311faea313bb2ad272503`.

## Current objective

1. Bind production `SettlementEngineModule` directly to a complete PostgreSQL settlement repository.
2. Remove RuntimeCore, optional Prisma, repository factory, ActionExecutor memory authority and process-memory OutboxService from the production settlement graph.
3. Normalize versioned payment terms, beneficiaries, reserve/release/refund basis, holds, partial payouts, bank operations and reconciliation facts.
4. Store and calculate money only in integer minor units.
5. Enforce Deal participation, tenant and money-role authority through trusted RLS.
6. Make reserve/release/refund requests atomic with payment state, bank operation, audit and `PENDING` outbox.
7. Confirm money movement only through a verified bank callback; human/operator paths cannot self-confirm reserve or release.
8. Prove idempotency, optimistic concurrency, restart, multi-instance, callback races, reconciliation and restricted-principal denial.
9. Keep live SberAPI, nominal account, credit and money movement disabled until separately accepted.

## Non-negotiable invariants

- No `amountRub`, floating-point or decimal money authority. Canonical persisted amounts are integer kopecks.
- No negative balances, over-release, double release, reserve inflation or beneficiary allocation above confirmed reserve.
- A request is not confirmation. Reserve/release/refund stay pending until verified callback authority commits.
- Callback identity, partner, key version, operation ID, event ID and payload fingerprint are server-verified and durably replay-safe.
- Payment, bank operation, ledger, audit and outbox effects commit together or roll back together.
- Ledger facts are append-only and balanced for every confirmed money event.
- Holds and disputes block the affected release amount without corrupting the undisputed portion.
- Reconciliation mismatch fails closed into manual review; it never silently repairs financial authority.
- No test may disable RLS/triggers or mutate confirmed financial facts directly.

## Allowed current scope

Use the exact scope from `autopilot-state.json`, centred on:

- `apps/api/src/modules/settlement-engine/**`
- canonical Deal command/gateway files listed in state
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260713*_settlement_postgresql_authority/**`
- settlement/reconciliation/outbox industrial tests listed in state
- `infra/sql/postgresql-settlement-authority-policies.sql`
- migration and one-deal scripts listed in state
- Source of Truth documents

## Forbidden zones

- apps/landing
- apps/web
- package and lock files
- live integration activation
- production migration execution
- production secrets
- temporary or self-modifying workflows
- direct pushes from GitHub Actions

## Acceptance

- production startup rejects missing, memory and unknown payment repository modes;
- production settlement graph contains no RuntimeCore, optional Prisma, repository factory or process-memory money/outbox authority;
- reads and mutations are PostgreSQL-authoritative under trusted RLS;
- same-tenant outsiders and cross-tenant users are denied;
- payment terms and release basis are versioned and Deal-linked;
- reserve/release/refund requests are atomic and callback-only for confirmation;
- partial payout, holds, beneficiary allocation and refunds satisfy money invariants;
- callback replay, conflicting replay, multi-instance races and reconciliation mismatch are proven;
- migrations pass on empty and baseline databases with zero drift;
- exact-head CI and manual review pass without fake-live claims.

## Next candidate

IR-10.5 Disputes PostgreSQL Authority remains locked until IR-10.4 is merged and Source of Truth is synchronized.
