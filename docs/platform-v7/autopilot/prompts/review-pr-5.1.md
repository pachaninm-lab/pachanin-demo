# Review task — PR 5.1 Application Service Layer

Review only PR 5.1.

Allowed files:
- apps/web/lib/platform-v7/runtime/application-service.ts
- apps/web/lib/platform-v7/runtime/application-service-types.ts
- apps/web/tests/unit/platformV7RuntimeApplicationServices.test.ts

Reject scope expansion:
- apps/landing
- platform-v7 UI routes/components
- adapters
- server actions
- AI gateway
- theme or onboarding
- package-lock.json

Architecture checks:
- DTO validation before execution.
- Persistence through injected ports.
- Idempotency before mutation.
- Duplicate idempotency does not mutate twice.
- Audit records success and denied actions.
- Money, document and bank basis actions use only the action-boundary functions.
- Release workflow remains thin orchestration.
- Dispute service does not move money directly.
- No hidden module-level persistence.
- Typed results are returned.

Forbidden direct service-layer domain calls:
- platformV7ApplyMoneyOperation
- platformV7ReleaseGate
- p7ConfirmBankRelease
- p7ConfirmBankRefund
- p7ConfirmBankHold
- p7MarkBankBasisSent
- p7BuildBankBasisPayload
- p7BuildArbitrationBasisPayload
- platformV7DocumentsBlockingStage
- isBankBasisReady
- platformV7DocumentMatrixReadiness

Allowed action-boundary calls:
- executePlatformV7MoneyAction
- executePlatformV7DocumentAction
- executePlatformV7BankBasisAction

Return:

BLOCKERS
- ...

REQUIRED FIXES
- ...

OPTIONAL IMPROVEMENTS
- ...

MERGEABLE: yes/no
