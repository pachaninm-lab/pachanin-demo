# platform-v7 execution queue

CURRENT: Autopilot Live Controlled Pilot Gate

CURRENT ALLOWED:
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md
- scripts/p7-autopilot-*.mjs
- .github/workflows/platform-v7-autopilot-*.yml

CURRENT CRITERIA:
- controlled mode is off by default;
- controlled mode requires explicit state permission;
- branch and draft PR steps require safe intake and merge gate;
- non-autopilot scope requires a new source-of-truth layer.

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
- Autopilot Safe Task Intake
- Autopilot Issue Executor Dry-run
- Autopilot Issue Executor PR Wiring
- Autopilot Full Loop Verification

NEXT:
- Layer: Autopilot Controlled Step Enablement
- Allowed files:
  - docs/platform-v7/autopilot/**
  - docs/platform-v7/execution-queue.md
  - scripts/p7-autopilot-*.mjs
  - .github/workflows/platform-v7-autopilot-*.yml
- Success criteria:
  - controlled mode stays off by default;
  - controlled mode requires explicit state flag;
  - branch and draft PR steps require safe intake and merge gate;
  - product scope remains locked until source-of-truth changes.
- Readiness remains 72%.

RULES:
- One PR equals one narrow layer.
- Keep controlled-pilot status.
- Keep this layer limited to autopilot docs, scripts, and matching autopilot workflows.
