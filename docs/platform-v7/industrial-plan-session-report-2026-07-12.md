# Отчёт: Industrial Plan — сессия 2026-07-12

Платформа «Прозрачная Цена». Ветка `claude/industrial-transaction-core-sgth0p`.
**8 блоков доведены до `main` через отдельные PR, каждый — после полного зелёного CI.**

| Блок | PR | Merge-коммит | Содержание |
|---|---|---|---|
| 1. Industrial Transaction Core | #2378 | `70d0d6d` | PostgreSQL-authority для любой сделки |
| 2. Деньги и ledger | #2379 | `8cfda70` | Reconciliation, ротация ключей, VO |
| 3. Наблюдаемость | #2380 | `f363702` | Метрики, correlation timeline, индексы |
| 4. UX: workspace любой сделки | #2381 | `e2c3644` | GAP-016 ядро, 409-UX |
| 5. Офлайн и языки | #2386 | `8617e8d` | Офлайн-очередь, RU/EN/ZH |
| 6. Список сделок участника | #2387 | `23a70de` | `/deals/accessible` + живой реестр |
| 7. Дашборд роли | #2401 | `addef48` | Вход → своя сделка |
| 8. CI-gate и load-proof | #2404 | `e47331c` | Обязательный gate, advisory locks |

---

## Сделано

### Блок 1 — Industrial Transaction Core (PR #2378)

- Аудит фактического `main`; создан живой реестр разрывов
  `docs/platform-v7/industrial-gap-register.md` (18 GAP, P0/P1/P2, критерии закрытия).
  Ключевая находка: атомарный PostgreSQL-pipeline существовал, но обслуживал один
  захардкоженный тестовый deal (`DEAL-INDUSTRIAL-001`); весь остальной трафик сделок
  жил в in-memory массивах процесса Node.js.
- Канонический command path обобщён на **любую** сделку с ACTIVE `DealParticipant`.
  Membership-резолюция fail-closed: UserOrg → участник сделки → организация VERIFIED →
  tenant; клиентские role/orgId никогда не выбирают скоуп.
- Optimistic concurrency: `version BIGINT` на Deal/Payment/Shipment, compare-and-swap в
  каждой команде, 409 CONFLICT при гонке, `expectedVersion` в командном DTO.
- Деньги: все kopeck-колонки → BIGINT (снят потолок Int32 = 21 474 836,47 ₽), цена и
  вес → DECIMAL(20,6) с backfill; value object `Money` на bigint в
  `packages/domain-core`; `LedgerV2` и арбитражные сплиты переведены на bigint.
- Append-only на уровне БД: RAISE-триггеры на `deal_events` и `ledger_entries`;
  найденные правила `DO INSTEAD NOTHING`, молча превращавшие UPDATE/DELETE в no-op,
  удалены — попытка мутации теперь громко падает.
- Банковский boundary: SECURITY DEFINER binding `(dealId, operationId)` →
  `(tenant, buyerOrg)` — без платформенной bank operation callback не имеет денежного
  эффекта; в industrial mode ручное подтверждение денег и произвольный `nextState`
  запрещены для всех сделок.
- Durable outbox worker: `FOR UPDATE SKIP LOCKED`, lease/heartbeat, exponential
  backoff + jitter, DEAD_LETTER, оператор re-drive, queueStats.
- Fail-closed production startup (`assertIndustrialProductionStartup`); честный
  `/ready` — реальный запрос к PostgreSQL и проверка применённости миграций (503 при
  отказе); `/health/detailed` проверяет БД.
- Forward-only migration gate научен различать lossless-расширение типов
  (Int→BIGINT/DECIMAL) и деструктивные rewrite.

### Блок 2 — Деньги и ledger (PR #2379)

- Bank reconciliation на PostgreSQL: `bank_statement_entries` (immutable evidence —
  триггер запрещает правку контента и DELETE, меняется только вердикт сверки),
  идемпотентный импорт по уникальному contentHash, `reconciliation_runs` +
  persisted cursor (`reconciliation_cursors`). MISMATCH → только MANUAL_REVIEW;
  в модуле нет ни одного пути к payments/deals/ledger. Демо-fallback, фабриковавший
  строки выписки из любого содержимого, удалён.
