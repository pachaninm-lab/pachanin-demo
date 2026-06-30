# Test plan

Targeted unit test:

`cd apps/web && pnpm vitest run tests/unit/platformV7MarketEntryFoundation.test.tsx`

Manual check:
- open `/platform-v7/market-entry`;
- select crop and route;
- verify delivered price changes;
- create buy or sell intent;
- verify launch gate and links.
