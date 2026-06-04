# platform-v7 execution queue

CURRENT: Autopilot Check Analyzer

CURRENT ALLOWED:
- scripts/p7-autopilot-check-analyzer.mjs
- scripts/p7-autopilot-safe-fix.mjs
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md
- .github/workflows/platform-v7-autopilot-*.yml

CURRENT CRITERIA:
- analyzer creates clear report;
- safe-fix refuses forbidden scope;
- safe-fix respects attempt limit;
- failed checks are not silently ignored.

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

NEXT:
- Layer: Autopilot Merge Gate
- Allowed files:
  - scripts/p7-autopilot-merge-gate.mjs
  - scripts/p7-autopilot-guard.sh
  - docs/platform-v7/autopilot/**
  - docs/platform-v7/execution-queue.md
  - .github/workflows/platform-v7-autopilot-*.yml
- Success criteria:
  - dirty PR is refused;
  - red PR is refused;
  - green clean PR is allowed;
  - gate writes decision reason to audit log.
- Readiness remains 72%.

RULES:
- One PR equals one narrow layer.
- Keep controlled-pilot status.
- No product code, apps/landing, API, DB, runtime, adapters, theme, onboarding, or lockfiles in this layer.
