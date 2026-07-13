# Codex current task — IR-10.3 Labs PostgreSQL Authority

Maturity: pre-integration / isolated PostgreSQL evidence only.
Do not overstate maturity or imply live laboratory, accreditation or external protocol integrations.
Do not change `apps/landing`, `apps/web`, lockfiles, packages or live integration configuration.
Do not auto-merge. Exact-head green checks and diff review are required.

## Source of truth

- State: `docs/platform-v7/autopilot/autopilot-state.json`
- Queue: `docs/platform-v7/execution-queue.md`
- Progress: `docs/platform-v7/autopilot/progress.json`
- Governing specification: `docs/platform-v7/autopilot/industrial-integration-readiness-v1.0.md`

## Current step

IR-10.3 Labs PostgreSQL Authority

## Last completed

IR-10.2 Logistics PostgreSQL Authority — PR #2412, merge `a272a1e64b1a30d1e5b2a3052ca66653afd7b66f`, verified head `4c880433811adc70c3fcb4b76edf1bbe81556c99`.

## Current objective

1. Bind production `LabsModule` directly to a complete Prisma lab repository.
2. Remove RuntimeCore, optional Prisma, repository factory and process-memory laboratory authority from the production graph.
3. Normalize sample custody, laboratory actor, method, equipment, accreditation basis and protocol authority in PostgreSQL.
4. Enforce Deal participation and laboratory assignment through trusted server-derived RLS context.
5. Implement explicit collection, handoff, receipt, testing and finalization state transitions with optimistic concurrency and durable idempotency.
6. Commit sample/test/custody state, audit and `PENDING` outbox atomically.
7. Make finalized protocol facts immutable and require explicit superseding corrections.
8. Prove restart, multi-instance, same-tenant outsider, cross-tenant, concurrency and replay behavior.
9. Keep external laboratory systems and accreditation verification disabled unless separately accepted.

## Allowed current scope

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- apps/api/src/common/config/industrial-mode.ts
- apps/api/src/common/command-execution.context.ts
- apps/api/src/common/prisma/rls-transaction.service.ts
- apps/api/src/modules/deals/deal-command-payload.ts
- apps/api/src/modules/deals/deal-command.service.ts
- apps/api/src/modules/deals/postgresql-deal-command.service.ts
- apps/api/src/modules/deals/postgresql-deal-command.service.spec.ts
- apps/api/src/modules/labs/**
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260713*_labs_postgresql_authority/**
- apps/api/test/industrial/harness.ts
- apps/api/test/industrial/labs-postgresql-authority.e2e-spec.ts
- apps/api/test/one-deal/industrial-one-deal.e2e-spec.ts
- apps/api/test/one-deal/labs-postgresql-authority.e2e-spec.ts
- apps/api/test/one-deal/restored-database-acceptance.ts
- apps/api/test/one-deal/seed.ts
- infra/sql/postgresql-labs-authority-policies.sql
- scripts/platform-v7-forward-only-migration-check.mjs
- scripts/platform-v7-one-deal-e2e.sh
- .github/workflows/ci.yml

## Forbidden zones

- apps/landing
- apps/web
- package.json
- package-lock.json
- pnpm-lock.yaml
- packages
- live integration activation
- production migration execution
- production credentials and secret material

## Acceptance

- production bootstrap rejects missing, memory and unknown lab repository modes;
- production `LabsModule` has no RuntimeCore or optional-Prisma path;
- sample and test reads/writes are PostgreSQL-authoritative under trusted RLS;
- same-tenant nonparticipants and cross-tenant users cannot read or mutate laboratory objects;
- client-authored tenant, actor, laboratory assignment, accreditation, method, equipment, status and protocol authority is denied;
- custody and test facts use explicit state transitions, optimistic concurrency and durable idempotency;
- each mutation commits business state, custody fact, audit and outbox together or rolls back;
- finalized protocol facts are immutable and evidence-linked;
- restart and second-instance tests prove persistence rather than object reuse;
- no fake accreditation or live laboratory success is exposed;
- empty/baseline migrations, zero drift, restricted-principal RLS and exact-head CI pass.

## Next candidate

IR-10.4 Settlement PostgreSQL Authority. It remains locked until IR-10.3 is merged and source-of-truth documents are synchronized.

## Implementation brief

Implement IR-10.3 strictly inside the allowed scope. Treat all existing lab repository skeletons and RuntimeCore behavior as untrusted until verified against PostgreSQL, RLS, idempotency, optimistic concurrency, immutable evidence and atomic audit/outbox requirements.