- Ротация банковских callback-ключей: `BANK_HMAC_KEYS` (несколько одновременно
  валидных ключей с окнами notBefore/notAfter; legacy `BANK_HMAC_SECRET` продолжает
  работать), мгновенный отзыв через append-only `bank_key_revocations` (проверка в
  PostgreSQL на каждом запросе — действует сразу на всех instance, отменить нельзя).
  Unknown/expired/not-yet-valid/revoked → fail closed + security-trail. Endpoint
  отзыва: ADMIN + MFA.
- VO `Weight` / `PricePerTon` / `QualityAdjustment` на bigint-микроединицах
  (точность DECIMAL(20,6)); сумма сделки и качественные дельты — целочисленно.
- `verifyDealEscrowInvariant`: escrow-баланс сделки выводится из append-only ledger
  и выявляет поддельный over-release.

### Блок 3 — Наблюдаемость (PR #2380)

- Prometheus-gauges денежного контура (scrape читает общий PostgreSQL — все instance
  показывают одну правду): глубина outbox по статусам, возраст старейшей due-записи,
  DEAD_LETTER, открытые reconciliation mismatch, отозванные ключи, fail-closed
  отклонения ключей за 24 ч.
- `GET /deals/:id/correlation-timeline` — единая хронология deal events, audit,
  outbox, банковских операций и привязанных строк выписки; membership-scoped;
  выборки ограничены (последние N на источник, default 200, max 500).
- Time-range индексы на `audit_events`, `deal_events`, `integration_events`,
  `ledger_entries`, `outbox_entries` (задел под партиционирование, GAP-014).

### Блок 4 — UX: workspace любой сделки (PR #2381)

- `CanonicalDealWorkspace` принимает `dealId`; новый маршрут
  `/platform-v7/deals/[id]/execution` открывает любую доступную участнику сделку.
- 409-конфликт — не ошибка пользователя: экран автоматически обновляется с
  сообщением «Данные изменились другим участником. Мы обновили экран…».
- Proxy строго real-backend-only для `execution-workspace`, `commands/*`,
  `correlation-timeline` **любого** dealId — демо-fallback не может сфабриковать
  состояние сделки на командном пути.
- Execution-маршрут открыт всем 12 бизнес-ролям на уровне shell-guard (по ревью:
  8 ролей ранее резались клиентом до серверной проверки); авторизация — только
  сервером.

### Блок 5 — Офлайн и языки (PR #2386)

- Офлайн-очередь команд для полевых ролей (водитель, элеватор, лаборатория,
  сюрвейер): обрыв связи → команда сохраняется на устройстве с исходными
  `commandId`/`idempotencyKey` и доставляется автоматически при событии `online`
  (или вручную). Сервер идемпотентен — повтор никогда не исполняет действие дважды.
  Одна отложенная команда на сделку; видимый статус-баннер; кнопка блокируется до
  синхронизации. По ревью ужесточено: 429/5xx не теряют команду (retry-later),
  удаляют её только финальный 4xx с показом причины и 409; недоступный localStorage
  честно даёт «не сохранено» вместо ложного обещания.
- Все видимые строки workspace покрыты словарём переводчика RU/EN/ZH.

### Блок 6 — Список сделок участника (PR #2387)

- `GET /deals/accessible`: сделки, где вызывающий — ACTIVE `DealParticipant`; скоуп
  определяет PostgreSQL через trusted RLS context; выборка ограничена (max 100);
  JSON-safe bigint (сделка на 98,7 млрд ₽ сериализуется корректно); `myRole` в
  каждой строке.
- Живой блок «Мои сделки в исполнении» на `/platform-v7/deals`: строки ведут в
  execution workspace; состояния «сервер недоступен» и «сделок нет» — честные;
  в proxy маршрут строго real-backend-only.

### Блок 7 — Дашборд роли (PR #2401)

- После входа корень каждой роли резолвит accessible-список и открывает execution
  workspace самой свежей сделки пользователя — сразу видно, что происходит и какое
  действие следующее.
- Переключение между сделками — inline-чипы через общий execution-маршрут (по
  ревью: реестр закрыт полевым ролям клиентским guard).
