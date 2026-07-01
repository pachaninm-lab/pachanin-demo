# platform-v7 execution queue

CURRENT: P0 API typecheck first debt slice outside auth and Prisma migration scope.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- apps/api/src/common/action-executor/action-policy.ts
- apps/api/src/common/logger/masked-logger.service.ts
- apps/api/src/health.controller.ts
- apps/api/src/modules/storage/storage.controller.ts

CURRENT CHECKS:
- reduce first confirmed API typecheck/runtime-smoke errors;
- keep policy fail-closed for missing roles;
- keep readiness status separate from health status;
- no package or lockfile changes;
- no Prisma migration changes;
- no maturity uplift.

NEXT:
- Layer: P0 API audit/prisma drift slice.
- Allowed files:
  - apps/api/src/common/interceptors/audit-action.interceptor.ts
  - apps/api/src/modules/deals/deal-auto.service.ts
  - apps/api/src/modules/anti-fraud/anti-fraud.service.ts
  - apps/api/src/modules/elevator/elevator.service.ts
  - apps/api/src/modules/kyc/kyc.service.ts
  - apps/api/src/modules/support/support.service.ts
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md

READINESS: 72% honest readiness. This slice reduces API debt only.
