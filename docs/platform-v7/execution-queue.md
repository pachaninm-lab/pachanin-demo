# platform-v7 execution queue

CURRENT: Tighten the elevator cabinet first screen so the role sees the operational contract before workflow details.

GOAL: keep platform-v7 moving toward real execution readiness without mixing UI polish with runtime, data, money, documents, integrations, load or ops layers.

CURRENT ALLOWED:
- apps/web/app/platform-v7/elevator/page.tsx
- apps/web/tests/unit/platformV7ElevatorFirstScreen.test.ts
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

CURRENT CHECKS:
- first screen shows what happened, what is blocked, money at risk, accountable roles and next action;
- visible first-screen actions route to real in-page sections;
- elevator cabinet does not claim live readiness;
- shell, mobile layout and role isolation remain stable;
- no public landing, backend, API, DB, auth, session, package or lockfile changes.

NEXT:
- Layer: Driver / field role functional first-screen review.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - next execution layer names the exact driver or field route/component/test scope before code changes;
  - first screen criteria remain explicit: what happened, what is blocked, money at risk, owner and next action;
  - every visible action must route to a real route/action/section or have a clear disabled reason;
  - shell, mobile layout and role isolation remain stable;
  - maturity remains controlled-pilot / pre-integration;
  - readiness remains 72% until runtime or a broader verified functional layer is merged.

ORDER:
1. Stable shell boundary is active from #2038.
2. Role-locked login handoff is active from #2036/#2037.
3. Mobile protected header action recovery is active from #2055.
4. Public mobile brand title recovery is active from #2056.
5. Elevator first-screen pass is current.
6. Then driver / field and regression route audit.

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
- #2045 mobile header pass.
- #2046 protected mobile header recovery.
- #2048 shell copy normalizer replacement.
- #2049 public entry login split.
- #2051 registration completion route guard.
- #2053 docs queue sync.
- #2055 protected mobile header action recovery.
- #2056 public mobile brand title recovery.

READINESS: 72% honest readiness. Runtime layers and remaining role-by-role functional passes are still incomplete.
