# platform-v7 execution queue

CURRENT: VP-3.14 Runtime Persistence Repository Adapter Pipeline Binding Plan.

GOAL: Выбрать точный scope для привязки repository adapter к runtime action pipeline после merge #2221, не меняя `schema.prisma`, не создавая migrations, не открывая UI/API/auth/backend broad scope и не заявляя live bank/ФГИС/ЭДО persistence.

CURRENT STATUS:
- VP-2.5 is complete: all 260 web unit tests pass (pnpm --filter web test → 260/260).
- VP-3 Deal Workspace Runtime Binding is complete from #2208.
- VP-3 Runtime Actions are complete from #2210.
- VP-3 Runtime Refresh Snapshot is complete from #2211.
- VP-3 Process Runtime Store is complete from #2212.
- VP-3.5 Runtime DB Contract is merged from #2213 as contract-only, not a live production DB migration.
- VP-3.6 Runtime Persistence Scope Selection is merged from #2214.
- VP-3.7 Runtime Persistence Repository Adapter Contract Plan is merged from #2215.
- VP-3.8 Runtime Persistence Implementation Scope Request is merged from #2216.
- VP-3.9 Runtime Persistence Repository Adapter Implementation Preflight is merged from #2217.
- VP-3.10 Runtime Persistence Implementation Activation is merged from #2218.
- VP-3.11 Runtime Persistence Implementation Scope Unlock is merged from #2219.
- VP-3.12 Runtime Persistence Implementation Final Gate is merged from #2220.
- VP-3.13 Runtime Persistence Repository Adapter Implementation is merged from #2221.
- VP-3.14 is docs-only scope plan for binding runtime action results to the repository adapter.
- #2113 remains open: repository settings cleanup.
- #2115 remains open: backend register role assignment hardening remains blocked by the current auth-file write path.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

CANDIDATE PIPELINE BINDING FILES FOR LATER PR:
- `apps/web/app/platform-v7/actions/deal-workspace-runtime-intent-actions.ts`
- `apps/web/tests/unit/platformV7DealWorkspaceRuntimePipelineBinding.test.ts`

STILL LOCKED:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**`
- `apps/web/components/platform-v7/**`
- `apps/web/app/api/**`
- `apps/api/src/modules/auth/**`
- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`

PIPELINE BINDING REQUIREMENTS FOR LATER PR:
- Runtime action result must include repository adapter receipt only after process runtime snapshot receipt exists.
- Pipeline must build `P7DealWorkspaceRuntimeDbContract` from refresh snapshot and process runtime store receipt.
- Pipeline must pass explicit actor, correlation, audit and idempotency values into DB contract builder.
- Repository adapter must remain contract-level and must not claim live DB persistence.
- `fully_linked` must stay blocked unless both outbox and audit linkage exist.
- Duplicate idempotency must not create second evidence write.
- No direct UI money movement.
- No bank/FGIS/EDO live persistence claims.
- No hidden migration.
- No `schema.prisma` drift.
- No package or lockfile change.

NEXT:
- Layer: VP-3.15 Runtime Persistence Repository Adapter Pipeline Binding Scope Unlock.
- Goal: request exact code scope for binding runtime action results to repository adapter receipts before implementation.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - keep pipeline binding files named but not written in VP-3.14;
  - keep `apps/api/prisma/schema.prisma` locked;
  - keep `apps/api/prisma/migrations/**` locked;
  - keep direct UI money movement forbidden;
  - keep hidden DB migration forbidden;
  - keep bank/FGIS/EDO live claims forbidden;
  - keep package and lockfile changes forbidden;
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
33. VP-3.5 Runtime DB Contract is active from #2213.
34. VP-3.6 Runtime Persistence Scope Selection is active from #2214.
35. VP-3.7 Runtime Persistence Repository Adapter Contract Plan is active from #2215.
36. VP-3.8 Runtime Persistence Scope Request is active from #2216.
37. VP-3.9 Runtime Persistence Preflight is active from #2217.
38. VP-3.10 Runtime Persistence Activation is active from #2218.
39. VP-3.11 Runtime Persistence Scope Unlock is active from #2219.
40. VP-3.12 Runtime Persistence Final Gate is active from #2220.
41. VP-3.13 Runtime Persistence Repository Adapter Implementation is active from #2221.
