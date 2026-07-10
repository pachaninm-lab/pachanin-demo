# platform-v7 execution queue

CURRENT: VP-3.19 Runtime Persistence Outbox Audit Linkage Scope Unlock.

GOAL: Docs-only разблокировать точные files для contract-level outbox/audit linkage после merge #2226, не меняя `schema.prisma`, не создавая migrations, не открывая runtime action/UI/API/auth/backend broad scope и не заявляя live bank/ФГИС/ЭДО persistence.

CURRENT STATUS:
- VP-3 Runtime Actions are complete from #2210.
- VP-3 Process Runtime Store is complete from #2212.
- VP-3.5 Runtime DB Contract is merged from #2213 as contract-only.
- VP-3.13 Runtime Persistence Repository Adapter Implementation is merged from #2221.
- VP-3.17 Runtime Persistence Pipeline Binding Implementation is merged from #2225.
- VP-3.18 Runtime Persistence Outbox Audit Linkage Plan is merged from #2226.
- Runtime repository receipt still has no real outbox/audit linkage.
- #2113 remains open: repository settings cleanup.
- #2115 remains open: backend register role assignment hardening remains blocked by the current auth-file write path.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

UNLOCKED IMPLEMENTATION FILES FOR LATER CODE PR:
- `apps/web/lib/platform-v7/deal-workspace-runtime-linkage.ts`
- `apps/web/tests/unit/platformV7DealWorkspaceRuntimeLinkage.test.ts`

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

LINKAGE REQUIREMENTS FOR LATER PR:
- Produce typed outbox/audit linkage evidence.
- Preserve `outbox_required` when outbox linkage is absent.
- Preserve `audit_required` when only outbox linkage exists.
- Allow `fully_linked` only when both explicit links exist.
- Keep duplicate idempotency duplicate-safe.
- Keep contract-level maturity language; do not claim live DB persistence.
- No direct UI money movement.
- No hidden migration or `schema.prisma` drift.
- No package or lockfile change.

NEXT:
- Layer: VP-3.20 Runtime Persistence Outbox Audit Linkage Final Gate.
- Goal: final docs-only gate before writing linkage code in the exact unlocked files.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - keep linkage files named but not written in VP-3.19;
  - keep critical forbidden zones unchanged;
  - keep Prisma schema and migrations locked;
  - guard, dry-run and security checks green;
  - maturity language remains platform-temporarily-without-external-integrations.

AFTER NEXT:
- Layer: VP-3.21 Runtime Persistence Outbox Audit Linkage Implementation.
- Candidate code files:
  - apps/web/lib/platform-v7/deal-workspace-runtime-linkage.ts
  - apps/web/tests/unit/platformV7DealWorkspaceRuntimeLinkage.test.ts
