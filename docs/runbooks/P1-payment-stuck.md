# RUNBOOK: P1 — Платёж завис / деньги не дошли

**Severity:** P1 — Critical (финансы)  
**SLA RTO:** < 30 минут (диагностика), < 4 часа (разрешение)  
**Оповещение:** PagerDuty → On-call Backend + CFO  

---

## 1. Диагностика

```bash
# Найти зависшие escrow-записи
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.grainflow.ru/api/exports/outbox-status | jq '.pending, .dead'

# Проверить Outbox dead-letter
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.grainflow.ru/api/exports/outbox-status | jq '.entries[] | select(.status=="DEAD")'
```

```sql
-- Найти зависшие холды
SELECT id, dealId, amountKopecks, status, createdAt
FROM "MoneyHold"
WHERE status = 'RESERVED'
  AND "createdAt" < NOW() - INTERVAL '1 hour'
ORDER BY "createdAt" ASC;

-- Проверить баланс инварианта
SELECT SUM(CASE WHEN "entryType" = 'DEBIT' THEN "amountKopecks" ELSE -"amountKopecks" END) AS balance
FROM "LedgerEntry"
WHERE "createdAt" > NOW() - INTERVAL '24 hours';
-- Результат должен быть 0
```

## 2. Возможные причины и действия

### 2.1 Банковский адаптер не отвечает

```bash
# Проверить health банковского адаптера
curl -sS https://api.grainflow.ru/health/detailed | jq '.integrations.BANK'

# Перезапустить outbox relay
kubectl rollout restart deployment/grainflow-api -n grainflow-prod
```

### 2.2 Outbox event в статусе DEAD

```bash
# Вручную переставить событие в PENDING для повторной обработки
# (только через прямой SQL, требует согласования CFO)
psql $DATABASE_URL -c "
  UPDATE \"OutboxEntry\" 
  SET status = 'PENDING', \"retryCount\" = 0 
  WHERE id = '<event_id>' AND status = 'DEAD';
"
```

### 2.3 Холд завис (таймаут)

```bash
# Создать ручной release через Settlement API (только Admin)
curl -X POST https://api.grainflow.ru/api/settlement/manual-release \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"holdId": "<id>", "reason": "P1 incident: timeout, manual release approved by CFO"}'
```

## 3. Эскалация

- Если деньги не разрезолвились за 4 часа → CEO + Банк-партнёр (номинальный счёт)
- Если нарушен инвариант Debit=Credit → немедленный останов Settlement Engine + DevOps

## 4. Проверка после разрешения

```sql
-- Убедиться что баланс сошёлся
SELECT COUNT(*) FROM "MoneyHold" WHERE status = 'RESERVED' AND "createdAt" < NOW() - INTERVAL '30 min';
-- Должно быть 0
```
