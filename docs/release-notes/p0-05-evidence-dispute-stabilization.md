# P0-05 Evidence + Dispute Continuity Stabilization

Status: technically stabilized as stacked PR
Branch: `codex/p0-05-evidence-dispute-continuity`
PR: #377
Base: `codex/p0-04-role-dashboards-continuity`

## Progress

Overall backlog: 31% done / 69% left.
P0-05: 78% done / 22% left.

## Delivered

- `EvidenceDisputeContinuityPanel`.
- Evidence pack summary.
- Dispute context.
- Bank decision status: Hold / Review / Can release.
- Money hold / release explanation.
- Audit trail.
- Deal timeline.
- Dispute pack readiness score.
- Readiness checklist.
- Sandbox export-ready summary.
- Bank page wiring.
- Disputes page wiring.

## Tests

- `evidenceDisputeContinuityPanel.test.tsx`
  - evidence / dispute / money / timeline continuity;
  - money hold/release explanation;
  - no live integration claims;
  - route links;
  - dispute pack readiness score and checklist;
  - sandbox export boundary.

- `evidenceDisputeRoutes.test.tsx`
  - `/platform-v7/disputes` contains the evidence-dispute continuity panel;
  - `/platform-v7/bank` contains the evidence-dispute continuity panel.

## Verification

Latest verified commit: `74df53bf8f3e9814090060af966ec81e5f49b05c`.

- CI build: success.
- Repo automations: success.
- Labeler: success.

## Boundaries

This is simulation-grade and sandbox-only.

Not included:

- live banking integration;
- live FGIS integration;
- live EDI / SberKorus events;
- production money release;
- real PDF/EDI/KEP export;
- production legal claims.

## Remaining 22% of P0-05

- Merge-order cleanup after P0-02/P0-03 and P0-04 are resolved.
- Full Node CI typecheck/test after normal merge base is available.
- Optional route-level polish after live preview review.
- Optional stronger dispute-pack export preview in P0-06.

## Agent queue

Parallel work queue: issue #378.

## Next block: P0-06

Recommended next block: deal-level evidence pack preview and export readiness.

Goal:

`deal -> evidence pack -> dispute pack preview -> bank hold/release explanation -> export readiness`

Acceptance criteria:

- Deal page can show same evidence/dispute readiness as bank/disputes.
- Export remains preview-only and sandbox-labelled.
- Missing data is visible.
- No live PDF/EDI/KEP claims.
- Tests cover component and route presence.
