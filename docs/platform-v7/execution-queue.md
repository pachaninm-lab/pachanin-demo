# platform-v7 execution queue

CURRENT: VP-3.7 Runtime Persistence Repository Adapter Contract Plan.

GOAL: Зафиксировать точный implementation contract для runtime persistence repository adapter до написания кода, чтобы следующий слой не открыл широкий backend/API/DB scope и не создал скрытую production migration.

CURRENT STATUS:
- VP-2.5 is complete: all 260 web unit tests pass (pnpm --filter web test → 260/260).
- VP-3 Deal Workspace Runtime Binding is complete from #2208.
- VP-3 Runtime Actions are complete from #2210.
- VP-3 Runtime Refresh Snapshot is complete from #2211.
- VP-3 Process Runtime Store is complete from #2212.
- VP-3.5 Runtime DB Contract is merged from #2213 as contract-only, not a live production DB migration.
- VP-3.6 Runtime Persistence Scope Selection is merged from #2214.
- VP-3.7 is docs-only: it defines the repository adapter contract before implementation writes.
- #2113 remains open: repository settings cleanup.
- #2115 remains open: backend register role assignment hardening remains blocked by the current auth-file write path.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

REPOSITORY ADAPTER CONTRACT PLAN:
- Proposed implementation file, not allowed in this PR:
  - `apps/web/lib/platform-v7/deal-workspace-runtime-db-repository.ts`
- Proposed test file, not allowed in this PR:
  - `apps/web/tests/unit/platformV7DealWorkspaceRuntimeRepositoryAdapter.test.ts`
- Proposed adapter responsibility:
  - accept `P7DealWorkspaceRuntimeDbContract` produced by `buildP7DealWorkspaceRuntimeDbContract`;
  - persist a runtime snapshot record only through an explicit repository boundary;
  - return a typed persistence receipt with `recordId`, `runtimeSnapshotId`, `idempotencyKey`, `state`, `savedAt`, `outboxEntryId`, `auditEventId`;
  - treat duplicated `idempotencyKey` as duplicate-safe success or explicit duplicate state, never as a second write;
  - preserve `ready_to_persist`, `outbox_required`, `audit_required`, `fully_linked` states;
  - require outbox and audit linkage before `fully_linked`;
  - never move money directly from UI;
  - never claim live bank/FGIS/EDO persistence.
- Transaction boundary requirement:
  - DB snapshot write, outbox entry write and audit event write must be designed as one atomic transaction in the later implementation layer;
  - if atomic implementation is not yet available, the adapter must return `outbox_required` or `audit_required`, not fake `fully_linked`.
- Migration boundary requirement:
  - `apps/api/prisma/schema.prisma` stays locked until a separate explicit migration PR;
  - `apps/api/prisma/migrations/**` stays locked until a separate explicit migration PR;
  - contract SQL under `apps/api/prisma/contracts/**` is not a production migration.
- Concurrency and scale requirement:
  - persistence must rely on unique `idempotencyKey` and unique `runtimeSnapshotId`;
  - repeated clicks, refreshes, retries and worker redelivery must not create duplicate evidence;
  - future implementation must be safe under concurrent users and repeated server action retries.

NEXT:
- Layer: VP-3.8 Runtime Persistence Repository Adapter Implementation Scope Request.
- Goal: запросить точечное разблокирование implementation files only after this contract plan is merged, still without schema.prisma/migration writes.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - request exact implementation files;
  - keep `apps/api/prisma/schema.prisma` locked;
  - keep `apps/api/prisma/migrations/**` locked;
  - keep direct UI money movement forbidden;
  - keep hidden DB migration forbidden;
  - keep outbox/audit linkage mandatory before fully_linked state;
  - keep bank/FGIS/EDO live claims forbidden;
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
