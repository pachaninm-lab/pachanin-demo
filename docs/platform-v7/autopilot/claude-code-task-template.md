# platform-v7 Claude Code Task Template

Use this template when opening a GitHub issue for Claude Code to execute.

---

## Issue template

```
Title: platform-v7 <short description>
Labels: platform-v7

## Goal
<One sentence: what should exist after this task completes.>

## Required outcome
<Numbered list of concrete deliverables.>

## Allowed scope
List exactly which paths Claude Code may touch. Must be a subset of
`allowedCurrentScope` in docs/platform-v7/autopilot/autopilot-state.json.

- docs/platform-v7/autopilot/**       (always allowed for docs/audit)
- docs/platform-v7/execution-queue.md (always allowed)
- scripts/p7-autopilot-*.mjs          (allowed for infra scripts)
- .github/workflows/platform-v7-autopilot-*.yml  (allowed for infra workflows)
- <add specific product paths only if SOT agentWritableScope permits>

## Hard rules
- One narrow PR per logical change.
- No apps/landing.
- No broad product runtime, UI, API, DB, live integrations, theme, onboarding,
  or lockfiles unless the SOT agentWritableScope explicitly includes the path.
- No production-ready claims.
- No fake-live claims.
- Maturity stays controlled-pilot / pre-integration.

## Acceptance
- PR merged green (platform-v7 autopilot guard + ci + build passing).
- <specific acceptance criterion for this task>.
- Final report posted as issue comment with PR number, changed files, audit
  engine, and confirmation that fallback autopilot remains active.
```

---

## How Claude Code reads this

1. Reads the issue body.
2. Reads `docs/platform-v7/autopilot/autopilot-state.json` to verify current
   `allowedCurrentScope` and `agentWritableScope`.
3. Verifies all planned files are within the stated allowed scope.
4. Opens PR, waits for checks, reports back.

Claude Code will refuse to touch paths outside `allowedCurrentScope` regardless
of what the issue body says. The SOT is the authoritative scope boundary.
