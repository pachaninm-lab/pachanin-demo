# P0-07 Evidence Operations Queue Stabilization

Status: stacked PR #382.
Branch: `codex/p0-07-evidence-operations-queue`.
Base: `codex/p0-06-deal-evidence-pack-preview`.

Progress:
- Overall backlog: 39% done / 61% left.
- P0-07: 35% done / 65% left.

Delivered:
- `EvidencePackOperationsQueue`.
- Queue on `/platform-v7/evidence-pack`.
- Average readiness.
- Hold / Review / Can release counters.
- Deal rows with blocker reason.
- Evidence / audit / timeline counts.
- Preview links to `/platform-v7/deals/[id]/evidence-pack`.

Tests:
- `evidencePackOperationsQueue.test.tsx`.
- `evidencePackIndexRoute.test.tsx`.

Verified commit: `3b18db1ad7d162e719d4634a77cfbe2d2068d6db`.

Verification:
- CI build: success.
- Repo automations: success.
- Labeler: success.

Boundaries:
- sandbox-only;
- no live PDF export;
- no live EDI / KEP export;
- no live banking, FGIS or SberKorus integration;
- no production legal claims.

Agent queue: issue #383.

Remaining:
- optional decision filters;
- visual polish after preview review;
- full Node CI after normal merge base;
- stacked PR merge-order cleanup.
