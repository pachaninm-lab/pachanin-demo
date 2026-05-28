# Agent Runner Health

Status: controlled-pilot / pre-integration.

This layer improves the reliability signal of the platform-v7 background runner. It does not make generated work merge automatically.

## What changed

The runner workflow now has:

- a concurrency group for runner executions;
- a 25-minute timeout;
- an issue-visible start marker for issue-triggered runs;
- a preflight step;
- a visible GitHub Actions step summary;
- an explicit check for the required repository secret;
- a final runner summary that records the generated branch environment value when available.

## Issue-visible diagnostics

Issue-triggered runs should surface a start marker back into the trigger issue before checkout, dependency installation or code-writing begins. Missing-secret preflight failures should also be posted back to the trigger issue when `OPENAI_API_KEY` is unavailable. This separates trigger failures from later runner failures.

## Required repository secret

- `OPENAI_API_KEY`

If this secret is missing or unavailable, the workflow must stop before the code-writing step and show a clear failure reason in the run summary or trigger issue.

## Safe operating rule

The runner may create pull requests only. It must not merge generated work.

## Acceptance criteria

The runner-health layer is acceptable when:

- the workflow file remains limited to the existing platform-v7 runner;
- product code is unchanged;
- apps/landing is unchanged;
- dependency files and lockfiles are unchanged;
- issue-triggered runs create a visible start marker;
- the runner has a clear preflight failure path;
- issue-triggered missing-secret failures are visible on the trigger issue;
- generated work remains PR-only;
- required checks are green.

## Next verification

After merge, trigger the runner through issue #1441 with `agent:run` or `/agent run current` and verify whether it creates an `agent-generated` pull request, posts a start marker, or fails with a visible preflight reason.
