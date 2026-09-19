# Epic 06: Bank Integration Readiness — progress report

## Status

E06 is complete at the foundation/source-of-truth level. Runtime hookup into the bank page is intentionally blocked until visible bank queue patching is done safely.

## Completed

- Added `apps/web/lib/platform-v7/bank-ledger.ts`.
- Added `apps/web/lib/platform-v7/bank-webhooks.ts`.
- Added `apps/web/lib/platform-v7/bank-reconciliation.ts`.
- Added `apps/web/lib/platform-v7/bank-manual-review.ts`.
- Added `apps/web/lib/platform-v7/bank-release-decision.ts`.
- Added `apps/web/lib/platform-v7/bank-operations-dashboard.ts`.
- Added `apps/web/lib/platform-v7/bank-partner-readiness.ts`.
- Added unit coverage for ledger, webhooks, reconciliation, manual review, release decision, operations dashboard and partner readiness.

## Covered acceptance areas

- Bank ledger has a centralized contract for reserve, hold, release, refund and fee entries.
- Bank webhook events have a centralized contract for reserve, hold, release, refund and fee confirmations.
- Reconciliation links ledger and webhook events before release decisions.
- Manual review is triggered by mismatch, failed webhook, over-limit release, active dispute and AML review.
- Release decision is fail-closed and depends on bank contract readiness, documents, reconciliation, manual review and positive release amount.
- Bank operations dashboard exposes total deals, release allowed, manual review, hold, blocked, blockers, critical reviews, amount ready to release and amount under control.
- Bank partner readiness separates sandbox, test stand, pre-live and live stages.
- Bank partner readiness does not allow live claims without contract, credentials, nominal account, webhook URL, test payment and production access.

## Merged PRs

- #133 — bank ledger model and tests.
- #134 — bank webhook model and tests.
- #135 — bank reconciliation model and tests.
- #136 — bank manual review model and tests.
- #137 — bank release decision model and tests.
- #138 — bank operations dashboard model and tests.
- #139 — bank partner readiness model and tests.

## Remaining blocker

Issue #140 blocks final runtime hookup into:

- `apps/web/app/platform-v7/bank/page.tsx`.
- `apps/web/components/v7r/BankRuntime.tsx`.

Reason: bank runtime touches money status, partner readiness, release queues, manual review, factoring, escrow, events and external-bank positioning. Final runtime hookup should be done as staged visible patches, not as a wholesale rewrite.

## Safe next step

Start with the smallest visible patch:

1. Import `platformV7BankOperationsDashboardModel()` into the bank surface.
2. Create a small demo bank queue from existing platform-v7 bank scenarios.
3. Render summary cards and queue rows above the existing `BankRuntime`.
4. Keep `BankRuntime`, factoring, escrow and events routes unchanged.
5. Keep Sber as the only active bank contour and mark other banks as next layer.
6. Do not mark any bank contour live-ready unless `canGoLive === true`.
7. Run `pnpm typecheck && pnpm test && pnpm build`.

Then migrate one block per PR:

1. Release queue → `bank-release-decision`.
2. Ledger and events → `bank-ledger` and `bank-webhooks`.
3. Reconciliation block → `bank-reconciliation`.
4. Manual review queue → `bank-manual-review`.
5. Partner readiness → `bank-partner-readiness`.

## Runtime impact so far

Low-risk. Runtime bank UI has not been changed yet. E06 foundation is ready for staged hookup.

## Known issues

- Final E06 acceptance cannot be marked done until issue #140 is resolved.
- E05 still has issue #131 for deal workspace runtime hookup.
- E04 still has issue #121 for investor/demo runtime hookup.
- E03 still has issue #111 for runtime action button hookup.
- E02 still has issue #100 for final `AppShellV3` hookup.
- E01 still has issue #91 for remaining large runtime files.

## Current estimate

- E06 foundation/source-of-truth: complete.
- E06 runtime bank readiness hookup: blocked.
- Overall E06 progress: about 98% complete.
