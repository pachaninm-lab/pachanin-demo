# Platform V7 live smoke QA plan

## Purpose

This is the first QA pass after the fast-safe hardening pass.

The goal is to verify the live canonical Platform V7 routes as a controlled-pilot execution UX, not to claim production-ready or fully live status.

## Canonical URL

- `https://pachanin-web.vercel.app/platform-v7/`

## Priority smoke routes

- `/platform-v7`
- `/platform-v7/control-tower`
- `/platform-v7/bank`
- `/platform-v7/driver/field`
- `/platform-v7/disputes`
- `/platform-v7/seller`
- `/platform-v7/buyer`
- `/platform-v7/logistics`
- `/platform-v7/elevator`
- `/platform-v7/lab`
- `/platform-v7/connectors`
- `/platform-v7/investor`

## Live smoke checks

For each route, verify:

1. Route loads on the canonical URL.
2. No 404 or crash shell appears.
3. First screen explains what the user can do.
4. Primary action is visible.
5. No horizontal overflow at 390px.
6. Mobile text is readable without zooming.
7. User-facing copy avoids internal technical wording.
8. User-facing copy avoids inflated maturity claims.
9. Missing external data is shown as requiring connection or test mode.
10. `apps/landing` is not part of the Platform V7 QA scope.

## Role-specific smoke checks

### Seller

- Seller sees lots, offers, documents, and money context.
- Seller does not see bank internal event logs.

### Buyer

- Buyer sees available lots, own bids, reserve, acceptance, and documents.
- Buyer does not see other buyers' closed-mode bids.

### Logistics

- Logistics sees trip request, vehicle, driver, route, and transport documents.
- Logistics does not see grain price or bank reserve.

### Driver

- Driver sees one trip and field actions.
- Driver does not see bank, investor, trading, Control Tower, or role switcher surfaces.

### Bank

- Bank sees reserve, hold, release basis, document blockers, and manual review.
- UI must say bank confirms release, not that the platform releases money.

### Arbitrator / disputes

- Disputes show evidence, missing metadata, amount at risk, and decision context.
- Missing evidence metadata must not be invented.

## Exit criteria

The live smoke pass is acceptable when:

- all priority routes load;
- no route has visible crash/404 shell;
- driver shell stays isolated;
- bank and money wording remains honest;
- responsive overflow gates remain green;
- no Russian or English overclaim appears;
- docs clearly separate controlled pilot from live external execution.

## Known out-of-scope items

- Real bank release execution.
- Live FGIS integration.
- Live EDO / ETRN connector validation.
- Live GPS / telematics.
- Production auth rewrite.
- Database migration.
- `apps/landing` changes.

## Next QA gates

1. Add visual regression screenshots for priority routes.
2. Add Lighthouse baseline and no-regression thresholds.
3. Add deeper selector-level leakage tests.
4. Add action-click smoke tests for old seller, buyer, bank, and Control Tower actions.
5. Add route policy hints beyond the driver route.
