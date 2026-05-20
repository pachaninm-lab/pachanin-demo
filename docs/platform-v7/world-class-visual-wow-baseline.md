# Platform-v7 · Visual Wow Core — Baseline Inventory

> PR-0: код не меняется. Только фиксация реального состояния.
> Дата: 2026-05-20

---

## 1. Routes (фактические)

### Root layout
- `apps/web/app/platform-v7/layout.tsx` — `AppShellV4` + `ToastProvider` + `PlatformThemeSync`
  - Импортирует 11 CSS файлов платформы
  - Читает роль из заголовка `x-pc-role`, fallback → `operator`
  - Инжектирует: `ScopedShellGuard`, `SupportHeaderIcon`, `RoleHeaderSwitcher`, `RoleExecutionSummaryGate`, `AuditSurfaceSummaryGate`, `SystemRouteSummaryGate`, `WorkRouteNav`, `MoneySpineStrip`, `CommandPalette`

### Core execution routes
| Route | Page file | Назначение |
|---|---|---|
| `/platform-v7` | `page.tsx` | Главный вход |
| `/platform-v7/deals` | `deals/page.tsx` | Реестр сделок |
| `/platform-v7/deals/[id]` | `deals/[id]/page.tsx` | **Главный экран — Deal Workspace** |
| `/platform-v7/deals/[id]/documents` | page.tsx | Документы сделки |
| `/platform-v7/deals/[id]/money` | page.tsx | Деньги сделки |
| `/platform-v7/deals/[id]/disputes` | page.tsx | Споры сделки |
| `/platform-v7/deals/[id]/logistics` | page.tsx | Логистика сделки |
| `/platform-v7/deals/[id]/quality` | page.tsx | Качество |
| `/platform-v7/deals/[id]/evidence-pack` | page.tsx | Пакет доказательств |
| `/platform-v7/deals/[id]/audit` | page.tsx | Журнал |
| `/platform-v7/lots` | `lots/page.tsx` | Реестр лотов |
| `/platform-v7/lots/[lotId]` | page.tsx | Карточка лота |
| `/platform-v7/lots/create` | page.tsx | Создание лота |
| `/platform-v7/disputes` | `disputes/page.tsx` | Споры |
| `/platform-v7/disputes/[id]` | page.tsx | Карточка спора |
| `/platform-v7/control-tower` | page.tsx | Центр управления (operator) |
| `/platform-v7/connectors` | page.tsx | Внешние подключения |
| `/platform-v7/audit-log` | ⚠️ **НЕТ** отдельного route — есть `/deals/[id]/audit` | — |
| `/platform-v7/investor` | page.tsx | Инвесторский обзор |
| `/platform-v7/help` | `help/page.tsx` | Помощь |
| `/platform-v7/profile` | `profile/page.tsx` | Профиль |
| `/platform-v7/not-found` | `not-found.tsx` | 404 |

