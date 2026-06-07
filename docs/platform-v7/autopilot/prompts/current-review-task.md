# Review current task — Autopilot Product Slice 19

Maturity: controlled-pilot / pre-integration.
Do not overstate maturity or imply live external integrations.
Do not change apps/landing, production UI, visual/theme/onboarding, adapters, server actions, AI gateway runtime, DB/migrations or lockfiles unless the current step explicitly allows it.
Do not auto-merge. Human review and green checks are required.

Review the diff, not the agent report.

## Required scope checks

- `apps/landing` diff must be 0.
- UI/visual/theme/onboarding diff must be 0 unless explicitly allowed by the current step.
- adapters/server-actions/AI gateway diff must be 0 unless explicitly allowed by the current step.
- no auto-merge behavior.
- no fake-live or maturity overclaim.

## Current allowed scope

- apps/web/tests/e2e/platform-v7-agent-generated-smoke-18.spec.ts
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md
- scripts/p7-autopilot-*.mjs
- .github/workflows/platform-v7-autopilot-*.yml

## Transition guard

- BLOCKED: Autopilot Product Slice 19 is not green/closed/mergeable. Dispatcher will not advance to Product Entry / Onboarding.

## Queue snapshot

# platform-v7 execution queue

CURRENT: Autopilot Product Slice 19

CURRENT ALLOWED:
- apps/web/tests/e2e/platform-v7-agent-generated-smoke-18.spec.ts

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
- Autopilot Product Slice 15
- Autopilot Product Slice 16
- Autopilot Product Slice 17
- Autopilot Product Slice 18

NEXT:
- Layer: Autopilot Product Slice 20
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


## Review brief

Review Autopilot Product Slice 19 strictly against the state allowed scope and queue.

Return PASS or BLOCKED. If BLOCKED, include blocker, file, why risk and exact fix.
