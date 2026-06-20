# Review current task — API repository boundary (controlled-pilot / pre-integration): DealRepository + PaymentRepository read boundaries over RuntimeCore; runtime adapter default, Prisma adapters disabled behind explicit flags. DB-backed path not active, no live integrations.

Maturity: controlled-pilot / pre-integration.
Do not overstate maturity or imply live external integrations.
Do not change apps/landing, production UI, visual/theme/onboarding, adapters, server actions, AI gateway runtime, DB/migrations or lockfiles unless the current step explicitly allows it.
Do not auto-merge. Human review and green checks are required.

Review the diff, not the agent report.

## Required scope checks

- `apps/landing` diff must be 0.
- UI/visual/theme/onboarding diff must be 0 unless explicitly allowed by the current step.
- adapters/server-actions/AI gateway diff must be 0 unless explicitly allowed by the current step.
- no auto-merge behavior.
- no fake-live or maturity overclaim.

## Current allowed scope

- apps/api/src/modules/deals/**
- apps/api/src/modules/settlement-engine/**
- apps/api/src/common/prisma/**
- apps/api/prisma/**
- apps/api/package.json
- docs/platform-v7/audit/**
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md

## Transition guard

- BLOCKED: API repository boundary (controlled-pilot / pre-integration): DealRepository + PaymentRepository read boundaries over RuntimeCore; runtime adapter default, Prisma adapters disabled behind explicit flags. DB-backed path not active, no live integrations. is not green/closed/mergeable. Dispatcher will not advance to Backend / DB / runtime persistence expansion.

## Queue snapshot

# platform-v7 execution queue

CURRENT: API repository boundary (controlled-pilot / pre-integration): DealRepository + PaymentRepository read boundaries over RuntimeCore; runtime adapter default, Prisma adapters disabled behind explicit flags. DB-backed path not active, no live integrations.

CURRENT ALLOWED:
- apps/api/src/modules/deals/**
- apps/api/src/modules/settlement-engine/**
- apps/api/src/common/prisma/**
- apps/api/prisma/**
- apps/api/package.json
- docs/platform-v7/audit/**
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md

DONE:
- VP-1: Visible Execution Entry Cockpit
- VP-2: Runtime QA Stabilization (slice 1 merged)
- VP-3: Runtime-bound Entry Cockpit
- VP-4: Product Entry (open, role-preview, onboarding — merged via PR #1689)
- VP-2.3: Shell / Role Isolation Guards (165/165 in scope, full run 270 -> 212, no regressions)
- VP-2.2: Server Action Route Contracts (closed in slice 1, verified green)
- VP-2.4: Honesty / Premium Copy Guards (named scope, full run 212 -> 191, no regressions)
- VP-2.5: Remaining Tail + Regression Gate — full web vitest 330 -> 0; web-unit required job added (.github/workflows/web-unit.yml)
- VP-8: Theme token parity — text/border hex -> design tokens across platform-v7 (dark-theme native parity; light preserved)
- VP-5: Driver / Logistics cockpit runtime binding (sourceMeta.runtimeBound)
- VP-6: Bank cockpit runtime binding — amount/basis/documents/journal via runtime; releasedRub invariant 0
- VP-7: Dispute / Evidence binding — hold via runtime money.holdRub, evidence pack from audit sink
- MASTER-ТЗ 3+ M3-0…M3-8: gap-аудит + premium-герой/Smart Collapse по всем ролям, витрина входа, фокусный мобильный вид, доступность WCAG AA, устранение гидратации, микро-анимации
- 10-PR техдоводка: PR-1 tenant/RBAC, PR-2 DB persistence adapter, PR-3 bank callback/reconciliation, PR-4 real-adapter shells, PR-5 UX-gate, PR-6 observability health screens, PR-7 BI runtime binding, PR-8 unified deal lifecycle + offline/conflict, PR-9 access status, PR-10 readiness audit + SOT
- Integration seam: adapter-factory mock↔real, bank-adapter-real + bank-callback, cabinet-level RBAC за фиче-флагом

NEXT (owner-side only — вне кода):
- отметить web-unit как required check в branch protection main
- разблокировать Vercel (account blocked, лимит/биллинг) и подтвердить основной live-deploy
- финальный live QA: визуальный QA тёмной темы на живом Vercel, smoke по ключевым маршрутам, паритет Netlify ↔ Vercel
- затем: договоры (банк/ФГИС/ЭДО/ЭПД), API-доступы и credentials, номинальный счёт, провайдер identity (ЕСИА/СберБизнес ID), реальная БД + миграции, security/legal review, первая controlled pilot сделка

STATUS 2026-06-15: код controlled-pilot готов. Full web vitest GREEN (585 файлов / 3702 теста); ci/tsc, web-unit, build, autopilot-guard, CodeQL — зелёные на каждом PR. Readiness = 100% code-ready for controlled pilot / pre-integration partner onboarding. Остаток — owner-side (см. NEXT).

RULES:
- one PR equals one narrow layer
- no apps/landing
- no API routes
- no DB
- no package or lockfiles
- full web vitest must not degrade (web-unit gate active)


## Review brief

Review API repository boundary (controlled-pilot / pre-integration): DealRepository + PaymentRepository read boundaries over RuntimeCore; runtime adapter default, Prisma adapters disabled behind explicit flags. DB-backed path not active, no live integrations. strictly against the state allowed scope and queue.

Return PASS or BLOCKED. If BLOCKED, include blocker, file, why risk and exact fix.
