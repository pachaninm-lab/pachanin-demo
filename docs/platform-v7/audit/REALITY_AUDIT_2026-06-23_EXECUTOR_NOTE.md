# platform-v7 executor note — reality audit 2026-06-23

This branch is intentionally docs-only. It does not implement seller cabinet UI or runtime changes.

## Why this exists

#1981 requires an audit before and alongside role-cabinet passes. #1982 requires real-operation readiness to be split into explicit domains instead of being implied by UI work.

## Next executor instruction

After this PR is merged, continue with #1976:

1. identify exact seller cabinet file paths;
2. touch only those files;
3. make the seller first screen answer event, blocker, money at risk, responsible party, next action;
4. ensure each CTA routes to a real route/action/section or safe disabled state;
5. run #1978 review gate and #1979 QA checklist.

If exact seller files cannot be identified, do not broaden to all `apps/web/app/platform-v7`. Record the blocker in #1974 and create a docs-only mapping PR instead.
