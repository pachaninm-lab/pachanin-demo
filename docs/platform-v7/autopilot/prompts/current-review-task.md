# Independent review brief — MASTER v2.1 R1

Review the exact current R1 diff, not the implementation report.

Block for:
- client-selected role/tenant/organization authority;
- production controlled-test/demo/fake fallback;
- identity impersonation instead of actual-actor + effective-role context;
- cross-tenant visibility;
- VIEW_AS writes or high-risk authority bypass;
- missing MFA/reason/expiry/audit;
- fake Founder metrics or values without PostgreSQL source/drill-down;
- stale #5182 code merged without current-main reconciliation;
- overlap with active UX/FGIS/bank scope;
- missing negative/concurrency/recovery tests;
- weakened CI/security/review/release gates.

PASS requires exact-head scope review plus applicable green checks. Merge/release/live acceptance are separate gates.
