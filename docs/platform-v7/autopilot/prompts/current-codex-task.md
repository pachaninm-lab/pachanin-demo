# Codex current task — IR-10.3 Labs PostgreSQL Authority

Maturity: controlled-pilot / pre-integration.
Do not overstate maturity or imply live laboratory, accreditation-registry, КЭП, EDO or external protocol integrations.
Do not change apps/landing, apps/web, lockfiles, packages or live integration configuration.
Do not auto-merge. Exact-head green checks and diff review are required.

## Source of truth

- State: `docs/platform-v7/autopilot/autopilot-state.json`
- Queue: `docs/platform-v7/execution-queue.md`
- Progress: `docs/platform-v7/autopilot/progress.json`
- Governing specification: `docs/platform-v7/autopilot/industrial-integration-readiness-v1.0.md`
- Review blockers: PR #2426 body and latest maintainer comments

## Current step

IR-10.3 Labs PostgreSQL Authority

## Last completed

IR-10.2 Logistics PostgreSQL Authority — PR #2412, merge `a272a1e64b1a30d1e5b2a3052ca66653afd7b66f`.

## Current objective

1. Bind production `LabsModule` directly to a complete Prisma lab repository.
2. Remove RuntimeCore, optional Prisma, silent fallback and repository factory selection from the production Labs graph.
3. Normalize laboratory organization, accreditation, authorized personnel, sampler, custody transfers, methods, equipment, corrections and protocol authority in PostgreSQL.
4. Enforce direct Deal participant, assigned laboratory actor or explicit privileged-staff scope through trusted RLS.
5. Persist sample collection, custody, test results, corrections, protocol finalization, audit and PENDING outbox atomically.
6. Bind canonical `finalize_lab` to one valid custody chain and server-authoritative protocol basis without client-authored authority.
7. Prove restart, multi-instance, cross-tenant and same-tenant outsider denial, idempotency and optimistic concurrency.
8. Keep live laboratory/LIMS, accreditation registry, КЭП and EDO integrations disabled unless separately accepted.

## Non-negotiable authority invariants

- Never use `session_replication_role=replica`, disabled triggers, bypass-RLS roles or fake direct-state fixtures to make tests green.
- Test fixtures must pass the same production constraints and trusted context as runtime code.
- Sample transitions are strictly `CREATED → COLLECTED → IN_TRANSIT → RECEIVED → ANALYSIS_IN_PROGRESS → FINALIZED`; no `PENDING → FINALIZED` exception.
- Confirmed tests, custody facts and protocols are append-only. UPDATE/DELETE/late INSERT violations fail loudly; they are never silent no-ops.
- Actor types are operation-specific: `SAMPLER` for collection, `COURIER`/`RECEIVER` for custody, `ANALYST` for tests and `SIGNATORY` for protocol finalization.
- Signed protocol evidence is bound to the exact deal/sample/shipment/protocol purpose. Any unrelated evidence file from the same deal is insufficient.
- Finalization time is server-authoritative or cryptographically bound and strictly validated; arbitrary client time is rejected.
- Corrections create superseding facts and preserve history. Protocol aggregation ignores superseded facts and uses one deterministic active fact per parameter.
- Canonical `finalize_lab` and Deal/acceptance/event/audit/outbox changes commit or roll back together.
- Evidence purpose metadata is immutable from the first `UPLOAD_PENDING` INSERT. Never weaken the shared document-authority trigger or permit a post-insert metadata enrichment path merely to support fixtures.
- Fix shared test infrastructure at its root. Never alias `createRememberedInstance` separately across industrial suites, and never remove unrelated comments or assertions while repairing Labs.

## Immediate execution order

Do not spend another iteration only changing prompts, comments or static marker tests. Implement the production path in this order:

