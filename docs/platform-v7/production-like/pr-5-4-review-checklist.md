# PR 5.4 Review Checklist

Scope: DTO and validation schemas only for the Stage 5 runtime service layer.

## Must Pass

- Only scoped files are changed:
  - `apps/web/lib/platform-v7/runtime/dto-schemas.ts`
  - `apps/web/tests/unit/platformV7RuntimeDtoSchemas.dto.test.ts`
  - this checklist document
- No service layer, persistence implementation, database migration, mock adapter, server action, API endpoint or UI is added.
- No MoneyTree, Document Matrix, Bank Basis, Action Boundary or Persistence Ports runtime logic is rewritten.
- Validation returns typed results and does not throw for normal validation failures.
- Validation accumulates errors as `P7ValidationError` objects.
- Actor role validation delegates to canonical role mapping.
- Idempotency key validation delegates to the existing idempotency helper.
- DTO schemas validate shape and basic constraints only.
- DTO schemas do not duplicate MoneyTree, document readiness, bank-basis readiness, RBAC, duplicate idempotency, bank movement or arbitration balance logic.
- No `class`, `any`, `Map`, `Set`, server action directive or module-level persistence state is introduced.

## Required Validation

- `pnpm typecheck`
- `pnpm --filter @pc/web exec bash -lc 'vitest run tests/unit/*dto*'`
- `pnpm test`
- `pnpm build`
- `git diff --name-only origin/main...HEAD`
- `git diff -- apps/landing`

## Reviewer Notes

- This PR intentionally does not make DTO validation authoritative for business rules.
- Later service-layer PRs should call these validators before loading/persisting runtime state.
