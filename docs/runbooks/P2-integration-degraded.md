# RUNBOOK: P2 — Внешняя интеграция деградирует

**Severity:** P2 — High  
**SLA RTO:** < 2 часа  
**Оповещение:** Alertmanager → Telegram #ops + Backend On-call  

---

## 1. Определить какой адаптер деградирует

```bash
# Детальный health всех адаптеров
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.grainflow.ru/health/detailed | jq '.integrations'

# Пример вывода:
# {
#   "FGIS_ZERNO": { "status": "ok", "lastCheckedAt": "..." },
#   "FNS": { "status": "down", "detail": "Connection timeout" },
#   ...
# }
```

## 2. Действия по конкретному адаптеру

### ФГИС «Зерно» деградирует

```bash
# Проверить статус API Минсельхоз
curl -sf https://api.fgiszerno.ru/health || echo "FGIS DOWN"

# Включить fallback режим (ручная регистрация партий)
# В настройках: FGIS_FALLBACK_MODE=manual
kubectl set env deployment/grainflow-api FGIS_FALLBACK_MODE=manual -n grainflow-prod

# Уведомить операторов о необходимости ручного ввода ФГИС-номеров
```

### ФНС недоступна (KYC деградирует)

```bash
# Новые организации будут проходить KYC через СМЭВ ЕГРЮЛ
# (СМЭВ и ФНС работают независимо)
# Переключить на СМЭВ:
kubectl set env deployment/grainflow-api FNS_FALLBACK=SMEV -n grainflow-prod
```

### Диадок (ЭДО) недоступен

```bash
# Переключить на Такском как резервный оператор
kubectl set env deployment/grainflow-api EDO_PRIMARY=TAKSKOM -n grainflow-prod

# Уведомить менеджеров — документы будут в очереди
```

### КриптоПро DSS недоступен

```bash
# Отложить подписание (документы в статусе PENDING_SIGN)
# Ничего критического — деньги в escrow пока нет подписи
# Уведомить пользователей через webhook/email
```

### GPS трекинг деградирует

```bash
# Переключить на ручной ввод координат
kubectl set env deployment/grainflow-api GPS_MODE=manual -n grainflow-prod
```

## 3. Деградация vs отказ

| Поведение | Действие |
|-----------|----------|
| Единичные ошибки (< 5%) | Мониторинг, без действий |
| 5-30% ошибок | Включить circuit breaker, уведомить |
| > 30% ошибок или timeout | Переключить на fallback |
| Полный отказ > 30 мин | Инициировать P1 |

## 4. Circuit Breaker

Все адаптеры имеют встроенный circuit breaker. Состояния:
- `CLOSED` — нормальная работа
- `OPEN` — адаптер отключён, запросы немедленно возвращают ошибку
- `HALF_OPEN` — пробные запросы

```bash
# Принудительно открыть circuit breaker для адаптера
curl -X POST https://api.grainflow.ru/admin/integrations/circuit-breaker/open \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"adapter": "FNS"}'
```
