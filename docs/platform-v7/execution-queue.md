# platform-v7 execution queue

CURRENT: Autopilot Product Slice 15

CURRENT ALLOWED:
- apps/web/tests/e2e/platform-v7-agent-generated-smoke-14.spec.ts

CURRENT CRITERIA:
- runner generates exactly one allowed code/test file;
- generated branch is opened as PR by the repo-side runner;
- generated PR receives platform-v7, agent-generated and automerge labels without manual labeling;
- restricted areas remain blocked;
- merge gate remains final authority.

DONE:
- baseline
- Runner Inline PR
- Runner Gate Fix
- Runner Opens PR
- Runner PR Permission Smoke
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
- Autopilot Exact Path Unlock
- Autopilot Product Slice Proposal
- Autopilot Product Slice 01
- Autopilot Product Slice 02
- Autopilot Product Slice 03
- Autopilot Product Slice 04
- Autopilot Product Slice 05
- Autopilot Product Slice 06
- Autopilot Product Slice 07
- Autopilot Product Slice 08
- Autopilot Product Slice 09
- Autopilot Product Slice 10
- Autopilot Product Slice 11
- Autopilot Product Slice 12
- Autopilot Product Slice 13
- Autopilot Product Slice 14

NEXT:
- Layer: Autopilot Product Slice 16
- Allowed files:
  - docs/platform-v7/autopilot/**
  - docs/platform-v7/execution-queue.md
  - scripts/p7-autopilot-*.mjs
  - .github/workflows/platform-v7-autopilot-*.yml
- Success criteria:
  - source-of-truth advances after generated PR merge;
  - restricted areas remain blocked;
  - merge gate remains final authority.
- Readiness remains 72%.

RULES:
- One PR equals one narrow layer.
- Keep controlled-pilot status.
- Keep current slice limited to the exact allowed file.
