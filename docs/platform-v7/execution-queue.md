# platform-v7 execution queue

CURRENT: Select exact driver field regression route audit scope before code changes.

GOAL: keep platform-v7 moving toward real execution readiness without mixing UI polish with runtime, data, money, documents, integrations, load or ops layers.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

CURRENT CHECKS:
- audit scope is selected before code changes;
- exact next route/component/test scope is named before the code PR opens;
- route audit covers visible action wiring, role isolation, shell consistency and mobile 390x844 constraints;
- maturity remains controlled-pilot / pre-integration;
- readiness remains 72% until runtime or a broader verified functional layer is merged;
- no public landing, backend, API, DB, auth, session, package or lockfile changes.

NEXT:
- Layer: Driver field route regression fix.
- Proposed files for the next code PR:
  - apps/web/app/platform-v7/driver/field/page.tsx
  - apps/web/tests/unit/platformV7DriverFieldRouteRegression.test.ts
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - all visible driver / field actions point to real in-page sections, real routes, or explicit disabled states;
  - no driver screen link exposes bank, buyer, price, payout, release or unrelated role control;
  - first-screen content remains above workflow details;
  - mobile 390x844 remains single-column, touch-safe, safe-area aware and without horizontal overflow;
  - maturity remains controlled-pilot / pre-integration;
  - readiness remains 72% until runtime or a broader verified functional layer is merged.

ORDER:
1. Stable shell boundary is active from #2038.
2. Role-locked login handoff is active from #2036/#2037.
3. Mobile protected header action recovery is active from #2055.
4. Public mobile brand title recovery is active from #2056.
5. Elevator first-screen pass is active from #2057.
6. Driver / field first-screen scope is active from #2058.
7. Driver / field first-screen pass is active from #2059.
8. Then driver field regression route audit.

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
- #2058 driver field first-screen scope selection.
- #2059 driver field first-screen pass.

READINESS: 72% honest readiness. Runtime layers and remaining role-by-role functional passes are still incomplete.
