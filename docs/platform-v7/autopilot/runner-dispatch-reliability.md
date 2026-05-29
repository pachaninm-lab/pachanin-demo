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

## Scope

Allowed files for the next reliability pass:

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

The next layer is acceptable when:

- the workflow still creates pull requests only;
- empty output does not create an empty pull request;
- issue/comment based start signal is visible when the event is delivered;
- failures remain visible without exposing secrets;
- required checks are green.
