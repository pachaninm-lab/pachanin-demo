# MOBILE_QA_REPORT — platform-v7

Дата: 2026-06-15. Цель: 390×844, без горизонтального overflow, читаемые важные
данные, touch-targets, field-mode, dark/light parity.

## EXISTS

- **Mobile focus / field mode:** `components/platform-v7/MobileDealFocus.tsx`
  (`@media(max-width:767px)`, money 32px/950, CTA `min-height:54px`),
  `DriverFieldShellGuard` (re-export `ScopedShellGuard`), per-role скрытие
  десктоп-секций на мобиле (elevator/lab/buyer).
- **Overflow-guards:** `min-width:0` (`premium/ExecutionUi.module.css`,
  `styles/platform-v7-premium-visual-polish.css`), `max-width:100%` и
  `overflow-x:auto` для таблиц/pre/code (`styles/mobile-polish.css`),
  `touch-action: manipulation`, `-webkit-overflow-scrolling: touch`.
- **Breakpoints:** 390 / 420 / 640 / 767–768 px.
- **Шрифты важных данных:** hero `clamp(28,8vw,38)`, money 32px, KPI 24px — все
  ≥16px для значимых значений.

## Чеклист

| Критерий | Статус | Источник / примечание |
|----------|--------|-----------------------|
| 390×844 layout | PARTIAL (нужен прогон) | breakpoint есть; см. MOB-001 |
| No horizontal overflow | OK (по коду) | `min-width:0` + `max-width:100%` + `overflow-x:auto` |
| Font ≥16px для важных данных | OK | money/KPI/hero крупные |
| Touch targets ≥44–56px | OK | CTA `min-height:54px` |
| Driver/elevator/surveyor field mode | OK | field-shell + mobile focus |
| Dark/light parity | PARTIAL | ломается на UX-001 (hardcoded hex в money/bank) |
| Mobile smoke tests | PARTIAL | route-smoke на Netlify зелёный; визуальный mobile-прогон — owner-side |

## Находки

### MOB-001 — Прогон 390px на сетках KPI/таблиц
- **Severity:** MEDIUM. **Affected:** mobile breakpoints (KPI-grid, fact-grid,
  таблицы). **Risk:** на 390px часть metric-сеток/таблиц может уезжать в
  горизонтальный скролл или обрезаться ellipsis. **Fix:** прогнать ключевые
  маршруты на 390 (buyer/seller/bank/elevator/lab/driver-field/control-tower),
  убедиться `max-width:100vw`/`min-width:0` на всех сетках. **Test:** добавить
  mobile-viewport проверки в e2e/playwright (owner-side CI) или unit на классы
  overflow-guard. **Status:** QA-task (визуальная часть — owner-side, нужен живой
  стенд/браузер).

### MOB-002 — Dark parity на мобиле зависит от UX-001
- **Severity:** MEDIUM (дубль UX-001). **Risk:** money/bank-компоненты с сырым
  hex плохо читаемы в тёмной теме на телефоне. **Fix:** токенизация (см.
  `VISUAL_UX_AUDIT.md`). **Status:** fixable-in-scope.

## Ограничение
Полный визуальный mobile QA (скриншоты на реальном 390×844, dark/light)
требует живого стенда. Sandbox-сеть до Netlify/Vercel закрыта; smoke по
маршрутам прогнан через CI (Netlify активен, Vercel — HTTP 402, account-blocked).
