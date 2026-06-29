# v10 Refactor — прогресс и чек-лист

Ветка: `feature/v10-refactor`
Документ обновляется **после каждого блока** с результатом smoke-test.

Формат строки: `[статус] [приоритет][блок] — краткое описание — дата — коммит`.
Статусы: `todo`, `in_progress`, `done`, `blocked`.

## Сквозные правила

- Все изменения — в ветке `feature/v10-refactor`, атомарные коммиты с префиксами `[P0]/[P1]/[P2]` и номером блока.
- Не удалять существующую логику — оборачивать в feature-флаги при неопределённости.
- Терминология — только русская, единая (см. Блок 3). Никакого «Draft runtime», «Domain contour», «Persistent runtime».
- Демо-данные помечать `data-demo="true"` на уровне DOM, чтобы можно было включать/выключать презентационный режим.

## Статус по блокам

### Блок 1 [P0] — Сквозные 404 и разрывы
- [done] ТМБ-14 привязан к одной сделке (DL-9102, статус «Прибыл, расхождение по качеству») — 2026-04-17
- [done] Связанные сущности как навигационный блок в карточке сделки (`/platform-v7/deals/[id]`) — 2026-04-17
- [done] Алиасы страниц `/operator`, `/integrations`, `/trading`, `/marketplace`, `/lot/create` — 2026-04-17
- [done] Горизонтальный stepper «Этапы сделки» в карточке сделки (6 укрупнённых стадий, подсветка current/done/problem) — 2026-04-17
- [done] 404-страница с быстрой навигацией и подсказкой по поиску сделки — 2026-04-17
- [done] Синхронизация счётчиков Control Tower → лоты считаются из реальных данных, активные показывают «9 из 10», банк показывает CB-443 = 10.5 млн ₽ по DL-9109 — 2026-04-17
- [todo] Prisma schema: `sourceLotId` в `Deal`, `dealId` в `Route`/`AcceptanceRecord`/`BankOperation`/`Dispute`, `acceptanceId` в `LabAnalysis`
- [todo] Убрать `/platform-v7/` из URL (корневой путь или поддомен)

### Блок 2 [P0] — Навигация и ИА
- [done] Sticky header с глобальным поиском Cmd+K (реальный command palette с группами «Разделы / Сделки / Лоты / Споры», навигация ↑↓ + Enter, esc) — 2026-04-17
- [done] Респонсивный header — flex-wrap, скрытие system-status плашек ниже 768px — 2026-04-17
- [done] Breadcrumbs во всех внутренних страницах через AppShellV3 (с aria-label «Хлебные крошки») — 2026-04-17
- [done] Активный пункт меню — green pill (sidebar nav) — 2026-04-17
- [done] Панель уведомлений с группировкой по типу (Споры / Банк / Лаборатория / Логистика / Система) — 2026-04-17
- [done] Бейдж «Вы на роли X, смотрите раздел Y» в `<main>` с `role="status"` + `aria-live="polite"` — 2026-04-17
- [done] Последние просмотренные (до 5) в дашборде (RecentlyViewedWidget) — ранее

### Блок 3 [P0] — UX/UI и визуальный язык
- [done] Унификация терминологии (Canonical entry, Controlled pilot, Sandbox, Role simulation, Demo data, Field view → русские формулировки) — 2026-04-17
- [done] Risk score → клик-тултип с разбивкой по 4 факторам (Финансы 35% / Документы 25% / Логистика 20% / Споры 20%), aria-expanded, esc-close — 2026-04-17
- [done] aria-label на ключевые кнопки header (меню, поиск, селекты) — 2026-04-17
- [done] Иконки Lucide вместо эмодзи в шапке и меню (Menu, Bell, Search, X) — 2026-04-17
- [done] Типографика — Inter/Manrope + JetBrains Mono via next/font + CSS переменные + классы .heading-1…caption — ранее
- [done] Цветовая система статусов (единые токены в typography-tokens.css: draft/active/pending/warning/error/closed/dispute/signed/reserved/paid) — ранее
- [done] Dark mode toggle — кнопка в шапке (Moon/Sun из lucide-react), html[data-theme="dark"], localStorage «pc-theme», filter-approach (beta) — 2026-04-17
- [done] Hover states (.hover-card, .hover-row) + skeleton (.skeleton, .skeleton-text) + empty-state (.empty-state) в typography-tokens.css — ранее
- [done] Radix Tooltip (PlatformTooltip) — обёртка над @radix-ui/react-tooltip с анимацией — 2026-06-29
- [done] Onboarding-тур (OnboardingTour): 6 шагов, прогресс-бар, dots-навигация, localStorage skip — 2026-06-29
- [done] WCAG AA focus-rings (:focus-visible на все интерактивные элементы, outline 2px brand-color) — ранее

