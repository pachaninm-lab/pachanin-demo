# Rollback note

This layer is isolated.

To rollback, remove:
- `apps/web/app/platform-v7/market-entry/page.tsx`
- `apps/web/components/platform-v7/MarketEntryFoundation.tsx`
- `apps/web/lib/platform-v7/market-entry-foundation.ts`
- `apps/web/tests/unit/platformV7MarketEntryFoundation.test.tsx`
- market entry documentation files in this folder.

No existing shell, bank, deal, route, navigation or RBAC file is changed by this branch.
