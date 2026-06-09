# platform-v7 execution queue

CURRENT: VP-4: Product Entry

CURRENT ALLOWED:
- apps/web/app/platform-v7/open/page.tsx
- apps/web/app/platform-v7/role-preview/page.tsx
- apps/web/app/platform-v7/onboarding/page.tsx
- apps/web/app/platform-v7/actions/runtime-actions.ts
- apps/web/lib/platform-v7/runtime/open-walkthrough.ts
- apps/web/tests/unit/platformV7ProductEntryOnboarding.test.ts
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md

DONE:
- VP-1: Visible Execution Entry Cockpit
- VP-2: Runtime QA Stabilization
- VP-3: Runtime-bound Entry Cockpit

NEXT:
- VP-4 open route
- VP-4 role preview route
- VP-4 onboarding route
- VP-4 focused test

RULES:
- one PR equals one narrow layer
- no apps/landing
- no API routes
- no DB
- no package or lockfiles
