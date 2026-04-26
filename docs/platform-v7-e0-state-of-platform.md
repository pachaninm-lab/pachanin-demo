# platform-v7 E0 state of platform

Generated: 2026-04-26
Branch: `feat/canonical-platform-task-v2`
Scope: canonicalization pass before E1 Unified Data Layer.

## Purpose

This document converts the canonical platform task into the first engineering baseline. It does not claim production readiness. It records what must be stabilized before adding more visible product surface.

## Current confirmed repository signals

The existing `docs/data-sources.md` already identifies dispersed data sources that must be consolidated before E1:

- `apps/web/lib/v7r/data.ts` — likely primary UI fixture source.
- `apps/web/mocks/handlers.ts` — MSW transport/mock layer.
- `apps/web/mocks/fixtures/deals.json` — explicit deal fixtures.
- `apps/web/mocks/fixtures/disputes.json` — explicit dispute fixtures.
- `apps/web/mocks/fixtures/bank-events.json` — money/bank events fixture source.
- `apps/web/mocks/fixtures/batches.json` — batch/lot-like source.
- `apps/web/mocks/fixtures/rfq.json` — RFQ/procurement source.
- `apps/web/stores/useFieldRuntimeStore.ts` — field runtime local state.
- `apps/web/stores/useCommercialRuntimeStore.ts` — commercial/lots/RFQ runtime state.
- `shared/runtime-store.ts` and `shared/runtime-snapshot.ts` — shared runtime sources.
- `config/fixtures/tambov-pilot-fixtures.json` — pilot seed/config.

## E0 diagnosis

The platform must not continue as a set of page-level facts. The first engineering risk is not missing visual screens. The first engineering risk is that deal, money, document, field and dispute facts can diverge across UI fixtures, MSW, runtime stores and pilot snapshots.

## Canonical product architecture

`Прозрачная Цена` is defined as four layers:

1. **Market Layer** — farmer lots, buyer search, RFQ, offers, auctions, buy-now and matching.
2. **Execution Layer** — deal, contract, money reserve, logistics, acceptance, lab, documents, FGIS/SDIZ, EDO/EPD, release/refund, dispute and evidence.
3. **Trust Layer** — RBAC, authority, signatures, 2FA, immutable audit, bank events, anti-fraud, anti-bypass and degradation mode.
4. **Intelligence Layer** — risk scoring, matching, price reference, AI assistance, investor metrics, unit economics and bank-ready dossier.

## Non-negotiable E0 rules

1. No new decorative feature work before data, state, money, audit and RBAC foundations are stable.
2. Market layer is mandatory, but every buy/auction/RFQ winner must auto-create a managed deal.
3. Sandbox/manual/live statuses must not be mixed.
4. UI must not claim production readiness, live FGIS, live bank, guaranteed payment or completed EDO unless that is factually true.
5. Every critical action must converge toward loading/result/audit-event semantics.
6. No money release path without idempotency, document gates, authority checks and open-dispute checks.

## First safe engineering sequence

1. Add canonical domain taxonomy and deal status state machine types.
2. Add transition guards without wiring them into UI yet.
3. Add canonical platform layer definitions.
4. Add claims/status guard constants for future audits.
5. Create follow-up E1 task to migrate fixtures into one domain source.

## Acceptance criteria for this E0 pass

- Canonical task document exists in `docs/`.
- E0 state-of-platform document exists in `docs/`.
- Canonical domain/state-machine skeleton exists under `apps/web/lib/platform-v7/domain/`.
- No current UI behavior is changed in this pass.
- Next pass can safely start E1 Unified Data Layer.
