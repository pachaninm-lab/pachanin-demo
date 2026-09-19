# Missing Filter Parsing Stabilization

Status: stacked PR #397.
Branch: `codex/missing-filter-parsing`.
Base: `codex/missing-type-deep-links`.

Progress:
- Overall backlog: 54% done / 46% left.
- Missing filter parsing: 45% done / 55% left.

Delivered:
- Server-side `missing` search param parsing.
- Supported values: evidence, audit, timeline, documents.
- Active missing filter UI.
- Combined `decision=Review&missing=...` filtering.
- Component test coverage.
- Route test coverage.

Verified commit: `2b1ad85cbe23784b9b7e951edbbfd41059db6b4b`.

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

Agent queue: issue #398.

Remaining:
- optional invalid missing fallback test;
- visual polish after preview review;
- full Node CI after normal merge base;
- stacked PR merge-order cleanup.
