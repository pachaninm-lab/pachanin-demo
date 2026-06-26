# platform-v7 execution queue

CURRENT: Driver / field mobile touch target hardening.

GOAL: keep platform-v7 moving toward real execution readiness without mixing public visual polish with runtime, data, money, documents, integrations, load or ops layers.

CURRENT ALLOWED:
- apps/web/app/platform-v7/driver/field/page.tsx
- apps/web/tests/unit/platformV7DriverFieldFirstScreen.test.ts
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

CURRENT CHECKS:
- #2078 is merged and driver / field follow-up audit moved into a narrow code pass;
- fix only driver / field mobile touch target defects found in the audit;
- keep first-screen actions route-backed or section-backed;
- keep mobile 390x844 single-column, safe-area aware and without horizontal overflow;
- keep calculator, notepad and unrelated role controls out of the driver field surface;
- no driver copy implies payout, price, bank release or unrelated money control;
- keep maturity controlled-pilot / pre-integration;
- readiness remains 72% until runtime or a broader verified functional layer is merged;
- no apps/landing, backend, API, DB, auth, session, package or lockfile changes.

NEXT:
- Layer: Driver / field follow-up audit closure or next role-specific field role pass after this PR is green.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Scope intent for the next code PR: move only if a concrete role-specific defect is found; do not widen to all platform-v7 routes.
- Success criteria:
  - first screen still answers what happened, what is blocked, money at risk, owner and next action;
  - mobile 390x844 remains single-column, touch-safe, safe-area aware and without horizontal overflow;
  - buttons remain real, route-backed, section-backed or explicitly disabled;
  - no copy implies payout, price, bank, release or unrelated role control;
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
9. Public process stage copy polish is active from #2065.
10. Netlify root entry redirect recovery is active from root-entry-redirect.
11. Public hero copy polish is active from #2067/#2068/#2070/#2071.
12. Driver field route anchor hardening is active from #2072 after stale #2061 was superseded.
13. Public entry human copy pass is active from #2075.
14. Public register header actions pass is active from #2076.
15. Public register visual system pass is active from #2077.
16. Driver / field follow-up audit is active from #2078.
17. Driver / field mobile touch target hardening is active here.

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
- #2067 public hero copy polish.
- #2068 public hero mobile composition.
- #2070 public hero mobile sizing.
- #2071 public entry copy proofread.
- #2072 driver field route anchor hardening.
- #2075 public entry human copy pass.
- #2076 public register header actions pass.
- #2077 public register visual system pass.
- #2078 driver field follow-up audit.
- root-entry-redirect Netlify root entry redirect recovery.

READINESS: 72% honest readiness. Runtime layers and remaining role-by-role functional passes are still incomplete.
