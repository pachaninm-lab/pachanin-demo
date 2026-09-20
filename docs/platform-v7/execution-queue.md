# PC-CROP MASTER v2.1 execution queue

CURRENT: R1 Founder/CEO Control Center and owner access to all 13 cabinets
OFFICIAL OVERALL: 5/100 = 5%
TARGET AFTER R1 PRODUCTION_PASS: 12/100 = 12%

## Authority
- MASTER: PC-CROP_CODEX_MASTER_TZ_v2.1_2026-09-12.
- Exact current-main and exact production baseline at R1 start: `5da8e80744908413102214f91dd68018911b892e`.
- REG.RU release controller evidence: run `35520784872`.
- R0 = PRODUCTION_PASS.
- IR-20 Canonical Durable Outbox = PRODUCTION_PASS.
- Historical IR queue remains evidence/background only where it does not conflict with MASTER v2.1 or current factual state.

## R1 serial queue
1. R1.1 exact inventory: derive the 13 production cabinets from current server role/route authority; map role/object permissions, tenant boundaries, owner access, audit and APIs.
2. R1.2 controlled open-as-role: actual actor remains Founder; effective role/org/tenant are server-bound; reason/session/audit are durable; safe return; high-risk actions keep normal authority and MFA.
3. R1.3 CEO overview and P0/P1 decision queue: real PostgreSQL data only, source/lineage/drill-down for every value.
4. R1.4 cash/runway, pipeline, client P&L, AR/DSO, forecast, retention, hiring and scale gates: real-data-only, explicit unavailable/empty states, no fabricated metrics.
5. R1.5 negative authorization, audit/security, desktop/mobile 13/13 acceptance, exact-current-main release and REG.RU live acceptance/observation.

## Confirmed current-main R1 gap at activation
- Server registry exposes 13 owner-controlled targets: 12 business roles plus organization employee.
- Existing staff access plane already has PostgreSQL-authoritative CONTROL_PLANE / VIEW_AS sessions, permission ceilings, recent-MFA enforcement, read-only delegated guard and audited staff events.
- The direct owner cabinet shortcut currently binds production owner review to `controlled-test-organizations`; that path cannot satisfy R1 real-data-only acceptance.
- Stale PR #5182 contains a Founder Control Center implementation, but it diverged hundreds of commits from current main and must not be merged wholesale. Reuse only revalidated backend/data-contract pieces.
- Active UX/UI PR #5465 is a separate visual/public scope; R1 must not change or duplicate its visual work.

## Conflict rule before every R1 slice
1. Re-check current main.
2. Inspect open UX/FGIS/bank PRs and changed files.
3. If overlap exists, restrict this lane to backend/API/data contracts or wait for safe merge.
4. No force push, branch-protection bypass, forged review or stale evidence reuse.

## R1 PASS
R1 remains IN_PROGRESS until all are true on one accepted exact SHA:
- REQ-R1-001..005 and REQ-ROL-001..006 applicable evidence PASS;
- 13/13 open/read-or-authorized-action/return matrix PASS;
- denied and high-risk negative cases PASS;
- Founder metrics are real-data-only with source/drill-down;
- audit records actual actor, effective role/org/tenant, reason and session;
- PRE_RELEASE_PASS;
- exact-current-main released to REG.RU;
- exact production SHA/digest/schema match;
- live acceptance plus required observation/evidence PASS.

Only then: OVERALL_PRODUCTION_PROGRESS = 12/100 = 12%.

## Parallel-account boundary
Do not redesign cabinet/Control Center UX, do not implement parallel FGIS, bank or financial visual surfaces, and do not touch active second-account branches. This lane owns backend/domain/server authority, permissions, PostgreSQL/RLS, APIs, metrics truthfulness, audit, tests, CI, security, release and production acceptance.
