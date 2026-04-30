# Queue Row Missing Hints Stabilization

Status: stacked PR #393.
Branch: `codex/queue-row-missing-hints`.
Base: `codex/export-state-links`.

Progress:
- Overall backlog: 50% done / 50% left.
- Row-level missing hints: 45% done / 55% left.

Delivered:
- Row-level missing hints in evidence queue.
- Needs evidence hint.
- Needs audit hint.
- Needs timeline hint.
- Needs documents hint.
- No missing data hint.
- Review links for missing hints.
- Unit test coverage.

Verified commit: `b3406ea9660ea6460a157fca15636b9b4b2c61b2`.

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

Agent queue: issue #394.

Remaining:
- optional row-level deep links by missing type;
- visual polish after preview review;
- full Node CI after normal merge base;
- stacked PR merge-order cleanup.
