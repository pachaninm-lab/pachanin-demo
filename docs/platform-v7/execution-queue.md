# platform-v7 execution queue

CURRENT: Autopilot Dry-run Loop

CURRENT ALLOWED:
- scripts/p7-autopilot-loop-dry-run.mjs
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md
- .github/workflows/platform-v7-autopilot-loop-dry-run.yml

CURRENT CRITERIA:
- dry-run loop receives a completed PR event;
- state updater runs;
- next layer is selected;
- merge gate is evaluated in dry-run mode;
- audit record is written.

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
- Autopilot Merge Gate

NEXT:
- Layer: Autopilot Safe Task Intake
- Allowed files:
  - docs/platform-v7/autopilot/**
  - docs/platform-v7/execution-queue.md
  - scripts/p7-autopilot-*.mjs
- Success criteria:
  - next issue/task is selected only when allowed scope is explicit;
  - no product file is selected without exact state permission;
  - blocked state is reported when the next task requires forbidden scope.
- Readiness remains 72%.

RULES:
- One PR equals one narrow layer.
- Keep controlled-pilot status.
- Keep this layer limited to autopilot docs, scripts, and matching autopilot workflows.
