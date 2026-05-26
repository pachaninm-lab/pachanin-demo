# Review current task — Qodana #1423 CI-only report-mode baseline

Maturity: controlled-pilot / pre-integration.

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

## Required checks

- platform-v7 autopilot guard
- Node CI
- CI
- Repo automations
- Labeler

Dependency Review may run, but this PR must not change dependency files.

## Merge rule

Merge only if scope is clean, checks are green, apps/landing diff is 0, maturity remains controlled-pilot / pre-integration, no product code changed, no hard gate added, and mergeable=true.
