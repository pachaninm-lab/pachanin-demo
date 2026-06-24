# platform-v7 execution queue

CURRENT: Seller mobile inline style text leak fix; next role pass remains elevator cabinet functional review.

GOAL: keep role cabinets stable on mobile with visible shell, role dock, no horizontal overflow, and clear first-screen execution context.

CURRENT ALLOWED:
- apps/web/app/platform-v7/layout.tsx
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
- apps/web/styles/platform-v7-entry-fix.css
- apps/web/styles/platform-v7-mobile-hardening.css
- apps/web/styles/platform-v7-mobile-reflow-p0.css
- apps/web/styles/platform-v7-shell-restore.css
- apps/web/components/v7r/ShellCopyNormalizer.tsx
- apps/web/tests/unit/platformV7FinalShellStaticGate.test.ts
- apps/web/tests/unit/platformV7PrimaryRoleCockpit.test.tsx
- apps/web/tests/unit/platformV7OperationalRoleCockpit.test.tsx
- apps/web/tests/unit/platformV7RoleUxRegressions.test.ts
- apps/web/tests/unit/platformV7UxGate.test.ts
- apps/web/tests/unit/platformV7MobileShellHardening.test.ts
- apps/web/tests/unit/roleContinuityLayouts.test.tsx
- apps/web/tests/unit/platformV7FieldRolesIsolation.test.ts
- apps/web/tests/unit/platformV7BankPageBasisGuard.test.ts
- docs/platform-v7/audit/**
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md

NEXT:
- Layer: elevator cabinet functional review after mobile shell stabilization.
- Allowed files:
  - exact elevator role page from CURRENT ALLOWED;
  - exact platform-v7 CSS file from CURRENT ALLOWED;
  - matching unit/static guard from CURRENT ALLOWED;
  - docs/platform-v7/audit/** only when recording audit evidence;
  - docs/platform-v7/autopilot/** and docs/platform-v7/execution-queue.md only for state updates.
- Success criteria:
  - mobile shell keeps header logo, menu, work tools and role dock visible without horizontal overflow;
  - elevator cabinet keeps first-screen status, blocker, money impact, responsible party and next action clear;
  - actions route to real page/action/section or have a clear disabled reason;
  - maturity remains controlled-pilot / pre-integration;
  - no apps/landing, package or lockfile changes;
  - readiness remains 72% until runtime or a broader verified functional layer is merged.

ORDER:
1. Seller, buyer, bank, operator, compliance and lab guards are already covered.
2. Elevator remains next.
3. Then driver / field and regression route audit.

RULES:
- one PR = one narrow layer;
- no apps/landing;
- no package or lockfiles;
- Netlify plus GitHub Actions green before merge;
- Vercel and Deno deprecated external statuses are not active gate for platform-v7.

DONE:
- #2028 seller CSS leak guard.
- #2029 state sync after mobile shell stabilization.

READINESS: 72% honest readiness. Runtime layers and remaining role-by-role functional passes are still incomplete.
