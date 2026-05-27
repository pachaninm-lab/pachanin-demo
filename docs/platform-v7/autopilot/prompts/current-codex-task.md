# Codex current task — Agent Runner Diagnostics

Current step: Agent Runner Diagnostics — background coding health check.
Maturity: controlled-pilot / pre-integration.

## Objective

Document the existing platform-v7 background coding runner so failures become diagnosable instead of silent.

This PR must improve automation visibility only. It must not change runner scripts, workflow files, product behavior, UI, runtime, API routes, DB, adapters, dependencies, lockfiles or maturity claims.

## Allowed files

- docs/platform-v7/autopilot/agent-runner-diagnostics.md

## Forbidden zones

- apps/landing
- apps/web/app/platform-v7
- apps/web/components/platform-v7
- apps/web/components/v7r
- apps/web/lib/platform-v7
- apps/web/app/api
- .github/workflows
- scripts
- package.json
- package-lock.json
- pnpm-lock.yaml

## Implement

Create a concise diagnostics document that covers:

- available trigger paths: workflow dispatch, issue label, issue comment;
- required GitHub Actions secret name;
- expected agent path from trigger to PR creation;
- allowed scope enforcement through autopilot-state and guard script;
- failure modes: missing secret, unavailable connector, no PR produced, blocked scope, red checks;
- safe next action for each failure mode.

## Required checks

- platform-v7 autopilot guard
- Node CI
- CI
- Repo automations
- Labeler
- Dependency Review
- Qodana platform-v7 report
- CodeQL platform-v7 report

## PR title

docs(platform-v7): add agent runner diagnostics
