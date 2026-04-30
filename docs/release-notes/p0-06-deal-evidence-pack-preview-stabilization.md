# P0-06 Deal Evidence Pack Preview Stabilization

Status: safe route layer stabilized as stacked PR
Branch: `codex/p0-06-deal-evidence-pack-preview`
PR: #379
Base: `codex/p0-05-evidence-dispute-continuity`

## Progress

Overall backlog: 35% done / 65% left.
P0-06: 40% done / 60% left.

## Delivered

- `DealEvidencePackPreview` component.
- Safe route: `/platform-v7/deals/[id]/evidence-pack`.
- Reuse of `EvidenceDisputeContinuityPanel` at deal level.
- Deal/disputes/bank links.
- Sandbox-only and preview-only export language.
- Fixed Next dynamic slug conflict by using canonical `[id]`.

## Tests

- `dealEvidencePackPreview.test.tsx`.
- `dealEvidencePackRoute.test.tsx`.

## Verification

Latest verified commit: `9c9adb0f4d0a9e4afea333a691e5520447d7107a`.

- CI build: success.
- Repo automations: success.
- Labeler: success.

## Boundaries

This is sandbox-preview only.

Not included:

- live PDF export;
- live EDI / KEP export;
- live banking integration;
- live FGIS integration;
- live SberKorus integration;
- production legal claims.

## Why the route is separate

The existing deal detail runtime is large and cannot be safely rewritten through a truncated connector fetch. The separate route avoids breaking the main deal detail screen while still adding deal-level evidence pack preview.

## Remaining P0-06 work

- Add discoverability link from a low-risk deal surface.
- Add route/link coverage after discoverability link is added.
- Full Node CI typecheck/test after normal merge base is available.

## Recommended next action

Add a small link to `/platform-v7/deals/[id]/evidence-pack` from an existing deal card/detail action area only when the full target file can be patched safely.
