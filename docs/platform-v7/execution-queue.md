# platform-v7 execution queue

CURRENT: P0 execution/evidence scenario selection.

GOAL: select one deterministic controlled-pilot scenario for issue #2096 before any code implementation. The scenario must prove that the platform can reconstruct a deal chain across roles and blockers without claiming live integrations or production maturity.

CURRENT STATUS:
- #2111 is merged: P0 cabinet-session body-role guard is active.
- #2113 is closed: deprecated Vercel/Deno statuses are not blocking current `main` merges; Netlify remains the active deployment target.
- #2115 remains open: backend register role assignment hardening remains blocked by the current auth-file write path.
- #2138 is merged: isolated audit read-model boundary is active.
- #2154 is merged: market-entry boundary selection is recorded.
- #2155 is merged: runtime CI checks are routed away from docs-only PRs.
- #2158 is merged: Netlify docs-only build gate is active.
- #2162 is merged: robust Netlify ignore script is active.
- #2159 remains open as draft: route implementation is blocked until route-scope write path or guard advancement is available.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md

CURRENT CHECKS:
- keep #2159 in draft until source-of-truth/guard is advanced;
- keep #2115 as an auth write-path blocker;
- select #2096 as the next safe docs-only execution/evidence layer;
- do not touch apps/landing, app routes, backend auth, API, DB, storage, package or lock files;
- maturity remains controlled-pilot / pre-integration;
- readiness remains 72%.

NEXT:
- Layer: P0 execution/evidence scenario selection for #2096.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/autopilot/progress.json
  - docs/platform-v7/autopilot/prompts/current-codex-task.md
  - docs/platform-v7/autopilot/prompts/current-review-task.md
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - one deterministic scenario is selected before implementation;
  - the scenario covers commercial, logistics, acceptance, quality, documents, dispute, external-basis callback and audit/export checkpoints;
  - closing remains blocked when required checkpoints are missing;
  - no live external integration claim;
  - no platform-side release claim;
  - no maturity or readiness uplift.

ORDER:
1. Stable shell boundary is active from #2038.
2. Role-locked login handoff is active from #2036/#2037.
3. Mobile protected header action recovery is active from #2055.
4. Public mobile brand title recovery is active from #2056.
5. Elevator first-screen pass is active from #2057.
6. Driver / field first-screen scope is active from #2058.
7. Driver / field first-screen pass is active from #2059.
8. Netlify root entry redirect recovery is active from root-entry-redirect.
9. P0 auth/session cabinet-session body-role guard is active from #2111.
10. P0 mobile header controls fix is active from #2117.
11. P0 backend register role assignment hardening remains blocked by #2115.
12. P0 RBAC / tenant scope / object scope source-of-truth selection is active from #2120.
13. P0 RBAC / tenant scope / object scope implementation boundary is active from #2121.
14. P0 route wiring selection is active from #2122.
15. P0 route-scope boundary implementation is active from #2123.
16. P0 route-scope state sync is active from #2124.
17. P0 canonical data boundary selection is active from #2125.
18. P0 canonical data implementation boundary is active from #2126.
19. P0 canonical data state sync after #2126 merge is active from #2127.
20. P0 money integer basis boundary selection is active from #2128.
21. P0 money integer basis implementation is active from #2129.
22. P0 money integer state sync after #2129 is active from #2130.
23. P0 ledger source-of-truth selection is active from #2131.
24. P0 ledger source-of-truth implementation boundary is active from #2132.
25. P0 ledger source state sync after #2132 merge is active from #2133.
26. P0 ledger invariants boundary selection is active from #2134.
27. P0 ledger invariants implementation boundary is active from #2135.
28. P0 ledger invariants state sync after #2135 merge is active from #2136.
29. P0 audit read-model boundary selection is active from #2137.
30. P0 audit read-model boundary implementation is active from #2138.
31. P0 market-entry boundary selection is active from #2154.
32. P0 execution/evidence scenario selection is current.

RULES:
- one PR = one narrow layer;
- no apps/landing;
- no package or lockfiles;
- no fake-live integration claims;
- no production-ready claims;
- no broad backend/API/DB/auth/session/runtime/storage rewrite inside the current boundary layer;
- Netlify plus GitHub checks green before merge.

DONE:
- #2111 P0 auth/session cabinet-session body-role guard.
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
- #2129 P0 money integer basis implementation.
- #2130 P0 money integer state sync after #2129 merge.
- #2131 P0 ledger source-of-truth selection.
- #2132 P0 ledger source-of-truth implementation boundary.
- #2133 P0 ledger source state sync after #2132 merge.
- #2134 P0 ledger invariants boundary selection.
- #2135 P0 ledger invariants implementation boundary.
- #2136 P0 ledger invariants state sync after #2135 merge.
- #2137 P0 audit read-model boundary selection.
- #2138 P0 audit read-model boundary implementation.
- #2154 market-entry boundary selection.
- #2155 runtime CI filtering for docs-only PRs.
- #2158 Netlify docs-only build gate.
- #2162 robust Netlify ignore gate.
- #2113 deprecated status cleanup closed by empirical merge verification.

READINESS: 72% honest readiness. Runtime layers, durable auth/session, server RBAC enforce, object scope wiring, mutable money/ledger paths, audit/outbox, storage/evidence and remaining role-by-role functional passes are still incomplete. The current scenario selection does not change maturity or readiness.
