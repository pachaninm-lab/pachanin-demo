# platform-v7 execution queue

## MASTER-TZ Execution Order

This is the real product execution sequence. The fallback smoke-slice loop is the automation conveyor only — it does not represent product completion.

---

CURRENT: VP-3: Runtime-bound Entry Cockpit

CURRENT ALLOWED:
- apps/web/app/platform-v7/page.tsx
- apps/web/lib/platform-v7/runtime/entry-cockpit-state.ts
- apps/web/tests/unit/platformV7VisibleEntry.test.ts
- apps/web/tests/unit/platformV7RuntimeEntryCockpit.test.ts
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md

DONE (MASTER-TZ checkpoints):
- MASTER-TZ complete through PR 20.0 as engineering foundation, not full product completion
- VP-1: Visible Execution Entry Cockpit — merged via PR #1682
- VP-2: Runtime QA Stabilization — merged via PR #1684

DONE (autopilot smoke conveyor):
- Autopilot conveyor complete through Product Slice 20

NEXT:
- Layer: VP-3 runtime-bound entry cockpit implementation via PR #1687
- Success criteria:
  - `/platform-v7` no longer owns operational blockers, lanes, roles, executionPath or proofItems arrays.
  - Entry cockpit state is produced outside the page component.
  - Page renders from runtime-facing state.
  - Empty state exists for no active blockers.
  - Guard, typecheck and relevant tests are green.
  - Maturity remains controlled-pilot / pre-integration.
  - No apps/landing, API, DB, live integration or lockfile changes.

RULES:
- One PR equals one narrow layer.
- Keep controlled-pilot / pre-integration status.
- No apps/landing. No broad UI/runtime/API/DB/lockfiles outside explicit SOT unlock.
- No production-ready claims. No fake-live claims.
- Fallback smoke conveyor continues independently and does not represent product completion.
