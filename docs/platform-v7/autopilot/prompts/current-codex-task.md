# Codex current task — P0 execution/evidence scenario runner

Maturity: controlled-pilot / pre-integration.

Do not overstate maturity. Do not imply external connections are active. Do not change apps/landing, app routes, backend auth, API, storage, packages or lockfiles.

## Source of truth

- State: `docs/platform-v7/autopilot/autopilot-state.json`
- Queue: `docs/platform-v7/execution-queue.md`
- Progress: `docs/platform-v7/autopilot/progress.json`

## Current step

Implement one deterministic scenario runner for issue #2096.

Use existing primitives from `packages/domain-core/src/execution-simulation`:

- `createExecutionSimulationState`
- `createExecutionDomainStore`
- `runPlatformAction`
- `transitionDeal` guard behavior through the action engine
- existing types and KPI helpers where useful

## Allowed current scope

Use only the exact paths listed in `allowedCurrentScope` in `autopilot-state.json`.

## Required implementation

Add `packages/domain-core/src/execution-simulation/scenario-runner.ts`.

The runner must:

- start from a fresh simulation state;
- run one deterministic happy path until the deal is closed;
- collect passed step labels;
- collect blocked guard checks;
- return audit event count and timeline event count;
- return a close readiness result;
- keep all labels controlled-pilot / pre-integration;
- avoid live integration claims.

Also export the runner from `packages/domain-core/src/execution-simulation/index.ts` and add one unit test at `apps/web/tests/unit/platformV7ExecutionScenarioRunner.test.ts`.

## Negative checks

Cover at least:

- missing reserve;
- missing documents;
- open dispute;
- missing weight;
- missing lab;
- missing idempotency key.

## Acceptance criteria

- no apps/landing diff;
- no app route diff;
- no backend/auth/API/storage diff;
- no package or lockfile diff;
- readiness remains 72%;
- GitHub Actions and Netlify checks green before merge.
