# Codex current task — CodeQL #1434 GitHub-native security report-only baseline

Current step: CodeQL #1434 — GitHub-native security report-only baseline.
Maturity: controlled-pilot / pre-integration.

## Objective

Add the first GitHub-native CodeQL baseline strictly as a report-only security visibility layer.

This PR must improve static security visibility only. It must not change product behavior, UI, runtime, API routes, DB, adapters, lockfiles or maturity claims.

## Allowed files

- .github/workflows/codeql-platform-v7-report.yml
- docs/platform-v7/qa/codeql-report-mode.md

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

Create a CodeQL workflow for platform-v7 security visibility in report-only mode.

Requirements:
- run on pull_request and workflow_dispatch;
- use GitHub-native CodeQL action;
- analyze JavaScript/TypeScript only;
- do not block merges in this first CodeQL PR;
- do not auto-fix code;
- do not require live integration credentials;
- keep the check informational/report-only;
- limit analysis intent to repository security visibility and controlled-pilot hardening;
- document how findings must be triaged before any future hard gate.

## Required checks

- platform-v7 autopilot guard
- Node CI
- CI
- Repo automations
- Labeler

Dependency Review may run, but this PR must not change dependency files.

## PR title

ci(platform-v7): add codeql report-mode baseline
