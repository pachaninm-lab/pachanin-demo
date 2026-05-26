# Codex current task — Qodana #1423 CI-only report-mode baseline

Current step: Qodana #1423 — CI-only report-mode baseline.
Maturity: controlled-pilot / pre-integration.

## Objective

Add the first Qodana baseline strictly as a CI-only report-mode layer.

This PR must improve observability and static-analysis visibility only. It must not change product behavior, UI, runtime, API routes, DB, adapters, lockfiles or maturity claims.

## Allowed files

- .github/workflows/qodana-platform-v7-report.yml
- qodana.yaml
- docs/platform-v7/qa/qodana-report-mode.md

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

Create a Qodana report-mode workflow for platform-v7 quality visibility.

Requirements:
- run on pull_request and workflow_dispatch;
- do not block merges in this first Qodana PR;
- do not auto-fix code;
- do not upload secrets or require live integration credentials;
- keep the check informational/report-only;
- limit analysis intent to repository quality visibility and controlled-pilot hardening;
- document how findings must be triaged before any future hard gate.

## Required checks

- platform-v7 autopilot guard
- Node CI
- CI
- Repo automations
- Labeler

Dependency Review may run, but this PR must not change dependency files.

## PR title

ci(platform-v7): add qodana report-mode baseline
