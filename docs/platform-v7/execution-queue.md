# platform-v7 execution queue

CURRENT: VP-3.5 Runtime DB Contract.

GOAL: Зафиксировать контракт Postgres-backed runtime snapshot persistence для Deal Workspace без применения скрытой production migration и без заявлений о live bank/ФГИС/ЭДО integrations.

CURRENT STATUS:
- VP-2.5 is complete: all 260 web unit tests pass (pnpm --filter web test → 260/260).
- VP-3 Deal Workspace Runtime Binding is complete from #2208.
- VP-3 Runtime Actions are complete from #2210.
- VP-3 Runtime Refresh Snapshot is complete from #2211.
- VP-3 Process Runtime Store is complete from #2212.
- VP-3.5 Runtime DB Contract is open in #2213 as contract-only, not a live production DB migration.
- #2113 remains open: repository settings cleanup.
- #2115 remains open: backend register role assignment hardening remains blocked by the current auth-file write path.

CURRENT ALLOWED:
- apps/web/** (runtime contract typings/tests only for current PR)
- apps/api/prisma/contracts/** (DB contract SQL only; no applied migration)
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

NEXT:
- Layer: VP-3.6 Runtime Persistence Repository Adapter Scope Selection.
- Goal: после merge #2213 выбрать безопасный write scope для repository adapter, outbox writer and audit writer without opening broad backend/API/DB zones or fake-live external integrations.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - define exact files for repository adapter implementation before writing code;
  - keep direct UI money movement forbidden;
  - keep hidden DB migration forbidden;
  - keep DB contract explicit;
  - keep outbox/audit linkage mandatory before fully_linked state;
  - guard-tests remain green;
  - pnpm --filter web test remains green;
  - maturity language remains platform-temporarily-without-external-integrations.

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
28. VP-2.5 vitest green + CI gate is complete.
29. VP-3 Deal Workspace Runtime Binding is active from #2208.
30. VP-3 Runtime Actions are active from #2210.
31. VP-3 Runtime Refresh Snapshot is active from #2211.
32. VP-3 Process Runtime Store is active from #2212.
