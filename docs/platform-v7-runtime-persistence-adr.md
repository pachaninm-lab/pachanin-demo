# Platform-v7 runtime persistence ADR

Дата: 2026-05-01
Статус: proposed, not implemented

## Контекст

Текущий runtime layer для bid/logistics commands использует server-side memory store.

Это подходит только для controlled pilot / demo contour и честно маркируется через `runtime-persistence-passport.ts`:

- `mode: server_memory`
- `durable: false`
- `productionReady: false`
- reset risk: restart/deploy

## Решение

Для production persistence нужен отдельный durable command/event store.

Базовый вариант по умолчанию: PostgreSQL.

Причины:

1. Нужны транзакции.
2. Нужна идемпотентность по command key.
3. Нужен audit trail.
4. Нужны запросы по сделке, лоту, заявке, рейсу и actor.
5. Нужна совместимость с будущим банковским, комплаенс и data-room контуром.

## Минимальная модель

Нужны 3 таблицы:

1. `platform_v7_runtime_commands`
2. `platform_v7_runtime_events`
3. `platform_v7_runtime_snapshots`

Команды нужны для идемпотентности и восстановления причины действия.
События нужны для audit trail.
Snapshots нужны для быстрого чтения projection без пересборки всего event stream.

## Что не делать

Не считать durable persistence закрытым через:

- in-memory store;
- browser localStorage;
- static fixture;
- JSON file in repo;
- Vercel serverless memory;
- test-only mock;
- demo-only seed.

## Production acceptance criteria

Persistence можно считать закрытым только если:

1. command write атомарный;
2. idempotency key имеет unique constraint;
3. event write происходит в той же transaction или через гарантированный outbox;
4. read projection восстанавливается после restart/deploy;
5. failed command не портит последнюю валидную projection;
6. rollback/error state в UI показывает server-confirmed состояние;
7. есть migration;
8. есть integration tests против реальной БД или testcontainer;
9. есть backup/restore strategy;
10. runtime-persistence-passport меняется только после фактического подключения durable store.

## Рекомендуемый порядок внедрения

1. Добавить schema migration.
2. Добавить repository interface.
3. Добавить Postgres adapter.
4. Перевести bid runtime store на adapter.
5. Перевести logistics runtime store на adapter.
6. Добавить integration tests.
7. Обновить persistence passport.
8. Только после этого убрать предупреждение о reset risk.

## Текущий статус

Не реализовано.

Этот ADR фиксирует целевой production path, но не заявляет, что durable persistence уже есть.