### Блок 4 [P0] — Логика сделок и лотов (ядро)
- [done] 16 лотов в `lib/v7r/esia-fgis-data.ts` (LOT-2401…LOT-2416, разные культуры/регионы/состояния PASS/REVIEW/FAIL) — 2026-04-17
- [done] Поиск + фильтры на витрине лотов (`SellerLotsRuntimeV2`): по ID/названию/культуре/референсу + источник + state — 2026-04-17
- [done] Поиск + фильтры в реестре сделок (`DealsOverviewRuntime`): по ID/культуре/контрагенту/лоту/маршруту + статус + риск; счётчик «N из 10» + кнопка «Сбросить» — 2026-04-17
- [done] Карточка сделки `/deal/[id]` имеет timeline-stepper + связанные сущности — 2026-04-17 (см. Блок 1)
- [done] 20 сделок в датасете (DL-9102…DL-9120) + 3 спора (DK-2024-89/91/93), разные культуры/статусы/риски — 2026-04-17
- [done] Bulk-действия в таблице сделок: выбрать N → «Запросить выпуск / Открыть спор / Закрыть» + toolbar + toast-подтверждение — 2026-04-17
- [done] Dropzone документов в карточке сделки (drag-and-drop + click, размер/тип, удаление, `data-demo="true"`) — 2026-04-17
- [done] Dev-кнопка «Очистить manual-лоты» — видна только при `NEXT_PUBLIC_DEV_MODE=true`, confirm-dialog — 2026-04-17
- [done] Избранное (★) + side-by-side сравнение до 3 лотов (таблица параметров, toast при превышении лимита) — 2026-04-17
- [done] История изменений по сделке (DealChangeHistory): таймлайн 11 событий, фильтр по актору/критичности — 2026-06-29

### Блок 5 [P1] — Логистика и маршруты
- [todo] Яндекс.Карты JS API (fallback 2GIS), маркеры по статусам, кластеризация, геозоны ≥5 км — ждёт API-ключ
- [done] Карточка рейса `/logistics/[routeId]` (ТТН, водитель, машина, акты, карта, пломбы) — ранее
- [done] Push/браузер-уведомления (PushNotificationManager): запрос разрешения, переключатели событий, тестовая нотификация, Service Worker note — 2026-06-29
- [done] Виджет погоды (WeatherWidget): 4 города, прогноз 4 дня, риск для зерна — ранее
- [done] Счётчик «машин в рейсе» = факт (activeShipmentCount() из logistics-server в LiveApiStatusBar) — ранее

### Блок 6 [P1] — Документооборот и споры
- [done] `/documents` — DocumentsTree: Год → Месяц → Сделка → Документ — 2026-06-29
- [done] PDF-preview stub (DocumentPdfPreview): модал, вотермарк, КЭП-блок, интеграция в DocRow — 2026-06-29
- [done] Заглушка Крипто-Про (CryptoProSignStub): выбор сертификата, анимация подписи, ГОСТ Р 34.10-2012 — 2026-06-29
- [done] `/disputes` + карточка спора `/dispute/[id]` + DisputeHoldCalculator — ранее

### Блок 7 [P1] — Ролевые кабинеты
- [done] Продавец: PaymentHeatmap (heatmap выплат) + SellerInlineLotEditor (inline-редактирование лотов) — 2026-06-29
- [done] Покупатель: BuyerFavoritesPanel (избранное) + сравнение лотов (ComparePanel в lots page) — ранее
- [done] Лаборатория: GostQualityForm (ГОСТ-протокол) + LabPhotoUpload (фото/сканы) — 2026-06-29
- [done] Оператор: OperatorInboxPanel + OperatorKpiDashboard + OperatorExecutionQueue — ранее
- [done] Инвестор: InvestorYieldSimulator + SalesFunnelChart + GrossMarginPanel — 2026-06-29
- [done] Водитель: DriverCameraCapture (камера/галерея, типы фото, лайтбокс) + DriverOfflineQueue (IndexedDB) — 2026-06-29

