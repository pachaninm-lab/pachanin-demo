# Review current task — IR-10.4 Settlement PostgreSQL Authority

Maturity: pre-integration / isolated PostgreSQL evidence only.
Do not imply live bank, nominal-account, credit, reserve or payout integration.
Do not auto-merge. Review exact diff, exact-head evidence and repository scope.

## Required scope checks

- `apps/landing`, `apps/web`, lockfiles and packages diff must be 0;
- no live provider activation, credentials or fake-live claims;
- no RuntimeCore, optional Prisma, repository factory, ActionExecutor memory authority or process-memory OutboxService in the production settlement graph;
- no float/`amountRub` financial authority;
- no human/operator confirmation of reserve or release;
- no trigger/RLS/idempotency/ledger bypass in fixtures;
- no temporary/self-modifying workflow and no direct push from Actions;
- state, task prompt and actual diff must agree.

## Automatic hard blockers

Return BLOCKED immediately for any of the following:

1. Settlement mutation still calls RuntimeCore or process-memory OutboxService.
2. Money authority is persisted or calculated in floating-point units.
3. `confirmWorksheet`, `releasePayment` or another human endpoint can confirm bank money movement.
4. Callback validation omits partner/key version/event/operation/fingerprint binding.
5. Exact callback replay creates a second financial effect, while conflicting replay is accepted.
6. Reserve, release, refund, beneficiary allocation or partial payout can exceed confirmed funds or become negative.
7. Payment/bank-operation/ledger/audit/outbox writes can partially commit.
8. Confirmed ledger or callback facts can be updated or deleted.
9. Reconciliation mismatch silently changes authority instead of entering manual review.
10. Same-tenant outsider or cross-tenant access passes under restricted principals.
11. CI is made green by disabling RLS, triggers, constraints or required tests.

## Review questions

1. Does production bootstrap fail closed for missing, memory and unknown payment repository modes?
2. Is PostgreSQL the only production settlement authority?
3. Are tenant, actor, Deal participation and financial role derived server-side?
4. Are all amounts integer kopecks with explicit overflow and boundary checks?
5. Are payment terms and release basis versioned Deal-linked facts?
6. Do reserve/release/refund requests atomically create payment state, bank operation, audit and PENDING outbox?
7. Can only a verified callback confirm money movement?
8. Are callbacks durably idempotent across restart and multiple instances?
9. Are holds, partial releases, beneficiary allocations and refunds bounded by confirmed reserve?
10. Are ledger entries append-only, balanced and linked to audit/correlation IDs?
11. Does reconciliation mismatch fail closed without mutating confirmed authority?
12. Are same-tenant outsiders and cross-tenant users denied by PostgreSQL RLS?
13. Do empty/baseline migrations, drift, typecheck, tests, build, one-deal, DR and exact-head security gates pass?

## Mandatory exact PostgreSQL proof matrix

- reserve request and verified callback confirmation;
- release request and verified callback confirmation;
- exact replay and conflicting replay;
- two-instance callback and command races;
- restart persistence;
- same-tenant outsider and cross-tenant denial;
- hold/dispute blocking;
- partial payout and multiple beneficiaries;
- over-release, negative amount and overflow denial;
- refund bounds;
- reconciliation match and mismatch/manual review;
- full rollback with no partial payment/bank operation/ledger/audit/outbox effects;
- append-only denial for confirmed financial facts.

## Decision format

Return PASS or BLOCKED. If BLOCKED, state severity, exact file/line or migration object, financial risk and exact fix. Industrial Integration-Ready remains NO-GO regardless of this slice until IR-90 acceptance.
