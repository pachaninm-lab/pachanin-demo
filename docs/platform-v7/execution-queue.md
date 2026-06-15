# platform-v7 execution queue

CURRENT: Owner-side live-интеграции (§43) — договоры, доступы, credentials, security/legal review, реальные пилот-сделки; код controlled-pilot готов (M3-1…M3-7 и 10-PR закрыты)

CURRENT ALLOWED:
- apps/web/tests/unit/**
- apps/web/tests/setup.ts
- apps/web/components/v7r/**
- apps/web/components/platform-v7/**
- apps/web/app/platform-v7/**
- apps/web/lib/platform-v7/**
- apps/web/lib/v7r/**
- apps/web/styles/**
- packages/domain-core/src/execution-simulation/**
- .github/workflows/dependency-review.yml
- .github/workflows/automerge.yml
- .github/workflows/platform-v7-autopilot-guard.yml
- .github/workflows/platform-v7-autopilot-issue-executor-dry-run.yml
- .github/workflows/platform-v7-autopilot-executor-wiring.yml
- .github/workflows/web-unit.yml
- scripts/p7-autopilot-issue-executor-dry-run.mjs
- scripts/p7-autopilot-issue-executor-pr-wiring.mjs
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md
- docs/platform-v7/**

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
