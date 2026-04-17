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
- [todo] Последние просмотренные (до 5) в дашборде
- [todo] Панель уведомлений с группировкой по типу (сейчас плоский список)
- [todo] Бейдж «Вы на роли X, смотрите раздел Y» в шапке main

### Блок 3 [P0] — UX/UI и визуальный язык
- [done] Унификация терминологии (Canonical entry, Controlled pilot, Sandbox, Role simulation, Demo data, Field view → русские формулировки) — 2026-04-17
- [done] Risk score → клик-тултип с разбивкой по 4 факторам (Финансы 35% / Документы 25% / Логистика 20% / Споры 20%), aria-expanded, esc-close — 2026-04-17
- [done] aria-label на ключевые кнопки header (меню, поиск, селекты) — 2026-04-17
- [todo] Типографика — Inter/Manrope + JetBrains Mono, шкала H1/H2/H3/body/caption
- [todo] Цветовая система статусов (единые токены)
- [todo] Иконки Lucide вместо эмодзи (≡, 🔔)
- [todo] Hover/скелетоны/toasty/empty states/Radix tooltips
- [todo] Onboarding-тур
- [todo] WCAG AA полный + focus-rings везде
- [todo] Dark mode toggle

### Блок 4 [P0] — Логика сделок и лотов (ядро)
- [done] 16 лотов в `lib/v7r/esia-fgis-data.ts` (LOT-2401…LOT-2416, разные культуры/регионы/состояния PASS/REVIEW/FAIL) — 2026-04-17
- [done] Поиск + фильтры на витрине лотов (`SellerLotsRuntimeV2`): по ID/названию/культуре/референсу + источник + state — 2026-04-17
- [done] Поиск + фильтры в реестре сделок (`DealsOverviewRuntime`): по ID/культуре/контрагенту/лоту/маршруту + статус + риск; счётчик «N из 10» + кнопка «Сбросить» — 2026-04-17
- [done] Карточка сделки `/deal/[id]` имеет timeline-stepper + связанные сущности — 2026-04-17 (см. Блок 1)
- [todo] 20+ сделок (сейчас 10) — расширить датасет
- [todo] Bulk-действия в таблице сделок (выбрать N → release/спор/закрыть)
- [todo] Dropzone документов в карточке сделки
- [todo] Избранное + side-by-side сравнение до 3 лотов
- [todo] История изменений по сделке
- [todo] Dev-кнопка «Очистить manual-лоты» — только при `NEXT_PUBLIC_DEV_MODE=true`

### Блок 5 [P1] — Логистика и маршруты
- [todo] Яндекс.Карты JS API (fallback 2GIS), маркеры по статусам, кластеризация, геозоны ≥5 км
- [todo] Карточка рейса `/route/[id]` (ТТН, водитель, машина, акты)
- [todo] Push/браузер-уведомления об отклонениях
- [todo] Виджет погоды OpenWeather/Яндекс.Погода
- [todo] Счётчик «машин в рейсе» = факт

### Блок 6 [P1] — Документооборот и споры
- [todo] `/documents` — древовидная структура Год → Месяц → Сделка → Документ
- [todo] Drag-and-drop (react-dropzone), PDF-preview (react-pdf)
- [todo] Статус подписания + заглушка интеграции с Крипто-Про
- [todo] `/disputes` + карточка спора `/dispute/[id]`, калькулятор удержаний

### Блок 7 [P1] — Ролевые кабинеты
- [todo] Продавец: календарный heatmap выплат, портфель с риск-метриками, inline-редактирование лотов
- [todo] Покупатель: корзина/избранное, рейтинги поставщиков, сравнение 3 лотов
- [todo] Лаборатория: форма протокола с ГОСТ-профилем, загрузка фото/сканов, история по контрагенту
- [todo] Оператор: единый inbox с приоритетами, дашборд KPI, bulk-действия, command palette
- [todo] Инвестор: переделка дашборда, DD-раздел, симулятор доходности, Presenter mode
- [todo] Водитель: mobile-first, ≥48px кнопки, камера, IndexedDB офлайн

### Блок 8 [P1] — Интеграции и внешние сервисы
- [todo] Виджеты статуса API: ФГИС «Зерно», СберБизнес, РСХБ, СПАРК/Контур.Фокус, лаборатории, СБИС/Такском
- [todo] Верификация по ИНН через СПАРК
- [todo] Чат поддержки (Telegram + Jivo fallback)
- [todo] Feature-флаги + моки с честной пометкой «демо-ответ»

### Блок 9 [P1] — Доверие и прозрачность
- [todo] Верификационные бейджи на карточках контрагентов
- [todo] Профили `/counterparty/[inn]` с рейтингами и отзывами
- [todo] Блок «Гарантии сделки» в карточке сделки
- [todo] Логотипы партнёров в футере

### Блок 10 [P0] — Мобильная адаптация
- [todo] Breakpoints 320/414/768/1024/1440
- [todo] Мобильное меню — гамбургер + slide-panel, hit-area ≥48px
- [todo] Bottom sheet для переключения ролей
- [todo] Карточный вид таблиц на мобиле
- [todo] Swipe-навигация между сделками
- [todo] PWA: manifest.json, service worker, IndexedDB, Web Push
- [todo] Водитель — mobile-first (общее с блоком 7)

### Блок 11 [P1] — Технические доработки
- [todo] Убрать `/platform-v7/` из URL
- [todo] Уникальные title/description, Open Graph (с динамическим og:image)
- [todo] HSTS preload, favicons, apple-touch-icon, manifest
- [todo] Lighthouse ≥90 Performance, ≥95 Accessibility
- [todo] sitemap.xml, robots.txt, SEO-редиректы

### Блок 12 [P2] — Аналитика и отчётность
- [todo] Экспорт Excel (ExcelJS), не CSV
- [todo] Графики динамики цен (Recharts/ECharts)
- [todo] Валовая прибыль по ролям
- [todo] Email-рассылки (Resend/SendPulse + React Email)
- [todo] Воронка продаж
- [todo] Графики Control Tower: area/donut/heatmap

### Блок 13 [P1] — Безопасность и compliance
- [todo] 2FA (TOTP + SMS fallback)
- [todo] История входов и активные сессии
- [todo] Watermark на PDF
- [todo] RBAC (CASL/casbin)
- [todo] 152-ФЗ compliance
- [todo] Rate limiting (SlowAPI)
- [todo] CSRF/httpOnly/CSP
- [todo] Аудит-логи критичных действий

## Smoke-тесты по блокам

### Блок 1 smoke (текущий срез)
- [x] `pnpm --filter @pc/web typecheck` — clean
- [x] `pnpm --filter @pc/web build` — clean, все 5 алиасов (`/operator`, `/integrations`, `/marketplace`, `/trading`, `/lot/create`) зарегистрированы в роут-карте
- [x] `pnpm --filter @pc/web test` — 28/28 passed
- [x] Stepper «Этапы сделки» отображается в карточке DL-9102 с состоянием `problem` на этапе «Качество»
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

## Отложено / требует согласования

- Prisma-схема (Блок 1.2) и миграции — следующий этап, нужна синхронизация с бэкендом (`apps/api`).
- Яндекс.Карты (Блок 5) — нужен API-ключ, feature-flag `NEXT_PUBLIC_YANDEX_MAPS_KEY`.
- Крипто-Про (Блок 6) — сейчас заглушка, реальный ключ позже.
- Интеграции (Блок 8) — контракты есть, реальные ключи/креды — отдельный релиз.
- Убрать `/platform-v7/` из URL (Блок 11.1) — решение по поддомену/корню принимается отдельно, сейчас зафиксирован префикс.
