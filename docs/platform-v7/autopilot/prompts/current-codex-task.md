# Current task — MASTER v2.1 R1.3

Active slice: **CEO overview + P0/P1 decision queue (backend/data authority)**.
Official progress remains **5/100 = 5%** until full R1 PRODUCTION_PASS.

Use only real PostgreSQL/domain authority. Do not consume legacy analytics mock/fixed scenario values and do not create demo/zero success fallbacks.

Required result:
- one Founder/CEO read contract for Company Health across business, operations, finance, risk and system health;
- every metric exposes source, asOf/freshness, grain/definition, availability state and drill-down reference;
- source failure is explicit UNAVAILABLE/STALE, never a fabricated number;
- one server-owned P0/P1 decision queue with stable item/object/version identity, owner or UNASSIGNED, deadline, impact, next action, escalation and evidence/source reference;
- PLATFORM_OWNER + current durable assignment + MFA are revalidated server-side;
- no client-selected tenant/role/provider authority and no cross-tenant leakage;
- no UI/visual implementation, no FGIS/bank product work, no parallel finance/settlement authority.

R1.2 consumer contract is already READY_FOR_CONSUMER via Team Hub #5469. R1.5 presentation remains ACCOUNT_2_PRODUCT scope.

After exact-head CI/review and merge, advance to R1.4 financial/commercial Founder metrics.
