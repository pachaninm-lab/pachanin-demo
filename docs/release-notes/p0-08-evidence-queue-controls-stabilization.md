# P0-08 Evidence Queue Controls Stabilization

Status: stacked PR #384.
Branch: `codex/evidence-queue-controls`.
Base: `codex/p0-07-evidence-operations-queue`.

Progress:
- Overall backlog: 42% done / 58% left.
- P0-08: 35% done / 65% left.

Delivered:
- decision controls for evidence queue;
- filters: all, Hold, Review, Can release;
- server route search params on `/platform-v7/evidence-pack`;
- visible filtered count;
- empty filtered state;
- tests for controls and route search params.

Verified commit: `c6f6b700fb63a60752045294c24249995a70191b`.

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

Agent queue: issue #385.

Remaining:
- optional stronger filter assertions;
- visual polish after preview review;
- full Node CI after normal merge base;
- stacked PR merge-order cleanup.
