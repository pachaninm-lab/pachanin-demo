# Missing Fallback Test Stabilization

Status: stacked PR #399.
Branch: `codex/filter-fallback`.
Base: `codex/missing-filter-parsing`.

Progress:
- Overall backlog: 56% done / 44% left.
- Invalid missing fallback test: 45% done / 55% left.

Delivered:
- Route test for invalid `missing` search param.
- Verifies fallback to all missing types.
- Verifies active missing filter is not rendered for invalid value.
- Verifies visible count remains rendered.

Verified commit: `a25aa746ec9b22300fc1208b4a1bc70da23f9efd`.

Verification:
- CI build: success.
- Repo automations: success.
- Labeler: success.

Boundaries:
- test-only change;
- sandbox-only;
- no live PDF export;
- no live EDI / KEP export;
- no live banking, FGIS or SberKorus integration;
- no production legal claims.

Agent queue: issue #400.

Remaining:
- optional component-level invalid filter test;
- visual polish after preview review;
- full Node CI after normal merge base;
- stacked PR merge-order cleanup.
