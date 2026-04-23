# Epic 02: Lexicon and environment foundation

## Done

- Added `apps/web/lib/platform-v7/lexicon.ts`.
- Added `apps/web/lib/platform-v7/environment.ts`.
- Added `apps/web/tests/unit/platformV7Lexicon.test.ts`.

## Covered

- one Russian label for Control Tower: `Центр управления`
- centralized environment labels
- centralized common action labels
- default environment source set to pilot mode unless explicitly configured

## Runtime impact

No UI route was rewritten in this PR. This is the foundation for staged nav/header migration without breaking the platform.

## Next

- Connect header/topbar labels to the lexicon.
- Replace duplicated environment badges with `getPlatformV7Environment()`.
- Add breadcrumbs/command palette migration in small follow-up PRs.
