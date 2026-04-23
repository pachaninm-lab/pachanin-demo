# Epic 01: Unified Data Layer foundation

## Scope in this PR

This is the safe foundation step for E1. It does not rewrite all platform-v7 pages yet. It adds a pure Control Tower KPI calculator and unit coverage so later UI migration can use one formula source instead of duplicated page math.

## Acceptance criteria

- [x] Pure KPI calculator added: `apps/web/lib/domain/kpi/controlTower.ts`.
- [x] Unit tests added for core KPI formulas: `apps/web/tests/unit/controlTowerKpis.test.ts`.
- [x] Runtime UI untouched in this step.
- [ ] All pages read data via `useX()` hooks. Not done in this PR; requires follow-up migration after discovery baseline lands.
- [ ] All hardcoded deal IDs removed from components. Not done in this PR; requires staged UI migration.
- [ ] Domain fixtures moved into one canonical source. Not done in this PR; requires mapping against current `v7r` and MSW fixtures.

## What changed

- Added KPI contract and calculator.
- Added unit tests for reserve, hold, release, money-at-risk, integration stops, transport stops and SLA critical count.

## Known constraints

- The repository currently uses `apps/web/lib/*` conventions and `@/*` path alias rooted at `apps/web`. This PR uses `apps/web/lib/domain` rather than introducing `apps/web/src/domain` immediately.
- The broader E1 migration must happen after E0 baseline and should not be compressed into one large blind rewrite.

## Next E1 steps

1. Migrate current `DEALS` from `apps/web/lib/v7r/data.ts` into canonical domain fixtures.
2. Make Control Tower consume `computeControlTowerKpis`.
3. Add tooltips/data-testid to KPI cards.
4. Add `useDeals`, `useDisputes`, `useLots` hooks.
5. Remove duplicate deal math from page components.
