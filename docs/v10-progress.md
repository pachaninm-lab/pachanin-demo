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
- [todo] Новые страницы `/operator`, `/integrations`, `/trading`, `/marketplace`, `/lot/create` — алиасы на существующие или новые модули
- [todo] Prisma schema: `sourceLotId` в `Deal`, `dealId` в `Route`/`AcceptanceRecord`/`BankOperation`/`Dispute`, `acceptanceId` в `LabAnalysis`
- [todo] Граф связей (горизонтальный stepper) в шапке сделки
- [todo] Синхронизация счётчиков Control Tower vs `/deals` (9 vs 10), банк показывает операции по DL-9109
- [todo] 404 страница с поиском и навигацией
- [todo] Убрать `/platform-v7/` из URL (корневой путь или поддомен)

### Блок 2 [P0] — Навигация и ИА
- [todo] Удалить дублирующий футер-меню
- [todo] Sticky header с глобальным поиском (Cmd+K)
- [todo] Breadcrumbs на всех внутренних страницах (частично уже есть)
- [todo] Активный пункт меню с акцентной левой границей
- [todo] Последние просмотренные (до 5) в дашборде
- [todo] Панель уведомлений с группировкой
- [todo] Переключатель ролей — реальное переключение контекста
- [todo] Бейдж «Вы на роли X, смотрите раздел Y»

### Блок 3 [P0] — UX/UI и визуальный язык
- [done] Унификация терминологии (Canonical entry, Controlled pilot, Sandbox, Role simulation, Demo data, Field view → русские формулировки) — 2026-04-17
- [todo] Типографика — Inter/Manrope + JetBrains Mono, шкала H1/H2/H3/body/caption
- [todo] Цветовая система статусов (единые токены)
- [todo] Risk score с тултипом методологии
- [todo] Иконки Lucide вместо эмодзи
- [todo] Hover/скелетоны/toasty/empty states/Radix tooltips
- [todo] Onboarding-тур
- [todo] WCAG AA + focus-rings + aria-label
- [todo] Dark mode toggle

### Блок 4 [P0] — Логика сделок и лотов (ядро)
- [todo] Матричный вид лотов (`/marketplace`, `/lots`), 15+ лотов, sticky header, sortable
- [todo] Фильтры лотов (культура/регион/объём/цена/класс/ФГИС/базис)
- [todo] Таблица сделок `/deals` с SLA-сортировкой, 20+ сделок, bulk-действия для оператора
- [todo] Карточка сделки `/deal/[id]` — участники, timeline-stepper, dropzone документов, чат/WS, audit log
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
- [x] `pnpm --filter @pc/web build` — clean
- [x] `pnpm --filter @pc/web test` — 28/28 passed
- [ ] Сквозной клик `LOT-2401 → DL-9102 → ТМБ-14 → ELV-TMB-03 → LAB-* → PAY-*` — проверить вручную после добавления недостающих страниц (следующий заход)

### Блок 3 smoke (текущий срез)
- [x] Английские CAPS-плашки (`CONTROLLED PILOT`, `SANDBOX`, `ROLE SIMULATION`, `CANONICAL ENTRY`, `DEMO DATA`, `FIELD VIEW`) заменены в хабе ролей и AppShellV3
- [x] Демо-данные помечены `data-demo="true"` на корневом контейнере PlatformRolesHub

## Отложено / требует согласования

- Prisma-схема (Блок 1.2) и миграции — следующий этап, нужна синхронизация с бэкендом (`apps/api`).
- Яндекс.Карты (Блок 5) — нужен API-ключ, feature-flag `NEXT_PUBLIC_YANDEX_MAPS_KEY`.
- Крипто-Про (Блок 6) — сейчас заглушка, реальный ключ позже.
- Интеграции (Блок 8) — контракты есть, реальные ключи/креды — отдельный релиз.
- Убрать `/platform-v7/` из URL (Блок 11.1) — решение по поддомену/корню принимается отдельно, сейчас зафиксирован префикс.
