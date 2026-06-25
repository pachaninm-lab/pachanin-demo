# platform-v7 execution queue

CURRENT: Queue the exact elevator cabinet functional review after public entry, registration and login role-handoff polish reached `main`.

GOAL: make the next elevator pass narrow, reviewable and tied to first-screen execution criteria before any code change touches the cabinet.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

CURRENT CHECKS:
- docs-only state transition;
- no public landing, backend, API, DB, auth, session, package or lockfile changes;
- no live-readiness or unsupported maturity claims;
- readiness remains 72% / controlled-pilot / pre-integration.

NEXT:
- Layer: Confirm elevator cabinet implementation scope before code change.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - next execution layer names the exact elevator route/component/test scope before code changes;
  - target code scope remains limited to `apps/web/app/platform-v7/elevator/page.tsx` and `apps/web/tests/unit/platformV7ElevatorFirstScreen.test.ts` unless the audit proves a smaller component scope is safer;
  - first-screen criteria remain explicit: what happened, what is blocked, money at risk, owner and next action;
  - every visible action must route to a real route/action/section or have a clear disabled reason;
  - shell, mobile layout and role isolation remain stable;
  - maturity remains controlled-pilot / pre-integration;
  - readiness remains 72% until runtime or a broader verified functional layer is merged.

QUEUED CODE SCOPE:
- apps/web/app/platform-v7/elevator/page.tsx
- apps/web/tests/unit/platformV7ElevatorFirstScreen.test.ts

ORDER:
1. Stable shell boundary is active from #2038.
2. Role-locked registration and login handoff are active from #2036/#2037.
3. Mobile protected header recovery and public entry polish are active through #2046/#2048/#2051.
4. Queue the exact elevator cabinet scope now.
5. Execute the elevator first-screen pass in a separate narrow PR.
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
- #2045/#2046 mobile protected header action recovery.
- #2048 public entry work CTA polish.
- #2049/#2050 single shell normalizer cleanup.
- #2051 public entry and role login flow polish.

READINESS: 72% honest readiness. Runtime layers and remaining role-by-role functional passes are still incomplete.
