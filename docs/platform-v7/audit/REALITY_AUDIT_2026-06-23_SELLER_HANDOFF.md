# platform-v7 seller cabinet handoff — from reality audit 2026-06-23

Linked issue: #1976.

## Narrow objective

Create exactly one seller cabinet PR after this audit PR. The PR must improve only the seller first screen and seller CTAs where exact seller cabinet files exist.

## Seller first-screen standard

The first visible seller cabinet screen must answer:

- what happened;
- what is blocked;
- money at risk;
- responsible party;
- next action.

## CTA standard

Every seller CTA must be one of:

1. real route;
2. real section anchor;
3. real action already supported by the current controlled-pilot architecture;
4. disabled state with a specific blocked reason.

## Forbidden scope

Do not touch:

- `apps/landing`;
- backend;
- DB/migrations;
- auth/session/API;
- package or lockfiles;
- buyer, bank, operator, executive, compliance, lab, elevator or field role files unless the seller cabinet imports a shared component and the change is split into a separate shared-shell PR.

## Language guard

Use controlled-pilot / pre-integration language. Do not claim live persistence, money movement, bank confirmation, external system callback or production readiness.
