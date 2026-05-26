# Codex current task — PR 6.1 External Adapter Emulator Contracts

Current step: PR 6.1 — External Adapter Emulator Contracts.
Maturity: controlled-pilot / pre-integration.
Human review is required before merge.

## Source of truth

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/autopilot/stage-6-adapter-emulator-contracts.md

## Objective

Define the Stage 6 contract-only boundary for future external adapter emulators.

This PR must not implement live integrations, adapter runtime behavior, API routes, DB persistence, UI, AI gateway, theme or onboarding. It only documents the external-event contract envelope, adapter families, allowed maturity language and guardrails for the next Stage 6 implementation PRs.

## Allowed files

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/autopilot/stage-6-adapter-emulator-contracts.md
- docs/platform-v7/execution-queue.md

## Forbidden zones

- apps/landing
- apps/web/app/platform-v7
- apps/web/components/platform-v7
- apps/web/components/v7r
- apps/web/lib/platform-v7/adapters
- apps/web/lib/platform-v7/ai
- apps/web/app/api
- apps/web/lib/platform-v7/runtime
- apps/web/tests/unit
- package-lock.json
- pnpm-lock.yaml
- theme
- onboarding
- UI components/routes

## Implement

Required changes:

- Add a contracts-only document for Stage 6 external adapter emulator boundaries.
- Define contract families for bank, FGIS/SDIZ, EDO, EPD/logistics and lab/inspection emulators.
- Define a shared external adapter event envelope.
- Keep `external_confirmed` reserved for future live integrations only.
- Keep readiness at 48% and do not raise it in this PR.
- Keep PR 6.2+ locked until PR 6.1 is green and merged.
- Keep maturity wording at controlled-pilot / pre-integration.
- Do not introduce any live bank, FGIS, EDO, EPD, logistics, lab or production-ready claims.

## Tests / checks

Run through CI:

- platform-v7 autopilot guard
- Node CI
- CI
- Repo automations
- Labeler

## PR title

docs(platform-v7): define stage 6 adapter emulator contracts
