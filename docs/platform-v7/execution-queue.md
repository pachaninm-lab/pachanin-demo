# platform-v7 execution queue

CURRENT: Netlify root entry redirect recovery scope before merge.

GOAL: keep platform-v7 moving toward real execution readiness without mixing UI polish with runtime, data, money, documents, integrations, load or ops layers.

CURRENT ALLOWED:
- apps/web/app/page.tsx
- apps/web/next.config.js
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

CURRENT CHECKS:
- root `/` no longer points users through protected `/platform-v7/control-tower`;
- root `/` routes directly to the public platform-v7 entry;
- root redirect is also declared in Next redirects for host-level recovery;
- maturity remains controlled-pilot / pre-integration;
- readiness remains 72% until runtime or a broader verified functional layer is merged;
- no public landing, backend, API, DB, auth, session, package or lockfile changes.

NEXT:
- Layer: Driver field route regression fix.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Scope intent for the next code PR: driver / field route only, plus its matching unit guard and autopilot docs.
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
8. Public mobile process carousel polish is active in #2062/#2064.
9. Public process stage copy polish is active in #2065.
10. Netlify root entry redirect recovery is active in the current PR.
11. Then driver field regression route audit.

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
- #2065 public process stage copy polish.

READINESS: 72% honest readiness. Runtime layers and remaining role-by-role functional passes are still incomplete.
