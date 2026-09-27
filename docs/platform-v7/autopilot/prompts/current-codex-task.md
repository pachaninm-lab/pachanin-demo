# Current task — MASTER v2.1 R1.2

Active slice: **Controlled open-as-role server authority**.
Official progress remains **5/100 = 5%** until full R1 PRODUCTION_PASS.

Use the existing Staff Access Control Plane. Do not create a Founder business/domain role and do not replace user identity.

Required backend result:
- one canonical server-owned 13-cabinet role-mode registry;
- client selects only a bounded cabinet intent + organization; effective API role and tenant are server-derived;
- PLATFORM_OWNER active assignment + recent MFA required;
- role-mode request is VIEW_AS and read-only;
- existing durable request → grant → opaque session flow is reused;
- reason/ticket/effective org/effective role/expiry/audit survive through activation and end/revoke;
- high-risk actions stay outside VIEW_AS;
- negative tests cover forged role/cabinet, target scope, expiry/revoke and writes.

Do not touch visual UX, FGIS or bank/finance product surfaces. Team Hub #5469 PRODUCT dependency is for R1.5 only.

After exact-head review/CI and merge, advance to R1.3 Company Health + P0/P1 queue.
