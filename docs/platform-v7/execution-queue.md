# platform-v7 execution queue

CURRENT: VP-3.21 Runtime Persistence Outbox Audit Linkage Implementation.

GOAL: Реализовать typed contract-level outbox/audit linkage boundary после merge #2228, не меняя `schema.prisma`, не создавая migrations, не открывая runtime action/UI/API/auth/backend broad scope и не заявляя live bank/ФГИС/ЭДО persistence.

CURRENT STATUS:
- VP-3 Runtime Actions are complete from #2210.
- VP-3 Process Runtime Store is complete from #2212.
- VP-3.5 Runtime DB Contract is merged from #2213 as contract-only.
- VP-3.13 Runtime Persistence Repository Adapter Implementation is merged from #2221.
- VP-3.17 Runtime Persistence Pipeline Binding Implementation is merged from #2225.
- VP-3.20 Runtime Persistence Outbox Audit Linkage Final Gate is merged from #2228.
- VP-3.21 implements a separate linkage boundary; pipeline binding is not part of this PR.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- apps/web/lib/platform-v7/deal-workspace-runtime-linkage.ts
- apps/web/tests/unit/platformV7DealWorkspaceRuntimeLinkage.test.ts

IMPLEMENTED:
- Typed outbox evidence contract.
- Typed audit evidence contract.
- Correlation, idempotency, actor and action validation.
- `outbox_required` when no valid outbox evidence exists.
- `audit_required` when valid outbox exists without valid audit evidence.
- `fully_linked` only when both matching evidence records exist.
- Invalid evidence is rejected with typed issues; linkage ids are not manufactured.

STILL LOCKED:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**`
- `apps/web/app/platform-v7/**`
- `apps/web/components/platform-v7/**`
- `apps/web/app/api/**`
- `apps/api/src/modules/auth/**`
- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`

GUARDRAILS:
- Contract-level linkage is not live outbox/audit persistence.
- No direct UI money movement.
- No hidden migration or `schema.prisma` drift.
- No package or lockfile change.
- Critical forbidden zones must remain unchanged.

NEXT:
- Layer: VP-3.22 Runtime Persistence Pipeline Linkage Binding Plan.
- Goal: select exact scope for binding the linkage boundary into runtime repository writes.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - VP-3.21 linkage boundary is merged and tested;
  - pipeline binding remains unmodified in this PR;
  - Prisma schema and migrations remain locked;
  - guard, dry-run, web-unit and security checks stay green;
  - maturity language remains platform-temporarily-without-external-integrations.
