# Codex current task — Role cabinet functional pass

Maturity: controlled-pilot / pre-integration.

Do not overstate maturity. Do not imply external connections are active. Do not change apps/landing, backend, persistence, external connectivity, auth/session/API, packages or lockfiles.

## Source of truth

- State: `docs/platform-v7/autopilot/autopilot-state.json`
- Queue: `docs/platform-v7/execution-queue.md`
- Progress: `docs/platform-v7/autopilot/progress.json`

## Current step

Role cabinet functional pass: every role cabinet must show within the first screen:

1. what happened;
2. what is blocked;
3. money impact;
4. responsible party;
5. evidence basis;
6. one next action.

## Allowed current scope

Use only the exact paths listed in `allowedCurrentScope` in `autopilot-state.json`.

## Implementation order

Start with seller. Then buyer, bank, operator, compliance, lab/elevator and field roles in separate small PRs.

## Acceptance criteria

- no apps/landing diff;
- no package or lockfile diff;
- no backend/persistence/external-connectivity changes;
- no fake maturity claims;
- one primary action per role screen;
- buttons route to a real page, action, or section anchor;
- GitHub Actions and Netlify checks green before merge.
