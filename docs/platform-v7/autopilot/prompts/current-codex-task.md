# Codex current task — IR-10.3 Labs PostgreSQL Authority

Maturity: controlled-pilot / pre-integration.
Do not overstate maturity or imply live laboratory, accreditation-registry, EDO or external protocol integrations.
Do not change apps/landing, apps/web, lockfiles, packages or live integration configuration.
Do not auto-merge. Exact-head green checks and diff review are required.

## Source of truth

- State: `docs/platform-v7/autopilot/autopilot-state.json`
- Queue: `docs/platform-v7/execution-queue.md`
- Progress: `docs/platform-v7/autopilot/progress.json`
- Governing specification: `docs/platform-v7/autopilot/industrial-integration-readiness-v1.0.md`

## Current step

IR-10.3 Labs PostgreSQL Authority

## Last completed

IR-10.2 Logistics PostgreSQL Authority — PR #2412, merge `a272a1e64b1a30d1e5b2a3052ca66653afd7b66f`.

## Current objective

1. Bind production `LabsModule` directly to a complete Prisma lab repository.
2. Remove RuntimeCore, optional Prisma, silent fallback and repository factory selection from the production Labs graph.
3. Normalize laboratory organization, accreditation, authorized personnel, sampler, custody transfers, methods, equipment and protocol authority in PostgreSQL.
4. Enforce direct Deal participant, assigned laboratory actor or explicit privileged-staff scope through trusted RLS.
5. Persist sample collection, custody, test results, protocol finalization, corrections, audit and PENDING outbox atomically.
6. Bind canonical `finalize_lab` to one valid custody chain and server-authoritative protocol basis without client-authored authority.
7. Prove restart, multi-instance, cross-tenant and same-tenant outsider denial, idempotency and optimistic concurrency.
8. Keep live laboratory/LIMS, accreditation registry and EDO integrations disabled unless separately accepted.

## Allowed current scope

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- apps/api/src/common/config/industrial-mode.ts
- apps/api/src/common/command-execution.context.ts
- apps/api/src/common/prisma/rls-transaction.service.ts
- apps/api/src/modules/deals/deal-command.service.ts
- apps/api/src/modules/deals/deal-command-payload.ts
- apps/api/src/modules/deals/postgresql-deal-command.service.ts
- apps/api/src/modules/deals/postgresql-deal-command.service.spec.ts
- apps/api/src/modules/labs/**
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260713*_labs_postgresql_authority/**
- apps/api/test/industrial/harness.ts
- apps/api/test/industrial/deal-command-no-fake-live.e2e-spec.ts
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
- production module graph has no RuntimeCore or optional Prisma path;
- sample list/get/workspace and all laboratory facts are PostgreSQL-authoritative;
- same-tenant nonparticipants and cross-tenant users cannot read or mutate laboratory records;
- laboratory, accreditation, actor, custody, method and equipment authority are server-derived and normalized;
- canonical `finalize_lab` consumes a valid custody/protocol basis atomically and exact retry replays durably;
- collection, custody, test and protocol facts persist across restart/instances and confirmed facts cannot be silently overwritten;
- mutations are idempotent, CAS-protected and atomic with audit/outbox;
- migrations pass on empty and baseline databases with zero drift;
- exact-head CI and manual review pass.

## Next candidate

IR-10.4 Settlement PostgreSQL Authority. It remains locked until IR-10.3 is merged and state is synchronized.

## Implementation brief

Implement IR-10.3 strictly inside the allowed scope. Treat current RuntimeCore behavior and the read-only Prisma skeleton as untrusted legacy boundaries. Preserve only verified business semantics, then make PostgreSQL the exclusive authority without claiming live external laboratory integrations.
