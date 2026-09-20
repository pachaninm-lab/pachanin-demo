# START HERE — PC-CROP shared team coordination

If you are ACCOUNT_1_CORE or ACCOUNT_2_PRODUCT, do not start a new implementation slice from chat memory alone.

## 1. Read the live Team Hub

https://github.com/pachaninm-lab/pachanin-demo/issues/5469

The issue body defines the team split. The newest comments are the live CLAIM / DEPENDENCY / HANDOFF / DECISION / CONFLICT / CHECKPOINT queue.

## 2. Read MASTER v2.1

https://github.com/pachaninm-lab/pachanin-demo/blob/coordination/pc-crop-team-hub/coordination/master-v2.1/INDEX.md

Original normative DOCX:
`!!!!! PC-CROP_CODEX_MASTER_TZ_v2.1_2026-09-12.docx`

SHA-256:
`7b81a6de53081b7eec1edfa654ae73a4597137db61e99652037f89544f309e42`

## 3. Read the team contract

https://github.com/pachaninm-lab/pachanin-demo/blob/coordination/pc-crop-team-hub/coordination/TEAM_OPERATING_CONTRACT.md

## 4. Refresh facts

Always re-fetch:
- live `main`;
- active PR heads;
- changed files;
- current CI;
- relevant production state.

Never rely on the bootstrap SHA if GitHub has advanced.

## 5. Coordinate before coding

If safe and non-overlapping: post CLAIM and work.

If you need the other contour: post DEPENDENCY.

If you have finished a producer contract/surface: post HANDOFF.

If work overlaps in semantic authority: post CONFLICT and stop the overlapping implementation, not the whole project.

If a decision affects both contours: record DECISION in the Team Hub.

## Current bootstrap ownership

- ACCOUNT_1_CORE: R1 server/domain/authority to PRODUCTION_PASS.
- ACCOUNT_2_PRODUCT: UX/UI + FGIS + bank/finance product/integration surfaces.

The owner is not the day-to-day dispatcher. Cross-contour coordination belongs in GitHub.
