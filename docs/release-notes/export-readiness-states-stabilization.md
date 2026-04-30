# Export Readiness States Stabilization

Status: stacked PR #388.
Branch: `codex/export-readiness-states`.
Base: `codex/evidence-export-readiness`.

Progress:
- Overall backlog: 46% done / 54% left.
- Export readiness states: 50% done / 50% left.

Delivered:
- Ready for preview state.
- Needs evidence state.
- Needs audit state.
- Needs timeline state.
- State breakdown in `EvidenceExportReadinessSummary`.
- Unit test coverage for state breakdown.

Verified commit: `c5fd959ab642ae077853b3848351d9984f96c338`.

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

Agent queue: issue #390.

Remaining:
- optional row-level missing-state links;
- visual polish after preview review;
- full Node CI after normal merge base;
- stacked PR merge-order cleanup.
