# ADR-003: Outbox Pattern для гарантированной доставки событий

**Статус:** Принято  
**Дата:** 2026-02-01  
**Авторы:** Backend Team  

## Контекст

При отказе внешних систем (банк, ЭДО) события могут теряться. Нужна гарантированная доставка без двойной отправки. В архитектуре пока нет Kafka.

## Решение

**Transactional Outbox Pattern:**

```
1. Бизнес-операция + запись в OutboxEntry — одна транзакция БД
2. OutboxRelayService опрашивает OutboxEntry со статусом PENDING
3. Доставляет во внешнюю систему
4. Помечает SENT или (при неудаче) увеличивает retryCount
5. После MAX_RETRIES → статус DEAD (DLQ)
```

Статусы: `PENDING` → `SENT` | `FAILED` → (retry) | `DEAD`

```typescript
// Каждое бизнес-событие создаёт OutboxEntry
await prisma.$transaction([
  prisma.deal.update({ where: { id }, data: { status: 'PAID' } }),
  prisma.outboxEntry.create({ data: { type: 'payment.completed', payload: {...} } }),
]);
```

## Последствия

- `+` At-least-once delivery гарантирована
- `+` Работает без Kafka (опрос БД)
- `+` DLQ (`DEAD` статус) для ручного вмешательства Admin
- `-` At-most-once не гарантировано — получатели должны быть idempotent
- `-` Polling нагружает БД (решение: переход на Kafka в Этапе 0)

## Путь к Kafka

При появлении Kafka `OutboxRelayService` заменяется на Debezium CDC — транзакционный Outbox pattern работает без изменений в бизнес-логике.
