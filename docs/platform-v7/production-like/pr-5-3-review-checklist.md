# PR 5.3 Review Checklist

Scope: persistence port interfaces only for the Stage 5 runtime service layer.

## Must Pass

- Only scoped files are changed:
  - `apps/web/lib/platform-v7/runtime/persistence-ports.ts`
  - `apps/web/tests/unit/platformV7RuntimePersistencePorts.persistence.test.ts`
  - this checklist document
- No runtime implementation is added.
- No database, migration, API endpoint, server action, UI, external adapter, lockfile or deploy config is changed.
- No MoneyTree, Document Matrix, Bank Basis or Action Boundary rewrite is included.
- Ports are dependency-injection friendly.
- Ports do not use module-level `Map`, `Set`, arrays or singleton state.
- Idempotency context includes processed keys, processed bank event ids and processed operation ids.
- Audit sink accepts allowed, denied, blocked, duplicate and bank audit payloads.
- Unit of work can type transaction-like composition across MoneyTree and BankBasis ports.
- Repository result can represent `ok`, `not_found`, `conflict` and `error`.

## Required Validation

- `pnpm typecheck`
- `pnpm --filter @pc/web exec vitest run tests/unit/*persistence*`
- `pnpm test`
- `pnpm build`

## Reviewer Notes

- This PR intentionally does not provide mock persistence adapters.
- Later service-layer PRs must inject these ports instead of storing state in modules.
- Any implementation added to this PR should be treated as a blocker.
