# Epic 01: KPI foundation

## Done

- Added `apps/web/lib/domain/kpi/controlTower.ts`.
- Added `apps/web/tests/unit/controlTowerKpis.test.ts`.
- Runtime UI is unchanged.

## Covered

- reserve total
- held amount
- ready to release
- money at risk
- integration stops
- transport stops
- SLA critical count
- release amount fallback

## Next

- Move fixtures into one domain source.
- Add domain hooks.
- Connect Control Tower to the KPI calculator.
- Add KPI test ids and formula tooltips.
