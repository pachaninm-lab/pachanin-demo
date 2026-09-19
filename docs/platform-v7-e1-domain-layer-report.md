# platform-v7 E1 domain layer report

Generated: 2026-04-26
Branch: `feat/canonical-platform-task-v2`
Status: partial E1 implementation. UI is not rewired yet.

## Progress

E1 foundation progress: **33% done / 67% remaining**.
Full production-polish program progress is lower because this branch covers only the E0/E1 foundation slice.

## Added files

Path: `apps/web/lib/platform-v7/domain/`

- `canonical.ts` — platform layers, maturity statuses, canonical deal statuses and transition rules.
- `types.ts` — canonical entity types for deals, lots, RFQ, offers, documents, counterparties and money state.
- `status-mapper.ts` — legacy status mapper.
- `legacy-deal-adapter.ts` — adapter from current mock deal shape to canonical deal shape.
- `money.ts` — money event and KPI helpers.
- `kpi.ts` — control tower and investor KPI helpers.
- `selectors.ts` — bridge selectors for gradual UI migration.
- `audit.ts` — audit event model.
- `rbac.ts` — role permission matrix.
- `index.ts` — module exports.

## Added tests

File: `apps/web/tests/unit/platformV7CanonicalDomain.test.ts`

Covered:

- status mapping;
- invalid transition guard;
- legacy deal normalization;
- money KPI calculations;
- control tower KPI calculations;
- investor KPI calculations;
- readiness selectors;
- highest-risk deal selector;
- role permission checks;
- audit event creation.

## Confirmed legacy mismatch

Existing mock deals use old statuses:

- `quality_disputed`
- `payment_reserved`
- `release_requested`
- `release_approved`
- `docs_complete`
- `loading_started`
- `unloading_done`

These now map into canonical statuses:

- `DISPUTED`
- `MONEY_RESERVED`
- `RELEASE_PENDING`
- `DOCUMENTS_COMPLETE`
- `LOADING`
- `WEIGHING`

Unknown status maps to `DEGRADED`.

## Why this order is correct

Direct UI rewiring before a canonical adapter would increase regression risk. This branch creates the compatibility path:

legacy fixtures -> normalize -> canonical deal -> canonical selectors -> gradual UI migration.

## Not changed in this pass

- Existing UI routes.
- Existing mock fixtures.
- Existing KPI module used by current screens.
- Runtime behavior.

## Next step

E1.2:

1. Pick one low-risk read-only surface.
2. Feed it through canonical selectors.
3. Compare old KPI and canonical KPI.
4. Replace only after values are verified.
5. Then migrate additional surfaces.

## Remaining E1 risks

1. Old KPI module still uses a different formula.
2. UI still reads legacy statuses directly.
3. Current fixtures still duplicate money fields.
4. Branch needs CI/build verification.
5. No data migration has been completed yet.
