# Epic 10: Quality & Lab Readiness — progress report

## Status

E10 is complete at the foundation/source-of-truth level. Runtime hookup into deal, shipment, receiving, quality, discount and release-readiness surfaces is intentionally blocked until staged visible patching is done safely.

## Completed

- Added `apps/web/lib/platform-v7/quality-control-gate.ts`.
- Added `apps/web/lib/platform-v7/quality-discount.ts`.
- Added `apps/web/lib/platform-v7/quality-release-readiness.ts`.
- Added unit coverage for quality gate, quality discount and final quality release readiness.

## Covered acceptance areas

- Release is not allowed without linked and signed quality protocol.
- Quality gate checks required parameters, missing parameters, rejected parameters, discount-required states and tolerance states.
- Receiver confirmation, active dispute and manual hold remain fail-closed.
- Quality discount calculates discount lines, total discount, total discount percent and net payable amount.
- Quality discount blocks negative payable and requires manual approval when needed.
- Final quality release readiness separates `allow_release`, `allow_partial_release` and `hold_release`.
- Runtime must remain honest: no claim that lab/provider integration is live unless real connector callback exists.

## Merged PRs

- #163 — quality control gate model and tests.
- #164 — quality discount model and tests.
- #165 — quality release readiness model and tests.

## Remaining blocker

Issue #166 blocks final runtime hookup into:

- deal detail quality block;
- shipment quality block;
- receiving/elevator quality workspace;
- lab protocol surface;
- quality discount surface;
- release readiness surface.

Reason: runtime hookup touches quality proof, lab protocol, discount calculations and release signals. It must be staged and fail-closed, not patched as a broad rewrite.

## Safe next step

Start with the smallest visible patch:

1. Add a sandbox quality readiness panel to an existing deal detail surface.
2. Import `platformV7QualityControlGateModel()` and `platformV7QualityDiscountModel()`.
3. Render status, blockers and next action.
4. Keep lab/provider callback marked as sandbox/pre-integration unless real callbacks are active.
5. Do not change lab upload/storage behavior.
6. Do not trigger release while final readiness is blocked.
7. Run `pnpm typecheck && pnpm test && pnpm build`.

Then migrate one block per PR:

1. Quality panel → `quality-control-gate`.
2. Discount panel → `quality-discount`.
3. Release readiness → `quality-release-readiness`.

## Runtime impact so far

Low-risk. Runtime quality/lab/discount UI has not been changed yet. E10 foundation is ready for staged hookup.

## Known issues

- Final E10 acceptance cannot be marked done until issue #166 is resolved.
- E09 still has issue #161 for logistics/receiving runtime hookup.
- E08 still has issue #154 for evidence/audit runtime hookup.
- E07 still has issue #147 for onboarding/compliance runtime hookup.
- E06 still has issue #140 for runtime hookup.
- E05 still has issue #131 for deal workspace runtime hookup.
- E04 still has issue #121 for investor/demo runtime hookup.
- E03 still has issue #111 for runtime action button hookup.
- E02 still has issue #100 for final `AppShellV3` hookup.
- E01 still has issue #91 for remaining large runtime files.

## Current estimate

- E10 foundation/source-of-truth: complete.
- E10 runtime quality/lab hookup: blocked.
- Overall E10 progress: about 98% complete.
