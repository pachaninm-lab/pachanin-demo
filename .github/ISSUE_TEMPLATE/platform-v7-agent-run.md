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

## Expected current step

```text
PR 5.1 — Application Service Layer
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

## Notes

The agent must use repository state as the source of truth:

- `docs/platform-v7/autopilot/autopilot-state.json`
- `docs/platform-v7/autopilot/prompts/codex-pr-5.1.md`
- `docs/platform-v7/autopilot/prompts/review-pr-5.1.md`
