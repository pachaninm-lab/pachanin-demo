# ADR-006: RBAC с 13 ролями и тройной изоляцией

**Статус:** Принято  
**Дата:** 2026-01-10  
**Авторы:** Backend Team, Product  

## Контекст

Платформа обслуживает 9+ типов участников с разными правами. Требуется:
- Роли для каждого типа участника
- Изоляция данных между организациями (multi-tenancy)
- Защита от доступа к чужим сделкам

## Решение

### 13 ролей

| Роль | Доступ |
|------|--------|
| `ADMIN` | Полный |
| `FARMER` | Свои продажи |
| `BUYER` | Свои покупки |
| `LOGISTICIAN` | Логистика |
| `LAB` | Лаборатория |
| `ELEVATOR` | Приёмка/хранение |
| `ACCOUNTANT` | Финансы (read) |
| `ACCOUNTING` | Финансы (write) |
| `COMPLIANCE_OFFICER` | KYC/AML |
| `ARBITRATOR` | Споры |
| `EXECUTIVE` | Аналитика |
| `SUPPORT_MANAGER` | Тикеты |
| `DRIVER` | GPS/маршруты |

### Тройная изоляция

```typescript
// 1. Role scope: что можно делать
if (!ALLOWED_ROLES.includes(user.role)) throw ForbiddenException();

// 2. Object scope: к чьим данным
if (deal.sellerOrgId !== user.orgId && deal.buyerOrgId !== user.orgId) throw ForbiddenException();

// 3. Tenant scope: в рамках своей организации
if (user.orgId !== resource.orgId) throw ForbiddenException();
```

### Enforcement через ActionExecutorService

```typescript
@Injectable()
export class ActionExecutorService {
  async execute<T>(action: Action, user: RequestUser, fn: () => Promise<T>): Promise<T> {
    await this.assertPermission(action, user);
    return fn();
  }
}
```

## Последствия

- `+` Гранулярный контроль доступа для каждой роли
- `+` Единая точка enforcement (ActionExecutorService)
- `+` Audit trail фиксирует роль при каждом действии
- `-` 13 ролей создают сложность в тестировании — нужна матрица
- **Решение:** `docs/ROLE_UAT_MATRIX_2026_04_04.md` — полная матрица тестов