- Честный fallback: нет сделок или сервер недоступен → каноническая тестовая
  сделка, без фабрикации.

### Блок 8 — CI-gate и load-proof (PR #2404)

- Industrial-suite стал **обязательным CI-gate**: job `industrial-core-e2e`
  (postgres:16, `prisma migrate deploy`, весь `test/industrial`) с
  evidence-артефактом; прошёл в CI этого же PR.
- Load-proof (CI-scale): 24 сделки параллельно через полный цикл 19 команд на двух
  независимых instance + duplicate-callback шторм. Инварианты: каждая сделка CLOSED
  c version 19, ровно один RESERVE и один RELEASE в ledger на сделку, hash-цепочки
  непрерывны, ноль потерянных подтверждённых команд. Evidence:
  **p50 186 ms / p95 283 ms / p99 359 ms, 78 команд/с** (цель ТЗ p95 ≤ 800 ms
  закреплена ассерцией).
- Load-proof вскрыл дефект масштабирования: глобальный Serializable ронял
  параллельные сделки через predicate-локи индексов (SSI write-conflict уже на
  6 сделках). Pipeline переведён на **per-deal advisory transaction lock**
  (`pg_advisory_xact_lock` по dealId) + ReadCommitted: команды одной сделки строго
  упорядочены (что и требуется hash-цепочкам и receipt'ам), разные сделки не
  конкурируют вовсе; version-CAS страхует любой обход. Тот же лок — в bank-failure
  пути.

## Доказано

- **8 × полный зелёный CI** перед каждым merge (50–54 checks: one-deal
  12 ролей · 19 команд · RLS · DR restore; persistent-auth; Security Gate; Gitleaks;
  CodeQL; TypeScript strict; guard; с блока 8 — industrial-gate).
- Локально на реальном PostgreSQL 16: industrial e2e 5 suites / 26 tests
  (гонки, burst 24 duplicate-callback → один ledger effect, multi-instance
  replay/restart, append-only отказ на уровне БД, двух-worker outbox, reconciliation,
  escrow-инвариант, load-proof); one-deal exploitation gate — полный проход;
  auth e2e 9/9; API unit 380; domain-core VO 20; web-battery 96; миграции
  применяются с нуля drift-free.
- 6 замечаний Codex-ревью отработаны кодом (bounded timeline reads,
  transient-retry офлайн-очереди, честность при сбое хранилища, route-guard для
  полевых ролей); 4 некорректных (scope) — аргументированно отклонены со ссылкой
  на штатный механизм `approvedConcurrentScopes` и зелёный guard-job.

## Не доказано (требует внешних предпосылок, не кода)

- Production-окружение: HA PostgreSQL с PITR, PgBouncer, S3-хранилище с Object
  Lock, secret manager, минимум по 2 instance web/API/workers.
- Live-интеграции: Сбер «Безопасные сделки», ФГИС «Зерно», ЭДО, КЭП — нужны
  договоры и credentials партнёров; статусы в register честные (sandbox/designed).
- Нагрузка production-масштаба (1000 concurrent users / 50 000 deals),
  restore-drill у провайдера, измеренные RTO/RPO, внешний pentest.

## Риски

- **P1**: fixtures-поверхности web (DEAL360-реестр) остаются демонстрационными —
  вне денежного пути (командные маршруты real-backend-only), вывод отложен
  осознанно до наполнения контура реальными сделками.
- **P1**: полная production-reconciliation с реальным банком не подключена
  (нет live-credentials).
- **P2**: pre-existing падения широкого web-vitest на `main` (не в CI-gates) —
  стоит завести отдельный issue.

## Позиция по готовности

Транзакционное ядро, деньги, банковский boundary, outbox, наблюдаемость и главный
UX-путь (вход → своя сделка → одно действие → офлайн-устойчивость) работают на
PostgreSQL и защищены обязательными CI-гейтами. Объявление production-ready
честно заблокировано до внешних актов (нагрузка на production-масштабе,
restore-drill, live-интеграции, pentest) — позиция «NO-GO без evidence»
сохранена в gap register и autopilot-state.
