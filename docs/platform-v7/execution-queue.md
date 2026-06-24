# platform-v7 execution queue

CURRENT: Role cabinet functional pass.

GOAL: every role cabinet must show within the first screen: what happened, what is blocked, money impact, responsible party, evidence basis and one next action.

CURRENT ALLOWED:
- apps/web/app/platform-v7/seller/page.tsx
- apps/web/app/platform-v7/buyer/page.tsx
- apps/web/app/platform-v7/bank/page.tsx
- apps/web/app/platform-v7/operator/page.tsx
- apps/web/app/platform-v7/compliance/page.tsx
- apps/web/app/platform-v7/lab/page.tsx
- apps/web/app/platform-v7/elevator/page.tsx
- apps/web/app/platform-v7/arbitrator/page.tsx
- apps/web/app/platform-v7/surveyor/page.tsx
- apps/web/app/platform-v7/driver/field/page.tsx
- apps/web/app/platform-v7/field/page.tsx
- apps/web/components/platform-v7/RoleExecutionCockpit.tsx
- apps/web/components/platform-v7/RoleExecutionSummary.tsx
- apps/web/components/platform-v7/LiveApiStatusBar.tsx
- apps/web/styles/platform-v7-mobile-hardening.css
- apps/web/components/v7r/ShellCopyNormalizer.tsx
- apps/web/tests/unit/platformV7FinalShellStaticGate.test.ts
- apps/web/tests/unit/platformV7PrimaryRoleCockpit.test.tsx
- apps/web/tests/unit/platformV7OperationalRoleCockpit.test.tsx
- apps/web/tests/unit/platformV7RoleUxRegressions.test.ts
- apps/web/tests/unit/platformV7UxGate.test.ts
- apps/web/tests/unit/roleContinuityLayouts.test.tsx
- apps/web/tests/unit/platformV7FieldRolesIsolation.test.ts
- docs/platform-v7/audit/**
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md

NEXT:
- Layer: continue role cabinet functional pass after buyer, bank, compliance and lab boundary guards.
- Allowed files:
  - exact role page from CURRENT ALLOWED;
  - matching unit/static guard from CURRENT ALLOWED;
  - docs/platform-v7/audit/** only when recording audit evidence;
  - docs/platform-v7/autopilot/** and docs/platform-v7/execution-queue.md only for state updates.
- Success criteria:
  - touched cabinet shows first-screen facts: what happened, blocker, money impact, responsible party, evidence basis and one next action;
  - actions route to real page/action/section or have a clear disabled reason;
  - current status remains controlled-pilot / pre-integration;
  - no apps/landing, backend, DB, auth/session/API, package or lockfile changes;
  - readiness remains 72% until runtime or a broader verified functional layer is merged.

ORDER:
1. Seller cabinet functional pass — first-screen control, handoff continuity and route-card continuity merged through #1998.
2. Buyer cabinet functional pass — first-screen control guard merged in #2000.
3. Bank cabinet functional pass — money-boundary guard merged in #2001.
4. Operator / executive control pass where exact files exist — operator first-screen control merged in #1996.
5. Compliance pass — risk/admission boundary guard merged in #2002.
6. Lab / elevator pass — lab quality-protocol boundary guard merged in #2003; elevator remains next.
7. Driver / field pass.
8. Regression tests and route/button audit.

RULES:
- one PR = one narrow layer;
- no apps/landing;
- no backend or persistence expansion;
- no new external connectivity claims;
- no package or lockfiles;
- Netlify + GitHub Actions green before merge;
- Vercel/Deno deprecated external statuses are not active gate for platform-v7.

DONE:
- #1966 entry surface mobile gap audit.
- #1968 mobile shell and runtime copy hardening.
- #1969 role-cabinet workspace density CSS pass.
- #1995 state advanced to seller cabinet functional pass.
- #1996 operator first-screen control.
- #1997 seller handoff continuity.
- #1998 seller route-card continuity.
- #1999 state after seller/operator pass.
- #2000 buyer first-screen control guard.
- #2001 bank money-boundary guard.
- #2002 compliance risk/admission boundary guard.
- #2003 lab quality-protocol boundary guard.

READINESS: 72% honest readiness. UX shell, seller/operator cabinet clarity and buyer/bank/compliance/lab guard coverage improved, but runtime layers and remaining role-by-role functional passes are still incomplete.
