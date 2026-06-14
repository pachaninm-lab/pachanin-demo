# platform-v7 execution queue

CURRENT: MASTER-ТЗ 3+ M3-0 — docs-only фиксация + gap-аудит (внутренний execution-контур в основном закрыт; остаток = доводка M3-1…M3-7 и live-интеграции)

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
- VP-2.5: Remaining Tail + Regression Gate — full web vitest 330 -> 0 (3607/3607 green); web-unit required job added (.github/workflows/web-unit.yml)
- VP-8: Theme token parity — text/border hex -> design tokens across 171 platform-v7 pages & components (dark-theme native parity; light theme preserved); full vitest stays 3607/3607 green
- VP-5: Driver / Logistics cockpit runtime binding — driver mission from execution-source runtime (sourceMeta.runtimeBound)
- VP-6: Bank cockpit runtime binding — amount/basis/documents/journal via runtime; releasedRub invariant 0
- VP-7: Dispute / Evidence binding — hold via runtime money.holdRub, evidence pack from audit sink

NEXT:
- owner-only: разблокировать Vercel (account blocked), отметить web-unit как required check,
  ротация VERCEL_TOKEN, включить dependency graph. Затем — VP-8 визуальный QA тёмной темы на живом деплое.
- Allowed files:
  - .github/workflows/web-unit.yml
  - .github/workflows/platform-v7-autopilot-guard.yml
  - .github/workflows/platform-v7-autopilot-issue-executor-dry-run.yml
  - .github/workflows/platform-v7-autopilot-executor-wiring.yml
  - scripts/p7-autopilot-issue-executor-dry-run.mjs
  - scripts/p7-autopilot-issue-executor-pr-wiring.mjs
  - docs/platform-v7/autopilot/**
  - docs/platform-v7/execution-queue.md
- Success criteria:
  - pnpm --filter @pc/web test is green in CI
  - web-unit job is required for merge into main
- Readiness remains 69% full mature platform readiness.
- STATUS 2026-06-13: full web vitest = 3603 tests / 1 failure left
  (platformV7CopyGuard — ложное срабатывание на имена пропсов 'blocker'/'blockers'
  в bank/page.tsx; чистый фикс = переименование общего пропса LiveApiStatusBar.blockers
  и P7ActionStateChip.blocker по ~20 файлам = код-полоса Codex). web-unit required
  gate включается сразу после закрытия этого единственного реда.
- HOSTING: Vercel (основной) временно заблокирован на уровне аккаунта (лимит/биллинг).
  Все изменения накапливаются в main и задеплоятся на Vercel после разблокировки;
  проверка идёт на Netlify (резерв) экономно по билд-кредитам.

LATER:
- VP-5 driver / logistics cockpit binding (after VP-2 green)
- VP-6 bank cockpit binding
- VP-7 dispute / evidence binding
- VP-8 theme / mobile final QA

RULES:
- one PR equals one narrow layer
- no apps/landing
- no API routes
- no DB
- no package or lockfiles
- full web vitest must not degrade (target: required web-unit gate in VP-2.5)
