# Epic 01: Data layer foundation

## Done

- Added `apps/web/lib/domain/types.ts`.
- Added `apps/web/lib/domain/adapters.ts`.
- Added `apps/web/lib/domain/selectors.ts`.
- Added `apps/web/lib/domain/kpi/controlTower.ts`.
- Added `apps/web/tests/unit/controlTowerKpis.test.ts`.
- Added `apps/web/tests/unit/domainSelectors.test.ts`.

## Covered now

- Domain metadata contract: `version`, `createdAt`, `updatedAt`, `sourceOfTruth`.
- Domain selectors over current `platform-v7` runtime data.
- Required audit deals are visible in the domain view: `DL-9113`, `DL-9114`, `DL-9116`, `DL-9118`, `DL-9120`.
- Active deal filtering excludes closed deals.
- Reserve, held and ready-to-release totals are calculated from selectors.
- Dispute lookup by dispute id and deal id.
- Control Tower KPI foundation remains covered by unit tests.

## Not done yet

- Full `DomainProvider` is not introduced yet.
- All 60+ pages are not migrated to `useDeals()`, `useLots()`, `useDisputes()` yet.
- Runtime UI is not changed in this PR.
- Hardcoded IDs across all components are not fully removed yet.
- KPI cards do not yet expose formula tooltips everywhere.

## Next

- Connect Control Tower totals to domain selectors.
- Add hooks over selectors.
- Migrate one page at a time from direct `v7r/data` reads to domain selectors.
- Add KPI test ids and formula tooltips after the selector migration is stable.
