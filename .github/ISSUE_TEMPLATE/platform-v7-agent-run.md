---
name: platform-v7 agent run
about: Start the platform-v7 autonomous agent for the current autopilot step
title: "platform-v7 agent run: current step"
labels: agent:run, platform-v7
assignees: ''
---

## Command

```text
/agent run current
```

## Expected current step source

```text
docs/platform-v7/autopilot/autopilot-state.json
docs/platform-v7/execution-queue.md
```

## Required checks before merge

- Changed files stay inside the allowed current scope.
- No UI changes.
- No `apps/landing` changes.
- No adapters, server actions, AI gateway, onboarding or theme changes.
- Scope guard passes.
- Typecheck passes.
- Tests pass.
- Review prompt result is mergeable.
- Merge is manual only.

## Notes

The agent must use repository state as the source of truth:

- `docs/platform-v7/autopilot/autopilot-state.json`
- `docs/platform-v7/execution-queue.md`
- `docs/platform-v7/autopilot/progress.json`
- `docs/platform-v7/autopilot/prompts/current-codex-task.md`
- `docs/platform-v7/autopilot/prompts/current-review-task.md`
