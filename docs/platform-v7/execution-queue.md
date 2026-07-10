# platform-v7 execution queue

CURRENT: VP-3.25 Runtime Persistence Pipeline Linkage Binding Implementation.

GOAL: Подключить typed linkage validation к runtime repository write после merge #2232, без client-supplied evidence, без Prisma/migrations и без live integration claims.

CURRENT STATUS:
- VP-3.13 repository adapter is merged from #2221.
- VP-3.17 runtime action pipeline binding is merged from #2225.
- VP-3.21 typed outbox/audit linkage boundary is merged from #2229.
- VP-3.24 final binding gate is merged from #2232.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- apps/web/app/platform-v7/actions/deal-workspace-runtime-intent-actions.ts
- apps/web/lib/platform-v7/deal-workspace-runtime-linkage.ts
- apps/web/tests/unit/platformV7DealWorkspaceRuntimeLinkage.test.ts
- apps/web/tests/unit/platformV7DealWorkspaceRuntimePipelineLinkageBinding.test.ts

IMPLEMENTED:
- Linkage validation and repository write are combined in `writeP7DealWorkspaceRuntimeWithLinkage`.
- Runtime action pipeline uses that validated write path.
- Public action input remains `dealId + intentId`; linkage IDs and evidence are not accepted from clients.
- Action result exposes the linkage decision separately from repository receipt.
- Default path without explicit server-side evidence remains `outbox_required`.
- Validated linkage is passed to repository adapter; raw IDs cannot bypass validation.
- Duplicate repository writes remain duplicate-safe.

STILL LOCKED:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**`
- `apps/web/components/platform-v7/**`
- `apps/web/app/api/**`
- `apps/api/src/modules/auth/**`
- package and lockfiles

KNOWN NEXT HARDENING:
- Current in-process repository stores the first idempotent receipt and does not promote a duplicate receipt when later evidence arrives.
- Transaction atomicity across snapshot, repository, outbox and audit is not implemented yet.
- Retry, partial failure and recovery semantics need explicit contracts and tests.

NEXT:
- Layer: VP-3.26 Runtime Persistence Transaction and Idempotency Hardening Plan.
- Goal: select exact scope for atomicity, duplicate replay, linkage promotion, retry and failure semantics.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - VP-3.25 binding is merged and tested;
  - no Prisma schema or migration changes occur in this layer;
  - critical forbidden zones remain unchanged;
  - guard, dry-run, web-unit, CI and security checks stay green;
  - maturity language remains platform-temporarily-without-external-integrations.
