# Runner Dispatch Reliability

Status: controlled-pilot / pre-integration.

This layer keeps the runner path observable and pull-request only.

## Current position

Runner health work is complete at the workflow visibility level:

- preflight visibility exists;
- start markers exist for issue-based runs;
- sanitized tail output exists for failure review;
- empty output can be treated as a controlled no-op;
- generated work remains pull-request only.

## Scheduled dispatch

The runner workflow may start from a schedule, manual dispatch, issue label or issue comment. Scheduled runs are still bounded by the same guardrails: they can create pull requests only and cannot merge generated work.

The GitHub-hosted schedule is set to the shortest practical loop supported by GitHub Actions for scheduled workflows: every five minutes. This is a continuous PR-loop, not a direct-to-main write path.

For a true always-on daemon, use a self-hosted runner or external worker that triggers the same PR-only workflow and keeps the same review gates.

## Scope

Allowed files for this reliability pass:

- `.github/workflows/platform-v7-agent-runner.yml`
- `docs/platform-v7/autopilot/runner-dispatch-reliability.md`

## Guardrails

- no apps/landing changes;
- no product code changes;
- no API, DB, runtime or adapter changes;
- no dependency or lockfile changes;
- no maturity increase;
- no auto-merge.

## Acceptance criteria

The layer is acceptable when:

- the workflow can start without manual issue activity;
- the workflow still creates pull requests only;
- empty output does not create an empty pull request;
- failures remain visible without exposing secrets;
- required checks are green.
