# platform-v7 execution queue

CURRENT: VP-2.5 complete — vitest 260/260 green + CI web-unit gate added.

GOAL: Зафиксировать завершение VP-2.5 (vitest green + CI gate) и перейти к VP-3 (Deal Workspace Runtime Binding).

CURRENT STATUS:
- VP-2.5 is complete: all 260 web unit tests pass (pnpm --filter web test → 260/260).
- CI web-unit gate is added to .github/workflows/ci.yml as required job before build.
- #2113 remains open: repository settings cleanup.
- #2115 remains open: backend register role assignment hardening remains blocked by the current auth-file write path.
- #2135 is merged: isolated read-only ledger invariants boundary is active.

CURRENT ALLOWED:
- apps/web/** (VP-3 Deal Workspace Runtime Binding scope)
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

NEXT:
- Layer: VP-3 Deal Workspace Runtime Binding.
- Goal: Deal workspace reads state through application services + mock persistence adapter (Stage 5), not through static scenarios. Scenarios remain as seed.
- Success criteria:
  - deal workspace server components use application services from lib/platform-v7/runtime/application-service.ts;
  - no direct domain/static data in page-level server components;
  - guard-tests remain green;
  - pnpm --filter web test → 260/260;
  - maturity remains controlled-pilot / pre-integration.

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
19. P0 canonical data state sync is active from #2127.
20. P0 money integer basis boundary selection is active from #2128.
21. P0 money integer basis boundary implementation is active from #2129.
22. P0 money integer state sync after #2129 is active from #2130.
23. P0 ledger source-of-truth selection is active from #2131.
24. P0 ledger source-of-truth implementation boundary is active from #2132.
25. P0 ledger source state sync after #2132 merge is active from #2133.
26. P0 ledger invariants implementation scope selection is active from #2134.
27. P0 isolated read-only ledger invariants boundary is active from #2135.
28. VP-2.5 vitest green + CI gate is active from current branch (260/260 passing).
