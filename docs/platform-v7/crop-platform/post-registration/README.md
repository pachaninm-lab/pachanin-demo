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
Later bounded slices are reconciled against their exact merged main commits;
registration remains outside the implementation scope.

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
criterion. The verified count remains **4/126 PASS, 3.1%** under the unchanged
round-down policy. W2-B materially improves the inventory/trust foundation but
still does not complete any additional end-to-end DoD criterion.

| Slice | GitHub evidence | Accepted boundary | Remaining boundary |
|---|---|---|---|
| W0 | #4998 merged | 126 criteria, 45 bounded findings | Maintain evidence as implementation advances |
| W1-A | #5001 merged | 13 codes, PostgreSQL RLS, CAS, replay, audit/outbox | SHADOW; downstream use and REG.RU acceptance |
| W1-B | #5010 merged | Durable provider, capability and service-offering registry | Complete service workflows and live provider evidence |
| W1-C | #5015 merged | Binding/maturity authority; PostgreSQL 7/7; Kubernetes/outbox passed | REG.RU, authentic external receipts, accounting consumer under #4321 |
| W1-D | #5019 merged | Domain 29/29, contracts 11/11, PostgreSQL 11/11, DR, Kubernetes/outbox; 39 successful workflows | Contract/Deal/service/financial integration and REG.RU acceptance |
| W1-E | #5026 merged | Marketplace API 25/25, PostgreSQL 12/12, provider revocation, payer consent, DR and Kubernetes/outbox | Physical/financial service consumers, user flows and REG.RU acceptance |
| W2-A | #5029 merged | Inventory API 22/22, PostgreSQL 15/15, exact quantities, contention, atomic evidence and restore | Full stock lifecycle, genealogy/custody/title, all market consumers, UX and REG.RU acceptance |
| W2-B | #5040 merged | New Auction lots require immutable canonical Inventory reservation; DECLARED + PUBLIC_ALLOWED is admitted without fabricated verification; restricted PostgreSQL/HTTP 17/17 and full exact-head CI/review passed | Canonical Deal allocation, later Offer/RFQ consumers, full trust/risk acknowledgement, lifecycle and REG.RU acceptance |

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
them. These findings describe that baseline; current W1/W2 changes are recorded above:

1. canonical physical inventory/reservation now exists, but complete lifecycle,
   genealogy, custody/title/restrictions and every market consumer are not closed;
2. new Auction lots can be DECLARED + PUBLIC_ALLOWED without creating false
   independent verification; complete fact-level trust and risk acknowledgement
   are still missing;
3. no RFQ, versioned offer, counter-offer or negotiation authority;
4. provider registry and integration binding foundations exist, but live
   partner/provider acceptance remains incomplete;
5. authenticated role roots, empty states and world-class role UX are not yet
   terminally accepted;
6. live ATI/Sber/1C/EDO/EPD corridors and authentic provider receipts remain
   outside accepted production evidence.

## Execution order and remaining work

W1 configuration foundations are merged. W2-A introduced canonical physical
inventory and atomic reservation/release. W2-B then consumed that authority in
the existing Auction registration path: every new declared Auction lot is bound
to one immutable Inventory reservation, exact profile/quantity identity is
pinned, legacy verified registration is denied, and browser source labels do not
manufacture independent verification.

`INVENTORY`, `DOUBLE_SELL_PROTECTION`, `PROGRESSIVE_TRUST` and
`UNVERIFIED_TRADING` remain non-terminal: W2-B closes only the Auction
registration edge. The canonical Deal still needs exact allocation of the
winning quantity, partial reservation remainder must be conserved, and later
RFQ/Offer writers plus risk acknowledgement/lifecycle/UX remain outstanding.

The next bounded slice is **W2-C: canonical Deal inventory allocation**. Its
finite source/fixture boundary is being approved separately under #5055 before
any implementation path is opened. The target is to reuse `PrismaDealRepository`,
the existing Auction award/`DEAL_BASIS_READY` authority and the canonical
Inventory reservation in one atomic Deal-creation transaction. No new Deal
engine is permitted.

## Registration boundary

- `REGISTRATION_CODE_CHANGED=0`
- `REGISTRATION_BEHAVIOR_CHANGED=0`
- `ROLE_ELIGIBILITY_REGRESSION=0`

Every implementation PR must prove these invariants independently.
