# platform-v7 execution queue

CURRENT: Restore the complete protected mobile header action set with a stable compact order and logout pinned to the far right.

GOAL: keep protected platform-v7 cabinets usable on mobile without hiding required work tools or creating role-lock, shell, route or maturity regressions.

CURRENT ALLOWED:
- apps/web/app/platform-v7/layout.tsx
- apps/web/components/platform-v7/RoleAssistantWidget.tsx
- apps/web/components/platform-v7/SupportHeaderIcon.tsx
- apps/web/tests/unit/platformV7RoleAssistantWidget.test.ts
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

CURRENT CHECKS:
- mobile header actions stay visible in compact order: search, theme, notepad, role notices, support, calculator, logout;
- logout remains the far-right action;
- role assistant no longer hides logout on mobile;
- support/search are available in the protected mobile shell;
- no public landing, backend, API, DB, auth, session, package or lockfile changes;
- no live-readiness or unsupported maturity claims.

NEXT:
- Layer: elevator cabinet functional review after #2045 is green and merged.
- Success criteria:
  - first screen answers what happened, what is blocked, money at risk, owner and next action;
  - every visible action routes to a real route/action/section or has a clear disabled reason;
  - shell, mobile layout and role isolation remain stable;
  - maturity remains controlled-pilot / pre-integration;
  - readiness remains 72% until runtime or a broader verified functional layer is merged.

ORDER:
1. Stable shell boundary is active in #2038.
2. Role-locked login handoff is active from #2036/#2037.
3. Mobile protected header action recovery is current.
4. Elevator remains next.
5. Then driver / field and regression route audit.

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

READINESS: 72% honest readiness. Runtime layers and remaining role-by-role functional passes are still incomplete.
