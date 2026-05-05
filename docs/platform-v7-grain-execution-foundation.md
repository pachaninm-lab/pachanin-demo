# Platform v7 grain execution foundation

Controlled-pilot implementation slice for turning `platform-v7` into a grain trade execution contour that starts from a concrete grain batch and continues through readiness, lot/RFQ, offer, deal, money, SDIZ, logistics, driver, elevator, weight, sample, lab, documents, dispute, evidence, support and audit.

## Scope

Touched only:

- `apps/web/app/platform-v7`
- `apps/web/components/platform-v7`
- `apps/web/lib/platform-v7`
- `apps/web/tests`
- `docs`

Did not touch:

- `apps/landing`

## Added domain foundation

- `GrainBatch` as the source object before a lot.
- Batch readiness score, blockers and next actions.
- Lot/RFQ/Offer data links.
- Netback calculation for clean seller price.
- SDIZ gate model for publication, shipment, acceptance and money release.
- Logistics order, incident, elevator operation, weight balance, quality delta and sample chain.
- Document requirements as gates, not only files.
- Money adjustments and money projection for partial release and disputed amount separation.
- Support automation from execution blockers.
- Role visibility projection through `RoleExecutionSummary`.
- Audit event generation for critical actions.

## Added routes

Exact dynamic routes were partially blocked by the tool safety layer during this pass, so this PR adds working static fallback routes for the demo contour:

- `/platform-v7/batches`
- `/platform-v7/batches/create`
- `/platform-v7/batches/view`
- `/platform-v7/seller/quick-sale`
- `/platform-v7/buyer/rfq`
- `/platform-v7/buyer/rfq/create`
- `/platform-v7/buyer/rfq/detail`
- `/platform-v7/elevator/terminal`
- `/platform-v7/deals/grain-quality`
- `/platform-v7/deals/grain-weight`
- `/platform-v7/deals/grain-sdiz`
- `/platform-v7/deals/grain-release`
- `/platform-v7/demo/grain-execution`

Follow-up when the tool allows it:

- `/platform-v7/batches/new`
- `/platform-v7/batches/[batchId]`
- `/platform-v7/buyer/rfq/new`
- `/platform-v7/buyer/rfq/[rfqId]`
- `/platform-v7/elevator/terminal/[operationId]`
- `/platform-v7/deals/[dealId]/quality`
- `/platform-v7/deals/[dealId]/weight`
- `/platform-v7/deals/[dealId]/sdiz`
- `/platform-v7/deals/[dealId]/release`

## UX and maturity rules

- No production-ready claim.
- No fully-live claim.
- No live ФГИС, bank, ЭДО, ЭТрН or ГИС ЭПД claim.
- External status language uses `тестовый контур`, `ручная проверка`, `требует боевого подключения`, `к выпуску через банк`.
- Driver role projection hides money, bank, bids, disputes and role-switching context.
- Logistics/elevator/lab projections hide commercial or banking details that are not needed for their role.

## Tests added

- `platformV7GrainBatchReadiness.spec.ts`
- `platformV7MoneyAdjustments.spec.ts`
- `platformV7MatchingEngine.spec.ts`
- `platformV7RoleVisibility.spec.ts`
- `platform-v7-full-grain-execution-demo.spec.ts`

## Known limitation of this pass

Local test execution was not possible from the container because the container could not resolve `github.com` for cloning. CI should be treated as the source of truth for build and test status.
