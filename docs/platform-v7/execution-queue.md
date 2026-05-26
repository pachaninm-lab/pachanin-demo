# platform-v7 execution queue

CURRENT: Workflow maintenance baseline

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
- PR 7.1 — AI Gateway Contracts
- PR 7.2 — AI Gateway Provider Port
- PR 7.3 — AI Gateway Mock Provider
- PR 7.4 — AI Gateway Runtime QA
- Qodana #1423 — CI-only report-mode baseline

NEXT AUTOPILOT STEP:
- Prepare a workflow maintenance baseline as a separate PR.
- Keep it non-product and reviewable.
- Do not touch product code, UI, API routes, DB, runtime, adapters or lockfiles.
- Use docs/platform-v7/autopilot/prompts/current-codex-task.md as the implementation prompt.
- Use docs/platform-v7/autopilot/prompts/current-review-task.md as the review prompt.

RULES:
- Do not touch apps/landing.
- Keep maturity wording at controlled-pilot / pre-integration.
- One PR = one narrow reviewable layer.
- Live integrations remain out of scope until credentials, agreements and explicit approval exist.
