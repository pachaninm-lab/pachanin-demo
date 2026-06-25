# platform-v7 execution queue

CURRENT: Keep a single protected shell copy normalizer before AppShellV4 without changing routes, runtime or maturity.

GOAL: keep protected platform-v7 cabinets readable and stable by preventing duplicate shell copy normalization while preserving the current mobile header action recovery.

CURRENT ALLOWED:
- apps/web/app/platform-v7/layout.tsx
- apps/web/components/platform-v7/PlatformV7LayoutClient.tsx
- apps/web/tests/unit/platformV7FinalShellStaticGate.test.ts
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

CURRENT CHECKS:
- server and client protected layouts mount exactly one ShellCopyNormalizer;
- the normalizer stays before AppShellV4;
- protected shell tools keep the current order: calculator, notepad, support, role assistant, page content;
- the compact mobile header action recovery from #2046 remains intact;
- no public landing, backend, API, DB, auth, session, package or lockfile changes;
- no live-readiness or unsupported maturity claims.

NEXT:
- Layer: Queue elevator cabinet functional review.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - next execution layer names the exact elevator route/component/test scope before code changes;
  - first screen criteria remain explicit: what happened, what is blocked, money at risk, owner and next action;
  - every visible action must route to a real route/action/section or have a clear disabled reason;
  - shell, mobile layout and role isolation remain stable;
  - maturity remains controlled-pilot / pre-integration;
  - readiness remains 72% until runtime or a broader verified functional layer is merged.

ORDER:
1. Stable shell boundary is active from #2038.
2. Role-locked login handoff is active from #2036/#2037.
3. Mobile protected header action recovery is active from #2046.
4. Single shell copy normalizer is current.
5. Queue the exact elevator cabinet scope next.
6. Then execute the elevator pass in a separate narrow PR.
7. Then driver / field and regression route audit.

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
- #2041 public role cards login handoff.
- #2042 access copy polish.
- #2046 protected mobile header action recovery.

READINESS: 72% honest readiness. Runtime layers and remaining role-by-role functional passes are still incomplete.
