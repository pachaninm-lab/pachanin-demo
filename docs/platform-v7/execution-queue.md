# platform-v7 execution queue

## MASTER-TZ Execution Order

This is the real product execution sequence. The fallback smoke-slice loop is the
automation conveyor only — it does not represent product completion.

---

CURRENT: PR 5.1 Application Service Layer

CURRENT ALLOWED:
- apps/web/lib/platform-v7/runtime/application-service.ts
- apps/web/lib/platform-v7/runtime/application-service-types.ts
- apps/web/tests/unit/platformV7RuntimeApplicationServices.test.ts

CURRENT CRITERIA:
- Implements P7MoneyExecutionService, P7DocumentExecutionService,
  P7BankBasisExecutionService, P7ReleaseWorkflowService, P7DisputeSettlementService.
- Connects: DTO validation, persistence ports, idempotency, audit,
  action-boundary, domain result, typed service result.
- Allowed domain paths: executePlatformV7MoneyAction,
  executePlatformV7DocumentAction, executePlatformV7BankBasisAction.
- Forbidden direct calls from service layer:
  platformV7ApplyMoneyOperation, platformV7ReleaseGate,
  p7ConfirmBankRelease, p7ConfirmBankRefund, p7ConfirmBankHold,
  p7MarkBankBasisSent, p7BuildBankBasisPayload,
  p7BuildArbitrationBasisPayload, platformV7DocumentsBlockingStage,
  isBankBasisReady, platformV7DocumentMatrixReadiness.
- Restricted areas remain blocked.
- Merge gate remains final authority.

DONE (MASTER-TZ checkpoints):
- Stage 3: RBAC / ACL / roles / access rights
- Stage 4: MoneyTree / Document Matrix / Bank Basis / Action Boundary / Final QA
- PR 5.0: Runtime Inventory
- PR 5.3: Persistence Port Interfaces
- PR 5.4: DTO / Validation Schemas

DONE (autopilot smoke conveyor):
- baseline
- Runner Inline PR
- Runner Gate Fix
- Runner Opens PR
- Runner PR Permission Smoke
- Autopilot Resilience Layer
- Role Boundary Smoke
- Autopilot State Schema
- Autopilot Next-layer Selector
- Autopilot Check Analyzer
- Autopilot Merge Gate
- Autopilot Dry-run Loop
- Autopilot Safe Task Intake
- Autopilot Issue Executor Dry-run
- Autopilot Issue Executor PR Wiring
- Autopilot Full Loop Verification
- Autopilot Live Controlled Pilot Gate
- Autopilot Step Enablement
- Autopilot Scope Proposal Gate
- Autopilot Exact Path Unlock
- Autopilot Product Slice Proposal
- Autopilot Product Slice 01 through 20

NEXT (strict order — each unlocked only after previous merges):
1. PR 5.1 Application Service Layer                 ← CURRENT
2. PR 5.5 Mock Persistence Adapter
3. PR 5.2 Server Action Wrappers
4. PR 5.6 Runtime Integration Tests
5. PR 5.7 Final Stage 5 QA
6. External Adapter Emulators     (only after Stage 5 complete)
7. AI Integration Gateway         (only after runtime/adapters)
8. Product Entry / Onboarding     (only after runtime foundation)
9. Theme / Visual / Role Cockpit  (only after runtime binding)

RULES:
- One PR equals one narrow layer.
- Keep controlled-pilot / pre-integration status.
- No apps/landing. No broad UI/runtime/API/DB/lockfiles outside explicit SOT unlock.
- No production-ready claims. No fake-live claims.
- Fallback smoke conveyor continues independently and does not represent product completion.
