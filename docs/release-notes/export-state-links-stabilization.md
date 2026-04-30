# Export State Links Stabilization

Status: stacked PR #391.
Branch: `codex/export-state-links`.
Base: `codex/export-readiness-states`.

Progress:
- Overall backlog: 48% done / 52% left.
- Export state links: 60% done / 40% left.

Delivered:
- Ready for preview action link.
- Needs evidence action link.
- Needs audit action link.
- Needs timeline action link.
- Links route to evidence queue filters.
- Unit test coverage for state links.

Verified commit: `246aa4064fa7f9885020e9601b63a9da1f75f10d`.

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

Agent queue: issue #392.

Remaining:
- optional row-level missing-state deep links;
- visual polish after preview review;
- full Node CI after normal merge base;
- stacked PR merge-order cleanup.
