# platform-v7 execution queue

CURRENT: P0 state sync after #2129.

GOAL: record #2129 as merged and select the next narrow docs-only layer.

CURRENT STATUS:
- #2111 is merged: P0 cabinet-session body-role guard is active.
- #2112 is closed as completed.
- #2113 remains open: repository settings cleanup.
- #2115 remains open: backend register role assignment hardening remains blocked by the current auth-file write path.
- #2120 is merged: RBAC / tenant scope / object scope source-of-truth selection is complete.
- #2121 is merged: isolated RBAC / tenant scope / object scope backend boundary is active.
- #2122 is merged: route wiring lane selection is complete.
- #2123 is merged: isolated route-scope boundary is active.
- #2124 is merged: route-scope state sync after #2123 is complete.
- #2125 is merged: canonical data boundary selection is complete.
- #2126 is merged: canonical data implementation boundary is active.
- #2127 is merged: canonical data state sync after #2126 is complete.
- #2128 is merged: money integer basis boundary selection is complete.
- #2129 is merged: money integer basis boundary implementation is active.
- Current layer is docs/state sync only.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

CURRENT CHECKS:
- record #2129 as merged in autopilot-state and queue;
- select the next narrow layer only in docs/state;
- keep #2113 and #2115 as open blockers unless source-of-truth changes;
- keep apps/landing, apps/web, API controllers, DB, ledger, audit, outbox, storage, runtime and live integrations out of scope;
- maturity remains controlled-pilot / pre-integration;
- readiness remains 72%;
- no package or lockfile changes.

NEXT:
- Layer: P0 ledger source-of-truth selection only.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - select the next boundary in docs/state only;
  - no implementation in the selection PR;
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
8. Netlify root entry redirect recovery is active from root-entry-redirect.
9. P0 auth/session cabinet session body-role guard is active from #2111.
10. P0 mobile header controls fix is active from #2117.
11. P0 backend register role assignment hardening remains blocked by #2115.
12. P0 RBAC / tenant scope / object scope source-of-truth selection is active from #2120.
13. P0 RBAC / tenant scope / object scope implementation boundary is active from #2121.
14. P0 route wiring selection is active from #2122.
15. P0 route-scope boundary implementation is active from #2123.
16. P0 route-scope state sync is active from #2124.
17. P0 canonical data boundary selection is active from #2125.
18. P0 canonical data implementation boundary is active from #2126.
19. P0 canonical data state sync is active from #2127.
20. P0 money integer basis boundary selection is active from #2128.
21. P0 money integer basis boundary implementation is active from #2129.
22. P0 state sync after #2129 is current.

RULES:
- one PR = one narrow layer;
- no apps/landing;
- no package or lockfiles;
- no fake-live integration claims;
- no production-ready claims;
- no broad backend/API/DB/auth/session/runtime/money/storage rewrite inside the current boundary layer;
- Netlify plus GitHub Actions green before merge.

DONE:
- #2111 P0 auth/session cabinet session body-role guard.
- #2117 P0 mobile header controls fix.
- #2119 docs/platform-v7 autopilot state sync after #2117.
- #2120 docs/platform-v7 RBAC / tenant scope / object scope source-of-truth selection.
- #2121 P0 RBAC / tenant scope / object scope implementation boundary.
- #2122 P0 RBAC / tenant scope / object scope route wiring selection.
- #2123 P0 RBAC / tenant scope / object scope route wiring boundary implementation.
- #2124 P0 route-scope state sync after #2123 merge.
- #2125 P0 canonical data boundary selection.
- #2126 P0 canonical data source-of-truth implementation boundary.
- #2127 P0 canonical data state sync after #2126 merge.
- #2128 P0 money integer basis boundary selection.
- #2129 P0 money integer basis boundary implementation.

READINESS: 72% honest readiness. Runtime layers, durable auth/session, server RBAC enforce, object scope wiring, money/ledger, audit/outbox, storage/evidence and remaining role-by-role functional passes are still incomplete.
