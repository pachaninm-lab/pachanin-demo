# platform-v7 execution queue

CURRENT: API repository boundary (controlled-pilot / pre-integration): extracting RuntimeCore data access into per-domain repository adapters; runtime adapter default, Prisma adapters disabled behind explicit flags. DB-backed path not active, no live integrations.

CURRENT ALLOWED:
- apps/api/src/modules/deals/**
- apps/api/src/modules/settlement-engine/**
- apps/api/src/modules/documents/**
- apps/api/src/modules/logistics/**
- apps/api/src/modules/labs/**
- apps/api/src/modules/disputes/**
- apps/api/src/modules/runtime-core/**
- apps/api/src/common/money/**
- apps/api/src/common/guards/**
- apps/web/lib/observability.ts
- apps/web/next.config.mjs
- apps/web/components/platform-v7/PlatformV7RoleLockFix.tsx
- apps/web/tests/unit/platformV7RoleLockFix.test.ts
- apps/web/lib/platform-v7/cabinet-access-policy.ts
- apps/web/tests/unit/platformV7SupportInvestorRoutePolicy.test.ts
- apps/web/app/platform-v7/bank/clean/page.tsx
- apps/web/lib/platform-v7/shellRoutes.ts
- apps/web/lib/platform-v7/navigation.ts
- apps/web/tests/unit/platformV7BankCanonicalRoute.test.ts
- apps/web/tests/unit/bankCleanRoom.test.tsx
- apps/web/tests/unit/platformV7ControlledPilotNav.test.ts
- apps/web/tests/unit/platformV7CabinetAccessPolicy.test.ts
- apps/web/tests/e2e/platform-v7-entry-gate.spec.ts
- apps/web/tests/e2e/platform-v7-route-audit.spec.ts
- apps/web/app/platform-v7/arbitrator/page.tsx
- apps/web/components/platform-v7/ArbitratorDisputeRoom.tsx
- apps/web/tests/unit/platformV7ArbitratorCanonicalImport.test.ts
- apps/web/tests/unit/arbitratorDecisionPolish.test.tsx
- apps/web/components/platform-v7/RoleCockpitLoading.tsx
- apps/web/app/platform-v7/lab/loading.tsx
- apps/web/app/platform-v7/surveyor/loading.tsx
- apps/web/app/platform-v7/compliance/loading.tsx
- apps/web/app/platform-v7/arbitrator/loading.tsx
- apps/web/app/platform-v7/support/loading.tsx
- apps/web/tests/unit/platformV7RoleCockpitLoading.test.ts
- apps/web/app/platform-v7/surveyor/page.tsx
- apps/web/tests/unit/platformV7SurveyorEmptyState.test.ts
- TRIGGER_PRODUCTION_REDEPLOY.txt
- notes_ui_test.txt
- ok.txt
- redeploy.txt
- tmp-control-fix-marker.txt
- tmp-test.txt
- tmp_test.txt
- trigger-20260411-1925.txt
- ui_preview_routes.txt
- zzz.txt
- apps/web/tmp_route_switch_test.txt
- apps/api/src/common/prisma/**
- apps/api/prisma/**
- apps/api/package.json
- docs/platform-v7/audit/**
- docs/platform-v7/autopilot/**
- docs/platform-v7/execution-queue.md

NEXT:
- Layer: platform-v7 professional maturity hardening (controlled-pilot / pre-integration): codebase, role-cockpit and end-to-end sandbox audits plus safe anti-vibe cleanups; DB-backed path stays behind flags; no live integrations, no money-path change, no schema migration.
- Allowed files:
  - docs/platform-v7/audit/**
  - docs/platform-v7/autopilot/**
  - docs/platform-v7/execution-queue.md
  - apps/api/src/**
- Success criteria:
  - Professional codebase audit and role-cockpit audit recorded under docs/platform-v7/audit/.
  - Static guards for forbidden fake-live copy and AI/generation traces are added and green.
  - All apps/api tests green; autopilot-guard green; no runtime/money/schema/live change.
- Readiness becomes ready.

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
- API repository boundary: per-domain adapters (Deal, Payment reads, Document, Shipment, Lab, Dispute); runtime default, Prisma disabled behind flags (#1918–#1923); Evidence N/A by design (#1924)
- RuntimeCore decomposition: 5 stateless engines — StateMachine (#1926), CompletenessChecker (#1927), BlockerResolver (#1928), TimelineBuilder (#1929), MoneyEngine decision ladder (#1930); behavior-preserving, money-flow spec unchanged
- Money minor-units: audit (#1931) + kopecks helper & invariants (PR-A, #1932) — behavior-neutral, MoneyEngine/SettlementEngine untouched
- Maturity audits (docs-only): Professional Codebase (#1944), Role Cockpit (#1949), End-to-End Sandbox Deal Flow (#1950)
- Phase 2 / PR-1 Role Shell Consistency (role-lock de-polling, #1951): removed the 50ms setInterval from PlatformV7RoleLockFix — enforcement stays event-/state-driven (pathname + role reactivity, popstate/hashchange/focus, rAF/timeout hydration race), behavior-preserving for the lock; anti-regression test added. Narrow owner-approved carve-out of two named files from the components/platform-v7 forbidden zone (broad zone stays forbidden); no cabinet rewrite, no business-logic change
- Phase 2 / PR-2 support/investor routing decision: support classified as internal oversight-only contour (not a participant cabinet, not a PlatformRole); investor classified as non-core oversight-only aggregate route (not an execution role, not a PlatformRole). cabinet-access-policy.ts now denies both to non-oversight roles explicitly (isPlatformV7InternalRoute / isPlatformV7NonCoreRoute) instead of incidental allowedPrefixes fallthrough — behavior-preserving, covered by platformV7SupportInvestorRoutePolicy.test.ts; no participant-visible route-switch (dead/unmounted switchers confirmed). Narrow owner-approved carve-out of two named files from the lib/platform-v7 forbidden zone (route/access policy only; broad zone stays forbidden); no cabinet rewrite, no business-logic change, no server-side RBAC. Server-side cabinet enforcement remains gated. ROLE_COCKPIT_AUDIT.md §3/§5 updated

- Phase 2 / PR-3 dual bank entry routing decision: canonical bank cabinet = /platform-v7/bank ("Кабинет банка", ~20 cross-app links + ~13 component tests); /platform-v7/bank/clean reclassified as a legacy "clean room" alias and converted to a thin server redirect → /bank (no second cockpit, no money logic). Bank role home + bottom-nav repointed to canonical in shellRoutes.ts and legacy navigation.ts (also fixing a pre-existing contradictory test); allowedPrefixes keeps the alias reachable. Covered by platformV7BankCanonicalRoute.test.ts; bankCleanRoom + cabinet-access + entry-gate/route-audit e2e updated to the alias contract. Narrow owner-approved carve-out (routing + the bank/clean route file); broad cockpit/lib/app zones stay forbidden; operator-only. No bank cockpit rewrite, no MoneyEngine/SettlementEngine change, no server-side RBAC, no live bank integration. ROLE_COCKPIT_AUDIT.md §5 #6 updated

- Phase 2 / PR-4 arbitrator legacy import cleanup: the active /platform-v7/arbitrator page no longer imports a page default-export from the legacy app/platform-v7r route tree. The dispute-room cockpit was relocated byte-identically (verified diff: identical body) into a canonical component components/platform-v7/ArbitratorDisputeRoom.tsx; the page imports/renders that instead. Legacy v7r route left untouched (read-only dead duplicate). New platformV7ArbitratorCanonicalImport.test.ts asserts the import boundary + no fake-live copy; arbitratorDecisionPolish mock retargeted. Narrow owner-approved carve-out (import/wrapper boundary only); broad cockpit/lib/app zones stay forbidden; operator-only. No cockpit rewrite, no dispute/arbitration business-logic change, no server-side RBAC, no live integration. ROLE_COCKPIT_AUDIT.md §5 #3 updated

- Phase 2 / PR-5 role cabinet loading-state consistency: the five role segments without a dedicated layout.tsx (lab, surveyor, compliance, arbitrator, support) now each have an additive route-level loading.tsx rendering a shared neutral cockpit skeleton (components/platform-v7/RoleCockpitLoading.tsx, built on the canonical Skeleton primitive). Error stays uniform via the existing root app/platform-v7/error.tsx (no redundant per-role error.tsx). Covered by platformV7RoleCockpitLoading.test.ts. No cabinet content/redesign/business-logic change; empty-state for static-array cabinets (Surveyor/Compliance) left as a later content-level follow-up. ROLE_COCKPIT_AUDIT.md §5 #7 updated

- Phase 2 / PR-6 surveyor empty-state: the Surveyor cabinet's static assignment list now renders the canonical EmptyState when there are no assignments (content-local additive ternary; non-empty render preserved). Covered by platformV7SurveyorEmptyState.test.ts. Compliance has no page-local list (shared always-populated cockpit components) — intentionally untouched; shared-cockpit empty path is a broader cross-role item, deferred. No redesign, no business-logic change. ROLE_COCKPIT_AUDIT.md §5 #7 updated

- Phase 2 closeout (docs-only): Phase 2 closed as a narrow, safe role-cockpit pass — PR-1 role-lock de-polling (#1951), PR-2 support/investor routing (#1952), PR-3 canonical bank route (#1953), PR-4 arbitrator legacy import (#1954), PR-5 loading consistency (#1955), PR-6 surveyor empty-state (#1956). Closeout + next-phase roadmap recorded in docs/platform-v7/audit/PHASE_2_CLOSEOUT_AND_ROADMAP.md. High-risk items GATED, no code: #1 server-side cabinet enforcement, #4 duplicate route/surface cleanup, generic cross-role empty-path in RoleExecutionCockpitContent. Next steps are docs-only design phases (Phase 3 route inventory, Phase 4 server-side enforcement design) before any Phase 5 controlled cleanup PRs

- Phase 3 route inventory (docs-only): full /platform-v7/** route map (181 routes, 10 existing alias/redirects, 20 grain template clones, 1 catch-all) with evidence-based, reversible disposition proposals (canonical / alias / orphan? / keep) and a prioritized gated migration backlog. Recorded in docs/platform-v7/audit/PHASE_3_ROUTE_INVENTORY.md. No code, no route change — each Phase 5 cleanup stays gated, one cluster per PR, alias-not-delete, with full link+test verification first

- Phase 4A server-side cabinet enforcement DESIGN (docs-only): designs binding web cabinet access to the verified JWT identity the API already trusts (auth.service JWT, RolesGuard, ActionExecutorService.assertObjectScope cross-org denial + audit). Current gap = platform-v7 web route layer derives role from URL/pc-role cookie, not a verified session. Flag-gated, report-only-first rollout (PLATFORM_V7_SERVER_CABINET_RBAC): 4A design → 4B report-only scaffold → 4C one-cabinet block-mode (bank) → 4D all-role, each gated. Recorded in docs/platform-v7/audit/PHASE_4_SERVER_SIDE_ROLE_ENFORCEMENT_DESIGN.md. No product code, no backend impl, no route rewrite — implementation deferred to gated 4B-4D

GATED (owner approval required before code starts):
- minor-units PR-B — internal MoneyEngine/SettlementEngine arithmetic in kopecks. STOP: changes live money arithmetic. Admission gate in docs/platform-v7/audit/MONEY_MINOR_UNITS_AUDIT.md §8 (all tests green; no external *Rub contract change; rollback path; characterization tests added first; no schema migration; no DB-backed activation; no live integrations)
- minor-units PR-C — Prisma Float→Int kopecks schema migration + backfill (locked until PR-B green)

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
