# PC-CROP post-registration execution evidence

This directory is the execution register for issue #4997 and the final
post-registration specification supplied on 2026-09-04.

## Exact inputs

- original W0 repository baseline: `bb0d0c20f0f4621e5fd60d606b821b1d790c99ff`;
- specification SHA-256:
  `1f85df31b83747741b415fe65c0027e3e0be754bb0caeca5d7b3db4eb6b1e99e`;
- specification size: `50,947` bytes, `2,768` lines;
- numbered sections: `0` through `110`;
- final DoD criteria: `126`.

No uploaded source text is copied into the repository. Only its fingerprint,
requirements inventory and evidence-backed assessment are committed.

The full audit was performed at `c4dfc4112599f2a4ff21e1a5cf35345509abad41`.
Before publication, main advanced by two commits to the baseline above. Their
delta contains only
`scripts/production-role-eligibility-fns-rsmp-import.sh`; it was reviewed and
does not change any post-registration finding or status. The W0 commit is
based directly on the newer exact main.

## Strict progress rule

`strictProgressPercent = floor(PASS / 126 * 1000) / 10`

Only a terminal `PASS` receives credit. `PARTIAL`, `FAIL`,
`EXTERNAL_BLOCKER` and `NOT_EVIDENCED` receive zero terminal credit. This
deliberately understates implementation rather than presenting foundations as
accepted end-to-end behavior.

The current percentage and status counts live in `execution-state.v1.json`.
The one-row-per-criterion evidence is in `dod-baseline.v1.json`.

## Current reconciliation

The inherited chat report of 4.0% did not identify a fifth terminally accepted
criterion. The verified count is **4/126 PASS, 3.1%** under the unchanged
round-down policy. Component tests and merged configuration foundations do
not supply additional terminal credit. Organization capabilities and
commercial rules are recorded as PARTIAL with their remaining boundaries.

| Slice | GitHub evidence | Accepted boundary | Remaining boundary |
|---|---|---|---|
| W0 | #4998 merged | 126 criteria, 45 bounded findings | Maintain evidence as implementation advances |
| W1-A | #5001 merged | 13 codes, PostgreSQL RLS, CAS, replay, audit/outbox | SHADOW; downstream use and REG.RU acceptance |
| W1-B | #5010 merged | Durable provider, capability and service-offering registry | Complete service workflows and live provider evidence |
| W1-C | #5015 merged | Binding/maturity authority; PostgreSQL 7/7; Kubernetes/outbox passed | REG.RU, authentic external receipts, accounting consumer under #4321 |
| W1-D | #5019 merged | Domain 29/29, contracts 11/11, PostgreSQL 11/11, DR, Kubernetes/outbox; 39 successful workflows | Contract/Deal/service/financial integration and REG.RU acceptance |
| W1-E | #5026 merged | Marketplace API 25/25, PostgreSQL 12/12, provider revocation, payer consent, DR and Kubernetes/outbox | Physical/financial service consumers, user flows and REG.RU acceptance |
| W2-A | #5029 merged | Inventory API 22/22, PostgreSQL 15/15, shared Marketplace 12/12, exact quantities, contention, atomic evidence, restore and all 37 CI workflows | Mandatory Lot/Offer/Deal consumption, full lifecycle, independent evidence, UX and REG.RU acceptance |

Register maintenance is limited to six files by the immutable base approval
merged in #5021; branch-local state, manifest and workflow expansion is denied.

The exact current main, PR head, workflow evidence and next step are recorded
in `execution-state.v1.json`. No W1/W2 production update has been verified. The
last known W1-A read-only preflight is historical evidence, not a current
runtime claim.

## Historical W0 conclusion

At the original W0 audit, the repository contained PostgreSQL-authoritative foundations for
auction, Deal, documents, laboratories, settlement, disputes, FGIS inbox and
accounting. The post-registration operating system was not assembled around
them. These findings describe that baseline; current W1 changes are recorded above:

1. no canonical physical inventory, availability or cross-lot reservation;
2. client-supplied `MANUAL_VERIFIED`, `ERP` and `OTHER` sources can be admitted
   as verified auction supply;
3. no durable organization capability authority;
4. no RFQ, versioned offer, counter-offer or negotiation authority;
5. provider registry, ranking, notifications, partner API and elevator paths
   still contain static or process-local authority;
6. authenticated role roots hide the real role workspaces and production
   routes expose static/sandbox Deal360 and privacy claims;
7. integration configuration is mock-by-default and live ATI/Sber/1C/EDO/EPD
   adapters and receipts are absent.

## Execution order and remaining work

W1-A delivered `Organization Capability Authority — shadow mode`:

- exactly 13 canonical capability codes from the specification;
- additive PostgreSQL authority with tenant RLS;
- version/CAS and payload-bound idempotency;
- business mutation, chained audit and outbox in one transaction;
- regulated capabilities remain pending until server-held evidence exists;
- empty effective set by default; no implicit or backfilled grants;
- no effect on registration, role eligibility, Deal, Auction or Settlement
  decisions until a later separately accepted enforcement slice.

W1-B replaced the static provider catalog with durable provider, capability
and service-offering authority. W1-C added integration bindings. W1-D
and W1-E are merged after exact-head checks and review. W2-A adds canonical
physical inventory and concurrent reservations for known shared positions.
INVENTORY, DOUBLE_SELL_PROTECTION and SERVICE_MARKETPLACE move from FAIL to
PARTIAL, with no additional terminal credit.

The next bounded slice is W2-B: connect the existing Auction registration path
to inventory and separate declared public supply from independent verification.
Its source findings and required acceptance are in
`w2-a-inventory-reservation-plan.v1.json`. That plan grants no implementation
scope: new migration/Auction changes require a separately merged finite approval.
External provider activation remains separately attested.

## Registration boundary

- `REGISTRATION_CODE_CHANGED=0`
- `REGISTRATION_BEHAVIOR_CHANGED=0`
- `ROLE_ELIGIBILITY_REGRESSION=0`

Every implementation PR must prove these invariants independently.
