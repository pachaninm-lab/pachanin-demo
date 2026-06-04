# platform-v7 execution queue

CURRENT: Autopilot State Schema

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- docs/platform-v7/autopilot/schema/autopilot-state.schema.json
- scripts/p7-autopilot-state-validate.mjs
- scripts/p7-autopilot-state-update.mjs

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

NEXT:
- Layer: Autopilot Next-layer Selector
- Allowed files:
  - scripts/p7-autopilot-next-layer.mjs
  - docs/platform-v7/autopilot/**
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - selector returns one valid next layer;
  - selector stops on conflict;
  - selector stops on forbidden scope;
  - selector writes clear reason.
- Readiness remains 72%.

RULES:
- One PR equals one narrow layer.
- Keep controlled-pilot status.
- No product code, apps/landing, API, DB, runtime, adapters, theme, onboarding, or lockfiles in this layer.
