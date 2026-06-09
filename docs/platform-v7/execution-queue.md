# platform-v7 execution queue

## MASTER-TZ Execution Order

This is the real product execution sequence. The fallback smoke-slice loop is the automation conveyor only — it does not represent product completion.

---

CURRENT: VP-2: Runtime QA Stabilization

CURRENT ALLOWED:
- apps/web/tests/unit/platformV7RuntimeApplicationServices.test.ts
- apps/web/tests/unit/platformV7RuntimeMockPersistenceAdapter.test.ts
- apps/web/tests/unit/platformV7RuntimeCheckHelper.test.ts
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md

DONE (MASTER-TZ checkpoints):
- MASTER-TZ complete through PR 20.0
- VP-1: Visible Execution Entry Cockpit — merged via PR #1682

DONE (autopilot smoke conveyor):
- Autopilot conveyor complete through Product Slice 20

NEXT:
- Layer: VP-3 visible product slice proposal
- Allowed files: to be unlocked by an explicit SOT scope proposal after VP-2 is green.
- Success criteria:
  - Runtime source-guard tests resolve source files independent of vitest cwd.
  - Runtime check-helper expectations match the current money-critical check registry.
  - Full platform-v7 runtime suite is green; typecheck and build are green.
  - Maturity remains controlled-pilot / pre-integration.
  - No apps/landing, API, DB, live integration or lockfile changes.

RULES:
- One PR equals one narrow layer.
- Keep controlled-pilot / pre-integration status.
- No apps/landing. No broad UI/runtime/API/DB/lockfiles outside explicit SOT unlock.
- No production-ready claims. No fake-live claims.
- Fallback smoke conveyor continues independently and does not represent product completion.
