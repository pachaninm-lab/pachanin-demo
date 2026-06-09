# platform-v7 execution queue

## MASTER-TZ Execution Order

This is the real product execution sequence. The fallback smoke-slice loop is the automation conveyor only — it does not represent product completion.

---

CURRENT: VP-1: Visible Execution Entry Cockpit

CURRENT ALLOWED:
- apps/web/app/platform-v7/page.tsx
- apps/web/tests/unit/platformV7VisibleEntry.test.ts
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md

DONE (MASTER-TZ checkpoints):
- MASTER-TZ complete through PR 20.0

DONE (autopilot smoke conveyor):
- Autopilot conveyor complete through Product Slice 20

NEXT:
- Layer: VP-1 merge gate
- Allowed files:
  - apps/web/app/platform-v7/page.tsx
  - apps/web/tests/unit/platformV7VisibleEntry.test.ts
  - docs/platform-v7/autopilot/**
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - Entry screen shows cause → blocker → money → responsible role → action.
  - Role entry cards exist for operator, buyer, driver and bank.
  - Maturity remains controlled-pilot / pre-integration.
  - No apps/landing, API, DB, live integration or lockfile changes.

RULES:
- One PR equals one narrow layer.
- Keep controlled-pilot / pre-integration status.
- No apps/landing. No broad UI/runtime/API/DB/lockfiles outside explicit SOT unlock.
- No production-ready claims. No fake-live claims.
- Fallback smoke conveyor continues independently and does not represent product completion.
