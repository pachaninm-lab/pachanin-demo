# RUNBOOK: P2 — Высокий error rate API (> 1%)

**Severity:** P2 — High  
**SLA RTO:** < 2 часа  
**Триггер:** `http_req_failed > 1%` в течение 5 минут  

---

## 1. Быстрая диагностика

```bash
# Текущий error rate из Prometheus
curl -sS "http://prometheus.grainflow.internal:9090/api/v1/query?query=rate(http_requests_total{status=~'5..'}[5m])/rate(http_requests_total[5m])" \
  | jq '.data.result[0].value[1]'

# Топ ошибочных endpoints
curl -sS "http://prometheus.grainflow.internal:9090/api/v1/query?query=topk(10,rate(http_requests_total{status=~'5..'}[5m]))" \
  | jq '.data.result[] | "\(.metric.handler): \(.value[1])"'

# Логи ошибок за последние 15 минут
kubectl logs -n grainflow-prod deployment/grainflow-api --since=15m | grep -E '"level":"error"' | tail -50
```

## 2. Анализ по типу ошибок

### HTTP 500 — Internal Server Error

```bash
# Найти stack traces в логах
kubectl logs -n grainflow-prod deployment/grainflow-api --since=15m \
  | jq -r 'select(.level=="error") | "\(.timestamp) \(.message) \(.stack)"' | head -30

# Проверить memory/CPU
kubectl top pods -n grainflow-prod -l app=api
```

### HTTP 503 — Service Unavailable

```bash
# Проверить количество активных Pod'ов vs replicas
kubectl get deployment grainflow-api -n grainflow-prod -o jsonpath='{.status.readyReplicas}/{.spec.replicas}'

# Если не хватает реплик — масштабировать
kubectl scale deployment grainflow-api -n grainflow-prod --replicas=5
```

### HTTP 429 — Rate Limit

```bash
# Найти IP-адрес, бьющий по лимитам
kubectl logs -n grainflow-prod deployment/grainflow-api --since=15m \
  | jq -r 'select(.message | contains("rate limit")) | .ip' | sort | uniq -c | sort -rn | head -10

# Заблокировать если необходимо (через WAF / nginx)
```

## 3. Откат при необходимости

```bash
# Проверить когда последний деплой
kubectl rollout history deployment/grainflow-api -n grainflow-prod

# Откатиться если деплой совпадает с началом ошибок
kubectl rollout undo deployment/grainflow-api -n grainflow-prod
```

## 4. После стабилизации

1. Убедиться что error rate вернулся < 0.5%
2. Проверить p95 latency (должно быть < 500ms)
3. Написать в `#incidents` о причинах и принятых мерах
