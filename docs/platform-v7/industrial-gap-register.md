# Industrial Gap Register — Прозрачная Цена

Дата актуализации: 2026-07-12 (по фактическому состоянию `main` @ `5f093b3`).
Метод: чтение кода, схемы Prisma, применённых миграций и триггеров реальной PostgreSQL 16
(локальный прогон `prisma migrate deploy` + инспекция `information_schema.triggers`).
Этот файл — единственный живой реестр разрывов промышленной готовности. Старые аудиты
(`AUDIT_platform-v7_full.md`, `AUDIT_maturity-runtime_2026-07-03.md`) — исторические
и не отражают текущее состояние.

Статусы: `OPEN` → `IN_PROGRESS` → `CLOSED (PR#…)`. Severity: P0 (деньги/данные/безопасность),
P1 (промышленная эксплуатация), P2 (качество/удобство).

---

## Сводка по фактическому состоянию

Что **уже есть** в main и является базой для transaction core:

- `DealCommandService` (`apps/api/src/modules/deals/deal-command.service.ts`) — атомарный
  command pipeline на Serializable-транзакции: state transition + hash-chained DealEvent +
  hash-chained AuditEvent + outbox receipt (idempotency replay) + ledger entries в одной
  транзакции. **Но включён только для одного захардкоженного deal**
  (`CANONICAL_TEST_DEAL_ID = 'DEAL-INDUSTRIAL-001'`).
- `IndustrialDealCommandGateway` — fail-closed membership resolution (UserOrg →
  DealParticipant ACTIVE → Organization VERIFIED → Deal tenant), bank-callback boundary
  (платформа не может self-confirm деньги на этом пути).
- PostgreSQL-схема с outbox_entries, audit_events (append-only триггер уже стоит),
  ledger_entries (INSERT-check `check_money_before_insert`), RLS-политики в
  `infra/sql/production-rls-policies.sql`.
- Персистентный auth (sessions, MFA, token rotation) с e2e-gate в CI на реальном PostgreSQL.

Что при этом **остаётся демонстрационным**: весь основной трафик сделок
(list/get/workspace/create/transition, документы, рейсы, пробы, платежи, callbacks)
по умолчанию обслуживается `RuntimeCoreService` — in-memory массивами процесса Node.js.

---

## P0 — деньги, данные, безопасность

### GAP-001 — In-memory runtime как production authority для сделок
- **Проблема**: `RuntimeCoreService` хранит deals/documents/shipments/samples/payments/
  callbacks/evidence в массивах процесса. Рестарт теряет состояние; два API instance
  видят разные данные; счётчики id конфликтуют.
- **Файлы**: `apps/api/src/modules/runtime-core/runtime-core.service.ts`;
  `apps/api/src/modules/deals/deal-repository.factory.ts` (default = runtime);
  аналогичные factory в `documents`, `logistics`, `labs`, `settlement-engine`.
- **Риск**: потеря состояния сделок и денег, расхождение экземпляров, двойные операции.
- **Целевое решение**: канонический DB command path (`DealCommandService`) для **всех**
  сделок; runtime — только demo profile/tests; в production запуск без
  `repository mode = prisma` невозможен (fail closed).
- **Критерий закрытия**: production-конфигурация не может стартовать с runtime authority;
  все deal-команды идут через PostgreSQL-транзакцию; состояние переживает рестарт.
- **Тест**: integration-тест «команда → рестарт сервиса (новый DI-контейнер) → состояние
  и идемпотентность сохранены»; два параллельных экземпляра сервиса видят одно состояние.
- **Статус**: CLOSED в блоке 1 (branch claude/industrial-transaction-core): production startup fail-closed (`assertIndustrialProductionStartup`), industrial mode блокирует legacy transition/manual confirm; runtime остаётся только demo profile. UI-переключение — GAP-016.

### GAP-002 — Industrial command path ограничен одним тестовым deal
- **Проблема**: `assertCanonicalDealId` в `DealCommandService` и
  `IndustrialDealCommandGateway` отклоняет любой dealId, кроме `DEAL-INDUSTRIAL-001`.
- **Файлы**: `apps/api/src/modules/deals/deal-command.service.ts:379`,
  `apps/api/src/modules/deals/industrial-deal-command.gateway.ts:333`,
  `apps/api/src/modules/deals/deal-command.policy.ts:1`.
- **Риск**: промышленный контур существует только как демонстрация на одной сделке —
  «архитектурная готовность» выдаётся за готовность.
- **Целевое решение**: снять канонический гейт; command path обслуживает любой deal с
  ACTIVE DealParticipant в PostgreSQL; membership-резолюция остаётся fail-closed.
- **Критерий закрытия**: команды исполняются для произвольного количества сделок,
  созданных через DB, при сохранении всех проверок (роль, tenant, участник, state,
  idempotency, version).
