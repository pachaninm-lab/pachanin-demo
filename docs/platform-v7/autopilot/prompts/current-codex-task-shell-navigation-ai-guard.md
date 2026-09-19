# Codex task — platform-v7 role-bound shell navigation and AI entry guard

Work from current `main` after PR #1889 and docs commit `454160e427ef64482b2892b5ab3200dd211a0d69`.

## Mission

Open one narrow PR that fixes shell/navigation/AI/dead-link risk without reviving stale PR #1874 or #1875 wholesale.

Project status: controlled-pilot / pre-integration.

## Source audit

Read first:

- `docs/platform-v7/audits/live-cabinet-shell-audit-2026-06-18.md`
- `apps/web/components/v7r/AppShellV4.tsx`
- `apps/web/components/v7r/CommandPalette.tsx`
- `apps/web/lib/platform-v7/shellRoutes.ts`
- `apps/web/lib/platform-v7/command.ts`
- `apps/web/app/platform-v7/ai/page.tsx`
- `apps/web/app/platform-v7/page.tsx`

## Allowed files

- `apps/web/components/v7r/AppShellV4.tsx`
- `apps/web/components/v7r/CommandPalette.tsx`
- `apps/web/lib/platform-v7/shellRoutes.ts`
- `apps/web/lib/platform-v7/command.ts`
- `apps/web/app/platform-v7/ai/page.tsx` only if needed for return-to-role action
- `apps/web/tests/unit/platformV7RoleRoutes.test.ts`
- new focused tests under `apps/web/tests/unit/`
- `docs/platform-v7/audits/live-cabinet-shell-audit-2026-06-18.md` only for final note if needed

## Forbidden

- Do not touch `apps/landing`.
- Do not touch backend, DB, migrations, live integrations, credentials, Netlify/Vercel config, package lockfiles.
- Do not copy stale PR #1874/#1875 wholesale.
- Do not add production-ready, fully-live, bank-connected, FGIS-connected, EDO-connected claims.
- Do not remove AI completely; make it role-bound.

## Required fixes

### 1. Role-bound AI shell entry

Current risk: `shellRoutes.ts` adds `AI_ITEM` to every role, and AppShellV4 links to `/platform-v7/ai` without current screen context.

Fix:
- keep AI available in shell;
- generate AI href with `from=<current pathname>`;
- label it as role assistant, not global assistant;
- ensure driver AI returns only to driver route;
- ensure seller/buyer/logistics/elevator/lab/surveyor/arbitrator/bank/compliance/executive actions stay inside allowed route set.

### 2. Command palette filtering

Current risk: `CommandPalette` builds a broad index from `platformV7CommandSectionItems()` and can expose role/cabinet migration.

Fix:
- filter section entries by active role;
- remove `/platform-v7/roles` from authenticated/shell command palette;
- remove investor/foreign cabinet entries from role-specific command palette;
- keep shared execution surfaces only where explicitly allowed for that role;
- recent items must not route to forbidden entries if role changed.

### 3. Narrow role-owned route guard

Fix only the minimum:
- add role-owned route map;
- add shared-route allowlist;
- when current path belongs to another role, redirect to current role home or render clear access boundary;
- no broad rewrite;
- no server-side fake RBAC claims.

### 4. Mobile shell safety

Fix/test:
- 390px mobile header must not horizontally overflow after calculator button;
- if needed, hide search text label on mobile, keeping icon/button functional;
- bottom nav must show only role-safe destinations.

## Tests required

Add/extend focused tests to prove:

1. public role cards still route through `/platform-v7/login`;
2. `/platform-v7/roles` is not exposed in shell command palette;
3. command palette filters foreign role cabinets;
4. shell AI href includes `from=` with current pathname;
5. driver nav does not expose bank/buyer/seller/operator screens;
6. calculator remains mounted inside shell and not on public root;
7. no `eval(` or `new Function` in calculator;
8. no forbidden maturity copy added.

## Verification commands

Run:

- `pnpm --filter @pc/web typecheck`
- `pnpm --filter @pc/web test`
- `pnpm --filter @pc/web build`
- existing platform-v7 unit tests touched by this PR

## PR rules

- one narrow PR only;
- title: `fix(platform-v7): role-bound shell navigation and AI entry guard`;
- include audit summary and exact changed files;
- wait for green checks before merge.
