# platform-v7 execution queue

CURRENT: P0 execution/evidence scenario runner plus contract/reserve action-engine slice.

GOAL: turn issue #2096 from scenario selection into a controlled-pilot execution chain. The current implementation must compose existing domain-core execution-simulation primitives into a deterministic path through deal creation, contract drafting, signatures and reserve confirmation, without claiming final release or production readiness.

CURRENT STATUS:
- #2111 is merged: P0 cabinet-session body-role guard is active.
- #2113 is closed: deprecated Vercel/Deno statuses are not blocking current `main` merges; Netlify remains the active deployment target.
- #2115 remains open: backend register role assignment hardening remains blocked by the current auth-file write path.
- #2138 is merged: isolated audit read-model boundary is active.
- #2154 is merged: market-entry boundary selection is recorded.
- #2155 is merged: runtime CI checks are routed away from docs-only PRs.
- #2158 is merged: Netlify docs-only build gate is active.
- #2162 is merged: robust Netlify ignore script is active.
- #2163 is merged: source-of-truth moved from market-entry block to #2096.
- #2159 remains open as draft: route implementation is blocked until route-scope write path or guard advancement is available.
- #2183 is the active PR for the controlled-pilot contract/reserve execution slice.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- packages/domain-core/src/execution-simulation/action-engine.ts
- packages/domain-core/src/execution-simulation/scenario-runner.ts
- packages/domain-core/src/execution-simulation/index.ts
- apps/web/tests/unit/platformV7ExecutionScenarioRunner.test.ts

CURRENT CHECKS:
- keep #2159 in draft until source-of-truth/guard is advanced;
- keep #2115 as an auth write-path blocker;
- implement #2096 only through the allowed domain-core execution-simulation paths;
- do not touch apps/landing, app routes, backend auth, API, DB, storage, package or lock files;
- maturity remains controlled-pilot / pre-integration;
- readiness remains 72%;
- no fake close, no final release and no live integration claim.

NEXT:
- Layer: P0 execution logistics assignment slice for #2096.
- Allowed files:
  - packages/domain-core/src/execution-simulation/action-engine.ts
  - packages/domain-core/src/execution-simulation/scenario-runner.ts
  - packages/domain-core/src/execution-simulation/index.ts
  - apps/web/tests/unit/platformV7ExecutionScenarioRunner.test.ts
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/autopilot/progress.json
  - docs/platform-v7/autopilot/prompts/current-codex-task.md
  - docs/platform-v7/autopilot/prompts/current-review-task.md
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - deterministic path reaches RESERVE_CONFIRMED before logistics;
  - assignDriver advances RESERVE_CONFIRMED to DRIVER_ASSIGNED through transitionDeal;
  - runner reports the logistics assignment step without claiming loading, arrival, weight, lab, documents, release or close;
  - negative checks remain explicit and do not relabel INVALID_TRANSITION as release guard;
  - no live external integration claim;
  - no platform-side release claim;
  - no maturity or readiness uplift.

RULES:
- one PR = one controlled execution layer;
- no apps/landing;
- no package or lockfiles;
- no fake-live integration claims;
- no production-ready claims;
- no broad backend/API/DB/auth/session/runtime/storage rewrite inside the current boundary layer;
- Netlify plus GitHub checks green before merge.

READINESS: 72% honest readiness. Runtime layers, durable auth/session, server RBAC enforce, object scope wiring, mutable money/ledger paths, audit/outbox, storage/evidence and remaining role-by-role functional passes are still incomplete. The current scenario runner/action-engine boundary does not change maturity or readiness.
