# PC-CROP MASTER v2.1 execution queue

CURRENT: R1.1 Server-side inventory of 13 cabinets and authority

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- docs/execution/**

NEXT:
- Layer: R1.2 Controlled open-as-role server authority
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/autopilot/progress.json
  - docs/platform-v7/autopilot/prompts/current-codex-task.md
  - docs/platform-v7/autopilot/prompts/current-review-task.md
  - docs/platform-v7/execution-queue.md
  - apps/api/src/modules/staff-access/**
  - apps/api/prisma/migrations/*_r1_owner_role_session/**
  - apps/api/test/industrial/r1-owner-role-session.e2e-spec.ts
  - scripts/r1-owner-role-authority.mjs
  - .github/workflows/ci.yml
- Success criteria:
  - actual Founder actor remains distinct from effective role, tenant and organization;
  - role/tenant/organization authority is server-derived and PostgreSQL-backed;
  - VIEW_AS is read-only and high-risk actions keep ordinary authority plus recent MFA;
  - reason, expiry, session identity and audit are durable;
  - negative cross-tenant, self-authority and stale-session cases fail closed.
- Readiness remains R1_IN_PROGRESS.

## Authority
- MASTER: PC-CROP_CODEX_MASTER_TZ_v2.1_2026-09-12.
- Exact current-main and exact production baseline at R1 start: `5da8e80744908413102214f91dd68018911b892e`.
- REG.RU release controller evidence: run `35520784872`.
- R0 = PRODUCTION_PASS.
- IR-20 Canonical Durable Outbox = PRODUCTION_PASS.
- Official overall progress remains 5/100 = 5% until the whole R1 block reaches PRODUCTION_PASS.

## R1 serial queue
1. R1.1 exact inventory of the server-side 13-cabinet registry, role/object permissions, tenant boundaries, owner authority, audit and APIs.
2. R1.2 controlled open-as-role server authority.
3. R1.3 CEO overview and P0/P1 decision queue data contracts.
4. R1.4 real-data business/finance metrics contracts and lineage.
5. R1.5 negative authorization, audit/security, 13/13 live matrix, exact-SHA release and REG.RU acceptance/observation.

## Confirmed current-main R1 discovery
- Current owner target registry contains 13 targets: 12 business roles plus organization employee.
- Existing Staff Access plane already provides PostgreSQL-backed staff assignments, CONTROL_PLANE / VIEW_AS modes, permission ceilings, recent-MFA enforcement, delegated read-only guard and staff audit events.
- The direct owner cabinet shortcut binds production owner review to `controlled-test-organizations`; it is a regression/test review path, not acceptable R1 real-data authority.
- PR #5182 contains a stale Founder Control Center implementation and diverged materially from current main. Do not merge it wholesale; port only current-main-revalidated backend/data-contract pieces.
- Active public UX/UI PR #5465 is a separate visual scope. No R1 visual redesign or competing implementation is allowed.

## Conflict rule before every R1 slice
1. Re-check current main.
2. Inspect open UX/FGIS/bank PRs and changed files.
3. If overlap exists, restrict this lane to backend/API/data contracts or wait for a safe merge.
4. No force push, branch-protection bypass, forged review or stale evidence reuse.

## R1 terminal gate
R1 stays IN_PROGRESS until one accepted exact SHA proves REQ-R1-001..005 and REQ-ROL-001..006, 13/13 open/read-or-authorized-action/return, denied/high-risk negatives, real-data-only Founder metrics with source/drill-down, audit attribution, PRE_RELEASE_PASS, exact-current-main REG.RU release, live acceptance and required observation/evidence.

Only after that: OVERALL_PRODUCTION_PROGRESS = 12/100 = 12%.

## Parallel-account boundary
Do not redesign cabinet/Control Center UX. Do not implement parallel FGIS or bank/finance visual surfaces. This lane owns backend/domain/server authority, permissions, PostgreSQL/RLS, APIs, metric truthfulness, audit, tests, CI, security, release and production acceptance.

## Historical review-policy compatibility
Archived instruction only. Historical provider-specific instructions are not current delivery scope and do not reopen IR-20.

## Owner-authorized provider-independent review — 2026-09-18
The current development-review policy remains provider-independent. Branch `fix/provider-independent-review-20260918` established that no named AI provider is a mandatory dependency. The implementation author cannot supply their own independent review. A real independent human or separate review session must inspect the exact-head diff. `READY_FOR_MANUAL_REVIEW` is readiness only; `AUTOMATIC_MERGE_DISABLED` remains the default. Complete applicable substantive CI/security checks, exact-head identity, owner audit, active CHANGES_REQUESTED and unresolved review threads remain enforced. Existing GitHub branch protections apply and manual merge must be SHA-bound. IR-20 remains active only as historical evidence language in this compatibility block; its production status is separately recorded as PRODUCTION_PASS and no IR-20 delivery scope is reopened.
