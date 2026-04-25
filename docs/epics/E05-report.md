# Epic 05: Deal Workspace Redesign — progress report

## Status

E05 is complete at the foundation/source-of-truth level. Runtime hookup into the deal detail page is intentionally blocked until full workspace patching is available.

## Completed

- Added `apps/web/lib/platform-v7/deal-workspace.ts`.
- Added `apps/web/lib/platform-v7/deal-financial-terms.ts`.
- Added `apps/web/lib/platform-v7/deal-workspace-actions.ts`.
- Added `apps/web/lib/platform-v7/deal-workspace-timeline.ts`.
- Added `apps/web/lib/platform-v7/deal-workspace-sidepanel.ts`.
- Added `apps/web/lib/platform-v7/deal-workspace-documents.ts`.
- Added `apps/web/lib/platform-v7/deal-workspace-logistics.ts`.
- Added `apps/web/lib/platform-v7/deal-workspace-release-readiness.ts`.
- Added unit coverage for workspace tabs, financial terms, action hierarchy, timeline, side panel, documents, logistics and release readiness.

## Covered acceptance areas

- Deal workspace has a centralized 5-tab contract: overview, documents, logistics, money and dispute.
- Action hierarchy is constrained to one primary action and two secondary actions.
- Financial terms are calculated through one model: gross, VAT, net, hold and release.
- Timeline has sorting, filtering, stable keys and type summary.
- Side panel has next owner, action hierarchy, filtered timeline and desktop/mobile layout contract.
- Documents model exposes completeness, signature status and release blockers.
- Logistics model exposes active trip, transport blockers, ETTN status and release blockers.
- Release readiness is controlled through a single gate model: documents, logistics, money, bank and dispute.
- Release remains fail-closed when documents, logistics, bank callback or dispute gates are not clean.

## Merged PRs

- #123 — deal workspace model and tests.
- #124 — deal financial terms calculator and tests.
- #125 — deal workspace action hierarchy and tests.
- #126 — deal workspace timeline model and tests.
- #127 — deal workspace side panel model and tests.
- #128 — deal workspace documents model and tests.
- #129 — deal workspace logistics model and tests.
- #130 — deal release readiness model and tests.

## Remaining blocker

Issue #131 blocks final runtime hookup into `apps/web/components/v7r/LiveDealDetailRuntime.tsx`.

Reason: this component touches deal state, documents, logistics, bank actions, money release and dispute behavior. Final runtime hookup should be done as staged visible patches, not as a wholesale rewrite.

## Safe next step

Start with the smallest visible patch:

1. Import `platformV7DealWorkspaceModel()` into `LiveDealDetailRuntime.tsx`.
2. Render the 5-tab header above the existing sections.
3. Keep all existing sections unchanged.
4. Do not change money release behavior.
5. Do not change dispute behavior.
6. Run `pnpm typecheck && pnpm test && pnpm build`.

Then migrate one section per PR:

1. Documents section → `deal-workspace-documents`.
2. Logistics section → `deal-workspace-logistics`.
3. Money section → `deal-financial-terms` and `deal-workspace-release-readiness`.
4. Journal section → `deal-workspace-timeline`.
5. Right/secondary panel → `deal-workspace-sidepanel`.

## Runtime impact so far

Low-risk. Runtime deal UI has not been changed yet. E05 foundation is ready for staged hookup.

## Known issues

- Final E05 acceptance cannot be marked done until issue #131 is resolved.
- E04 still has issue #121 for investor/demo runtime hookup.
- E03 still has issue #111 for runtime action button hookup.
- E02 still has issue #100 for final `AppShellV3` hookup.
- E01 still has issue #91 for remaining large runtime files.

## Current estimate

- E05 foundation/source-of-truth: complete.
- E05 runtime deal workspace hookup: blocked.
- Overall E05 progress: about 98% complete.