- **Тест**: e2e полного цикла для N произвольных сделок; отказ для не-участника.
- **Статус**: CLOSED в блоке 1: канонический гейт снят; command path обслуживает любой deal с ACTIVE DealParticipant (e2e: 2 произвольные сделки, полный цикл 19 команд).

### GAP-003 — Float и 32-битные Int для денег
- **Проблема**: `Deal.volumeTons/pricePerTon/totalRub Float`, `Deal.totalKopecks Int`
  (максимум 21 474 836,47 ₽ — переполнение на крупной сделке), `Payment.amountRub Float`,
  `Payment.amountKopecks/holdAmountKopecks/refundedKopecks/commissionKopecks Int`,
  `LedgerEntry.amountKopecks Int`, `Dispute.claimAmountKopecks Int`,
  `DisputeMoneyHold.amountKopecks Int`, `AcceptanceRecord.moneyAdjustKopecks Int`,
  `LabSample.moneyDeltaRub Float`. RuntimeCore считает деньги JS-числами в рублях.
- **Файлы**: `apps/api/prisma/schema.prisma`; `runtime-core.service.ts` (amountRub);
  `apps/api/src/platform-v7/money-integer/money-integer.ts` (number, не bigint).
- **Риск**: переполнение, ошибки округления, расхождение ledger.
- **Целевое решение**: BIGINT для всех сумм в копейках; DECIMAL(20,6) для цены за тонну
  и веса; value object `Money` на bigint в `packages/domain-core`; запрет арифметики
  денег через JS number в новом коде.
- **Критерий закрытия**: миграция применена; канонический command path не использует
  Float/Int для денег; unit-тесты Money покрывают переполнение/округление/валюту.
- **Тест**: unit Money (bigint); integration: сделка на сумму > 21 474 836,47 ₽ проходит
  reserve/release без переполнения.
- **Статус**: CLOSED (ядро) в блоке 1: миграция BIGINT/DECIMAL, `Money` (bigint) в domain-core, ledger/arbitrator на bigint; e2e со сделкой 98,7 млрд ₽. Остальные VO — блок «Деньги и ledger».

### GAP-004 — Нет `version` (optimistic concurrency) на mutable-агрегатах
- **Проблема**: у `Deal`, `Payment`, `Shipment` нет `version BIGINT`; CAS в
  `DealCommandService` держится на `updatedAt` (миллисекундная точность, коллизии).
- **Файлы**: `apps/api/prisma/schema.prisma` (Deal, Payment, Shipment).
- **Риск**: конфликтующие переходы при одновременных командах; lost update.
- **Целевое решение**: `version BIGINT NOT NULL DEFAULT 0` + compare-and-swap
  `UPDATE … WHERE id = ? AND version = ?`, инкремент в каждой команде; 409 CONFLICT
  при расхождении.
- **Критерий закрытия**: каждый переход инкрементирует version; параллельная команда
  получает 409; API отдаёт version клиенту.
- **Тест**: race-тест «две команды одновременно — ровно одна проходит».
- **Статус**: CLOSED в блоке 1: `version BIGINT` на Deal/Payment/Shipment, CAS в каждой команде, 409 при конфликте; race-тест «две команды — один победитель».

### GAP-005 — Банковские callback вне канонического пути не идемпотентны
- **Проблема**: `RuntimeCoreService.registerSafeDealsCallback` принимает callback без
  provider event ID, подписи, replay-защиты и повторно применяет денежные эффекты при
  повторе. Канонический путь (`executeBankCallback`) корректен, но обслуживает один deal.
- **Файлы**: `apps/api/src/modules/runtime-core/runtime-core.service.ts:720`;
  `apps/api/src/modules/settlement-engine/*`.
- **Риск**: двойная выплата/резерв при повторном callback; spoofing.
- **Целевое решение**: все банковские callback идут через канонический DB-путь:
  unique constraint на provider event ID, payload fingerprint, replay → 200
  `already_processed`, mismatch → 409 без денежного эффекта.
- **Критерий закрытия**: N одинаковых callback → ровно один ledger effect и один
  переход; повтор возвращает сохранённый результат.
- **Тест**: race-тест параллельных duplicate callback на реальном PostgreSQL.
- **Статус**: CLOSED в блоке 1: в industrial mode все верифицированные callback идут через канонический путь; SECURITY DEFINER scope binding (dealId, operationId); burst-тест 24 параллельных duplicate → ровно один ledger effect.

### GAP-006 — `/ready` лжёт о зависимостях
- **Проблема**: `/ready` возвращает `database: 'ok'` без единого запроса к БД.
- **Файлы**: `apps/api/src/main.ts:91-93`.
- **Риск**: балансировщик направляет трафик в мёртвый инстанс; тихая деградация.
- **Целевое решение**: `/ready` выполняет реальный `SELECT 1`, проверяет применённость
  миграций и repository mode; `/live` — только живость процесса.
