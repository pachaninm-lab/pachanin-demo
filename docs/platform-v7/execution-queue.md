# platform-v7 execution queue

CURRENT: Autopilot Exact Path Unlock

CURRENT ALLOWED:
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md
- scripts/p7-autopilot-*.mjs
- .github/workflows/platform-v7-autopilot-*.yml

CURRENT CRITERIA:
- exact path unlock is represented as a proposed state patch;
- patch is blocked for restricted paths;
- patch can allow a narrow non-restricted path only when current source-of-truth says so;
- merge gate remains final authority.

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
- Autopilot Live Controlled Pilot Gate
- Autopilot Step Enablement
- Autopilot Scope Proposal Gate

NEXT:
- Layer: Autopilot Product Slice Proposal
- Allowed files:
  - docs/platform-v7/autopilot/**
  - docs/platform-v7/execution-queue.md
  - scripts/p7-autopilot-*.mjs
  - .github/workflows/platform-v7-autopilot-*.yml
- Success criteria:
  - first product slice is proposed as exact paths only;
  - proposal does not modify product files;
  - apps/landing remains blocked;
  - merge gate remains final authority.
- Readiness remains 72%.

RULES:
- One PR equals one narrow layer.
- Keep controlled-pilot status.
- Keep this layer limited to autopilot docs, scripts, and matching autopilot workflows.
