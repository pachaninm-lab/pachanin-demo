# Missing Type Deep Links Stabilization

Status: stacked PR #395.
Branch: `codex/missing-type-deep-links`.
Base: `codex/queue-row-missing-hints`.

Progress:
- Overall backlog: 52% done / 48% left.
- Missing type deep links: 45% done / 55% left.

Delivered:
- Typed missing links in evidence queue rows.
- `Needs evidence` links to `missing=evidence`.
- `Needs audit` links to `missing=audit`.
- `Needs timeline` links to `missing=timeline`.
- `Needs documents` links to `missing=documents`.
- Missing links keep `decision=Review`.
- Unit test coverage for typed missing links.

Verified commit: `660c12a7081f08bc88844755d5a56468a3060c3e`.

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

Remaining:
- server-side missing filter parsing;
- visible missing filter state;
- full Node CI after normal merge base;
- stacked PR merge-order cleanup.