- **Критерий закрытия**: остановка PostgreSQL переводит `/ready` в non-200.
- **Тест**: integration: `/ready` падает при отключённой БД.
- **Статус**: CLOSED в блоке 1: /ready выполняет реальный SELECT 1 + проверку применённости миграций, 503 при отказе; /health/detailed проверяет БД.

### GAP-007 — Подавление ошибок audit/event через `.catch(() => {})`
- **Проблема**: `DealsService.create/transition` эмитят DealEvent с `.catch(() => {})` —
  потеря событий бизнес-аудита молча.
- **Файлы**: `apps/api/src/modules/deals/deals.service.ts:109,158`;
  поиск по репо показывает аналогичные подавления в других модулях.
- **Риск**: разрыв доказательной цепочки без сигнала.
- **Целевое решение**: на каноническом пути события пишутся в той же транзакции
  (уже так в `DealCommandService`); legacy-путь не допускается в production (GAP-001).
- **Критерий закрытия**: production-путь не содержит fire-and-forget записи audit/event.
- **Статус**: CLOSED для production-пути в блоке 1: канонический путь пишет события в той же транзакции; legacy fire-and-forget не достижим в industrial mode.

### GAP-008 — Append-only не форсирован для deal_events и ledger_entries
- **Проблема**: триггер append-only стоит только на `audit_events`,
  `staff_access_events`, `case_events`. `deal_events` и `ledger_entries` можно
  UPDATE/DELETE любым принципалом с правами записи.
- **Файлы**: миграции `20260711103000_staff_audit_chain_enforcement`; отсутствуют
  триггеры для `deal_events`, `ledger_entries`.
- **Риск**: незаметная правка доказательной и денежной истории.
- **Целевое решение**: BEFORE UPDATE/DELETE триггеры с RAISE EXCEPTION на
  `deal_events` и `ledger_entries`.
- **Критерий закрытия**: UPDATE/DELETE на этих таблицах падает на уровне БД.
- **Тест**: integration-тест прямого UPDATE → исключение PostgreSQL.
- **Статус**: CLOSED в блоке 1: RAISE-триггеры на deal_events/ledger_entries; тихие DO INSTEAD NOTHING правила удалены; e2e проверяет отказ UPDATE/DELETE на уровне БД.

### GAP-009 — Роль/скоуп из client state на legacy-путях
- **Проблема**: RuntimeCore фильтрует list по `user.role/orgId` из токена, но операции
  (sign, release, adjust) не проверяют участие в сделке; legacy
  `PATCH /deals/:id/transition` принимает произвольный `nextState`.
- **Файлы**: `runtime-core.service.ts`; `deals.controller.ts:83-105`.
- **Риск**: эскалация в рамках роли, обход state machine.
- **Целевое решение**: единственный способ смены статуса — server-side domain command
  (policy in `deal-command.policy.ts`); legacy transition отключён в production.
- **Критерий закрытия**: в production-конфигурации нет маршрута произвольной смены статуса.
- **Статус**: CLOSED в блоке 1: в industrial mode legacy PATCH transition отклоняется для всех сделок (DEAL_REQUIRES_COMMAND); единственный путь — доменная команда.

## P1 — промышленная эксплуатация

### GAP-010 — Outbox worker без lease/backoff/DLQ на канонической таблице
- **Проблема**: `workers/runtime-outbox-db/runtime-outbox-db.worker.ts` симулирует
  обработку (помечает PROCESSED без реальной доставки), без lease/heartbeat;
  каноническая `outbox_entries` не обрабатывается воркером с
  `FOR UPDATE SKIP LOCKED`, exponential backoff, jitter, DEAD_LETTER, re-drive.
- **Файлы**: `workers/runtime-outbox-db/*`, `apps/api/src/shared/runtime-db-persistence.ts`.
- **Целевое решение**: durable worker: claim батчей `FOR UPDATE SKIP LOCKED`, lease
  (leaseOwner/leaseExpiresAt), retryCount→nextRetryAt с экспонентой и jitter,
  maxRetries→DEAD_LETTER, manual re-drive, метрики.
- **Критерий закрытия**: два воркера параллельно не обрабатывают одну запись дважды;
  упавший воркер освобождает lease по таймауту.
- **Тест**: integration с двумя конкурирующими воркерами.
- **Статус**: CLOSED в блоке 1: DurableOutboxWorker (FOR UPDATE SKIP LOCKED, lease/heartbeat, exponential backoff + jitter, DEAD_LETTER, re-drive, queueStats); e2e: два конкурирующих воркера без double-processing, reclaim после lease expiry.

