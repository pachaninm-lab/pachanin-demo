# platform-v7 execution queue

## MASTER-TZ Execution Order

This is the real product execution sequence. The fallback smoke-slice loop is the automation conveyor only — it does not represent product completion.

---

CURRENT: VP-2: Runtime QA Stabilization (master plan: docs/platform-v7/autopilot/master-tz-2.md)

CURRENT ALLOWED:
- apps/web/tests/unit/**
- apps/web/components/v7r/**
- apps/web/components/platform-v7/**
- apps/web/app/platform-v7/**
- apps/web/lib/platform-v7/**
- .github/workflows/dependency-review.yml
- .github/workflows/automerge.yml
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md

DONE (MASTER-TZ checkpoints):
- MASTER-TZ complete through PR 20.0
- VP-1: Visible Execution Entry Cockpit — merged via PR #1682

DONE (autopilot smoke conveyor):
- Autopilot conveyor complete through Product Slice 20

NEXT:
- Layer: VP-3 Deal Workspace Runtime Binding (after full web vitest is green and gated in CI)
- Allowed files: to be unlocked by an explicit SOT scope proposal after VP-2 is green.
- Success criteria (VP-2, see master-tz-2.md):
  - Full `pnpm --filter @pc/web test` run is green and added as a required CI job.
  - Role-isolation and honesty guard contracts match sources again.
  - No permanently red CI jobs: deploy/dependency-review either work or honest-skip with warning.
  - Maturity remains controlled-pilot / pre-integration.
  - No apps/landing, API, DB, live integration or lockfile changes.

RULES:
- One PR equals one narrow layer.
- Keep controlled-pilot / pre-integration status.
- No apps/landing. No broad UI/runtime/API/DB/lockfiles outside explicit SOT unlock.
- No production-ready claims. No fake-live claims.
- Fallback smoke conveyor continues independently and does not represent product completion.
