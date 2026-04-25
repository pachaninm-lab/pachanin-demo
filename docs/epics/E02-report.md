# Epic 02: Navigation & Lexicon Unification — progress report

## Status

E02 is almost complete at the foundation/source-of-truth level. Runtime shell hookup is intentionally blocked until full workspace patching is available.

## Completed

- Expanded `apps/web/lib/platform-v7/lexicon.ts`.
- Hardened `apps/web/lib/platform-v7/environment.ts`.
- Added `apps/web/lib/platform-v7/navigation.ts`.
- Added `apps/web/lib/platform-v7/breadcrumbs.ts`.
- Added `apps/web/lib/platform-v7/roles.ts`.
- Added `apps/web/lib/platform-v7/command.ts`.
- Added `apps/web/lib/platform-v7/shell.ts`.
- Connected `CommandPalette` to `platformV7CommandSectionItems()`.
- Added unit coverage for lexicon, environment, navigation, breadcrumbs, roles, command and shell model.

## Covered acceptance areas

- One Russian label for Control Tower is centralized as `Центр управления`.
- Environment labels are centralized:
  - `Пилотный режим`
  - `Тестовая среда`
  - `Демо-данные`
  - `Боевой контур`
- Non-production environments cannot be marked as live through `platformV7CanShowAsLive()`.
- Role labels and role routes are centralized.
- Navigation items by role are centralized.
- Breadcrumb labels are centralized.
- Command Palette section items are centralized.
- `CommandPalette` no longer owns its local section list.

## Merged PRs

- #92 — lexicon expansion and tests.
- #93 — navigation foundation and tests.
- #94 — breadcrumbs foundation and tests.
- #95 — environment label hardening and tests.
- #96 — role options foundation and tests.
- #97 — command foundation and tests.
- #98 — CommandPalette runtime hookup to command foundation.
- #99 — shell model foundation and tests.

## Remaining blocker

Issue #100 blocks the final runtime hookup of `AppShellV3`.

Reason: `apps/web/components/v7r/AppShellV3.tsx` is large and layout-critical. GitHub connector output is truncated, so wholesale replacement would risk breaking header, navigation, mobile layout, theme logic, keyboard shortcuts or analytics.

## Remaining duplicated sources in AppShellV3

- `ROLE_LABELS`
- `ROLE_STAGE`
- `ROLE_ROUTES`
- `NAV_BY_ROLE`
- `CRUMB_LABELS`
- local `breadcrumbs()`
- local `inferRoleFromPath()`
- direct `NOTIFICATIONS / NOTIFICATION_GROUPS` import from `@/lib/v7r/data`

## Safe next step

Use Codex/IDE/full checkout to patch `AppShellV3` with a small diff:

1. Import `platformV7ShellModel()` / `inferPlatformV7RoleFromPath()` from `apps/web/lib/platform-v7/shell.ts`.
2. Replace local role/nav/breadcrumb sources with the shell model.
3. Keep icon bindings local.
4. Do not change JSX layout, CSS, route behavior, theme behavior, keyboard shortcuts or analytics.
5. Run `pnpm typecheck && pnpm test && pnpm build`.

## Runtime impact so far

Low-risk. Only `CommandPalette` runtime source was connected. Main shell/header layout has not been rewritten.

## Known issues

- Final E02 acceptance cannot be marked done until issue #100 is resolved.
- E01 still has issue #91 for remaining large runtime files.

## Current estimate

- E02 foundation/source-of-truth: complete.
- E02 runtime shell hookup: blocked.
- Overall E02 progress: about 94% complete.
