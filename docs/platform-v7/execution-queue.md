# platform-v7 execution queue

CURRENT: Autopilot Next-layer Selector

CURRENT ALLOWED:
- scripts/p7-autopilot-next-layer.mjs
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md

CURRENT CRITERIA:
- selector returns one valid current layer;
- selector stops on queue/state conflict;
- selector stops on forbidden scope;
- selector writes clear machine-readable JSON reason.

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

NEXT:
- Layer: Autopilot Check Analyzer
- Allowed files:
  - scripts/p7-autopilot-check-analyzer.mjs
  - scripts/p7-autopilot-safe-fix.mjs
  - docs/platform-v7/autopilot/**
  - docs/platform-v7/execution-queue.md
  - .github/workflows/platform-v7-autopilot-*.yml
- Success criteria:
  - analyzer creates clear report;
  - safe-fix refuses forbidden scope;
  - safe-fix respects attempt limit;
  - failed checks are not silently ignored.
- Readiness remains 72%.

RULES:
- One PR equals one narrow layer.
- Keep controlled-pilot status.
- No product code, apps/landing, API, DB, runtime, adapters, theme, onboarding, or lockfiles in this layer.
