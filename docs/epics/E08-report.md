# Epic 08: Evidence & Audit Readiness — progress report

## Status

E08 is complete at the foundation/source-of-truth level. Runtime hookup into deal, dispute, bank review, document archive and operator evidence surfaces is intentionally blocked until staged visible patching is done safely.

## Completed

- Added `apps/web/lib/platform-v7/evidence-ledger.ts`.
- Added `apps/web/lib/platform-v7/dispute-evidence-pack.ts`.
- Added `apps/web/lib/platform-v7/audit-trail.ts`.
- Added `apps/web/lib/platform-v7/audit-evidence-export.ts`.
- Added `apps/web/lib/platform-v7/evidence-retention.ts`.
- Added unit coverage for evidence ledger, dispute evidence pack, audit trail, audit + evidence export and retention/legal hold.

## Covered acceptance areas

- Evidence is modeled as a verifiable hash chain with `hash`, `prevHash`, `signedAt`, `signedBy`, source and evidence class.
- Broken chain, duplicate ID, missing hash, missing signer and rejected evidence are detected as blockers.
- Dispute pack readiness depends on valid ledger and required evidence classes.
- Audit trail requires actor, role, correlation ID and status-change before/after hashes.
- Export readiness for bank review, dispute, due diligence and operator archive depends on valid evidence + valid audit.
- Retention separates active, expiring, expired and legal hold states.
- Unsafe purge is blocked while `disputeOpen` or `legalHold` is true.
- Runtime must remain honest: no claim that evidence is legally accepted by court/bank until connectors and legal process are actually verified.

## Merged PRs

- #149 — evidence ledger model and tests.
- #150 — dispute evidence pack model and tests.
- #151 — audit trail model and tests.
- #152 — audit + evidence export model and tests.
- #153 — evidence retention model and tests.

## Remaining blocker

Issue #154 blocks final runtime hookup into:

- deal detail evidence/document blocks;
- dispute workspace / dispute pack screen;
- bank review export surface;
- document archive / audit export surface;
- operator console evidence review.

Reason: runtime hookup touches dispute evidence, bank review, document archive, retention/legal hold and visible proof claims. It must be staged and fail-closed, not patched as a broad rewrite.

## Safe next step

Start with the smallest visible patch:

1. Add a sandbox evidence/audit panel to an existing deal or dispute surface.
2. Import `platformV7EvidenceLedgerModel()` and `platformV7AuditTrailModel()`.
3. Render status, blockers and next action.
4. Keep evidence sources marked as sandbox/pre-integration unless real connectors are active.
5. Do not change upload/storage behavior.
6. Do not allow export when ledger or audit is broken.
7. Run `pnpm typecheck && pnpm test && pnpm build`.

Then migrate one block per PR:

1. Evidence ledger panel → `evidence-ledger`.
2. Dispute pack screen → `dispute-evidence-pack`.
3. Audit timeline → `audit-trail`.
4. Bank/DD/export pack → `audit-evidence-export`.
5. Retention/legal hold → `evidence-retention`.

## Runtime impact so far

Low-risk. Runtime evidence/dispute/audit/export UI has not been changed yet. E08 foundation is ready for staged hookup.

## Known issues

- Final E08 acceptance cannot be marked done until issue #154 is resolved.
- E07 still has issue #147 for onboarding/compliance runtime hookup.
- E06 still has issue #140 for bank runtime hookup.
- E05 still has issue #131 for deal workspace runtime hookup.
- E04 still has issue #121 for investor/demo runtime hookup.
- E03 still has issue #111 for runtime action button hookup.
- E02 still has issue #100 for final `AppShellV3` hookup.
- E01 still has issue #91 for remaining large runtime files.

## Current estimate

- E08 foundation/source-of-truth: complete.
- E08 runtime evidence/audit hookup: blocked.
- Overall E08 progress: about 98% complete.
