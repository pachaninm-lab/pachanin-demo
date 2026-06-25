# platform-v7 execution queue

CURRENT: Elevator cabinet functional review after merged public entry, role-locked login, registration CTA and stable shell boundary fixes.

GOAL: keep public entry, login, registration and protected cabinets on one stable platform shell boundary without creating role-lock bypasses or false readiness claims.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

NEXT:
- Layer: elevator cabinet functional review.
- Success criteria:
  - first screen states what happened, what is blocked, who owns the next step and what action is available;
  - blocked actions have clear reasons and do not imply live release or automatic integration;
  - calculator and notepad remain shell tools only where the protected cabinet shell is active;
  - mobile 390x844 has no horizontal overflow or bottom-tool collision;
  - role-lock is not bypassed from public login or registration handoff;
  - maturity remains controlled-pilot / pre-integration;
  - no apps/landing, package or lockfile changes;
  - readiness remains 72% until runtime or a broader verified functional layer is merged.

ORDER:
1. Stable shell boundary is active in #2038.
2. Role-locked login handoff is merged in #2041.
3. Login access copy polish is merged in #2042.
4. Elevator remains next.
5. Then driver / field and regression route audit.

RULES:
- one PR = one narrow layer;
- no apps/landing;
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
- #2041 role-locked login from public role grid.
- #2042 login access copy polish.

READINESS: 72% honest readiness. Runtime layers and remaining role-by-role functional passes are still incomplete.
