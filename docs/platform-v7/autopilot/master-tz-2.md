# MASTER-ТЗ 2

platform-v7 / «Прозрачная Цена»

Зелёный контур и связный продукт: полное восстановление QA-контрактов, операционная гигиена CI/CD, связывание ролевых кокпитов с runtime без дрейфа.

---

## 0. Контрольная точка

Закрыто по MASTER-ТЗ 1:

- Stage 3–5 (RBAC, MoneyTree, Document Matrix, Bank Basis, Action Boundary, runtime inventory, persistence ports, DTO, application services, mock persistence, server actions, runtime integration tests, Stage 5 QA)
- PR 6.0 External Adapter Emulators
- PR 7.0 AI Integration Gateway
- PR 8.0–20.0 (product entry, theme, deal workspace, dispute/evidence, automation engines, domain, transaction, risk/security, trust, SOT, shell/simulation, bank payment basis)
- VP-1 Visible Execution Entry Cockpit — смержен (PR #1682), задеплоен в production через Vercel Git integration

В работе:

- VP-2 Runtime QA Stabilization (этот блок)

Главная зафиксированная проблема после MASTER-ТЗ 1: конвейер генерировал слои быстрее, чем поддерживал инварианты — накопился дрейф между guard-тестами и исходниками (~330 падений полного vitest-прогона), плюс операционный шум CI (невалидный VERCEL_TOKEN, выключенный dependency graph).

## 1. Главная цель

Платформа уже «есть» по слоям. Цель MASTER-ТЗ 2 — сделать так, чтобы она была **доказуемо целой**:

- полный vitest-прогон web зелёный и закреплён как merge-гейт
- guard-контракты (role isolation, honesty copy, money boundary) снова совпадают с исходниками
- CI без перманентно красных не-гейтовых джоб
- видимые ролевые кокпиты соединены с runtime-слоем, а не с декоративными данными
- любое новое изменение, ломающее контракт, краснеет в CI в момент PR, а не через десять слоёв

## 2. Главный принцип

Не «потушить красное», а **восстановить контракт**:

- если guard-тест кодирует продуктовый/безопасностный инвариант (водитель не видит деньги; деньги двигает только банковское событие; нет fake-live заявлений; статус дублируется текстом) и исходник его нарушает — чинится исходник
- если исходник осознанно переработан более поздним слоем и новое состояние корректно — обновляется ожидание теста
- запрещено удалять тесты, ослаблять матчеры до бессмысленных, добавлять фиктивные пропсы ради зелёного

## 3. Блок VP-2 — Runtime QA Stabilization

### PR VP-2.1 — Test Infrastructure Determinism (закрыт)

- cwd закреплён на apps/web в vitest setup
- пути чтения исходников нормализованы (17 файлов root-конвенции)
- `new URL(..., import.meta.url)` заменён на `resolve(__dirname, ...)` (12 файлов)
- workflow-гигиена: dependency-review с probe графа; CLI-deploy со skip+warning при невалидном токене

### PR VP-2.2 — Server Action Route Contracts

Файлы: tests/unit/platformV7ServerActionRoute*.test.ts (~29 падений)

Причина: payload-контракты боундари расширились (counterpartyId, priceRubPerTon, volumeTons, validUntil и др.), route-тесты шлют старый payload и получают 400 до гейта, который проверяют.

Правило: дополнить payload до контрактно-валидного там, где тест проверяет гейт ЗА контрактом (409 idempotency, 202 manual review, готовность гейтов). Намеренные пропуски для негативных сценариев не трогать.

### PR VP-2.3 — Shell / Role Isolation Guards

Файлы: scopedShellGuard, roleExecutionHandoff, driverFieldShellGuard, platformV7RoleUxRegressions, journalPreview, roleContinuity*, workRouteNav*, supportIndexRoleScope (~90 падений)

Это ядро ролевой изоляции. Приоритет — починка компонентов: AppShellV4 / ScopedShellGuard обязаны держать контракт «каждая роль видит только свою работу».

### PR VP-2.4 — Honesty / Premium Copy Guards

Файлы: platformV7Premium*, *ExecutionPolish, platformV7VisibleExecutionCopy, platformV7HiddenDetails, controlTowerVisualHierarchy (~30 падений)

Контракты честности: нет «production-ready», деньги выпускает банк, длинные детали скрыты, статус дублирован текстом.

### PR VP-2.5 — Remaining Tail + Regression Gate

- добить остаточные падения (route-страницы, evidence pack, simulation panel, env-зависимые тесты)
- env-зависимые тесты (ECONNREFUSED 127.0.0.1:4000) перевести на msw или явный skip-контракт с пометкой integration
- добавить в CI required-джобу `web-unit`: `pnpm --filter @pc/web test` — полный vitest как merge-гейт
- с этого момента полный прогон не имеет права деградировать

## 4. Блок OPS — операционная гигиена

### OPS-1 (владелец репозитория)

- Ротация VERCEL_TOKEN в Settings → Secrets (CLI-deploy сейчас в режиме skip+warning; production покрыт Vercel Git integration)
- Включение Dependency graph в Settings → Advanced Security (dependency-review сейчас в режиме probe+skip)

### OPS-2 — Контракт против дрейфа

Источник дрейфа: guard-тесты дублируют строки копий вручную. Решение:

- ключевые продуктовые копии вынести в copy-модули (lib/platform-v7/copy/*), компоненты и тесты импортируют один источник
- honesty-инварианты (forbidden claims) держать одним реестром, прогоняемым по glob исходников, а не по перечисленным файлам

### OPS-3 — Конвейерное правило

Каждый автоматический слой обязан перед merge прогонять полный web vitest, а не только свой файл. Узкий guard-скоуп остаётся для diff-дисциплины, но зелёность — глобальная.

## 5. Блок VP — видимый продукт (после зелёного VP-2)

### VP-3 — Deal Workspace Runtime Binding

Deal workspace читает состояние через application services + mock persistence adapter (Stage 5), а не через статические сценарии. Сценарии остаются как seed.

### VP-4 — Seller / Buyer Cockpit Binding

Кокпиты продавца и покупателя: партии, RFQ, предложения, блокеры денег — из runtime-слоя; действия через server action wrappers.

### VP-5 — Driver / Logistics Cockpit Binding

Рейс, следующее действие, offline-очередь; изоляция водителя подтверждается guard-тестами VP-2.3.

### VP-6 — Bank Cockpit Binding

Сумма, основание, документы, журнал, запрос на выпуск — через bank basis execution service; деньги не двигаются без банковского события (инвариант Stage 4/5).

### VP-7 — Dispute / Evidence Binding

Спор удерживает сумму через runtime, evidence pack собирается из audit sink.

### VP-8 — Theme / Mobile Final QA

Light/dark и mobile-проходы по связанным кокпитам; viewport-матрица 360→1920; запрет статуса только цветом.

## 6. Правила (без изменений с MASTER-ТЗ 1)

- один PR = один узкий слой
- controlled-pilot / pre-integration; никаких fake-live и production-ready заявлений
- нет apps/landing, нет lockfile-правок вне явного разрешения
- никакого module-level fake persistence; UI не зовёт domain напрямую
- код выглядит как работа инженерной команды: малые модули, явные типы, нормальные сообщения коммитов

## 7. Definition of Done (MASTER-ТЗ 2)

1. `pnpm --filter @pc/web test` — 0 падений, закреплено required-джобой CI.
2. `pnpm -r typecheck`, `pnpm build` — зелёные.
3. Все guard-контракты ролевой изоляции и honesty снова совпадают с исходниками.
4. CI не содержит перманентно красных джоб: deploy/dependency-review либо работают, либо honest-skip с warning.
5. VERCEL_TOKEN ротирован, dependency graph включён (действия владельца зафиксированы).
6. Кокпиты VP-3…VP-7 читают и пишут через runtime-слой Stage 5.
7. Copy-инварианты вынесены в единые модули; дрейф ловится в момент PR.
8. SOT (execution-queue, autopilot-state, progress) отражает фактическое состояние.
