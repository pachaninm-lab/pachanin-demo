# Codex current task — Agent Runner Health

Current step: Agent Runner Health.
Maturity: controlled-pilot / pre-integration.

## Objective

Improve visibility for the existing platform-v7 background runner without changing product behavior.

This PR must be limited to runner workflow visibility and documentation. It must not change product code, UI, runtime, API routes, DB, adapters, dependencies, lockfiles or maturity claims.

## Allowed files

- .github/workflows/platform-v7-agent-runner.yml
- docs/platform-v7/autopilot/agent-runner-health.md

## Forbidden zones

- apps/landing
- apps/web/app/platform-v7
- apps/web/components/platform-v7
- apps/web/components/v7r
- apps/web/lib/platform-v7
- apps/web/app/api
- package.json
- package-lock.json
- pnpm-lock.yaml

## Implement

Harden the existing runner workflow so failed or skipped runs are easier to diagnose.

Requirements:
- keep generated work PR-only;
- do not add auto-merge;
- do not add dependencies;
- do not change scripts in this layer;
- add clear workflow-level visibility where safe;
- document start paths, pass criteria and failure handling.

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

ci(platform-v7): improve runner health visibility
