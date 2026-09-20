# Current task — MASTER v2.1 R1

Exact baseline main/production: `5da8e80744908413102214f91dd68018911b892e`
Official progress: **5/100 = 5%**
Active block: **R1 Founder/CEO and owner access to all 13 cabinets**
Target after full R1 PRODUCTION_PASS: **12/100 = 12%**

Work remaining-only. First inventory current server authority and existing Staff Access / owner cabinet paths. Do not merge stale #5182 wholesale. Preserve PostgreSQL authority, tenant isolation, MFA, audit and idempotency. Replace any production owner path that relies on controlled test/demo business state with a real-data-only server-authoritative path.

Do not invent or redesign UI. The parallel account owns cabinet/Control Center visual UX, FGIS and bank/finance visual surfaces. Touch only server/API/data-contract files in this lane unless an existing non-visual handoff route must be wired to authoritative state.

Before each slice re-check main and the changed files of open UX/FGIS/bank PRs. Any overlap is a stop-for-that-path, not permission to create a competing implementation.

R1 is not complete at code/CI/merge. Required terminal sequence: exact accepted head → current main → exact-SHA REG.RU release → live 13/13/negative acceptance → required observation/evidence → R1 PRODUCTION_PASS.
