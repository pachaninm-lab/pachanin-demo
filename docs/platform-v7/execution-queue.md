# platform-v7 execution queue

CURRENT: Public role cards now enter registration as role-scoped applications without opening protected cabinets.

GOAL: keep the public entry, login and registration routes coherent without creating role-lock bypasses; protected role cabinets remain strict and readiness remains honest.

CURRENT ALLOWED:
- apps/web/app/platform-v7/register/page.tsx
- apps/web/components/platform-v7/PublicRegistrationEntryPatch.tsx
- apps/web/tests/unit/platformV7PublicRegistrationPatch.test.ts
- apps/web/tests/unit/platformV7PublicRegisterRoleSelection.test.ts
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md

NEXT:
- Layer: elevator cabinet functional review after public registration role selection is green.
- Allowed files:
  - exact elevator role page from next autopilot scope;
  - exact platform-v7 CSS file when needed for mobile/shell correction;
  - matching unit/static guard;
  - docs/platform-v7/audit/** only when recording audit evidence;
  - docs/platform-v7/autopilot/** and docs/platform-v7/execution-queue.md only for state updates.
- Success criteria:
  - public role cards lead to registration with the selected role preserved;
  - existing users still have a login action;
  - registration role choice is an application field, not a role-lock bypass;
  - maturity remains controlled-pilot / pre-integration;
  - no apps/landing, package or lockfile changes;
  - readiness remains 72% until runtime or a broader verified functional layer is merged.

ORDER:
1. Public role-scoped registration handoff is active in #2036.
2. Seller, buyer, bank, operator, compliance and lab guards are already covered.
3. Elevator remains next.
4. Then driver / field and regression route audit.

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

READINESS: 72% honest readiness. Runtime layers and remaining role-by-role functional passes are still incomplete.