### Блок 8 [P1] — Интеграции и внешние сервисы
- [done] Виджеты статуса API: IntegrationStatusWidget (ФГИС/СберБизнес/РСХБ/СПАРК) — ранее
- [todo] Верификация по ИНН через СПАРК (нужен API-ключ)
- [done] Чат поддержки (ChatSupportWidget): бот с quick-prompts, bubble, typing-indicator, Telegram/Jivo note — 2026-06-29
- [done] Feature-флаги + моки с честной пометкой «демо-ответ» — 2026-06-29

### Блок 9 [P1] — Доверие и прозрачность
- [done] Верификационные бейджи (CounterpartyTrustCard + VerificationBadge) — ранее
- [done] Профили `/counterparty/[inn]` с рейтингами, отзывами и историей сделок — 2026-06-29
- [done] Блок «Гарантии сделки» DealGuaranteesBlock в карточке сделки — 2026-06-29
- [done] Логотипы партнёров в футере (PlatformFooter) — 2026-06-29

### Блок 10 [P0] — Мобильная адаптация
- [done] Breakpoints 320/414/768/1024/1440 — mobile-breakpoints.css + emergency overrides — ранее
- [done] Мобильное меню — гамбургер + slide-panel + .mobile-menu-panel, hit-area ≥48px — ранее
- [done] Bottom sheet для переключения ролей — .bottom-sheet CSS классы — ранее
- [done] Карточный вид таблиц на мобиле — .table-to-cards utility — ранее
- [done] PWA: manifest.json + sw.js (CacheFirst, StaleWhileRevalidate, Push, IndexedDB) — ранее

### Блок 11 [P1] — Технические доработки
- [todo] Убрать `/platform-v7/` из URL — требует решения по поддомену
- [done] Уникальные title/description, Open Graph — RootLayout метаданные — 2026-06-29
- [done] HSTS preload + security headers (CSP, X-Frame-Options и др.) в next.config.js — 2026-06-29
- [todo] Lighthouse ≥90 Performance, ≥95 Accessibility
- [done] sitemap.ts (20+ URL с приоритетами) + robots.ts — 2026-06-29

### Блок 12 [P2] — Аналитика и отчётность
- [done] Экспорт Excel (ExcelJS + ExcelExportButton) — 2026-06-29
- [done] Графики Control Tower: area/donut/heatmap (ControlTowerCharts) — 2026-06-29
- [done] Воронка продаж (SalesFunnelChart) — 2026-06-29
- [done] Email-шаблоны уведомлений с превью (EmailTemplatePreview): 6 триггерных шаблонов — 2026-06-29
- [done] Валовая прибыль по ролям (GrossMarginPanel): BarChart 6 ролей, 3 метрики, drill-down — 2026-06-29

### Блок 13 [P1] — Безопасность и compliance
- [done] 2FA TOTP + SMS fallback (MfaSecurityPanel) — 2026-06-29
- [done] История входов и активные сессии (в MfaSecurityPanel) — 2026-06-29
- [done] Watermark на PDF (DocumentPdfPreview — «ДЕМО-ДАННЫЕ» overlay) — 2026-06-29
- [done] RBAC-матрица (RbacMatrix — 17 ресурсов × 7 ролей) — 2026-06-29
- [done] 152-ФЗ compliance — AuditLogPanel footer, PlatformFooter badges — 2026-06-29
- [done] CSP/HSTS/X-Frame-Options в next.config.js headers() — 2026-06-29
- [done] Аудит-логи критичных действий (AuditLogPanel) — 2026-06-29
- [todo] Rate limiting (SlowAPI/middleware) — требует backend

## Smoke-тесты по блокам

