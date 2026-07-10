# platform-v7 execution queue

CURRENT: VP-3.24 Runtime Persistence Pipeline Linkage Binding Final Gate.

GOAL: Финально зафиксировать manual code PR gate для подключения typed linkage boundary к runtime repository write после merge #2231, без fake evidence и без Prisma/migration changes.

CURRENT STATUS:
- VP-3.13 repository adapter is merged from #2221.
- VP-3.17 runtime action pipeline binding is merged from #2225.
- VP-3.21 typed outbox/audit linkage boundary is merged from #2229.
- VP-3.23 pipeline linkage binding scope unlock is merged from #2231.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

MANUAL CODE PR SCOPE AFTER THIS GATE:
- `apps/web/app/platform-v7/actions/deal-workspace-runtime-intent-actions.ts`
- `apps/web/lib/platform-v7/deal-workspace-runtime-linkage.ts`
- `apps/web/tests/unit/platformV7DealWorkspaceRuntimeLinkage.test.ts`
- `apps/web/tests/unit/platformV7DealWorkspaceRuntimePipelineLinkageBinding.test.ts`

MANDATORY BINDING RULES:
- No client-supplied linkage IDs or evidence.
- Audit payload count is not persisted evidence.
- Pipeline must validate evidence before repository write.
- No evidence means `outbox_required`.
- Valid outbox only means `audit_required`.
- Both validated evidence records may mean `fully_linked`.
- Duplicate idempotency remains duplicate-safe.

STILL LOCKED:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**`
- `apps/web/components/platform-v7/**`
- `apps/web/app/api/**`
- `apps/api/src/modules/auth/**`
- package and lockfiles

NEXT:
- Layer: VP-3.25 Runtime Persistence Pipeline Linkage Binding Implementation.
- Goal: prepare the manual implementation layer after this final gate is merged.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - final gate closes without code changes;
  - next manual code PR explicitly expands current scope to the four approved files;
  - critical forbidden zones remain unchanged;
  - Prisma schema and migrations remain locked;
  - maturity language remains platform-temporarily-without-external-integrations.

AFTER NEXT:
- Layer: VP-3.26 Runtime Persistence Transaction and Idempotency Hardening Plan.
- Goal: assess atomicity, duplicate replay, failure and retry semantics after pipeline linkage binding is implemented.
