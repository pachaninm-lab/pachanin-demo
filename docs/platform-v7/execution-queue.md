# platform-v7 execution queue

CURRENT: P0 CI/k6/web build diagnostics for execution-runtime merge readiness.

GOAL: make #2184 an infrastructure-hardening layer that separates web build, Node CI, API typecheck, API runtime smoke and k6 diagnostics without hiding existing API compiled build debt.

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
- #2183 remains open: execution-runtime scenario reaches `RESERVE_CONFIRMED`, but is not merged while general CI is red.
- #2184 is open: CI/k6/web build diagnostics and start-path hardening.
- Existing API compiled build debt is confirmed by `node-ci-typecheck-log` / `api-k6-build-log`; this queue does not claim that debt is closed.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- .github/workflows/ci.yml
- .github/workflows/security-quality-gate.yml
- .github/workflows/web-unit.yml
- .github/workflows/node-ci.yml
- apps/api/package.json
- apps/web/lib/platform-v7/shellRoutes.ts
- apps/web/tests/unit/platformV7RootWorkEntry.test.ts

CURRENT CHECKS:
- preserve complete CI web build logs as artifacts;
- preserve web-unit logs as artifacts;
- preserve Node CI phase logs as artifacts;
- preserve API compiled-build diagnostics as artifacts;
- keep k6 smoke runnable against a test runtime without claiming API compiled build is clean;
- fix only concrete web build/runtime blockers discovered by artifacts;
- no disabling of security checks;
- no live external integration claim;
- no maturity or readiness uplift;
- readiness remains 72%.

NEXT:
- Layer: API compiled build debt reduction, separate from #2184.
- Candidate scope must be selected after #2184 gives complete artifacts.
- First likely clusters:
  - missing `jwt-auth.guard` imports / auth guard compatibility;
  - action-policy role coverage;
  - audit log return/promise contract;
  - Prisma schema drift around audit/kyc/elevator/exports;
  - integration-sdk import surface;
  - security spec/runtime-core drift.
- This next layer must not be mixed into #2183 execution-runtime logic.

RULES:
- one PR = one narrow layer;
- no apps/landing;
- no package or lockfiles;
- no fake-live integration claims;
- no production-ready claims;
- no broad backend/API/DB/auth/session/runtime/storage rewrite inside the current boundary layer;
- Netlify plus GitHub checks green before merge;
- if a check is diagnostic rather than maturity proof, say so explicitly.

READINESS: 72% honest readiness. Runtime layers, durable auth/session, server RBAC enforce, object scope wiring, mutable money/ledger paths, audit/outbox, storage/evidence and remaining role-by-role functional passes are still incomplete. #2184 improves CI observability and smoke wiring only; it does not change maturity or readiness.
