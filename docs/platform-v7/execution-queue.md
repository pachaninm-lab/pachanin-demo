# platform-v7 execution queue

CURRENT: PR 7.1 — AI Gateway Contracts

DONE:
- Stage 3 — RBAC / ACL / roles / access rights
- Stage 4 — MoneyTree / Document Matrix / Bank Basis / Action Boundary / Final QA
- Stage 5.0 — Runtime Inventory
- Stage 5.3 — Persistence Port Interfaces
- Stage 5.4 — DTO / Validation Schemas
- PR 5.1 — Application Service Layer
- PR 5.5 — Mock Persistence Adapter
- PR 5.2 — Server Action Wrappers
- PR 5.6 — Runtime Integration Tests
- PR 5.7 — Final Stage 5 QA
- PR 5.8 — Stage 5 Stability Wiring
- PR 6.1 — External Adapter Emulator Contracts
- PR 6.2 — Bank Adapter Emulator
- PR 6.3 — FGIS Adapter Emulator
- PR 6.4 — EDO Adapter Emulator
- PR 6.5 — EPD / Logistics Adapter Emulator
- PR 6.6 — External Adapter Runtime QA

LOCKED UNTIL 7.1 GREEN:
- PR 7.2 — AI Gateway Provider Port
- PR 7.3 — AI Gateway Mock Provider
- PR 7.4 — AI Gateway Runtime QA
- Product Entry / Onboarding
- Theme / Visual
- Role Cockpit / UX

ACTIVE RULES:
- Do not rewrite platform-v7 from scratch.
- Do not touch apps/landing.
- Do not start UI, onboarding, visual polish, AI gateway implementation, provider runtime or theme-pass during PR 7.1.
- PR 7.1 is contracts-only: define AI gateway boundaries, safety terms and review rules without implementing AI runtime behavior.
- Keep maturity wording at controlled-pilot / pre-integration.
- Do not overstate external connection status, AI capability status or product maturity.
- One PR = one narrow reviewable layer.
- AI Gateway must remain explicitly pre-integration and must not imply live provider access, automated decisions, guarantees or binding actions.

NEXT AUTOPILOT STEP:
- Prepare PR 7.1 — AI Gateway Contracts.
- Use docs/platform-v7/autopilot/prompts/current-codex-task.md as the implementation prompt.
- Use docs/platform-v7/autopilot/prompts/current-review-task.md as the review prompt.
- Do not advance to PR 7.2 until PR 7.1 is green, reviewed and merged.

AUTOPILOT STATE RULES:
- The dispatcher may generate prompts and progress from state and queue.
- The dispatcher must not mark locked work as current while the current step is not green, closed, mergeable or merged.
- The dispatcher must not update readiness percent as if work merged.
- The dispatcher must not remove forbidden zones.
- The dispatcher must not auto-merge.
