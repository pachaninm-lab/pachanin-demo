# platform-v7 execution queue

CURRENT: VP-3.20 Runtime Persistence Outbox Audit Linkage Final Gate.

GOAL: Финально зафиксировать ручной code PR gate для contract-level outbox/audit linkage после merge #2227, не меняя `schema.prisma`, не создавая migrations, не открывая runtime action/UI/API/auth/backend broad scope и не заявляя live bank/ФГИС/ЭДО persistence.

CURRENT STATUS:
- VP-3 Runtime Actions are complete from #2210.
- VP-3 Process Runtime Store is complete from #2212.
- VP-3.5 Runtime DB Contract is merged from #2213 as contract-only.
- VP-3.13 Runtime Persistence Repository Adapter Implementation is merged from #2221.
- VP-3.17 Runtime Persistence Pipeline Binding Implementation is merged from #2225.
- VP-3.18 Runtime Persistence Outbox Audit Linkage Plan is merged from #2226.
- VP-3.19 Runtime Persistence Outbox Audit Linkage Scope Unlock is merged from #2227.
- Runtime repository receipt still has no real outbox/audit linkage.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

MANUAL CODE PR SCOPE AFTER THIS GATE:
- The next manual code PR must set `current` to `VP-3.21 Runtime Persistence Outbox Audit Linkage Implementation`.
- The next manual code PR must set `allowedCurrentScope` to docs plus exactly:
  - `apps/web/lib/platform-v7/deal-workspace-runtime-linkage.ts`
  - `apps/web/tests/unit/platformV7DealWorkspaceRuntimeLinkage.test.ts`
- The next manual code PR must keep `NEXT` safe/docs-only.

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

LINKAGE REQUIREMENTS FOR VP-3.21:
- Build typed linkage evidence from explicit outbox and audit records.
- Preserve `outbox_required` when outbox linkage is absent.
- Preserve `audit_required` when only outbox linkage exists.
- Permit `fully_linked` only when both explicit links exist.
- Keep duplicate idempotency duplicate-safe.
- Keep the boundary contract-level; do not claim live DB persistence.
- No direct UI money movement.
- No hidden migration or `schema.prisma` drift.
- No package or lockfile change.

NEXT:
- Layer: VP-3.21 Runtime Persistence Outbox Audit Linkage Implementation.
- Goal: implement the typed linkage boundary only after this gate is merged.
- Allowed files for this gate remain docs-only.

AFTER NEXT:
- Layer: VP-3.22 Runtime Persistence Pipeline Linkage Binding Plan.
- Goal: select exact scope for binding the new linkage boundary into repository writes without changing Prisma or migrations.
