# PR #1876 status

Diagnostic minimal PR for platform-v7 role-lock scope isolation.

Current effective diff:
- adds `apps/web/middleware.ts` to `allowedCurrentScope`;
- adds `apps/web/middleware.ts` to `agentWritableScope`.

Rolled back during diagnostics:
- middleware role-source cleanup;
- `/platform-v7/ai` redirect;
- access page CTA copy cleanup.

Reason:
- `Node CI` still fails on `pnpm run typecheck` even when the PR diff is docs-only.
- Therefore the current typecheck failure is not caused by the P0 role-lock code attempted in this PR.

Merge policy:
- Do not merge while required checks are red.
- Next action is to identify and fix the baseline `typecheck` failure, then re-apply the P0 role-lock changes in a clean follow-up PR.