1. Fix `apps/api/test/industrial/harness.ts` at the root: exported `createInstance()` must register its returned `ServiceInstance` in `activeInstances`. Restore all suites to the normal `createInstance` import; do not patch `load-proof`, `observability` or `money-reconciliation` one by one.
2. Extend `StorageService.requestUpload()` and its controller contract so a validated flat evidence metadata object is persisted in the original trusted-RLS `UPLOAD_PENDING` INSERT. Then replace fixture direct metadata UPDATEs with `requestUpload({ ..., metadata })` followed by normal confirmation. Do not add or restore a migration that relaxes `deal_documents` metadata immutability.
3. Bind harness mutations to the same production repository boundary as `LabsModule`: `AuthorizedPrismaLabRepository` wrapping the Prisma delegate, not the raw delegate.
4. Persist laboratory corrections completely: normalize `supersedesId`, include it in the append-only `lab_tests` INSERT, event, audit and receipt material, preserve the predecessor and let protocol aggregation ignore superseded facts.
5. Enforce actor type at every production command and PostgreSQL trigger boundary: SAMPLER, COURIER/RECEIVER, ANALYST, SIGNATORY. Privileged staff may authorize or observe but must not silently become the physical laboratory actor.
6. Use `PostgresqlDealCommandService` in canonical one-deal runtime. After `confirm_inspection`, prepare authority, admission, sample, custody, tests and protocol evidence through the production laboratory boundary, then execute canonical `finalize_lab`.
7. Reject duplicate or reordered custody at the INSERT/command transaction. Prove zero custody, sample-version, audit and outbox partial effects after rejection; do not store a corrupted chain and defer detection to finalization.
8. Add real exact PostgreSQL E2E files, not marker-only tests. Cover the complete state path, same-payload replay, different-payload idempotency conflict, two-instance race, restart, same-tenant outsider, cross-tenant, every wrong actor type, expired accreditation/calibration, incomplete/reordered custody, missing/foreign/wrong-purpose evidence, correction history, append-only denials and full rollback.
9. Run typecheck/unit first, then empty/baseline migration plus zero Prisma drift, then industrial one-deal and transaction-core gates. Fix the first deterministic failure; do not mask it by modifying acceptance criteria.

Current deterministic blockers that must be eliminated:

- `createInstance()` does not register itself; callers fail inside `provisionDeal()`. The fix belongs in the harness factory, not in every suite import.
- `createVerifiedEvidence()` currently mutates `deal_documents.metadata` after the object identity was inserted. Purpose metadata must exist in the initial insert; the shared document trigger remains strict.
- `PrismaLabRepository.recordTest()` accepts `supersedesId` in the command type but does not normalize or persist it.
- Exact laboratory E2E must use `AuthorizedPrismaLabRepository`, not bypass it through the raw Prisma delegate.
- Canonical one-deal must execute the real laboratory lifecycle before `finalize_lab` and use `PostgresqlDealCommandService`.
- Duplicate/reordered custody must fail atomically when recorded, not remain as a confirmed fact.
- Changes in `load-proof.e2e-spec.ts`, `observability.e2e-spec.ts` and `money-reconciliation.e2e-spec.ts` are outside the accepted IR-10.3 repair path and must be reverted after the harness root fix.

No PASS may be claimed while any item above remains in the exact-head diff or while the non-bypass regression gate is red.

## Allowed current scope

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
- apps/api/src/modules/storage/storage.service.ts
- apps/api/src/modules/storage/storage.controller.ts
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
- temporary or self-modifying workflows
- direct pushes from GitHub Actions
- apps/api/test/industrial/load-proof.e2e-spec.ts
- apps/api/test/industrial/observability.e2e-spec.ts
- apps/api/test/industrial/money-reconciliation.e2e-spec.ts

## Acceptance

- production bootstrap rejects missing, memory and unknown lab repository modes;
- production module graph has no RuntimeCore or optional Prisma path;
- sample list/get/workspace and all laboratory facts are PostgreSQL-authoritative;
- same-tenant nonparticipants and cross-tenant users cannot read or mutate laboratory records;
- laboratory, accreditation, actor type, custody, method, equipment and evidence authority are server-derived and normalized;
- canonical `finalize_lab` consumes exactly one valid custody/protocol basis atomically and exact retry replays durably;
- collection, custody, test, correction and protocol facts persist across restart/instances and cannot be silently overwritten;
- mutations are idempotent, CAS-protected and atomic with audit/outbox;
- migrations pass on empty and baseline databases with zero drift;
- exact PostgreSQL E2E proves happy path, replay, two-instance race, restart, same-tenant outsider, cross-tenant, wrong actor type, expired accreditation, expired calibration, incomplete custody, missing/foreign evidence, correction and full rollback;
- exact-head CI and manual review pass with no trigger/RLS bypass in tests.

## Next candidate

IR-10.4 Settlement PostgreSQL Authority. It remains locked until IR-10.3 is merged and state is synchronized.

## Implementation brief

Implement IR-10.3 strictly inside the allowed scope. Treat current RuntimeCore behavior, direct-state fixtures and the read-only Prisma skeleton as untrusted legacy boundaries. Preserve only verified business semantics, then make PostgreSQL the exclusive authority without claiming live external laboratory integrations.
