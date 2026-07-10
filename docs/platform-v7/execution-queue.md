# platform-v7 execution queue

CURRENT: VP-3.23 Runtime Persistence Pipeline Linkage Binding Scope Unlock.

GOAL: Docs-only разблокировать точные files для подключения typed linkage boundary к runtime repository write после merge #2230, без fake evidence и без Prisma/migration changes.

CURRENT STATUS:
- VP-3.13 repository adapter is merged from #2221.
- VP-3.17 runtime action pipeline binding is merged from #2225.
- VP-3.21 typed outbox/audit linkage boundary is merged from #2229.
- VP-3.22 pipeline linkage binding plan is merged from #2230.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

UNLOCKED IMPLEMENTATION FILES FOR LATER CODE PR:
- `apps/web/app/platform-v7/actions/deal-workspace-runtime-intent-actions.ts`
- `apps/web/lib/platform-v7/deal-workspace-runtime-linkage.ts`
- `apps/web/tests/unit/platformV7DealWorkspaceRuntimeLinkage.test.ts`
- `apps/web/tests/unit/platformV7DealWorkspaceRuntimePipelineLinkageBinding.test.ts`

BINDING RULES:
- No client-supplied linkage IDs or evidence.
- Audit payload count is not persisted evidence.
- Pipeline must call linkage validation before repository write.
- Default path without evidence remains `outbox_required`.
- Only validated evidence may advance repository state.
- Duplicate idempotency must remain duplicate-safe.

STILL LOCKED:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**`
- `apps/web/components/platform-v7/**`
- `apps/web/app/api/**`
- `apps/api/src/modules/auth/**`
- package and lockfiles

NEXT:
- Layer: VP-3.24 Runtime Persistence Pipeline Linkage Binding Final Gate.
- Goal: final docs-only gate before writing pipeline linkage binding code.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - linkage binding files remain unchanged in VP-3.23;
  - critical forbidden zones remain unchanged;
  - Prisma schema and migrations stay locked;
  - guard, dry-run and security checks remain green;
  - maturity language remains platform-temporarily-without-external-integrations.

AFTER NEXT:
- Layer: VP-3.25 Runtime Persistence Pipeline Linkage Binding Implementation.
- Candidate code files are the four exact files listed above.
