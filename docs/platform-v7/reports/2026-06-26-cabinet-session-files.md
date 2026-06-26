# Cabinet session guard files

Branch: `fix/p7-cabinet-session-body-role-guard`
Base: `main` at `9dce37a6e571c54216218c82fa24814b0459affe`

Changed files:

- `apps/web/app/api/platform-v7/cabinet-session/route.ts`
- `apps/web/tests/unit/platformV7CabinetSessionRoute.static.test.ts`
- `docs/platform-v7/reports/2026-06-26-cabinet-session-body-role-guard.md`
- `docs/platform-v7/queue/2026-06-26-auth-session-next.md`
- `docs/platform-v7/acceptance/auth-session-status-2026-06-26.md`

Forbidden zones not touched:

- `apps/landing`
- package files
- lockfiles

This branch intentionally does not rewrite web login, backend auth persistence or server RBAC enforce.