### GAP-011 — Ledger не double-entry-балансируется на уровне инварианта
- **Проблема**: `ledger_entries` — одна строка с debitAccount/creditAccount (компактная
  форма пары проводок), но нет проверки баланса по операции/сделке и записи balance
  invariant в тестах; `check_money_before_insert` проверяет только положительность.
- **Целевое решение**: инвариант sum(debit)=sum(credit) по correlation/operation
  (в компактной форме — автоматически выполняется одной строкой; требуется тест и
  запрет частичных пар при разложении), reconciliation-отчёт.
- **Статус**: CLOSED (ядро) в блоке 2: DB-backed bank reconciliation (immutable bank_statement_entries c contentHash-дедупликацией, reconciliation_runs, persisted cursor), mismatch → MANUAL_REVIEW без движения денег; escrow-инвариант `verifyDealEscrowInvariant` из append-only ledger; ротация/отзыв банковских ключей (BANK_HMAC_KEYS + append-only bank_key_revocations, fail-closed для unknown/expired/not-yet-valid/revoked). Полная производственная reconciliation с реальным банком — после live-доступа.

### GAP-012 — Startup guards не проверяют repository mode/секреты полностью
- **Проблема**: fail-closed есть для proxy и live-интеграций, но нет запрета
  runtime-repository в production и проверки применённости миграций при старте.
- **Файлы**: `apps/api/src/main.ts`.
- **Целевое решение**: production startup guard: DATABASE_URL обязателен, migrations
  current, repository mode = prisma, mock auth выключен.
- **Статус**: CLOSED (ядро) в блоке 1: production guard требует DATABASE_URL, repository=prisma, запрет test-accounts/runtime mutation; секрет-менеджер и полный контроль секретов — блок инфраструктуры.

### GAP-013 — Sandbox-коннекторы могут выглядеть как live
- **Проблема**: `integrationHealth()` в RuntimeCore возвращает захардкоженные статусы
  (`LIVE_SIMULATED` для GPS) на API-маршруте.
- **Целевое решение**: статусы интеграций только из `integration-sdk` registry с
  честными статусами designed/sandbox/live; фиксация в
  `docs/INTEGRATION_CAPABILITY_MATRIX.md`.
- **Статус**: OPEN (блок «Реальные интеграции»).

### GAP-014 — Нет партиционирования/архивации event-таблиц
- **Проблема**: audit_events/deal_events/outbox_entries растут неограниченно.
- **Целевое решение**: партиционирование по времени или архивная политика; индексы
  под целевые объёмы (миллионы событий).
- **Статус**: OPEN (блок «Масштабирование»).

### GAP-015 — Нагрузочные цели не доказаны
- **Проблема**: `apps/api/tests/load` существует, но нет доказанного прогона
  1 000 concurrent users / 5 000 sessions / 50 000 deals с p95/p99 в целях.
- **Целевое решение**: k6/artillery-профили + прогон в production-like окружении,
  результаты фиксируются как evidence.
- **Статус**: OPEN (блок «Масштабирование»). Требует внешнего окружения.

## P2 — качество и удержание

### GAP-016 — UX-контур не подтверждён на DB-пути
- **Проблема**: `apps/web/app/platform-v7` использует execution-workspace только для
  канонической сделки; остальные экраны читают runtime-данные.
- **Целевое решение**: после generalization (GAP-002) переключить экраны на
  канонический workspace; 409-обновление экрана с понятным сообщением; RU/EN/ZH.
- **Статус**: OPEN (блок UX, после transaction core).

### GAP-017 — Money value objects отсутствуют в domain-core
- **Проблема**: `money-integer.ts` в platform-v7 работает на `number`.
- **Целевое решение**: `Money`/`Weight`/`PricePerTon`/`QualityAdjustment` на bigint/
  decimal-строках в `packages/domain-core`, переиспользование в api и web.
- **Статус**: CLOSED: Money (блок 1); Weight/PricePerTon/QualityAdjustment на bigint микроединицах (блок 2).

### GAP-018 — Evidence storage: WORM/retention не доказаны
- **Проблема**: durable evidence storage (миграция `20260710173000`) есть, но
  Object Lock/immutable retention/antivirus/restore drill не подтверждены.
- **Статус**: OPEN (блок «Audit и evidence chain» / инфраструктура).

---

## Порядок закрытия (industrial plan)

1. **Блок 1 — Industrial Transaction Core** (текущий): GAP-001…010, 012, 017(Money).
2. Блок 2 — Деньги и ledger: GAP-011, остальные VO, reconciliation.
3. Блок 3 — Production-инфраструктура: GAP-013, 018, health/observability.
4. Блок 4 — Масштабирование: GAP-014, 015.
5. Блок 5 — UX low-digital-literacy + RU/EN/ZH на DB-пути: GAP-016.
6. Блок 6 — Реальные интеграции (sandbox → live со статусами по честной шкале).
