# platform-v7 agent runbook

## Purpose

This runbook describes the autonomous agent layer for platform-v7. The agent layer is designed to execute the current autopilot step from repository state, not from chat memory.

## Current control files

- `docs/platform-v7/autopilot/autopilot-state.json` — current step, allowed scope, locked work, forbidden zones and wording guardrails.
- `docs/platform-v7/autopilot/prompts/codex-pr-5.1.md` — implementation prompt for the current step.
- `docs/platform-v7/autopilot/prompts/review-pr-5.1.md` — review prompt for the current step.
- `scripts/p7-agent-runner.sh` — runner script used by GitHub Actions.
- `.github/workflows/platform-v7-agent-runner.yml` — workflow that starts the runner.

## How to start the agent

There are three supported triggers.

### Manual trigger

Repository → Actions → `platform-v7 agent runner` → Run workflow → command: `run-current`.

### Issue label trigger

Add label:

```text
agent:run
```

### Issue comment trigger

Comment in an issue:

```text
/agent run current
```

## Required secret

The workflow requires this repository secret:

```text
OPENAI_API_KEY
```

Add it in:

Repository → Settings → Secrets and variables → Actions → New repository secret.

Do not commit secrets to the repository.

## Expected result

The agent runner should:

1. read `autopilot-state.json`;
2. read the current implementation prompt;
3. create an agent branch;
4. call the coding agent API;
5. run scope guard, typecheck and tests;
6. push a branch;
7. create a pull request through GitHub Actions.

## Hard merge rule

The agent may create a branch and pull request, but it must not merge to `main` automatically.

Merge only after:

- checks are green;
- changed files are inside the allowed scope;
- review says mergeable;
- no UI, `apps/landing`, adapters, server actions, AI gateway, onboarding or theme changes are present;
- no fake maturity claims are introduced.

## Current step

Current step is PR 5.1 — Application Service Layer.

Allowed files for the current implementation:

```text
apps/web/lib/platform-v7/runtime/application-service.ts
apps/web/lib/platform-v7/runtime/application-service-types.ts
apps/web/tests/unit/platformV7RuntimeApplicationServices.test.ts
```

## What the agent is not allowed to do

- change `apps/landing`;
- change platform-v7 UI routes/components;
- start adapters, server actions, AI gateway, onboarding or theme work;
- claim live external integrations;
- claim production maturity;
- move money outside the action-boundary path;
- skip idempotency or audit.
