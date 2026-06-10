# ФИНАЛЬНОЕ MASTER-ТЗ — карта сверки с фактическим состоянием

Дата сверки: 2026-06-10. Источник правды: autopilot-state.json (lastClosed), execution-queue.md, код apps/web.

## Поправка контрольной точки

Раздел 0 ФИНАЛЬНОГО ТЗ («стоим после PR 5.4, следующий шаг PR 5.1») устарел:
PR 5.1, 5.2, 5.5, 5.6, 5.7 закрыты и смержены (см. lastClosed; файлы
lib/platform-v7/runtime/application-service.ts, mock-persistence-adapter.ts,
dto-schemas.ts, persistence-ports.ts существуют и под тестами). Стартовать PR 5.1
заново нельзя — это переписывание готового слоя, что запрещает само ТЗ (§6).

Фактическая позиция: VP-2.5 по master-tz-2 (полный web vitest green + merge gate).

## Карта блоков ФИНАЛЬНОГО ТЗ

| Блок ТЗ | Статус | Доказательство / остаток |
| --- | --- | --- |
| §7.1 Runtime (5.1–5.7) | Закрыт | lastClosed PR 5.0–5.7; lib/platform-v7/runtime/* |
| §7.2 Adapters (6.1–6.8) | Закрыт одним слоем (PR 6.0) | lib/platform-v7/external-adapters.ts, integrations/providerRegistry.ts; журнал/replay — проверить при VP-6/VP-7 binding |
| §7.3 AI (AI-0…AI-6) | Частично (PR 7.0) | lib/platform-v7/ai/gateway-{envelope,provider-port,mock-provider}.ts; ролевые AI UX entry points (AI-5) и расширенный QA (AI-6) не подтверждены |
| §7.4 Product Entry (UI-0…UI-6) | Закрыт ядром (PR 8.0 + VP-4 #1689) | /open, /role-preview, /onboarding, open-walkthrough; UI-6 mobile/accessibility — в VP-8 |
| §7.5 Theme (THEME-1…6) | Частично (PR 9.0) | токены и light/dark есть; финальный THEME-6 regression QA — в VP-8 |
| §7.6 Role Cockpit UX (UX-1…7) | Частично | VP-3 entry cockpit закрыт; UX-1…UX-7 = VP-5/VP-6/VP-7 runtime binding — главный продуктовый остаток (LATER в очереди) |
| §7.7 Premium HX (HX-0…10) | Частично | components/platform-v7/premium/ExecutionUi (PremiumDealShell, money rail, driver field shell); полный HX-набор — только после binding (правило §7.7 самого ТЗ) |
| §3 Модель доступа | Ядро есть | Stage 3 RBAC + RbacGuard + изоляция полевых ролей (VP-2.3); полный request-access/приглашения — вместе с UX-блоком |
| §4 Копии статусов внешних контуров | В работе (VP-2.5) | deep copy sweep: реестр platformV7DeepBankDealCopyGuard нарушен в ~40 исходниках; replacement-словарь = §4.2 ТЗ |
| §26 Light/Dark идеал | Не закрыт | VP-8 |
| §29 Engineering QA | В работе (VP-2.5) | полный vitest 191 падение; web-unit required gate после зелёного |
| §31 DoD | Не достигнут | честная готовность 69% (autopilot-state) |

## Логический порядок доработки (по правилу §32 «сначала runtime → binding → cockpit → premium»)

1. VP-2.5 (текущий): deep copy sweep (§4.2) + остаток тест-долга + полный vitest green.
2. web-unit merge gate activation (NEXT в очереди): required-джоба `pnpm --filter @pc/web test`.
3. UX-блок §7.6 = VP-5 → VP-6 → VP-7 (runtime binding кокпитов), затем VP-8 (§26 + UI-6 + THEME-6).
4. AI-5/AI-6 ролевые входы поверх существующего gateway.
5. Premium HX-блок §7.7 — строго после binding.

Запреты §0/§6 действуют: не переписывать готовые слои, не начинать HX до binding,
не трогать apps/landing и lockfiles.
