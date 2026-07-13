# Review current task — IR-10.3 Labs PostgreSQL Authority

Maturity: controlled-pilot / pre-integration.
Do not overstate maturity or imply live external laboratory, accreditation-registry, КЭП or EDO integrations.
Do not auto-merge. Review the exact diff and exact-head evidence.

## Required scope checks

- `apps/landing`, `apps/web`, lockfiles and packages diff must be 0;
- no live provider activation, credentials or fake-live claims;
- no RuntimeCore, optional Prisma or repository factory in the production Labs graph;
- no process-memory sample, custody, test, correction or protocol authority;
- no hidden bypass of canonical Deal commands, RLS, triggers, constraints, idempotency, optimistic concurrency or evidence provenance;
- no temporary/self-modifying workflow and no direct push from Actions;
- `autopilot-state.json`, current Codex task and actual changed-file scope must agree exactly.

## Current allowed scope

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- apps/api/src/common/config/industrial-mode.ts
- apps/api/src/common/command-execution.context.ts
- apps/api/src/common/prisma/rls-transaction.service.ts
- apps/api/src/modules/deals/canonical-test-deal.seed.ts
- apps/api/src/modules/deals/deals.module.ts
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

## Automatic hard blockers

Any item below is an immediate BLOCKED decision:

1. `session_replication_role=replica`, `DISABLE TRIGGER`, `BYPASSRLS` or an equivalent fixture bypass.
2. Direct destructive reseeding of confirmed laboratory facts, including `labTest.deleteMany`.
3. A legacy `PENDING -> FINALIZED` sample transition.
4. Silent `RETURN NULL` handling of an append-only violation or a late fact after finalization.
5. An ANALYST, SAMPLER, COURIER or RECEIVER permitted to sign the final protocol; finalization requires SIGNATORY authority.
6. Client-authored laboratory organization, accreditation, method, equipment, protocol result, applicable standard or unbounded `finalizedAt`.
7. Evidence accepted only because it belongs to the same Deal, without exact deal/sample/shipment/protocol-purpose binding.
8. Protocol aggregation that includes superseded test facts or loses correction history.
9. Missing exact PostgreSQL Labs E2E, or tests that prove only object reuse/single process.
10. Green CI obtained by weakening a database constraint, trigger, RLS policy, state machine or non-bypass regression test.

## Review questions

1. Does production startup fail closed for missing, memory and unknown lab repository modes?
2. Does `LabsModule` bind a complete Prisma repository directly with no RuntimeCore or optional dependency?
3. Are tenant, actor, role, Deal participation, laboratory organization, accreditation, sampler, custody, method and equipment derived and enforced server-side?
4. Are actor types operation-specific: SAMPLER for collection, COURIER/RECEIVER for custody, ANALYST for testing and SIGNATORY for finalization?
5. Are same-tenant outsiders and cross-tenant users denied by restricted-principal RLS tests?
6. Does canonical `finalize_lab` consume exactly one valid custody/protocol basis atomically and support durable exact-command replay?
7. Are collection, custody, test, correction and protocol mutations CAS-protected, idempotent and atomic with Deal/acceptance/audit/outbox?
8. Do restart and two-instance race tests prove persistence and serialization rather than object reuse?
9. Are finalized facts immutable, with corrections represented as explicit superseding records and excluded from active-result aggregation?
10. Is signed evidence purpose-bound to the exact sample/protocol, with server-authoritative time and provenance?
11. Are live LIMS, accreditation registry, КЭП and EDO paths disabled rather than simulated as live?
12. Do empty/baseline migrations, zero drift, typecheck, build, unit, industrial, one-deal, non-bypass and exact-head CI pass?

## Mandatory exact PostgreSQL proof matrix

- full happy path through production service/gateway methods;
- exact idempotent replay after restart;
- two API/service instances racing on one sample/protocol basis;
- same-tenant outsider denial;
- cross-tenant denial;
- wrong actor type at each operation;
- expired accreditation;
- expired equipment calibration;
- missing, incomplete or reordered custody;
- missing, unrelated or foreign signed evidence;
- correction by superseding fact with preserved history;
- full rollback with no partial sample/protocol/acceptance/deal/event/audit/outbox facts.

## Decision format

Return PASS or BLOCKED. If BLOCKED, state severity, exact file/line or migration object, risk and exact fix. Industrial Integration-Ready remains NO-GO regardless of this slice until IR-90 acceptance.
