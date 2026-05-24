# platform-v7 execution queue

CURRENT: PR 5.2 — Server Action Wrappers

DONE:
- Stage 3 — RBAC / ACL / roles / access rights
- Stage 4 — MoneyTree / Document Matrix / Bank Basis / Action Boundary / Final QA
- Stage 5.0 — Runtime Inventory
- Stage 5.3 — Persistence Port Interfaces
- Stage 5.4 — DTO / Validation Schemas
- PR 5.1 — Application Service Layer
- PR 5.5 — Mock Persistence Adapter

LOCKED UNTIL 5.2 GREEN:
- PR 5.6 — Runtime Integration Tests
- PR 5.7 — Final Stage 5 QA
- PR 6.x — External Adapter Emulators
- AI Gateway
- Product Entry / Onboarding
- Theme / Visual
- Role Cockpit / UX

ACTIVE RULES:
- Do not rewrite platform-v7 from scratch.
- Do not touch apps/landing.
- Do not start UI, adapters, onboarding, visual polish, AI gateway or theme-pass before PR 5.2 is closed and green.
- Keep maturity wording at controlled-pilot / pre-integration.
- Do not overstate live external connection status or product maturity.
- One PR = one narrow reviewable layer.

NEXT AUTOPILOT STEP:
- Run node scripts/p7-autopilot-dispatcher.mjs.
- Use docs/platform-v7/autopilot/prompts/current-codex-task.md as the implementation prompt.
- Use docs/platform-v7/autopilot/prompts/current-review-task.md as the review prompt.
- Do not advance from PR 5.2 until its PR is green, reviewed and manually merged.

AUTOPILOT STATE RULES:
- The dispatcher may generate prompts and progress from state and queue.
- The dispatcher must not mark locked work as current while the current step is not green, closed, mergeable or merged.
- The dispatcher must not update readiness percent as if work merged.
- The dispatcher must not remove forbidden zones.
- The dispatcher must not auto-merge.