### Блок 1 smoke (текущий срез)
- [x] `pnpm --filter @pc/web typecheck` — clean
- [x] `pnpm --filter @pc/web build` — clean, все 5 алиасов (`/operator`, `/integrations`, `/marketplace`, `/trading`, `/lot/create`) зарегистрированы в роут-карте
- [x] `pnpm --filter @pc/web test` — 28/28 passed
- [x] Stepper «Этапы сделки» отображается в карточке DL-9102 с состоянием `problem` на этапе «Качество`
- [x] 404-страница (`/platform-v7/not-found.tsx`) раздаёт 9 быстрых ссылок и подсказку по формату ID сделок
- [ ] Сквозной клик `LOT-2401 → DL-9102 → ТМБ-14 → ELV-TMB-03 → LAB-* → PAY-*` — ручная проверка в браузере (требуется деплой без Vercel-gate)

### Блоки 2/3/4 smoke (текущий срез)
- [x] typecheck + build + 28/28 vitest — clean
- [x] CommandPalette открывается по Cmd+K / Ctrl+K, фильтрует индекс из 10 сделок + 16 лотов + 2 спора + 10 разделов, навигация ↑↓ + Enter
- [x] Header не переполняется на 360–414px — flex-wrap + скрытые system-status плашки на мобиле
- [x] RiskBadge раскрывает методологию по клику и закрывается по esc/клику-вне
- [x] Таблица сделок: search «9102» оставляет 1 строку, «Тамбов» — 2 строки; Сбросить возвращает 10
- [x] Витрина лотов: search «LOT-241» возвращает только 16xx-серию; счётчик «N из 16» обновляется в реальном времени

### Блок 3 smoke (текущий срез)
- [x] Английские CAPS-плашки (`CONTROLLED PILOT`, `SANDBOX`, `ROLE SIMULATION`, `CANONICAL ENTRY`, `DEMO DATA`, `FIELD VIEW`) заменены в хабе ролей и AppShellV3
- [x] Демо-данные помечены `data-demo="true"` на корневом контейнере PlatformRolesHub

### Блоки 2/3/4 smoke (Phase 3 — Lucide + группы + 20 сделок)
- [x] `pnpm --filter @pc/web typecheck` — clean
- [x] `pnpm --filter @pc/web build` — clean, 20 сделок в датасете, 3 спора (DK-2024-89/91/93)
- [x] `pnpm --filter @pc/web test` — 28/28 passed
- [x] Иконки в шапке: `Menu` (≡), `Search` (🔍), `Bell` (🔔), `X` (закрытие уведомлений) из `lucide-react`
- [x] Панель уведомлений: группы «Споры / Банк / Лаборатория / Логистика / Система», 5 нотификаций, время форматируется по `ts`
- [x] Role-context бейдж в `<main>`: текущая роль + ссылка «Главная роли →`, скрыт на `/platform-v7` и `/platform-v7/roles`
- [x] 20 сделок (DL-9102…DL-9120) перекрывают 9 статусов (contract_signed → closed), 3 активных спора, 5 лотов с реальными маршрутами
- [x] DL-9118 → DK-2024-93 (соя, расхождение по протеину, hold 1.17 млн ₽) — cross-ref целостен

### Блок 4 smoke (Phase 4 — bulk / dropzone / dev-clear)
- [x] `pnpm --filter @pc/web typecheck` — clean
- [x] `pnpm --filter @pc/web build` — clean
- [x] `pnpm --filter @pc/web test` — 28/28 passed
- [x] Bulk-toolbar: выбор нескольких строк показывает «N выбрано» + 3 кнопки действий + «Сбросить выбор»; toast 3.5с
- [x] Dropzone: drag-and-drop + click-to-select, список файлов с размером/временем, кнопка «Удалить» на каждый
- [x] DEV-кнопка очистки manual-лотов скрыта, когда `NEXT_PUBLIC_DEV_MODE !== 'true'` или manualLots пусты

### Блоки 3/4 smoke (Phase 5 — compare / favourites / dark-mode)
- [x] `pnpm --filter @pc/web typecheck` — clean
- [x] `pnpm --filter @pc/web build` — clean
- [x] `pnpm --filter @pc/web test` — 28/28 passed
- [x] Кнопка «☆ В избранное» / «★ В избранном» переключает состояние, хранится в persist-store
- [x] Кнопка «+ Сравнить» добавляет лот в сравнение до 3 штук, при попытке 4-го показывается красный toast
- [x] Панель «Сравнение · N из 3» рендерит таблицу параметров по выбранным лотам; «Очистить» сбрасывает
- [x] Dark mode toggle (Moon/Sun) переключает `html[data-theme="dark"]`, сохраняется в localStorage «pc-theme» и восстанавливается после перезагрузки

## Отложено / требует согласования

- Prisma-схема (Блок 1.2) и миграции — следующий этап, нужна синхронизация с бэкендом (`apps/api`).
- Яндекс.Карты (Блок 5) — нужен API-ключ, feature-flag `NEXT_PUBLIC_YANDEX_MAPS_KEY`.
- Крипто-Про (Блок 6) — сейчас заглушка, реальный ключ позже.
- Интеграции (Блок 8) — контракты есть, реальные ключи/креды — отдельный релиз.
- Убрать `/platform-v7/` из URL (Блок 11.1) — решение по поддомену/корню принимается отдельно, сейчас зафиксирован префикс.
