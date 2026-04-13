# Platform v7 hardening — apply notes

Ветка: `fix/platform-v7-v9-hardening`
Репозиторий: `pachaninm-lab/pachanin-demo`
Контур приложения: `apps/web/...`

## Что уже добавлено в эту ветку
- `apps/web/app/platform-v7/analytics/page.tsx`
- `apps/web/app/platform-v7/error.tsx`
- `apps/web/app/platform-v7/not-found.tsx`
- `apps/web/app/platform-v7/deals/loading.tsx`
- `apps/web/app/platform-v7/disputes/loading.tsx`

## Критические инлайн-правки, которые должны быть применены к существующим файлам

### 1. Массово убрать ложные `/platform-v9/`
Во всех существующих файлах заменить:
- `/platform-v9/deals/` → `/platform-v7/deals/`
- `/platform-v9/disputes/` → `/platform-v7/disputes/`
- ``window.location.href = `/platform-v9/`` → ``window.location.href = `/platform-v7/``

Подтверждённые файлы с проблемой:
- `apps/web/app/platform-v7/control-tower/page.tsx`
- `apps/web/app/platform-v7/deals/page.tsx`
- `apps/web/app/platform-v7/seller/page.tsx`
- `apps/web/app/platform-v7/buyer/page.tsx`
- `apps/web/app/platform-v7/bank/page.tsx`
- `apps/web/app/platform-v7/disputes/page.tsx`

### 2. Убрать блокирующий спиннер MSW
Файл: `apps/web/components/v9/layout/MSWProvider.tsx`

Нужно:
- показывать `children` сразу
- запускать MSW в фоне
- до готовности MSW показывать тонкий верхний баннер `Загрузка демо-данных...`
- не блокировать первый экран

### 3. Role-first entry вместо мгновенного редиректа
Файл: `apps/web/app/platform-v7/page.tsx`

Сейчас там прямой redirect в control-tower.
Нужно заменить на клиентский role picker:
- Оператор
- Покупатель
- Продавец
- Водитель
- Банк
- Арбитр

Маршруты по умолчанию:
- operator → `/platform-v7/control-tower`
- buyer → `/platform-v7/buyer`
- seller → `/platform-v7/seller`
- driver → `/platform-v7/field`
- bank → `/platform-v7/bank`
- arbitrator → `/platform-v7/disputes`

### 4. Header / breadcrumbs / sandbox
Файл: `apps/web/components/v9/layout/Header.tsx`

Нужно:
- breadcrumb label `platform-v7` поменять с `v9` на `Платформа`
- добавить мобильную кнопку поиска рядом с AI (`onOpenCmd`) — не только desktop `⌘K`
- рядом с SANDBOX-плашкой добавить кнопку `Выйти из SANDBOX`
- при выходе: `setDemoMode(false)` + toast о live-режиме

### 5. Sidebar
Файл: `apps/web/components/v9/layout/Sidebar.tsx`

Нужно:
- убрать строку `v9 · PLATFORM`, заменить на `PLATFORM` или полностью убрать версию
- добавить свайп-влево для закрытия sidebar на мобильном

### 6. AppShell
Файл: `apps/web/components/v9/layout/AppShell.tsx`

Нужно:
- добавить skip-link к `#main-content`
- добавить обработчик `?` для shortcuts help
- добавить простое модальное окно / overlay со списком shortcuts:
  - `⌘K` — Поиск
  - `⌘I` — AI-помощник
  - `R` — Обновить данные
  - `Esc` — Закрыть модальное окно
  - `G+D` — Сделки
  - `G+C` — Control Tower
  - `G+B` — Банк
  - `G+S` — Споры

### 7. Seller page
Файл: `apps/web/app/platform-v7/seller/page.tsx`

Нужно:
- заменить операторский язык:
  - `Ожидается выплат` → `Получите на счёт`
  - `Заморожено` → `Задержано (спор)`
  - `Блокеры` → `Что мешает выплате`
  - `Документы к загрузке` → `Нужны документы`
- добавить в верхнюю часть блок `Ближайшая выплата`
- не писать `Загрузка документов недоступна вне SANDBOX`
- вместо этого при `demoMode=false` показывать toast:
  `В реальном режиме здесь — upload в защищённое хранилище`
- симуляция upload в SANDBOX должна оставаться рабочей

### 8. Buyer page
Файл: `apps/web/app/platform-v7/buyer/page.tsx`

Нужно:
- вернуть все deal links на `/platform-v7/...`
- над shortlist добавить сортировки:
  - `Цена: от низкой`
  - `Цена: от высокой`
  - `По качеству`
  - `По региону`
- добавить фильтр культур:
  - все
  - пшеница 3 кл.
  - пшеница 4 кл.
  - кукуруза
  - ячмень

### 9. Compliance page
Файл: `apps/web/app/platform-v7/compliance/page.tsx`

Нужно:
- не писать `Экспорт недоступен вне SANDBOX`
- сделать реальный CSV blob export
- добавить filters:
  - actor
  - dateFrom
  - dateTo

### 10. Field page
Файл: `apps/web/app/platform-v7/field/page.tsx`

Нужно:
- page-level switcher preview-ролей для admin/operator:
  - водитель / сюрвейер / элеватор / лаборант
- постоянно видимый блок `Офлайн-очередь`
- driver-specific блок `Маршрут` с простым вертикальным прогрессом и `ETA`

### 11. Disputes list
Файл: `apps/web/app/platform-v7/disputes/page.tsx`

Нужно:
- вернуть ссылки на `/platform-v7/...`
- добавить summary KPI сверху:
  - активных споров
  - под удержанием
  - SLA истекает сегодня
- в fixtures или mapping добавить поля:
  - `reasonCode`
  - `ballAt`
  - `evidence.total`
  - `evidence.uploaded`

### 12. Dispute detail
Файл: `apps/web/app/platform-v7/disputes/[disputeId]/page.tsx`

Нужно:
- добавить верхний индикатор `⚽ Мяч у:`
- сделать `Evidence Pack` как реальный blob download в SANDBOX
- имя файла: `evidence-pack-<disputeId>.txt` или `.pdf`

### 13. Deal detail
Файл: `apps/web/app/platform-v7/deals/[dealId]/page.tsx`

Нужно:
- добавить сверху macro-phase progress bar:
  `Контракт → Логистика → Приёмка → Документы → Расчёт`
- добавить money breakdown table
- добавить контекстные действия по статусу
- добавить route / events для `DL-9102`

### 14. Mock handlers
Файл: `apps/web/mocks/handlers.ts`

Добавить endpoints:
- `POST /api/deals/:id/status`
- `POST /api/deals/:id/documents`
- `POST /api/bank/escalate`
- `POST /api/disputes/:id/notify`
- `POST /api/deals/:id/partial-release`
- `GET /api/analytics`

## Рекомендуемый порядок применения
1. Сначала весь repo-wide replace `/platform-v9/` → `/platform-v7/`
2. Потом `MSWProvider.tsx`
3. Потом `platform-v7/page.tsx`
4. Потом `Header.tsx`, `Sidebar.tsx`, `AppShell.tsx`
5. Потом seller / buyer / compliance / field
6. Потом disputes / deal detail / mocks

## Definition of done
- ни одной ссылки на `/platform-v9/` внутри `apps/web/app/platform-v7/**`
- первый экран без блокирующего спиннера
- вход начинается с выбора роли
- SANDBOX размечен глобально и честно
- seller/compliance действия симулируются, а не заблокированы
- mobile header имеет trigger поиска
- `analytics` маршрут открывается и рендерится
