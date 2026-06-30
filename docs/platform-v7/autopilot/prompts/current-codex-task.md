# Codex current task — P0 market-entry page boundary selection

Maturity: controlled-pilot / pre-integration.

Do not overstate maturity. Do not imply external connections are active. Do not change apps/landing, backend, persistence, external connectivity, auth/session/API, packages or lockfiles.

## Source of truth

- State: `docs/platform-v7/autopilot/autopilot-state.json`
- Queue: `docs/platform-v7/execution-queue.md`
- Progress: `docs/platform-v7/autopilot/progress.json`

## Current step

Docs-only scope selection for the future `/platform-v7/market-entry` route.

The current PR must only update source-of-truth docs. It must not implement app code.

## Allowed current scope

Use only the exact paths listed in `allowedCurrentScope` in `autopilot-state.json`.

## Next implementation candidate

After this docs PR is green and merged, the next PR may target only:

- `apps/web/app/platform-v7/market-entry/page.tsx`

That follow-up implementation must be route-only and server-rendered: no client hooks, no localStorage, no handoff, no API route, no storage, no shell, no RBAC, no bank, no deal runtime and no money movement.

## Acceptance criteria

- no apps/landing diff;
- no package or lockfile diff;
- no app implementation diff in this docs PR;
- no backend/persistence/external-connectivity changes;
- no fake maturity claims;
- readiness remains 72%;
- GitHub Actions and Netlify checks green before merge.
