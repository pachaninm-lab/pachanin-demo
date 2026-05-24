# platform-v7 execution queue

CURRENT: PR 5.1 — Application Service Layer

DONE:
- Stage 3 — RBAC / ACL / roles / access rights
- Stage 4 — MoneyTree / Document Matrix / Bank Basis / Action Boundary / Final QA
- Stage 5.0 — Runtime Inventory
- Stage 5.3 — Persistence Port Interfaces
- Stage 5.4 — DTO / Validation Schemas

LOCKED UNTIL 5.1 GREEN:
- PR 5.5 — Mock Persistence Adapter
- PR 5.2 — Server Action Wrappers
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
- Do not start UI, adapters, onboarding, visual polish, mock persistence, server actions, AI gateway or theme-pass before PR 5.1 is closed and green.
- Keep maturity wording at controlled-pilot / pre-integration.
- No production-ready, fully live, fully integrated, platform guarantees payment, or platform releases money claims.
- One PR = one narrow, reviewable layer.

NEXT AUTOPILOT STEP:
- Use docs/platform-v7/autopilot/prompts/codex-pr-5.1.md as the implementation prompt.
- Use docs/platform-v7/autopilot/prompts/claude-review-pr-5.1.md as the review prompt.
