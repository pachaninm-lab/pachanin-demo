# PC-CROP post-registration execution baseline

This directory is the W0 source of truth for issue #4997 and the final
post-registration specification supplied on 2026-09-04.

## Exact inputs

- repository baseline: `bb0d0c20f0f4621e5fd60d606b821b1d790c99ff`;
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

## W0 conclusion

The repository contains strong PostgreSQL-authoritative foundations for
auction, Deal, documents, laboratories, settlement, disputes, FGIS inbox and
accounting. The post-registration operating system is not assembled around
them. The blocking gaps are upstream:

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

## Execution order

W1-A is `Organization Capability Authority — shadow mode`:

- exactly 13 canonical capability codes from the specification;
- additive PostgreSQL authority with tenant RLS;
- version/CAS and payload-bound idempotency;
- business mutation, chained audit and outbox in one transaction;
- regulated capabilities remain pending until server-held evidence exists;
- empty effective set by default; no implicit or backfilled grants;
- no effect on registration, role eligibility, Deal, Auction or Settlement
  decisions until a later separately accepted enforcement slice.

W1-B then replaces the static provider catalog with a durable provider,
capability, service-offering and integration-binding authority. External
provider activation remains separately attested.

## Registration boundary

- `REGISTRATION_CODE_CHANGED=0`
- `REGISTRATION_BEHAVIOR_CHANGED=0`
- `ROLE_ELIGIBILITY_REGRESSION=0`

Every implementation PR must prove these invariants independently.
