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
- apps/web/tests/unit/platformV7PrimaryRoleCockpit.test.tsx
- apps/web/tests/unit/platformV7OperationalRoleCockpit.test.tsx
- apps/web/tests/unit/platformV7RoleUxRegressions.test.ts
- apps/web/tests/unit/platformV7UxGate.test.ts
- apps/web/tests/unit/roleContinuityLayouts.test.tsx
- apps/web/tests/unit/platformV7FieldRolesIsolation.test.ts
- docs/platform-v7/audit/**
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md

ORDER:
1. Seller cabinet functional pass.
2. Buyer cabinet functional pass.
3. Bank cabinet functional pass.
4. Operator / executive control pass where exact files exist.
5. Compliance pass.
6. Lab / elevator pass.
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

READINESS: 72% honest readiness. UX shell is more stable, but role-by-role functional structure is not complete yet.
