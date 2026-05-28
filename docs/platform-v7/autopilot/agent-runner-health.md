# Agent Runner Health

Status: controlled-pilot / pre-integration.

This layer improves the reliability signal of the platform-v7 background runner. It does not make generated work merge automatically.

## What changed

The runner workflow now has:

- a concurrency group for runner executions;
- a 25-minute timeout;
- a preflight step;
- a visible GitHub Actions step summary;
- an explicit check for the required repository secret;
- a final runner summary that records the generated branch environment value when available.

## Required repository secret

- `OPENAI_API_KEY`

If this secret is missing or unavailable, the workflow must stop before the code-writing step and show a clear failure reason in the run summary.

## Safe operating rule

The runner may create pull requests only. It must not merge generated work.

## Acceptance criteria

The runner-health layer is acceptable when:

- the workflow file remains limited to the existing platform-v7 runner;
- product code is unchanged;
- apps/landing is unchanged;
- dependency files and lockfiles are unchanged;
- the runner has a clear preflight failure path;
- generated work remains PR-only;
- required checks are green.

## Next verification

After merge, trigger the runner through issue #1441 with `agent:run` or `/agent run current` and verify whether it creates an `agent-generated` pull request or fails with a visible preflight reason.
