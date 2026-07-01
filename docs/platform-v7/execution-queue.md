# platform-v7 execution queue

CURRENT: P0 execution/evidence scenario runner implementation boundary.

GOAL: turn issue #2096 from scenario selection into one narrow code layer. The next implementation must compose existing domain-core execution-simulation primitives into a deterministic controlled-pilot scenario runner with positive and blocked paths.

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

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- packages/domain-core/src/execution-simulation/scenario-runner.ts
- packages/domain-core/src/execution-simulation/index.ts
- apps/web/tests/unit/platformV7ExecutionScenarioRunner.test.ts

CURRENT CHECKS:
- keep #2159 in draft until source-of-truth/guard is advanced;
- keep #2115 as an auth write-path blocker;
- implement #2096 only through the allowed domain-core scenario runner paths;
- do not touch apps/landing, app routes, backend auth, API, DB, storage, package or lock files;
- maturity remains controlled-pilot / pre-integration;
- readiness remains 72%.

NEXT:
- Layer: P0 execution/evidence scenario runner implementation for #2096.
- Allowed files:
  - packages/domain-core/src/execution-simulation/scenario-runner.ts
  - packages/domain-core/src/execution-simulation/index.ts
  - apps/web/tests/unit/platformV7ExecutionScenarioRunner.test.ts
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/autopilot/progress.json
  - docs/platform-v7/autopilot/prompts/current-codex-task.md
  - docs/platform-v7/autopilot/prompts/current-review-task.md
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - one deterministic happy path reaches CLOSED;
  - runner reports passed steps, blocked checks, audit event count, timeline event count and close readiness;
  - negative checks cover missing reserve, missing documents, open dispute, missing weight, missing lab and missing idempotency key;
  - no live external integration claim;
  - no platform-side release claim;
  - no maturity or readiness uplift.

RULES:
- one PR = one narrow layer;
- no apps/landing;
- no package or lockfiles;
- no fake-live integration claims;
- no production-ready claims;
- no broad backend/API/DB/auth/session/runtime/storage rewrite inside the current boundary layer;
- Netlify plus GitHub checks green before merge.

READINESS: 72% honest readiness. Runtime layers, durable auth/session, server RBAC enforce, object scope wiring, mutable money/ledger paths, audit/outbox, storage/evidence and remaining role-by-role functional passes are still incomplete. The current scenario runner boundary does not change maturity or readiness.
