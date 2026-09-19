# P0-04 Role Continuity Stabilization

Status: technically stabilized as stacked PR
Branch: `codex/p0-04-role-dashboards-continuity`
PR: #376
Base: `codex/p0-02-p0-03-domain-action-core`

## Progress

Overall backlog: 24% done / 76% left.
P0-04: 92% done / 8% left.

## What is delivered

- Shared `RoleContinuityPanel` for role dashboards.
- Role continuity for buyer, seller, bank, logistics, driver, lab.
- Role-specific action handoff.
- Sandbox dispatch bridge.
- Role action journal with status, audit and timeline feedback.
- Evidence, audit, timeline, owner, status, amount and blocker context.
- Buyer/seller/bank/logistics route layouts.
- Driver/lab page wiring.
- Agent workpack for P0-04.

## Tests / coverage

- `roleContinuityPanel.test.tsx`
  - buyer, seller, bank, logistics, driver, lab continuity.
  - action handoff labels and action types.
- `roleActionDispatchBridge.test.tsx`
  - disabled state.
  - successful sandbox dispatch.
  - audit and timeline feedback.
  - role action journal entry.
- `roleContinuityLayouts.test.tsx`
  - buyer/seller/bank/logistics layout continuity presence.

## Verification

Latest verified commit: `39bc3e479048f17d71e4a0428d3c65ea3c6d2c42`.

- CI build: success.
- Repo automations: success.
- Labeler: success.

## Boundaries

This is simulation-grade and sandbox-only.

Not included:

- live banking integration;
- live FGIS integration;
- live EDI / SberKorus events;
- production money logic;
- production legal claims;
- live dispatch from real users.

## Remaining 8% of P0-04

- Merge order cleanup after PR #375 leaves draft state.
- Full Node CI typecheck/test after normal merge base is available.
- Optional visual polish after real preview review.

## Next block: P0-05

Recommended next block: deal-level evidence pack and dispute continuity.

Goal:

`role action -> evidence -> audit -> timeline -> dispute pack -> money hold/release explanation`

Acceptance criteria:

- deal page shows evidence pack summary;
- dispute page can reference same evidence chain;
- bank page can see why money is held/released;
- export-ready evidence summary remains sandbox-only;
- no live-integration claims.
