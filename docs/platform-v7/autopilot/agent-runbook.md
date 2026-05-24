# platform-v7 agent runbook

## Purpose

The platform-v7 autopilot runs one narrow current step from repository state. It is not a merge bot and it does not decide product maturity. The project remains controlled-pilot / pre-integration until persistence, API runtime and external integrations are explicitly completed and reviewed.

## Source Of Truth

- `docs/platform-v7/autopilot/autopilot-state.json` — current step, open PR, allowed scope, locked work, forbidden zones and wording guardrails.
- `docs/platform-v7/execution-queue.md` — ordered queue and transition rules.
- `scripts/p7-autopilot-dispatcher.mjs` — generates current prompts and progress from state and queue.
- `docs/platform-v7/autopilot/prompts/current-codex-task.md` — generated implementation prompt.
- `docs/platform-v7/autopilot/prompts/current-review-task.md` — generated review prompt.
- `docs/platform-v7/autopilot/progress.json` — generated progress snapshot.
- `scripts/p7-agent-runner.sh` — runner used by GitHub Actions.
- `.github/workflows/platform-v7-agent-runner.yml` — workflow that starts the runner and opens a PR.

## How To Start

Use one of these entry points:

- Create the `platform-v7 agent run` issue template.
- Add the `agent:run` label to an issue.
- Comment `/agent run current` on an issue.
- Run the `platform-v7 agent runner` workflow manually with `command=run-current`.

## What Happens

1. The workflow checks out the repository.
2. The dispatcher reads state and queue.
3. The dispatcher generates the current Codex prompt, review prompt and progress snapshot.
4. The runner reads `current-codex-task.md`.
5. The runner creates a step-specific branch.
6. The runner calls the coding agent.
7. The runner applies only file replacements inside the current allowed scope.
8. The guard, typecheck and tests run.
9. GitHub Actions creates a pull request with `platform-v7`, `agent-generated` and `needs-review` labels.
10. A reviewer checks the PR.
11. Merge happens only by a human after green checks.

## Autonomous Loop

The optional `platform-v7 autopilot loop` workflow runs every 30 minutes and can also be started manually.

Loop behavior:

- It runs the dispatcher and reads `autopilot-state.json`.
- If an open `platform-v7` + `agent-generated` PR already exists, it stops and logs the PR gate.
- If `currentStatus` is not `ready`, it stops and logs the state gate.
- If no agent PR is open and `currentStatus=ready`, it triggers `platform-v7 agent runner` with `command=run-current`.
- It never merges a PR directly.

## Agent Roles

Codex implementation role:

- Read the generated `current-codex-task.md`.
- Change only files allowed by `allowedCurrentScope`.
- Run the guard, typecheck and tests.
- Create a narrow PR and leave merge to a human.

Claude review role:

- Read the generated `current-review-task.md`.
- Review the diff, not the agent report.
- Return PASS or BLOCKED.
- Require explicit fixes for scope drift, fake-live claims, missing checks or hidden mutation paths.

## Transition Rules

- The dispatcher must not advance to the next queue item while the current step is not green, closed, mergeable or merged.
- The dispatcher must not update readiness percent as if work merged.
- The dispatcher must not remove forbidden zones.
- The dispatcher must not start UI, visual, theme, onboarding, adapters, server actions, AI gateway, DB or migration work before the queue allows it.
- The runner must not commit secrets.
- The runner must not merge PRs.
- The workflow must not auto-merge PRs.

## Hard Stop Conditions

Stop the autonomous loop and require human review if any of these happen:

- `apps/landing` changes.
- UI, visual, theme, onboarding, adapters, server actions or AI gateway changes appear before the current step allows them.
- A PR claims maturity above controlled-pilot / pre-integration.
- A PR claims live bank, FGIS, EDO or payment guarantees.
- A workflow attempts auto-merge behavior.
- A runner output includes secrets or credentials.
- GitHub checks are pending, failed or hidden.
- The dispatcher tries to skip the current queue item.

## Current Step

Current step is PR 5.1 — Application Service Layer.

Allowed files for the current implementation:

```text
apps/web/lib/platform-v7/runtime/application-service.ts
apps/web/lib/platform-v7/runtime/application-service-types.ts
apps/web/tests/unit/platformV7RuntimeApplicationServices.test.ts
```

## Hard Guards

- No `apps/landing` changes.
- No platform-v7 UI routes or component changes before the relevant queue item.
- No adapters, server actions, AI gateway, onboarding or theme changes before the relevant queue item.
- No live external integration claims.
- No maturity overclaim.
- No money movement outside the action-boundary path.
- No hidden module-level persistence state.

## Required Secret

The workflow requires:

```text
OPENAI_API_KEY
```

Store it in GitHub Actions secrets. Do not commit secrets.
