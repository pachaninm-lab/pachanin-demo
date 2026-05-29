# platform-v7 execution queue

CURRENT: Runner Dispatch Reliability

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
- CodeQL #1434 — GitHub-native security report-only baseline
- CI Speed #1436 — GitHub Actions speed baseline
- Playwright Smoke #1438 — platform-v7 key route smoke skeleton
- Forbidden Copy #1440 — no-fake-live test expansion
- Mobile Overflow Smoke — 390x844 baseline
- Agent Runner Diagnostics — background coding health check
- Route Smoke Hardening — platform-v7 route availability baseline
- Runner Health

NEXT:
- Keep the next layer limited to runner dispatch reliability.
- Do not change product code, UI, API routes, DB, runtime, adapters or lockfiles.
- Keep generated work PR-only.
- Keep readiness at 72% until generated pull request behavior is verified.

RULES:
- Do not touch apps/landing.
- Keep maturity wording at controlled-pilot / pre-integration.
- One PR = one narrow reviewable layer.
