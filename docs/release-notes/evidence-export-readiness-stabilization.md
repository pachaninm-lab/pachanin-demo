# Evidence Export Readiness Stabilization

Status: stacked PR #386.
Branch: `codex/evidence-export-readiness`.
Base: `codex/evidence-queue-controls`.

Progress:
- Overall backlog: 44% done / 56% left.
- Export readiness: 35% done / 65% left.

Delivered:
- `EvidenceExportReadinessSummary`.
- Route wiring on `/platform-v7/evidence-pack`.
- Readiness score.
- Evidence / audit / timeline linked metrics.
- Dispute marker metric.
- Sandbox preview boundary.
- Component and route tests.

Verified commit: `028f9195f859fb001c90a3ca371b0b297ac3d672`.

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

Agent queue: issue #387.

Remaining:
- optional stronger export readiness states;
- visual polish after preview review;
- full Node CI after normal merge base;
- stacked PR merge-order cleanup.
