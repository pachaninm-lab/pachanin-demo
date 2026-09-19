# Epic 04: Investor & Demo Modes — progress report

## Status

E04 is almost complete at the foundation/source-of-truth level. Runtime investor/demo page hookup is intentionally blocked until full workspace patching is available.

## Completed

- Added `apps/web/lib/platform-v7/investor-metrics.ts`.
- Added `apps/web/lib/platform-v7/investor-story.ts`.
- Added `apps/web/lib/platform-v7/investor-roadmap.ts`.
- Added `apps/web/lib/platform-v7/investor-dashboard.ts`.
- Added `apps/web/lib/platform-v7/demo-tour.ts`.
- Added `apps/web/lib/platform-v7/demo-tour-controller.ts`.
- Added `apps/web/lib/platform-v7/demo-tour-runtime.ts`.
- Added `apps/web/lib/platform-v7/demo-dashboard.ts`.
- Added unit coverage for investor metrics, investor story, investor roadmap, investor dashboard, demo tour, tour controller, tour runtime and demo dashboard.

## Covered acceptance areas

- Investor mode has a centralized 6-KPI data contract.
- Investor metrics are explicitly marked as `ГИПОТЕЗА`.
- Investor story blocks explain execution rail, money control and controlled pilot readiness.
- Investor roadmap includes evidence, risk, status and quarter.
- Investor dashboard model composes metrics, story, roadmap and disclosure.
- Demo tour has 5 scripted steps.
- Demo tour duration stays inside the 2–3 minute acceptance window.
- Demo tour controller supports current position, jump-to-step, next/previous and validation.
- Demo tour runtime contract supports idle, playing, paused and complete states.
- Demo dashboard model composes tour steps, duration, controls and initial runtime view.

## Merged PRs

- #113 — investor metrics foundation and tests.
- #114 — demo tour foundation and tests.
- #115 — investor story foundation and tests.
- #116 — investor roadmap foundation and tests.
- #117 — demo tour controller foundation and tests.
- #118 — demo tour runtime contract and tests.
- #119 — investor dashboard view model and tests.
- #120 — demo dashboard model and tests.

## Remaining blocker

Issue #121 blocks final runtime hookup for `/platform-v7/investor` and `/platform-v7/demo`.

Reason: target runtime pages/shell routes should be patched through Codex/IDE/full workspace. The final hookup should be small and visible, not a wholesale rewrite.

## Safe next step

Start with `/platform-v7/investor` only:

1. Import `platformV7InvestorDashboardModel()`.
2. Render 6 KPI widgets from model data.
3. Render story blocks and roadmap from model data.
4. Keep disclosure visible: demo/controlled pilot, not production-ready.
5. Do not touch shell/header/navigation.
6. Run `pnpm typecheck && pnpm test && pnpm build`.

Then `/platform-v7/demo`:

1. Import `platformV7DemoDashboardModel()` and runtime helpers.
2. Render 5-step tour.
3. Support start, pause, previous, next and jump-to-step.
4. Show narrator overlay from runtime view.
5. Keep controlled pilot disclosure visible.

## Runtime impact so far

Low-risk. Runtime investor/demo UI has not been changed yet. E04 foundation is ready for staged hookup.

## Known issues

- Final E04 acceptance cannot be marked done until issue #121 is resolved.
- E03 still has issue #111 for runtime action button hookup.
- E02 still has issue #100 for final `AppShellV3` hookup.
- E01 still has issue #91 for remaining large runtime files.

## Current estimate

- E04 foundation/source-of-truth: complete.
- E04 runtime investor/demo hookup: blocked.
- Overall E04 progress: about 90% complete.
