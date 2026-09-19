# Agent runner diagnostics

Status: controlled-pilot / pre-integration.

This document describes the existing platform-v7 background coding runner and the checks required before it can be treated as an autonomous code-writing loop.

## Existing trigger paths

The current workflow is `.github/workflows/platform-v7-agent-runner.yml`.

It can start from:

- manual workflow dispatch with `run-current`;
- an issue receiving label `agent:run`;
- an issue comment containing `/agent run current`.

## Required secret

The runner requires this GitHub Actions repository secret:

- `OPENAI_API_KEY`

If this secret is missing, the runner exits before generating code or creating a PR.

## Expected path

1. Workflow starts from a supported trigger.
2. The repository is checked out.
3. Dependencies are installed with pnpm.
4. `scripts/p7-autopilot-dispatcher.mjs` generates the current task prompt from source-of-truth files.
5. `scripts/p7-agent-runner.sh` calls the configured OpenAI model.
6. The model must return strict JSON file replacements.
7. The runner applies only files listed in `allowedCurrentScope`.
8. `scripts/p7-autopilot-guard.sh`, typecheck and tests run.
9. `peter-evans/create-pull-request` opens a PR labeled `platform-v7`, `agent-generated`, `needs-review`.

## Current guardrails

The runner is not allowed to merge. It only creates PRs.

Safety is enforced by:

- `docs/platform-v7/autopilot/autopilot-state.json`;
- `docs/platform-v7/autopilot/progress.json`;
- `scripts/p7-autopilot-guard.sh`;
- required CI and QA workflows;
- manual or assistant review before merge.

## Failure modes and action

| Failure | Meaning | Safe action |
|---|---|---|
| No agent PR appears after trigger | Workflow did not start, exited early, or failed before PR creation | Check workflow run for issue #1441 trigger and verify `OPENAI_API_KEY` exists |
| Missing `OPENAI_API_KEY` | Runner cannot call model | Add repository secret in GitHub Actions settings |
| Agent writes outside allowed scope | Runner or prompt rejected unsafe output | Keep PR blocked; adjust source-of-truth only if the next layer is intentionally approved |
| Red CI after agent PR | Generated code is not mergeable | Read logs and fix only inside allowed scope |
| No repository diff | Agent returned no usable file replacements | Re-run after updating the current prompt or choosing a smaller next layer |
| GitHub connector unavailable in automation context | Background task cannot read/write repo | Reconnect GitHub connector for automation context |

## Minimum acceptance before background coding is trusted

Background coding is considered operational only when all are true:

- issue label or comment trigger produces an agent PR;
- PR changes stay inside `allowedCurrentScope`;
- `apps/landing` diff is zero;
- lockfile diff is zero unless explicitly allowed;
- all required checks are green;
- PR remains reviewable and does not auto-merge;
- state advance happens only after merge.

Until then, the current reliable mode is assisted autonomy: the assistant reads source-of-truth, creates small PRs, waits for checks, fixes red CI within allowed scope and merges only when clean.
