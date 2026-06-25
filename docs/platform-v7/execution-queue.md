# platform-v7 execution queue

CURRENT: Tighten the elevator cabinet first screen so the top of the role cabinet shows the operational state before secondary workflow details.

GOAL: keep protected platform-v7 cabinets usable as execution workspaces, not decorative dashboards: first screen must expose what happened, what is blocked, money at risk, owner and next action.

CURRENT ALLOWED:
- apps/web/app/platform-v7/elevator/page.tsx
- apps/web/tests/unit/platformV7ElevatorFirstScreen.test.ts
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

CURRENT CHECKS:
- elevator first screen appears before collapsible workflow details;
- first screen shows fact, blocker, money at risk, accountable roles and next action;
- visible action buttons route to real sections on the same cabinet;
- mobile 390px layout keeps the new first-screen grid single-column and actions full-width;
- no public landing, backend, API, DB, auth, session, package or lockfile changes;
- no live-readiness or unsupported maturity claims.

NEXT:
- Layer: driver / field cabinet first-screen pass.
- Allowed files:
  - apps/web/app/platform-v7/driver/page.tsx
  - apps/web/tests/unit/platformV7DriverFirstScreen.test.ts
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - driver first screen shows trip fact, blocker, money/document impact, owner and next action;
  - all visible actions route to real route/action/section or explain disabled state;
  - shell, mobile layout and role isolation remain stable;
  - maturity remains controlled-pilot / pre-integration;
  - readiness remains 72% until runtime or a broader verified functional layer is merged.

ORDER:
1. Stable shell boundary is active from #2038.
2. Role-locked login handoff is active from #2036/#2037.
3. Mobile protected header action recovery is complete.
4. Public mobile entry regression is repaired in #2053.
5. Elevator first-screen pass is current.
6. Then driver / field first-screen pass.
7. Then regression route audit.

RULES:
- one PR = one narrow layer;
- no apps/landing;
- no backend/API/DB/auth/session changes inside UI PRs;
- no package or lockfiles;
- Netlify plus GitHub Actions green before merge;
- Vercel and Deno deprecated external statuses are not active gate for platform-v7.

DONE:
- #2028 seller CSS leak guard.
- #2029 state sync after mobile shell stabilization.
- #2031 seller mobile CSS text leak fix.
- #2032 mobile shell stabilization follow-up.
- #2034 public registration CTA recovery.
- #2036 public role-scoped registration handoff.
- #2037 public login role handoff.
- #2038 stable shell boundary.
- #2040 single shell copy normalizer.
- #2041 public role cards login handoff.
- #2042 access copy polish.
- #2045/#2046 mobile protected header action recovery.
- #2048/#2049 login/register entry polish.
- #2051 role login flow polish.
- #2053 public mobile entry regression repair.

READINESS: 72% honest readiness. Runtime layers and remaining role-by-role functional passes are still incomplete.
