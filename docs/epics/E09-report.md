# Epic 09: Logistics & Receiving Readiness — progress report

## Status

E09 is complete at the foundation/source-of-truth level. Runtime hookup into deal, shipment, receiving, transport document, operator logistics queue and release-readiness surfaces is intentionally blocked until staged visible patching is done safely.

## Completed

- Added `apps/web/lib/platform-v7/logistics-shipment-gate.ts`.
- Added `apps/web/lib/platform-v7/logistics-receiving-gate.ts`.
- Added `apps/web/lib/platform-v7/logistics-transport-documents-gate.ts`.
- Added `apps/web/lib/platform-v7/logistics-ops-queue.ts`.
- Added `apps/web/lib/platform-v7/logistics-release-readiness.ts`.
- Added unit coverage for shipment gate, receiving gate, transport documents gate, logistics ops queue and final release readiness.

## Covered acceptance areas

- Release is not allowed only because a shipment was created.
- Shipment readiness depends on transport status, transport documents, GPS/tracking, weight, quality, receiver confirmation, active dispute and manual hold.
- Receiving readiness depends on arrival confirmation, unloading, receiver confirmation, weight, quality, receiving documents and linked lab protocol.
- Transport document readiness depends on transport document status, signatures, GIS EPD status and provider callback.
- Operator logistics queue shows whether the blocker sits in shipment, receiving or transport documents.
- Final logistics release readiness separates `allow_release`, `allow_partial_release` and `hold_release`.
- Active dispute and manual hold remain fail-closed.
- Runtime must remain honest: no claim that provider integration is live unless real connector callback exists.

## Merged PRs

- #156 — logistics shipment gate model and tests.
- #157 — logistics receiving gate model and tests.
- #158 — transport documents gate model and tests.
- #159 — logistics ops queue model and tests.
- #160 — logistics release readiness model and tests.

## Remaining blocker

Issue #161 blocks final runtime hookup into:

- deal detail logistics block;
- shipment/transport workspace;
- receiving/elevator workspace;
- transport document surface;
- operator logistics queue;
- release readiness surface.

Reason: runtime hookup touches physical movement, receiving, documents, provider callbacks and release signals. It must be staged and fail-closed, not patched as a broad rewrite.

## Safe next step

Start with the smallest visible patch:

1. Add a sandbox logistics readiness panel to an existing deal detail surface.
2. Import `platformV7ShipmentGateModel()`, `platformV7ReceivingGateModel()` and `platformV7TransportDocumentsGateModel()`.
3. Render status, blockers and next action.
4. Keep provider callback marked as sandbox/pre-integration unless real callbacks are active.
5. Do not change provider/upload behavior.
6. Do not trigger release while final readiness is blocked.
7. Run `pnpm typecheck && pnpm test && pnpm build`.

Then migrate one block per PR:

1. Shipment panel → `logistics-shipment-gate`.
2. Receiving panel → `logistics-receiving-gate`.
3. Transport documents panel → `logistics-transport-documents-gate`.
4. Operator queue → `logistics-ops-queue`.
5. Release readiness → `logistics-release-readiness`.

## Runtime impact so far

Low-risk. Runtime logistics/receiving/document UI has not been changed yet. E09 foundation is ready for staged hookup.

## Known issues

- Final E09 acceptance cannot be marked done until issue #161 is resolved.
- E08 still has issue #154 for evidence/audit runtime hookup.
- E07 still has issue #147 for onboarding/compliance runtime hookup.
- E06 still has issue #140 for runtime hookup.
- E05 still has issue #131 for deal workspace runtime hookup.
- E04 still has issue #121 for investor/demo runtime hookup.
- E03 still has issue #111 for runtime action button hookup.
- E02 still has issue #100 for final `AppShellV3` hookup.
- E01 still has issue #91 for remaining large runtime files.

## Current estimate

- E09 foundation/source-of-truth: complete.
- E09 runtime logistics/receiving hookup: blocked.
- Overall E09 progress: about 98% complete.
