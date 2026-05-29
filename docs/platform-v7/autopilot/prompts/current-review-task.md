# Review current task

Current step: Runner Dispatch Reliability.
Maturity: controlled-pilot / pre-integration.

## Allowed files

- .github/workflows/platform-v7-agent-runner.yml
- docs/platform-v7/autopilot/runner-dispatch-reliability.md

## Do not change

- apps/landing
- apps/web/app/platform-v7
- apps/web/components/platform-v7
- apps/web/components/v7r
- apps/web/lib/platform-v7
- apps/web/app/api
- package.json
- package-lock.json
- pnpm-lock.yaml

## Required checks

- platform-v7 autopilot guard
- Node CI
- CI
- Repo automations
- Labeler
- Dependency Review
- Qodana platform-v7 report
- CodeQL platform-v7 report

## Merge rule

Merge only if scope is clean, checks are green, apps/landing diff is 0, maturity remains controlled-pilot / pre-integration, no product code changed, no lockfile changed, generated work stays pull-request only, and mergeable=true.
