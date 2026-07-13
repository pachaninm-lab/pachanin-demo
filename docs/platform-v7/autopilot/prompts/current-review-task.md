# Review current task — IR-10.3 Labs PostgreSQL Authority

Maturity: pre-integration / isolated PostgreSQL evidence only.
Do not overstate maturity or imply live laboratory, accreditation or external protocol integrations.
Do not auto-merge. Review the exact diff and exact-head evidence.

## Required scope checks

- `apps/landing`, `apps/web`, lockfiles and packages diff must be 0;
- no live provider activation, credentials or fake-live claims;
- no RuntimeCore, optional Prisma or repository factory in the production Labs graph;
- no process-memory sample, test, custody or protocol authority;
- no hidden bypass of canonical Deal commands, RLS, idempotency, optimistic concurrency or immutable evidence.

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

## Review questions

1. Does production startup fail closed for missing, memory and unknown lab repository modes?
2. Does `LabsModule` bind one complete Prisma repository directly with no RuntimeCore or optional dependency?
3. Are tenant, actor, Deal participation, laboratory assignment, sample custody, method, equipment and accreditation basis derived and enforced server-side?
4. Are same-tenant outsiders and cross-tenant users denied under restricted-principal RLS tests?
5. Are collection, handoff, receipt, testing, correction and finalization explicit state transitions rather than free-form writes?
6. Are mutations optimistic-concurrency protected and durably idempotent across restart and instances?
7. Do sample/test/custody state, audit and `PENDING` outbox commit or roll back together?
8. Are finalized protocols and confirmed test facts immutable and linked to verified evidence?
9. Are corrections explicit superseding facts rather than overwrites?
10. Are live accreditation and external laboratory providers disabled rather than simulated as successful?
11. Do empty/baseline migrations, drift, build, unit, industrial, one-deal, DR and exact-head checks pass?

## Decision format

Return PASS or BLOCKED. If BLOCKED, state severity, exact file/line or migration object, risk and exact fix. Industrial Integration-Ready remains NO-GO regardless of this slice until IR-90 acceptance.
