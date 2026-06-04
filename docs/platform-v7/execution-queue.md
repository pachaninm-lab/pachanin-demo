# platform-v7 execution queue

CURRENT: Autopilot Safe Task Intake

CURRENT ALLOWED:
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md
- scripts/p7-autopilot-*.mjs

CURRENT CRITERIA:
- selected task must have explicit allowed scope;
- selected task must stay inside current state permission;
- unsafe scope must return blocked state.

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
- Autopilot Dry-run Loop

NEXT:
- Layer: Autopilot Issue Executor Dry-run
- Allowed files:
  - docs/platform-v7/autopilot/**
  - docs/platform-v7/execution-queue.md
  - scripts/p7-autopilot-*.mjs
  - .github/workflows/platform-v7-autopilot-*.yml
- Success criteria:
  - selected safe task becomes a branch plan;
  - executor dry-run produces intended file actions;
  - unsafe scope stops before branch or PR creation;
  - merge gate remains required before merge.
- Readiness remains 72%.

RULES:
- One PR equals one narrow layer.
- Keep controlled-pilot status.
- Keep this layer limited to autopilot docs, scripts, and matching autopilot workflows.
