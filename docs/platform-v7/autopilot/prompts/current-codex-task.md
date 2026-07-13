# Codex current task — IR-10.2 Logistics PostgreSQL Authority

Maturity: controlled-pilot / pre-integration.
Do not overstate maturity or imply live external integrations.
Do not change apps/landing, apps/web, lockfiles, packages or live integration configuration.
Do not auto-merge. Exact-head green checks and diff review are required.

## Source of truth

- State: `docs/platform-v7/autopilot/autopilot-state.json`
- Queue: `docs/platform-v7/execution-queue.md`
- Progress: `docs/platform-v7/autopilot/progress.json`
- Governing specification: `docs/platform-v7/autopilot/industrial-integration-readiness-v1.0.md`

## Current step

IR-10.2 Logistics PostgreSQL Authority

## Last completed

IR-10.1 Documents PostgreSQL Authority — PR #2410, merge `a485371e54b31fc787c061643c0068184e373c7b`.

## Current objective

1. Bind production `LogisticsModule` directly to a complete Prisma shipment repository.
2. Remove RuntimeCore, optional Prisma, silent fallback and process-memory logistics authority from the production graph.
3. Normalize and validate Deal-specific carrier, driver, vehicle, route and admission authority in PostgreSQL.
4. Enforce direct Deal participant, assigned-driver or explicit privileged-staff scope through trusted RLS.
5. Persist shipment operational facts with optimistic concurrency, idempotency, audit and PENDING outbox in one transaction.
6. Prove restart, multi-instance, cross-tenant and same-tenant outsider denial.
7. Keep telematics/GIS EPD providers disabled unless real activation is separately accepted.

## Allowed current scope

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- apps/api/src/common/config/industrial-mode.ts
- apps/api/src/common/command-execution.context.ts
- apps/api/src/common/prisma/rls-transaction.service.ts
- apps/api/src/modules/documents/document-repository.spec.ts
- apps/api/src/modules/deals/deal-command.service.ts
- apps/api/test/one-deal/industrial-one-deal.e2e-spec.ts
- apps/api/src/modules/deals/deal-command-payload.ts
- apps/api/src/modules/deals/deals.module.ts
- apps/api/src/modules/deals/logistics-admission-context.ts
- apps/api/src/modules/deals/logistics-admission.service.ts
- apps/api/src/modules/deals/postgresql-deal-command.service.ts
- apps/api/src/modules/deals/postgresql-deal-command.service.spec.ts
- apps/api/src/modules/logistics/**
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260713*_logistics_postgresql_authority/**
- apps/api/test/industrial/harness.ts
- apps/api/test/industrial/logistics-postgresql-authority.e2e-spec.ts
- apps/api/test/one-deal/logistics-postgresql-authority.e2e-spec.ts
- apps/api/test/one-deal/seed-logistics-admission.ts
- apps/api/test/one-deal/seed.ts
- infra/sql/postgresql-logistics-authority-policies.sql
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

- production bootstrap rejects missing, memory and unknown shipment repository modes;
- production module graph has no RuntimeCore or optional Prisma path;
- shipment list/get/workspace and operational facts are PostgreSQL-authoritative;
- same-tenant nonparticipants and cross-tenant users cannot read or mutate shipments;
- assignment consumes a valid normalized admission and binds one Shipment atomically;
- retry of the exact command replays durably without consuming another admission;
- checkpoint, GPS and PIN facts persist across restart/instances and never rely on process memory;
- mutations are idempotent, CAS-protected and atomic with audit/outbox;
- migrations pass on empty and baseline databases with zero drift;
- exact-head CI and manual review pass.

## Next candidate

IR-10.3 Labs PostgreSQL Authority. It remains locked until IR-10.2 is merged and state is synchronized.

## Implementation brief

Implement IR-10.2 strictly inside the allowed scope. Treat the existing draft PR #2408 as untrusted prior work: reuse only verified architectural ideas, not its stale base, failed CI status or incomplete repository skeleton.
