# Review current task — IR-10.2 Logistics PostgreSQL Authority

Maturity: controlled-pilot / pre-integration.
Do not overstate maturity or imply live external integrations.
Do not auto-merge. Review the exact diff and exact-head evidence.

## Required scope checks

- `apps/landing`, `apps/web`, lockfiles and packages diff must be 0;
- no live provider activation, credentials or fake-live claims;
- no RuntimeCore, optional Prisma or repository factory in the production Logistics graph;
- no process-memory logistics authority or fire-and-forget authoritative writes;
- no hidden bypass of canonical Deal commands, RLS, idempotency or optimistic concurrency.

## Current allowed scope

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- apps/api/src/common/config/industrial-mode.ts
- apps/api/src/common/command-execution.context.ts
- apps/api/src/common/prisma/rls-transaction.service.ts
- apps/api/src/modules/deals/deal-command-payload.ts
- apps/api/src/modules/deals/deals.module.ts
- apps/api/src/modules/deals/logistics-admission-context.ts
- apps/api/src/modules/deals/logistics-admission.service.ts
- apps/api/src/modules/deals/postgresql-deal-command.service.ts
- apps/api/src/modules/deals/postgresql-deal-command.service.spec.ts
- apps/api/src/modules/logistics/**
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260713*_logistics_postgresql_authority/**
- apps/api/test/industrial/logistics-postgresql-authority.e2e-spec.ts
- apps/api/test/one-deal/logistics-postgresql-authority.e2e-spec.ts
- apps/api/test/one-deal/seed-logistics-admission.ts
- apps/api/test/one-deal/seed.ts
- infra/sql/postgresql-logistics-authority-policies.sql
- scripts/platform-v7-forward-only-migration-check.mjs
- scripts/platform-v7-one-deal-e2e.sh
- .github/workflows/ci.yml

## Review questions

1. Does production startup fail closed for missing, memory and unknown shipment repository modes?
2. Does `LogisticsModule` bind a complete Prisma repository directly with no RuntimeCore or optional dependency?
3. Are tenant, actor, role, Deal participation, assigned driver, carrier, vehicle, route and admission derived and enforced server-side?
4. Are same-tenant outsiders and cross-tenant users denied by restricted-principal RLS tests?
5. Does canonical `assign_logistics` consume and bind one admission atomically and support exact-command idempotent replay?
6. Are shipment checkpoint, GPS and driver-verification mutations CAS-protected, idempotent and atomic with audit/outbox?
7. Do restart and second-instance tests prove persistence rather than object reuse?
8. Are confirmed physical facts append-only or corrected through explicit new records?
9. Are provider-dependent telematics/GIS EPD paths disabled rather than simulated as live?
10. Do empty/baseline migrations, drift, build, unit, industrial, one-deal and exact-head CI pass?

## Known stale work warning

Draft PR #2408 was created from an obsolete base and had failing CI. Its normalized-admission ideas may be reused only after rebasing/reimplementation and closing these known defects:
- application used the non-replay resolver after admission consumption;
- broad legacy deal visibility could expose same-tenant nonparticipants;
- trigger expected stale `ASSIGNED` while the canonical command emits `DRIVER_ASSIGNED`;
- production Logistics repository remained a RuntimeCore-backed factory with a Prisma skeleton.

## Decision format

Return PASS or BLOCKED. If BLOCKED, state severity, exact file/line or migration object, risk, and exact fix. Industrial Integration-Ready remains NO-GO regardless of this slice until IR-90 acceptance.
