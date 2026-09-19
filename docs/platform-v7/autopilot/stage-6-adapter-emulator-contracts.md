# Stage 6 — External Adapter Emulator Contracts

Maturity: controlled-pilot / pre-integration.

This document defines contract boundaries for future external adapter emulators. It does not implement live integrations, does not add API routes, does not change runtime behavior, and does not claim that any external system is connected.

## Objective

Define a stable pre-integration contract layer for external systems that may later be connected through credentials, agreements, technical access, and live transaction evidence.

The contract layer must make the future integration surface explicit without implying that bank, FGIS, EDO, EPD, logistics, lab or inspection systems are live today.

## Contract principles

1. Emulator responses must be deterministic and auditable.
2. Every external event must include source, receivedAt, correlationId, externalStatus and maturity.
3. Every money-related event must preserve the rule: the platform does not release money itself; bank confirmation is required.
4. Every document-related event must preserve document responsibility, status and blocking effect.
5. Every emulator must distinguish pre-integration test data from external confirmed data.
6. Every contract must support idempotency and reconciliation.
7. Every failure state must be explicit: unavailable, rejected, conflict, manual_review, timeout, invalid_payload.

## Required adapter families

### Bank adapter emulator

Purpose: model reserve, hold, release request, release confirmation, refund and reconciliation events without claiming live bank connectivity.

Required event types:

- reserve_requested
- reserve_confirmed
- hold_created
- hold_released
- release_requested
- release_confirmed
- refund_requested
- refund_confirmed
- manual_review
- reconciliation_mismatch

Hard rule: money release remains an external bank-confirmed event. The platform may prepare basis, request, audit trail and reconciliation, but must not claim it independently releases funds.

### FGIS / SDIZ adapter emulator

Purpose: model party traceability, SDIZ status, redemption and error/manual review states without claiming live FGIS access.

Required event types:

- party_link_requested
- party_linked
- sdiz_draft_created
- sdiz_ready_to_sign
- sdiz_signed
- sdiz_sent
- sdiz_redeemed
- sdiz_partially_redeemed
- sdiz_error
- manual_review

Hard rule: FGIS/SDIZ status must affect deal readiness, shipment, acceptance and money basis only through explicit status and blocker mapping.

### EDO adapter emulator

Purpose: model legally significant document exchange lifecycle without claiming live EDO connectivity.

Required event types:

- document_draft_created
- document_sent
- document_signed_by_one_side
- document_signed_by_all_sides
- document_rejected
- document_revoked
- manual_review

Hard rule: documents must remain tied to deal, role, responsible party, blocker level and money impact.

### EPD / logistics adapter emulator

Purpose: model transport document and logistics event exchange without claiming live EPD or logistics system connectivity.

Required event types:

- epd_draft_created
- epd_sent
- epd_confirmed
- epd_rejected
- trip_event_received
- route_deviation_received
- arrival_confirmed
- manual_review

Hard rule: logistics events must not override evidence, quality, document or bank gates without explicit domain rules.

### Lab / inspection adapter emulator

Purpose: model quality protocol, sample, inspection and discrepancy events without claiming live laboratory or surveyor connectivity.

Required event types:

- sample_registered
- protocol_draft_created
- protocol_confirmed
- quality_delta_detected
- discrepancy_reported
- inspection_confirmed
- manual_review

Hard rule: quality deltas must remain auditable and must be able to affect hold/release basis, dispute and document blockers.

## Shared event envelope

Every emulator event must be representable by a shared envelope:

```ts
interface P7ExternalAdapterEmulatorEvent {
  source: 'bank' | 'fgis' | 'edo' | 'epd' | 'logistics' | 'lab' | 'inspection';
  maturity: 'pre_integration' | 'test_event' | 'external_confirmed';
  eventType: string;
  correlationId: string;
  externalId?: string;
  dealId?: string;
  documentId?: string;
  tripId?: string;
  moneyOperationId?: string;
  status: 'accepted' | 'rejected' | 'manual_review' | 'conflict' | 'timeout' | 'invalid_payload';
  receivedAt: string;
  payload: Record<string, unknown>;
}
```

For current Stage 6 contracts, only `pre_integration` and `test_event` are valid. `external_confirmed` is reserved for future live integrations after credentials, agreements and real external evidence exist.

## Forbidden claims

Do not claim:

- production-ready
- fully live
- fully integrated
- bank connected
- FGIS connected
- EDO connected
- platform guarantees payment
- platform releases money

## PR 6.1 output boundary

PR 6.1 may add or update only docs/prompts/state needed to define this contract layer. It must not implement the adapter runtime. PR 6.2+ may introduce adapter emulator code only after PR 6.1 is green and merged.