### Role cockpit routes (12 ролей)
| Роль | Root route | Sub-routes |
|---|---|---|
| operator | `/platform-v7/control-tower` | anti-bypass, bypass-risk, canonical-reconciliation, grain, hotlist |
| buyer | `/platform-v7/buyer` | deals, lots, matches, offers, financing, reputation, rfq/* |
| seller | `/platform-v7/seller` | deals, lots, lots/new, batches, matches, offers, reputation, rfq, quick-sale, fgis-parties |
| bank | `/platform-v7/bank` | escrow, clean, factoring, payment-basis, release-safety, events/[id], grain |
| logistics | `/platform-v7/logistics` | inbox, [routeId], grain |
| driver | `/platform-v7/driver` | field, grain |
| surveyor | `/platform-v7/surveyor` | acts/[id], grain |
| elevator | `/platform-v7/elevator` | grain, terminal, terminal/[operationId] |
| lab | `/platform-v7/lab` | grain |
| arbitrator | `/platform-v7/arbitrator` | grain |
| compliance | `/platform-v7/compliance` | grain |
| executive | `/platform-v7/executive` | grain |

---

## 2. AppShell — фактическое состояние

**Файл:** `apps/web/components/v7r/AppShellV4.tsx` (594 строки)

### Структура шапки сейчас:
```
[☰] [BrandMark] Прозрачная Цена          [🔍 Поиск ⌘K] [🔔] [User]
     Сделка · логистика · документы · деньги
──────────────────────────────────────────────────────────────────
[breadcrumbs]                       [ФГИС: статус] [Банк: статус] [Споры: статус]
```

### Что есть:
- sticky header с `backdrop-filter: blur(18px)`
- BrandMark, название, breadcrumbs
- Роль: скрытый `<select>` на desktop, `pc-v4-mobile-role` кнопка на mobile
- Stage badge: `Контур сделки / Проверка условий / Полевой контур`
- System statuses: ФГИС, Банк, Споры (захардкоженные, без реальных данных)
- Notifications panel (статичные)
- Sidebar drawer с навигацией по роли
- Role-switcher через `<details>` в drawer

### Что отсутствует (для Visual Wow Core):
- Execution zone (деньги · документы · рейс · качество · спор) в шапке
- Active blocker в шапке
- TrustDot
- Header shrink on scroll
- Compact deal pulse
- MobileExecutionHeader (отдельный компонент)
- Role в шапке явно на desktop (сейчас только select/badge)

### Mobile breakpoints:
- `≤ 980px`: скрываются search текст, role select, stage badge, statuses
- `≤ 640px`: скрываются subtitle, breadcrumbs; title уменьшается до 14px
- Header offset: 116px (desktop), 128px (≤980), 118px (≤640)

---

## 3. P7 Components — фактические (platform-v7)

### Core primitives (SAFE TO USE):
| Компонент | Файл | testId support | Что делает |
|---|---|---|---|
| `P7Card` | P7Card.tsx | ✅ `testId` prop | Карточка с title/subtitle/footer |
| `P7Section` | P7Section.tsx | ✅ `testId` prop | Секция с title/subtitle/eyebrow/actions, surface: plain/card/muted |
| `P7ActionLog` | P7ActionLog.tsx | — | Лог действий (PlatformActionLogEntry[]) |
| `P7Badge` | P7Badge.tsx | — | Badge с tone |
| `P7ActionButton` | P7ActionButton.tsx | — | Кнопка действия |
| `P7MetricCard` | P7MetricCard.tsx | — | Метрика |
| `P7Hero` | P7Hero.tsx | — | Hero section |
| `P7Toolbar` | P7Toolbar.tsx | — | Toolbar |
| `P7HiddenDetails` | P7HiddenDetails.tsx | — | Collapsible |

### Money components (НЕ МЕНЯТЬ логику):
| Компонент | Что делает |
|---|---|
| `MoneyTreeStrip` | Визуализация денежного дерева, `data-testid="platform-v7-money-tree-strip"` |
| `MoneySpineStrip` | Spine деньги |
| `MoneyGateCard` | Gate для денежных операций |
| `MoneyImpactSummaryStrip` | Summary влияния на деньги |

### Evidence & Document components (НЕ МЕНЯТЬ):
| Компонент | Что делает |
|---|---|
| `EvidencePack` | Пакет доказательств |
| `DocumentsMatrix` | Матрица документов |
| `DocumentGateCard` | Gate документов |

### Action feedback (НЕ МЕНЯТЬ):
| Компонент | Что делает |
|---|---|
| `P7ActionFeedbackStrip` | Feedback strip |
| `ActionFeedbackPreviewStrip` | Preview feedback |

---

## 4. Lib domain — ключевые типы

### Money buckets (`domain/money.ts`):
```ts
// MoneyTree buckets:
reserved | readyToRelease | held | blockedByDispute | blockedByDocuments | manualReview | notReady

// MoneyEvents:
RESERVE_REQUESTED | RESERVE_CONFIRMED | HOLD_CREATED | HOLD_UPDATED |
RELEASE_REQUESTED | PARTIAL_RELEASE_EXECUTED | FINAL_RELEASE_EXECUTED |
REFUND_REQUESTED | REFUND_EXECUTED | BANK_REJECTED | MANUAL_REVIEW |
RECONCILIATION_MISMATCH | COMMISSION_ACCRUED
```

### PlatformRole (`stores/usePlatformV7RStore`):
```ts
operator | buyer | seller | logistics | driver | surveyor | elevator | lab | bank | arbitrator | compliance | executive
```

### PlatformV7Tone (`design/tokens.ts`):
```ts
neutral | success | warning | danger | info | money | evidence | integration | bank | logistics | document | dispute
```

---

## 5. CSS файлы — фактические

| Файл | Назначение |
|---|---|
| `platform-v7-final-polish.css` | Финальная полировка — **основной target для Visual Wow** |
| `platform-v7-mobile-excellence.css` | Mobile оптимизация |
| `platform-v7-premium-visual-polish.css` | Premium visual polish |
| `platform-v7-shell-clarity.css` | Шапка/shell clarity |
| `platform-v7-work-surfaces.css` | Рабочие поверхности |
| `platform-v7-dark-role-fixes.css` | Dark mode исправления |
| `platform-v7-premium-rhythm.css` | (не в layout.tsx — не загружается) |
| `platform-v7-mobile-notification-safe.css` | (не в layout.tsx) |

---

## 6. CSS design tokens — фактические

### Цветовая система (CSS vars, light mode):
```
--p7-color-background: #F7F9F5
--p7-color-surface: #FFFFFF
--p7-color-border: #D7DEE3
--p7-color-brand: #0A7A5F        // зелёный — основной brand
--p7-color-accent: #B68A35       // золотой — акцент
--p7-color-money: #155EEF        // синий — деньги
--p7-color-success: #027A48      // зелёный — подтверждено
--p7-color-warning: #B54708      // оранжевый — ожидание
--p7-color-danger: #B42318       // красный — стоп
--p7-color-document: #0369A1     // синий — документ
--p7-color-dispute: #9F1239      // малиновый — спор
--p7-color-logistics: #5B21B6   // фиолетовый — логистика
--p7-color-evidence: #6941C6    // фиолетовый — доказательства
--p7-color-bank: #1E293B        // тёмно-синий — банк
```

### Существующие shell CSS vars:
```
--pc-bg, --pc-bg-card, --pc-bg-elevated, --pc-bg-header
--pc-text-primary, --pc-text-secondary, --pc-text-muted
--pc-border, --pc-border-light
--pc-accent, --pc-accent-bg, --pc-accent-border, --pc-accent-strong
--pc-shadow-sm, --pc-shadow-md, --pc-shadow-lg
--pc-header-offset: 116px (desktop) / 128px (≤980) / 118px (≤640)
```

---

## 7. data-testid — СОХРАНЯТЬ

| testId | Компонент | Где используется |
|---|---|---|
| `platform-v7-money-tree-strip` | MoneyTreeStrip | E2E: money-tree.spec.ts |
| P7Card testId | P7Card (через testId prop) | E2E: множество тестов |
| P7Section testId | P7Section (через testId prop) | E2E: множество тестов |

**Правило**: добавлять новые data-testid только с префиксом `p7-vil-` (Visual Intelligence Layer).

---

## 8. E2E Tests — существующие (НЕ ЛОМАТЬ)

Все 50+ тестов в `apps/web/tests/e2e/platform-v7-*.spec.ts`.

Критические тесты, которые затрагивает Visual Wow Core:
- `platform-v7-mobile-overflow-gate.spec.ts` — горизонтальный overflow
- `platform-v7-forbidden-copy-gate.spec.ts` — запрещённые слова
- `platform-v7-role-leakage-deep.spec.ts` — утечка данных ролей
- `platform-v7-driver-field-shell.spec.ts` — изоляция водителя
- `platform-v7-bank-release-action-visibility.spec.ts` — банковский язык
- `platform-v7-mobile-compact-shell.spec.ts` — компактная шапка
- `platform-v7-visual-smoke.spec.ts` — визуальный smoke

---

## 9. Grain Execution — ключевые компоненты

**Runtime:** `GrainExecutionPage`, `GrainExecutionPageFixed`, `GrainReleaseCockpit`, `GrainWorkflowPage`

**Automation engines** (`lib/platform-v7/grain-execution/automation/`):
- `next-action-engine.ts` — предсказание следующего действия ← **источник для SmartNextAction**
- `money-release-engine.ts` — логика выпуска денег ← **источник для MoneyLockHalo/UnlockPath**
- `sdiz-gate-engine.ts` — СДИЗ blocking ← **источник для CauseLine**
- `evidence-pack-engine.ts` — evidence completeness ← **источник для EvidenceStrengthMeter**
- `document-requirement-engine.ts` — требования к документам ← **источник для DocumentImpactChip**
- `readiness-engine.ts` — готовность к сделке
- `quality-delta-engine.ts` — расхождения по качеству

---

## 10. Role Visibility — что кому доступно (domain/rbac.ts)

### ЗАПРЕЩЕНО смешивать:
| Роль | НЕ должна видеть |
|---|---|
| driver | bank, investor, general money aggregates, control tower, RoleLens |
| seller/buyer | чужие агрегаты, bank internal view |
| bank | лишняя полевая операционка без влияния на основание |
| executive | персональные операционные детали |

---

## 11. Forbidden copy — что нельзя в UI

Запрещено в видимом UI:
- `production-ready`, `fully live`, `fully integrated`
- `platform guarantees`, `платформа гарантирует`
- `Sandbox`, `mock`, `seed`
- `runtime`, `callback`
- `createLabProtocol` (технический термин)
- `fully connected`

Корректно:
- `Внешние подключения требуют договоров, доступов и подтверждения на реальных сделках.`
- `Тестовый контур внешних подключений`
- `Controlled-pilot contour`

---

## 12. Visual Intelligence Layer — целевые пути

```
apps/web/components/platform-v7/visual/
  ExecutionHeader.tsx
  MobileExecutionHeader.tsx
  DealStatusEdge.tsx
  CauseLine.tsx
  MoneyLockHalo.tsx
  UnlockPath.tsx
  DealMiniMap.tsx
  FocusDetailMode.tsx
  SmartSectionSummary.tsx
  ProgressiveDetailCard.tsx
  DocumentImpactChip.tsx
  ProofRibbon.tsx
  EvidenceStrengthMeter.tsx
  TimelineChapters.tsx
  TimelineWithImpact.tsx
  MagneticActionDock.tsx
  ActionPreview.tsx
  AfterActionReceipt.tsx
  TrustDot.tsx
  ObjectFocusHover.tsx
  RoleLens.tsx
  OperatorRadar.tsx
  BankCleanView.tsx
  DriverBigTileMode.tsx
  QuietIntelligenceHint.tsx
```

---

## 13. Риски при внедрении

### Mobile overflow risk:
- AppShellV4 имеет `overflowX: hidden` на root, но не на header/main
- CauseLine horizontal может вызвать overflow на узких экранах
- DealMiniMap (sticky right) требует тщательного позиционирования
- MagneticActionDock (bottom) должен учитывать `safe-area-inset-bottom`

### Z-index конфликты:
```
AppShellV4 header: z-index 100
AppShellV4 drawer: z-index 120
Drawer overlay: z-index 110
CommandPalette: высокий (нужно проверить)
MagneticActionDock: должен быть < 100 на desktop, ~90 на mobile
ActionPreview panel: ~95
```

### Existing P7 imports:
Все новые компоненты должны импортировать только из:
- `@/lib/platform-v7/design/tokens` — токены
- `@/components/platform-v7/p7Theme` — CSS vars
- Lucide icons — иконки
- НЕ импортировать из `@/components/v7r/*` напрямую

### data-testid strategy:
Новые компоненты используют `data-testid="p7-vil-{компонент}"`, не перекрывают существующие.

---

## 14. Safe edit zones

### ✅ МОЖНО безопасно менять:
- `apps/web/components/platform-v7/visual/*` (новые файлы)
- `apps/web/styles/platform-v7-final-polish.css` (только platform-v7 стили)
- `apps/web/app/platform-v7/*/page.tsx` — добавлять Visual Intelligence компоненты
- `apps/web/components/v7r/AppShellV4.tsx` — добавлять execution zone в шапку (осторожно)

### ⛔ НЕ ТРОГАТЬ:
- `apps/landing/*`
- `apps/web/lib/platform-v7/domain/money.ts` — MoneyTree логика
- `apps/web/lib/platform-v7/execution-state-machine.ts`
- `apps/web/lib/platform-v7/grain-execution/automation/*`
- `apps/web/stores/usePlatformV7RStore.ts`
- Существующие `data-testid` атрибуты
- `apps/web/tests/e2e/*`

---

## 15. Definition of Done — чеклист

- [ ] Шапка показывает execution state (деньги/документы/рейс/блокер)
- [ ] Mobile-шапка компактна, не overflow
- [ ] Сделка понятна за 10 секунд (статус + деньги + блокер + действие)
- [ ] CauseLine: документ → блокер → деньги → ответственный → действие
- [ ] MoneyLockHalo на заблокированных суммах
- [ ] UnlockPath — путь разблокировки
- [ ] DocumentImpactChip у каждого документа
- [ ] ProofRibbon: GPS/Фото/Вес/Пломба/Лаборатория/Акт
- [ ] EvidenceStrengthMeter (технический индекс полноты)
- [ ] TimelineWithImpact — события с последствиями
- [ ] MagneticActionDock — один primary CTA
- [ ] ActionPreview — что изменится
- [ ] AfterActionReceipt — квитанция результата
- [ ] TrustDot — вместо повторяющихся дисклеймеров
- [ ] Mobile 390×844 без overflow
- [ ] Водитель: DriverBigTileMode, без bank/investor data
- [ ] Банк: BankCleanView, без полевого хаоса
- [ ] apps/landing не изменён
- [ ] MoneyTree не сломан
- [ ] data-testid сохранены
- [ ] Нет forbidden copy
- [ ] Нет fake-live claims
