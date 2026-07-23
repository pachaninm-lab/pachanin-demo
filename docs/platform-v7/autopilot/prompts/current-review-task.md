# Review current task — IR-10.4 Settlement PostgreSQL Authority

Maturity: pre-integration / isolated PostgreSQL evidence only.
Do not imply live bank, nominal-account, credit, reserve or payout integration.
Do not auto-merge. Review exact diff, exact-head evidence and repository scope.

## Required scope checks

- `apps/landing`, `apps/web`, lockfiles and packages diff must be 0 for the serialized IR-10.4 branch, except for the explicitly approved concurrent scopes below;
- no live provider activation, credentials or fake-live claims;
- no RuntimeCore, optional Prisma, repository factory, ActionExecutor memory authority or process-memory OutboxService in the production settlement graph;
- no float/`amountRub` financial authority;
- no human/operator confirmation of reserve or release;
- no trigger/RLS/idempotency/ledger bypass in fixtures;
- no temporary/self-modifying workflow and no direct push from Actions;
- state, task prompt and actual diff must agree.

## Approved concurrent infrastructure scope — IR-K8S #2659 / PR #2660

The serialized primary task remains IR-10.4. A separate, isolated infrastructure acceptance slice is authorized for branch `ir/k8s-production-like-2659` under:

`docs/platform-v7/autopilot/scopes/ir-k8s-production-like-2659.json`

Review this branch only against that exact allow-list. It may add the production-like Kubernetes workflow, disposable kind topology, runtime dependencies, hardening manifests, PgBouncer configuration and `scripts/release/production-like-kubernetes-*` acceptance/evidence tooling. It must not change application/domain code, Prisma schema or migrations, web code, packages or lockfiles.

This concurrent scope proves only a disposable multi-node production-like deployment, immutable rollout and same-schema rollback. It does not advance the global maturity status, does not prove provider HA/PITR or production capacity, and does not authorize any live external integration.

## Approved concurrent public homepage scope — PR #3046

The user explicitly authorized a narrow public-copy completion slice on branch `agent/platform-v7-strategic-rebuild-v3` under:

`docs/platform-v7/autopilot/scopes/platform-v7-strategic-rebuild-v3.json`

Review this branch only against its exact allow-list. It may change the RU/EN/ZH public homepage copy, the dedicated public-copy test and the bound scope manifest. It must not change API, database, RBAC, protected routes, TAI runtime, intake persistence, deployment topology, lockfiles or packages.

The public text must present the platform through capabilities and user outcomes, must not contain development-stage or maturity-status language, and must not claim that bank, FGIS, EDI or another external system is connected without separate runtime evidence.

## Approved concurrent production web hardening scope — PR #3044

The user explicitly authorized a narrow REG.RU web-only operational slice on branch `ops/production-web-hardening-v1`. Review only these paths:

- `.github/workflows/production-hosting-authority.yml`;
- `.github/workflows/production-web-exact-sha.yml`;
- `.github/workflows/production-web-key-normalization-retry.yml`;
- `apps/web/app/api/health/ready/route.ts`;
- `docs/ops/active-hosting-contour.md`;
- `docs/ops/production-web-hardening.md`;
- `docs/ops/virtual-server-production-runbook.md`;
- `docs/ops/vps-post-deploy-checklist.md`;
- `infra/compose/production-web-hardening.override.yml`;
- `infra/docker/Dockerfile.web`;
- `scripts/check-production-hosting-authority.mjs`;
- `scripts/check-production-web-hardening.mjs`;
- `scripts/production-web-exact-sha.sh`;
- `scripts/production-web-live-acceptance.sh`;
- `scripts/production-web-remote-entrypoint.sh`.

This slice may add exact-SHA web deployment, readiness healthcheck, immutable rollback, Compose metadata recovery, Watchtower retirement and a one-shot fail-closed SSH private-key normalization retry against the already published immutable target. It must not change API, PostgreSQL, migrations, Caddy, production environment values, volumes, networks, domain logic, money logic, external integrations, packages or lockfiles. Production claims require running OCI revision and live-domain evidence.

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

For the approved IR-K8S concurrent scope, also return BLOCKED if:

12. The actual diff exceeds the allow-list in the IR-K8S scope manifest.
13. A chart or acceptance overlay creates additive broad egress that weakens destination-scoped NetworkPolicy.
14. A probe/helper pod impersonates a monitored workload selector or gains unnecessary network authority.
15. Images are mutable, mixed-commit, not registry-digest addressed or not bound to the exact head.
16. API or worker runs schema migrations, or application principals gain DDL authority.
17. Evidence is not machine-readable, exact-head bound or contains violated thresholds.

For the public homepage concurrent scope, return BLOCKED if:

18. The diff exceeds the bound homepage scope.
19. Public copy includes implementation-stage, pilot, pre-live or maturity-status language.
20. Public copy states that an external system is connected without verified runtime evidence.
21. RU, EN or ZH is incomplete or semantically inconsistent.

For the production web hardening concurrent scope, return BLOCKED if:

22. The diff exceeds the 15-path hardening allow-list.
23. SSH identity or protected server paths are committed, printed or defaulted to an unprotected principal.
24. Deployment uses `latest`, mutable-image acceptance or Watchtower polling as release evidence.
25. A non-web service, Caddy, environment, volume, network, API or database is mutated.
26. The image lacks exact manifest/revision binding, readiness healthcheck or an immutable rollback path.
27. The retry workflow accepts a public key, encrypted key, unknown key material or secret disclosure instead of failing closed before SSH.

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

For IR-K8S #2659 additionally verify:

14. Does default Helm rendering remain fail-closed with zero executable workloads?
15. Are API, web, worker and migration images a complete immutable exact-head digest set?
16. Does one separate migration Job complete before API/web/worker rollout?
17. Are two replicas of API, web and outbox worker ready on separate worker nodes?
18. Do PDB, anti-affinity, non-root, read-only filesystem, dropped capabilities, seccomp and disabled service-account tokens hold at runtime?
19. Are NetworkPolicies destination-scoped without additive broad chart policies?
20. Do single-pod deletion, rolling update and same-schema rollback meet all declared thresholds?
21. Does the evidence artifact identify the exact commit, commands, actuals, thresholds, violations and maturity boundary?

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

Return PASS or BLOCKED. If BLOCKED, state severity, exact file/line or migration object, financial or operational risk and exact fix. Industrial Integration-Ready remains NO-GO regardless of this slice until IR-90 acceptance.
