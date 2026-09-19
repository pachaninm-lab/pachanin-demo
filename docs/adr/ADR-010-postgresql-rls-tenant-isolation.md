# ADR-010: PostgreSQL RLS для мультитенантной изоляции

**Статус:** Принято  
**Дата:** 2024-07

## Контекст

GrainFlow — мультитенантная платформа: организации не должны видеть данные друг друга.
Требование ТЗ 4.1: row-level security для `deals`, `audit_events`, `ledger_entries`.

## Решение

PostgreSQL Row Level Security (RLS) с функцией контекста:

```sql
SET app.current_user_id = '<uuid>';
SET app.current_org_id = '<uuid>';
SET app.current_role = 'SELLER';
```

Политики:
- `deals`: `org_id = current_setting('app.current_org_id')`
- `audit_events`: только ADMIN и COMPLIANCE видят все, остальные — только своих
- `ledger_entries`: только собственные счета

## Альтернативы

| Альтернатива | Причина отклонения |
|---|---|
| WHERE в каждом запросе | Риск пропустить фильтр, нет defense-in-depth |
| Отдельные схемы/БД | Сложность, дорого при 10k+ организаций |
| Application-level only | Нет защиты от SQL injection в сложных запросах |

## Последствия

**Плюсы:**
- Defense-in-depth — защита даже при баге в application layer
- Аудит на уровне БД, невозможно обойти через Prisma
- Работает для всех клиентов (Prisma, прямые запросы, BI инструменты)

**Минусы:**
- Требует `SET` параметров до каждого запроса (middleware)
- Осложняет debug и административные запросы
- Производительность: дополнительная проверка на каждой строке
