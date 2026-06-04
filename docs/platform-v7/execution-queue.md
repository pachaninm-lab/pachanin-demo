# platform-v7 execution queue

CURRENT: Autopilot Merge Gate

CURRENT ALLOWED:
- scripts/p7-autopilot-merge-gate.mjs
- scripts/p7-autopilot-guard.sh
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md
- .github/workflows/platform-v7-autopilot-*.yml

CURRENT CRITERIA:
- dirty PR is refused;
- red PR is refused;
- green clean PR is allowed;
- gate writes decision reason to audit log.

DONE:
- Runtime foundation stages
- External adapter baseline stages
- AI gateway baseline stages
- CI and QA baseline stages
- Runner health and dispatch stages
- Deal identity smoke
- Route smoke QA
- Agent PR creation reliability
- Autopilot Resilience Layer
- Role Boundary Smoke
- Autopilot State Schema
- Autopilot Next-layer Selector
- Autopilot Check Analyzer

NEXT:
- Layer: Autopilot Dry-run Loop
- Allowed files:
  - scripts/p7-autopilot-loop-dry-run.mjs
  - docs/platform-v7/autopilot/**
  - docs/platform-v7/execution-queue.md
  - .github/workflows/platform-v7-autopilot-loop-dry-run.yml
- Success criteria:
  - dry-run simulates merged PR received;
  - state updater runs;
  - next layer selected;
  - merge gate evaluated as dry-run;
  - audit record written.
- Readiness remains 72%.

RULES:
- One PR equals one narrow layer.
- Keep controlled-pilot status.
- No product code, apps/landing, API, DB, runtime, adapters, theme, onboarding, or lockfiles in this layer.
