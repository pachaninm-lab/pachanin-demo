# platform-v7 execution queue

CURRENT: Public role cards hand off exactly one selected role to login; login no longer exposes repeat cabinet selection and keeps registration separate.

GOAL: keep public entry, login, registration and protected cabinets on one stable platform shell boundary without creating role-lock bypasses or false readiness claims.

CURRENT ALLOWED:
- apps/web/app/platform-v7/login/page.tsx
- apps/web/components/platform-v7/PublicEntryCleanup.tsx
- apps/web/components/platform-v7/PublicRegistrationEntryPatch.tsx
- apps/web/tests/unit/platformV7PublicRegistrationPatch.test.ts
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

NEXT:
- Layer: elevator cabinet functional review after role-locked login handoff is green and merged.
- Success criteria:
  - role is selected only on the public main role grid;
  - login receives the role through `?role=` or the pending-role session handoff;
  - login does not render a role select/dropdown;
  - registration remains visible as a separate button;
  - protected cabinet routes keep header, shell tools and bottom navigation after public/login navigation;
  - maturity remains controlled-pilot / pre-integration;
  - no apps/landing, package or lockfile changes;
  - readiness remains 72% until runtime or a broader verified functional layer is merged.

ORDER:
1. Stable shell boundary is active in #2038.
2. Role-locked login handoff is current.
3. Seller, buyer, bank, operator, compliance and lab guards are already covered.
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

READINESS: 72% honest readiness. Runtime layers and remaining role-by-role functional passes are still incomplete.
