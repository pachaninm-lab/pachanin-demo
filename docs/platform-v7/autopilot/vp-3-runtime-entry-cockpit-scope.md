VP-3 Runtime Entry Cockpit Scope

Goal: convert platform-v7 entry cockpit from static display to runtime-bound product surface.

Allowed files:
- apps/web/app/platform-v7/page.tsx
- apps/web/lib/platform-v7/runtime/entry-cockpit-state.ts
- apps/web/tests/unit/platformV7VisibleEntry.test.ts
- apps/web/tests/unit/platformV7RuntimeEntryCockpit.test.ts
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md

Acceptance:
- page does not own operational blockers, lanes, or roles arrays
- cockpit state is produced outside the component
- page renders from runtime-facing state
- empty and error-safe states exist
- tests prevent static-only regression
- SOT does not claim full mature product completion
