# Codex current task — P0 execution/evidence scenario selection

Maturity: controlled-pilot / pre-integration.

Do not overstate maturity. Do not imply external connections are active. Do not change apps/landing, app routes, backend auth, persistence, external connectivity, auth/session/API, packages or lockfiles.

## Source of truth

- State: `docs/platform-v7/autopilot/autopilot-state.json`
- Queue: `docs/platform-v7/execution-queue.md`
- Progress: `docs/platform-v7/autopilot/progress.json`

## Current step

Docs-only source-of-truth selection for issue #2096.

The current PR must only update source-of-truth docs. It must not implement app or backend code.

## Allowed current scope

Use only the exact paths listed in `allowedCurrentScope` in `autopilot-state.json`.

## Scenario selection objective

Select one deterministic controlled-pilot execution/evidence scenario before implementation.

The selected scenario must cover:

- commercial request and accepted terms;
- deal creation checkpoint;
- shipment assignment and driver loading checkpoint;
- elevator acceptance and weight checkpoint;
- laboratory quality checkpoint;
- document matrix checkpoint;
- dispute/no-dispute branch and decision basis;
- external-basis callback simulation;
- close gate;
- audit/export reconstruction.

## Acceptance criteria

- no apps/landing diff;
- no app route diff;
- no package or lockfile diff;
- no backend/auth/API/persistence/external-connectivity changes;
- no live external-integration claims;
- no fake maturity claims;
- readiness remains 72%;
- GitHub Actions and Netlify checks green before merge.
