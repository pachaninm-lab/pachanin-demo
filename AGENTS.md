# Agent Operating Instructions

## Purpose

Accelerate platform-v7 without losing engineering discipline. Agents must follow repository state, not chat memory.

## Source of truth

Read these files before any change:

- `docs/platform-v7/autopilot/autopilot-state.json`
- `docs/platform-v7/execution-queue.md`
- `docs/platform-v7/autopilot/progress.json`
- `docs/platform-v7/autopilot/prompts/current-codex-task.md`
- `docs/platform-v7/autopilot/prompts/current-review-task.md`

## Hard rules

- Work only inside the current `allowedCurrentScope` from `autopilot-state.json`.
- One PR equals one narrow current step.
- Do not rewrite platform-v7 from scratch.
- Do not touch `apps/landing`.
- Do not touch platform-v7 UI, visual, theme, onboarding, adapters, server actions, AI gateway, DB/migrations or lockfiles unless the current step explicitly allows it.
- Do not commit secrets.
- Keep maturity wording at controlled-pilot / pre-integration unless live contracts, credentials, deployments and real transaction evidence are confirmed.

## Forbidden claims

Do not introduce these claims in UI, docs, PR body, tests or code comments:

- production-ready
- fully live
- fully integrated
- platform guarantees payment
- платформа гарантирует оплату
- платформа сама выпускает деньги
- банк подключён
- ФГИС подключён
- ЭДО подключён

## Product owner design requirements (binding)

Recorded 2026-07-19 from the product owner. Any UI work allowed by the current step must comply:

- The platform must be understandable to any user without training: one task per screen, one primary action, plain sixth-grade Russian, help in place. Follow `DESIGN_STANDARD_platform_2026-07-19.md`.
- The platform must look like a mature industrial federal-scale system: document numbers, timestamps with timezone, audit notice, visual quiet. No marketing gloss, no emoji in work surfaces, no version names (v7/v9) visible to users.
- Zero function loss: simplification means re-ranking (progressive disclosure), never removal. Every existing function stays reachable within 2 clicks.
- Zero demo feel for working roles: demo/simulation/flag tooling moves to staff-only surfaces; environment banners collapse into a quiet service line. This does not override the maturity-wording rules above — honest stage wording stays, phrased in user language.
- Design/visual diagnosis and migration plan: `AUDIT_design-visual_2026-07-19.md`. Acceptance criteria for any UI wave: `DESIGN_STANDARD_platform_2026-07-19.md` §7.

## Engineering rules

- Use explicit boundaries.
- Use dependency injection.
- Use typed results.
- Keep changes reviewable.
- Add or update tests for every implementation step.
- Do not use hidden singleton runtime state.
- Do not use module-level persistence state unless the current step explicitly permits it. For PR 5.5, persistence state must live only inside an explicit adapter instance.
- Do not bypass RBAC, idempotency, audit or action-boundary rules.

## Required checks

Run the closest available checks and document results in PR body:

- `node scripts/p7-autopilot-dispatcher.mjs`
- `bash scripts/p7-autopilot-guard.sh`
- `pnpm typecheck`
- `pnpm test`

## PR body minimum

Include:

- Scope
- Changed files
- Guards
- Checks
- Known limitations

## Codex role

Codex writes implementation PRs only for the current allowed step.

## Claude role

Claude should be used as reviewer, architect and risk auditor. Claude should not write competing implementation PRs for the same current step.

## Review rule

Review the diff, not the agent report. If changed files exceed allowed scope, block merge.