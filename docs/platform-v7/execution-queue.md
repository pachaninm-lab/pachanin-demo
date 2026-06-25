# platform-v7 execution queue

CURRENT: Select exact driver field first-screen scope before code changes.

GOAL: keep platform-v7 moving toward real execution readiness without mixing UI polish with runtime, data, money, documents, integrations, load or ops layers.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

CURRENT CHECKS:
- driver / field route scope is selected before code changes;
- exact next code scope is named as apps/web/app/platform-v7/driver/field/page.tsx plus apps/web/tests/unit/platformV7DriverFieldFirstScreen.test.ts;
- first screen criteria remain explicit: what happened, what is blocked, money at risk, owner and next action;
- every visible action must route to a real route/action/section or have a clear disabled reason;
- shell, mobile layout and role isolation remain stable;
- maturity remains controlled-pilot / pre-integration;
- no public landing, backend, API, DB, auth, session, package or lockfile changes.

NEXT:
- Layer: Queue driver field code pass after exact scope selection.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - next execution layer preserves the exact code scope: apps/web/app/platform-v7/driver/field/page.tsx and apps/web/tests/unit/platformV7DriverFieldFirstScreen.test.ts;
  - first screen criteria remain explicit: what happened, what is blocked, money boundary, accountable role and next action;
  - visible actions must route to real in-page sections or disabled states with clear reasons;
  - driver must see own-trip / field context only and no bank, buyer, price, payout or unrelated role control;
  - mobile 390x844 must remain single-column, no horizontal overflow, bottom-safe and touch-safe;
  - maturity remains controlled-pilot / pre-integration;
  - readiness remains 72% until runtime or a broader verified functional layer is merged.

ORDER:
1. Stable shell boundary is active from #2038.
2. Role-locked login handoff is active from #2036/#2037.
3. Mobile protected header action recovery is active from #2055.
4. Public mobile brand title recovery is active from #2056.
5. Elevator first-screen pass is active from #2057.
6. Driver / field first-screen scope is current.
7. Then driver field code pass and regression route audit.

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
- #2057 elevator first-screen pass.

READINESS: 72% honest readiness. Runtime layers and remaining role-by-role functional passes are still incomplete.
