# platform-v7 execution queue

CURRENT: VP-3.22 Runtime Persistence Pipeline Linkage Binding Plan.

GOAL: Выбрать точный scope для подключения typed linkage boundary к runtime repository write после merge #2229, без fake evidence, без изменений Prisma/migrations и без live integration claims.

CURRENT STATUS:
- VP-3.13 repository adapter is merged from #2221.
- VP-3.17 runtime action pipeline binding is merged from #2225.
- VP-3.21 typed outbox/audit linkage boundary is merged from #2229.
- Current runtime action writes repository receipt without explicit linkage evidence and therefore remains `outbox_required`.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

CANDIDATE IMPLEMENTATION FILES FOR LATER CODE PR:
- `apps/web/app/platform-v7/actions/deal-workspace-runtime-intent-actions.ts`
- `apps/web/lib/platform-v7/deal-workspace-runtime-linkage.ts`
- `apps/web/tests/unit/platformV7DealWorkspaceRuntimeLinkage.test.ts`
- `apps/web/tests/unit/platformV7DealWorkspaceRuntimePipelineLinkageBinding.test.ts`

BINDING RULES:
- Client input must never supply `outboxEntryId` or `auditEventId`.
- Existing `auditPayloads` and `auditPayloadCount` are not proof that an audit record was persisted.
- Only explicit server-side outbox/audit evidence records may be validated and passed into repository write.
- Without evidence, pipeline must stay `outbox_required`.
- Valid outbox only may advance to `audit_required`.
- Both validated records may advance to `fully_linked`.
- The binding path must use the linkage boundary rather than passing raw IDs directly to repository adapter.

STILL LOCKED:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**`
- `apps/web/components/platform-v7/**`
- `apps/web/app/api/**`
- `apps/api/src/modules/auth/**`
- package and lockfiles

NEXT:
- Layer: VP-3.23 Runtime Persistence Pipeline Linkage Binding Scope Unlock.
- Goal: docs-only unlock the exact four binding implementation files.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - keep candidate files named but unchanged in VP-3.22;
  - keep critical forbidden zones unchanged;
  - keep Prisma schema and migrations locked;
  - guard, dry-run and security checks remain green;
  - maturity language remains platform-temporarily-without-external-integrations.
