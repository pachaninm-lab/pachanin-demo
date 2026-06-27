# platform-v7 execution queue

CURRENT: P0 canonical data source-of-truth implementation boundary.

GOAL: add a typed canonical-data boundary without wiring controllers, DB, runtime, money, storage or live integrations.

CURRENT STATUS:
- #2111 is merged: P0 cabinet-session body-role guard is active.
- #2112 is closed as completed.
- #2113 remains open: branch protection/settings cleanup for deprecated Vercel/Deno required checks.
- #2115 remains open: backend register role assignment hardening implementation is blocked by the current auth-file write path.
- #2117 is merged: mobile header controls fix is active.
- #2119 is merged: autopilot source-of-truth is synced after #2117.
- #2120 is merged: RBAC / tenant scope / object scope source-of-truth selection is complete.
- #2121 is merged: isolated RBAC / tenant scope / object scope backend boundary is active.
- #2122 is merged: route wiring lane selection is complete.
- #2123 is merged: isolated route-scope boundary is active.
- #2124 is merged: route-scope state sync after #2123 is complete.
- #2125 is merged: canonical data source-of-truth boundary selection is complete.
- Current implementation is the canonical-data boundary only.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- apps/api/src/platform-v7/canonical-data/**
- apps/api/test/platform-v7/canonical-data/**

CURRENT CHECKS:
- mark #2125 as merged in autopilot-state and queue;
- add typed canonical entity registry;
- add canonical read/write boundary decisions;
- keep money basis and audit entries read-only;
- keep #2113 and #2115 as open blockers unless source-of-truth changes;
- keep auth module files blocked by #2115 out of scope;
- keep apps/landing, apps/web, API controllers, DB, money, ledger, audit, outbox, storage, runtime and live integrations out of scope;
- maturity remains controlled-pilot / pre-integration;
- readiness remains 72%;
- no package or lockfile changes.

CURRENT NOTES:
- #2115 is not closed by this layer; it still requires a safe maintainer/Codex path to write auth service and related auth tests.
- #2113 requires repository settings/branch protection verification and should not change platform code.
- #2123 added an isolated route-scope adapter only; it did not wire broad controllers or frontend routes.
- #2125 selected canonical data only; this implementation adds a typed boundary without persistence or live source integration.

NEXT:
- Layer: P0 canonical data state sync.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - select the next narrow layer only after this canonical-data boundary is green;
  - keep #2113 and #2115 as open blockers unless source-of-truth changes;
  - no forbidden zone, fake-live claim or readiness uplift;
  - keep status controlled-pilot / pre-integration;
  - readiness remains 72%.

ORDER:
1. Stable shell boundary is active from #2038.
2. Role-locked login handoff is active from #2036/#2037.
3. Mobile protected header action recovery is active from #2055.
4. Public mobile brand title recovery is active from #2056.
5. Elevator first-screen pass is active from #2057.
6. Driver / field first-screen scope is active from #2058.
7. Driver / field first-screen pass is active from #2059.
8. Public mobile process carousel polish is active in #2062/#2064.
9. Public process stage copy polish is active from #2065.
10. Netlify root entry redirect recovery is active from root-entry-redirect.
11. Public hero copy polish is active from #2067/#2068/#2070/#2071.
12. Driver field route anchor hardening is active from #2072 after stale #2061 was superseded.
13. Public entry human copy pass is active from #2075.
14. Public register header actions pass is active from #2076.
15. Public register visual system pass is active from #2077.
16. Driver / field follow-up audit is active from #2078.
17. Driver / field mobile touch target hardening is active from #2079.
18. Field roles follow-up audit is active from #2080.
19. P0 auth/session cabinet session body-role guard is active from #2111.
20. P0 mobile header controls fix is active from #2117.
21. P0 backend register role assignment hardening remains blocked by #2115.
22. P0 RBAC / tenant scope / object scope source-of-truth selection is active from #2120.
23. P0 RBAC / tenant scope / object scope implementation boundary is active from #2121.
24. P0 RBAC / tenant scope / object scope route wiring selection is active from #2122.
25. P0 RBAC / tenant scope / object scope route wiring boundary implementation is active from #2123.
26. P0 route-scope state sync after #2123 merge is active from #2124.
27. P0 canonical data boundary selection is active from #2125.
28. P0 canonical data source-of-truth implementation boundary is current.

RULES:
- one PR = one narrow layer;
- no apps/landing;
- no package or lockfiles;
- no fake-live integration claims;
- no production-ready claims;
- no broad backend/API/DB/auth/session/runtime/money/storage rewrite inside the current boundary layer;
- Netlify plus GitHub Actions green before merge;
- Vercel and Deno deprecated external statuses are not active gate for platform-v7 unless branch protection still requires them.

DONE:
- #2028 seller CSS leak guard.
- #2029 state sync after mobile shell stabilization.
- #2031 seller mobile CSS text leak fix.
- #2032 mobile shell stabilization follow-up.
- #2034 public registration CTA recovery.
- #2036 public role-scoped registration handoff.
- #2037 public login role handoff.
- #2038 stable shell boundary.
- #2040 single shell copy normalizer.
- #2041 public role cards login handoff.
- #2042 access copy polish.
- #2045 mobile header pass.
- #2046 protected mobile header recovery.
- #2048 shell copy normalizer replacement.
- #2049 public entry login split.
- #2051 registration completion route guard.
- #2053 docs queue sync.
- #2055 protected mobile header action recovery.
- #2056 public mobile brand title recovery.
- #2057 elevator first-screen pass.
- #2058 driver field first-screen scope selection.
- #2059 driver field first-screen pass.
- #2065 public process stage copy polish.
- #2067 public hero copy polish.
- #2068 public hero mobile composition.
- #2070 public hero mobile sizing.
- #2071 public entry copy proofread.
- #2072 driver field route anchor hardening.
- #2075 public entry human copy pass.
- #2076 public register header actions pass.
- #2077 public register visual system pass.
- #2078 driver field follow-up audit.
- #2079 driver field mobile touch target hardening.
- #2080 field roles follow-up audit.
- root-entry-redirect Netlify root entry redirect recovery.
- #2111 P0 auth/session cabinet session body-role guard.
- #2117 P0 mobile header controls fix.
- #2119 docs/platform-v7 autopilot state sync after #2117.
- #2120 docs/platform-v7 RBAC / tenant scope / object scope source-of-truth selection.
- #2121 P0 RBAC / tenant scope / object scope implementation boundary.
- #2122 P0 RBAC / tenant scope / object scope route wiring selection.
- #2123 P0 RBAC / tenant scope / object scope route wiring boundary implementation.
- #2124 P0 route-scope state sync after #2123 merge.
- #2125 P0 canonical data boundary selection.

READINESS: 72% honest readiness. Runtime layers, durable auth/session, server RBAC enforce, object scope wiring, money/ledger, audit/outbox, storage/evidence and remaining role-by-role functional passes are still incomplete.
