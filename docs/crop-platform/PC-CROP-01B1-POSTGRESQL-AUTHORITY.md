# PC-CROP-01B.1 — PostgreSQL schema and invariant authority

Статус: `IMPLEMENTATION_IN_PROGRESS`  
Issue: `#2883`  
Parent: `#2882`  
Stack base: `PC-CROP-01A / PR #2879`  
Operational status: `NOT_ATTESTED`

## 1. Назначение

Этот slice создаёт транзакционный фундамент реестра товарных профилей на PostgreSQL 16. Он рассчитан на промышленную федеральную платформу, но сам по себе не является подтверждением production, внешней интеграции или нормативной актуальности профилей.

Главная граница: таблицы реестра не создают отдельные `Deal`, `Lot` или `Organization`. Они формируют версионируемые правила, которые последующие slices смогут закреплять за существующей Сделкой.

## 2. Выбор модели хранения

Рассмотрены варианты:

1. Полностью нормализованные таблицы на каждый вид правила.
2. Один JSON blob внутри `Deal`.
3. Файлы YAML/JSON как runtime authority.
4. Отдельный commodity microservice.
5. PostgreSQL identity/version tables + immutable canonical JSON content.
6. Внешний master-data provider как authority.

Выбран вариант 5.

Причины:

- стабильная identity, lifecycle, effective dates, approvals и provenance остаются relational;
- вся версия правила фиксируется единым SHA-256 и не распадается между таблицами при публикации;
- добавление новых культур и правил не требует постоянной миграции основной state machine;
- PostgreSQL остаётся единственным транзакционным authority;
- JSON content валидируется domain contract до записи и защищается DB-триггерами после выхода из DRAFT;
- последующая материализация индикаторов и документов в read models не меняет authority.

Prisma model sync имеет статус `PENDING_SCHEMA_SYNC`. SQL migration уже задаёт фактическую DB-модель, но slice нельзя закрывать до синхронизации `schema.prisma`, Prisma generate и drift acceptance.

## 3. Таблицы

### `commodity_profiles`

Стабильная идентичность профиля:

- canonical code;
- один из шести архетипов;
- авторитетное русское имя и RU/EN/ZH display layer;
- классификация;
- optimistic version;
- actor/time metadata.

После появления версии нельзя удалить профиль. `canonicalCode`, `archetype`, creator и identity immutable.

### `commodity_profile_versions`

Версия правил:

- monotonic sequence;
- lifecycle;
- canonical JSON content;
- `SHA-256` digest;
- source verification state;
- effective range;
- approval evidence;
- optimistic version;
- actor/time metadata.

Версия обязана начинаться в `DRAFT`. После выхода из DRAFT content и hash не меняются. Исправление создаёт новую sequence.

### `commodity_profile_transitions`

Append-only receipt:

- before/after lifecycle state;
- actor, role, tenant/purpose;
- reason;
- command/idempotency/correlation;
- content hash;
- previous transition hash/current hash;
- timestamp.

Composite foreign key запрещает связать receipt с версией другого профиля.

## 4. Конкурентная активация

Для одной profile identity используется transaction-level advisory lock:

`pg_advisory_xact_lock(hashtextextended(profileId, 0))`

После получения lock trigger повторно проверяет пересечение `tstzrange`. Это обеспечивает один результат при двух конкурентных попытках активации без зависимости от optional extension `btree_gist`.

Acceptance запускает две отдельные PostgreSQL sessions:

- A активирует первую approved version и удерживает transaction;
- B пытается активировать пересекающуюся version;
- B ждёт lock, затем получает `PC_PROFILE_EFFECTIVE_OVERLAP`;
- в базе остаётся один EFFECTIVE winner и один transition receipt.

## 5. Lifecycle и immutable history

Разрешены только:

- `DRAFT → REVIEW`;
- `REVIEW → DRAFT | APPROVED`;
- `APPROVED → EFFECTIVE | REVOKED`;
- `EFFECTIVE → DEPRECATED | REVOKED`;
- `DEPRECATED → REVOKED`.

DB блокирует:

- direct insert не в DRAFT;
- изменение identity;
- stale optimistic version;
- content update после DRAFT;
- content update без нового hash;
- EFFECTIVE без effectiveFrom;
- published state без approval evidence;
- DEPRECATED без effectiveTo;
- overlap;
- update/delete transition history;
- неправильный predecessor/prevHash receipt.

## 6. RLS

Все три таблицы используют `ENABLE ROW LEVEL SECURITY` и `FORCE ROW LEVEL SECURITY`.

- privileged server context читает и изменяет registry;
- обычный готовый server context читает только фактически действующие версии;
- draft/review/approval history и transition receipts закрыты от обычного контекста;
- write разрешён только `app_rls_privileged()`;
- отсутствие server RLS context означает fail closed.

Ролевое решение пользователя остаётся в NestJS policy layer следующего slice. База принимает только privileged service transaction, а не client-selected role/tenant.

## 7. Forward-only и forward-fix

Migration не удаляет и не переименовывает существующие таблицы, не меняет Deal authority и не требует PostgreSQL extension.

Rollback в production не выполняется destructive down-migration. При дефекте:

1. feature/API activation остаётся выключенной;
2. writes блокируются policy/feature flag;
3. выпускается forward-fix migration;
4. данные не удаляются;
5. несовместимая версия остаётся доступной для forensic review;
6. Prisma/schema/read layer включается только после повторной exact acceptance.

## 8. Evidence

Workflow обязан подтвердить:

- применение всей migration chain на чистом PostgreSQL 16;
- `prisma migrate status`;
- static scope/invariant verifier;
- DRAFT update;
- immutable REVIEW/APPROVED/EFFECTIVE content;
- append-only transition chain;
- initial-state restriction;
- lifecycle transition;
- concurrent overlap one-winner behavior;
- evidence hashes и 90-day artifact.

## 9. Граница незавершённости

До следующих slices отсутствуют:

- Prisma model sync;
- NestJS repository/service/commands;
- RBAC/ABAC/separation-of-duties workflow;
- idempotency result storage beyond transition command uniqueness;
- audit/outbox integration with existing platform events;
- API/BFF;
- подключение интерфейса;
- Deal/Lot version pin;
- external/live integrations.

Поэтому status остаётся `NOT_ATTESTED`, а acceptance report явно указывает `PENDING_SCHEMA_SYNC` и `NOT_IN_THIS_SLICE`.
