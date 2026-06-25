# platform-v7 execution queue

CURRENT: The platform-v7 shell stays mounted across public-to-cabinet navigation; public chrome is hidden by the client pathname controller without replacing the shell tree.

GOAL: keep public entry, login, registration and protected cabinets on one stable platform shell boundary without creating role-lock bypasses or false readiness claims.

CURRENT ALLOWED:
- apps/web/app/platform-v7/layout.tsx
- apps/web/components/platform-v7/PublicRegistrationEntryPatch.tsx
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

NEXT:
- Layer: elevator cabinet functional review after #2038 is green and merged.
- Allowed files:
  - exact elevator role page from next autopilot scope;
  - exact platform-v7 CSS file when needed for mobile/shell correction;
  - matching unit/static guard;
  - docs/platform-v7/audit/** only when recording audit evidence;
  - docs/platform-v7/autopilot/** and docs/platform-v7/execution-queue.md only for state updates.
- Success criteria:
  - public routes render without visible shell chrome;
  - protected cabinet routes keep header, shell tools and bottom navigation after public/login navigation;
  - AppShellV4 remains mounted at the platform-v7 segment boundary;
  - role-lock remains strict and public role choice never opens a protected cabinet;
  - maturity remains controlled-pilot / pre-integration;
  - no apps/landing, package or lockfile changes;
  - readiness remains 72% until runtime or a broader verified functional layer is merged.

ORDER:
1. Public role-scoped registration handoff is merged in #2036.
2. Login role handoff is merged in #2037.
3. Stable shell boundary is active in #2038.
4. Seller, buyer, bank, operator, compliance and lab guards are already covered.
5. Elevator remains next.
6. Then driver / field and regression route audit.

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

READINESS: 72% honest readiness. Runtime layers and remaining role-by-role functional passes are still incomplete.
