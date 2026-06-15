# VISUAL_UX_AUDIT — platform-v7

Дата: 2026-06-15. Планка: дорогая B2B/fintech/SaaS платформа. Зрелость:
controlled-pilot.

## Премиум-система (EXISTS)

`components/platform-v7/premium/`: `CockpitHero`, `ProcessStepper`, `StatusPill`,
`PremiumStatCard`, `PremiumCtaButton`, `DonutGauge`, `TrendSparkline`. Используют
CSS-токены (`var(--pc-prem-*)`), responsive `clamp()`, `min-width:0` для
overflow-safety, accessibility (`role='img'`, `aria-label`).

## Чеклист «дорогой платформы»

| Критерий | Статус | Комментарий |
|----------|--------|-------------|
| Нет перегруза | OK | smart-collapse, фокусные кокпиты по ролям |
| Один главный CTA | PARTIAL | UX-003: на странице 2–3 CTA (primary+ghost+sidebar) |
| Статус сделки за 5 сек | OK | hero (title+lead) + ProcessStepper + живые блокеры |
| Деньги ↔ документы/качество/рейс/спор | OK | `MoneyGateCard`, `RoleExecutionHandoff` (moneyImpact/documentImpact) |
| Банк видит чистое основание | OK | см. `BANK_BUYER_DD_CHECKLIST.md` |
| Водитель — только полевое действие | OK | driver field-shell, mobile focus |
| Элеватор — очередь/вес/приёмка | OK | `app/platform-v7/elevator/page.tsx` (деньги скрыты) |
| Спор: evidence → hold → decision | OK | dispute-evidence-pack, hold через runtime |
| Длинные тексты — smart collapse | OK | `CollapsibleSection`, `-webkit-line-clamp:2` |
| Нет «мусора»/несортированного скролла | OK | сетки на токенах, overflow-guards |

## Dark/Light (EXISTS, с исключениями)

~120 токенов в `styles/theme.css` + premium-оверрайды в
`styles/platform-v7-premium-cockpit.css` (light/dark). Контраст основного текста
на тёмной (`#E8F0EC` на `#07110F`) ≈ 14.8:1 (OK).

## Находки

### UX-001 — Hardcoded hex вместо токенов (тема ломается на тёмной)
- **Severity:** HIGH. **Affected:**
  `components/platform-v7/MoneyGateCard.tsx:13-20` (`#B45309`, `#B91C1C`,
  `rgba(180,83,9,0.05)`…),
  `components/platform-v7/P7BankPaymentBasisRuntimePanel.tsx:52,59` (`#0A7A5F`,
  `rgba(10,122,95,...)`).
- **Risk:** не адаптируется к тёмной теме; контраст местами ~3:1 (FAIL),
  `-soft`-фоны почти невидимы на `#07110F`. Это деньги/банк — самые важные
  компоненты.
- **Fix:** вынести в токены (`--pc-money-held`, `--pc-money-awaiting`,
  `--pc-money-ready` и т.п.) с light/dark значениями; компоненты используют
  `var(--…)`.
- **Test:** юнит/линт «нет сырых hex в money/bank компонентах» + snapshot токенов.
- **Status:** **fixable-in-scope** (`components/platform-v7/**`, `styles/**`),
  визуальный слой, без изменения бизнес-логики.

### UX-002 — Низкая alpha бордера на тёмной теме
- **Severity:** MEDIUM. **Affected:** `styles/theme.css` (`--pc-border:
  rgba(88,113,105,0.28)`). **Risk:** бордеры карточек теряются на тёмном фоне.
  **Fix:** поднять alpha для dark (≈40%) или `color-mix`. **Test:** визуальный
  snapshot/контраст. **Status:** fixable-in-scope.

### UX-003 — Несколько CTA на кокпите
- **Severity:** MEDIUM. **Affected:** per-role pages (напр. `buyer/page.tsx:161`).
  **Risk:** размывается главный путь. **Fix:** единый паттерн — один primary,
  остальные ghost/sidebar; задокументировать иерархию. **Test:** «ровно один
  primary CTA на hero». **Status:** follow-up (in-scope).

## Рекомендация по приоритету
UX-001 и UX-002 безопасны и ценны для DD (банковские/денежные экраны на тёмной
теме) — кандидаты на первый точечный fix-PR после этого audit-PR.
