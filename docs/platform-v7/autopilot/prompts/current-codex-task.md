# Current task

Current step: Runner Dispatch Reliability.
Maturity: controlled-pilot / pre-integration.

## Goal

Keep the runner path observable and pull-request only.

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

## Requirements

- no product code changes;
- no auto-merge;
- no dependency changes;
- generated work stays pull-request only;
- readiness remains 72.

## Required checks

- platform-v7 autopilot guard
- Node CI
- CI
- Repo automations
- Labeler
- Dependency Review
- Qodana platform-v7 report
- CodeQL platform-v7 report
