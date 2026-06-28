# RUNBOOK: P1 — API полностью недоступен

**Severity:** P1 — Critical  
**SLA RTO:** < 30 минут  
**Оповещение:** PagerDuty → On-call Backend + DevOps  

---

## 1. Диагностика

```bash
# Проверить статус Pod'ов
kubectl get pods -n grainflow-prod -l app=api

# Проверить последние логи
kubectl logs -n grainflow-prod deployment/grainflow-api --tail=100 --previous

# Проверить health endpoint
curl -sf https://api.grainflow.ru/health || echo "UNHEALTHY"

# Проверить события Pod'ов
kubectl describe pods -n grainflow-prod -l app=api | grep -A5 Events
```

## 2. Возможные причины и действия

### 2.1 Crash Loop (OOMKilled / Error)

```bash
# Посмотреть причину падения
kubectl get pods -n grainflow-prod | grep -v Running
kubectl describe pod <pod-name> -n grainflow-prod

# Если OOMKilled — временно поднять лимит памяти
kubectl set resources deployment/grainflow-api -n grainflow-prod \
  --limits=memory=2Gi --requests=memory=1Gi

# Если Error — откатиться на предыдущий образ
kubectl rollout undo deployment/grainflow-api -n grainflow-prod
kubectl rollout status deployment/grainflow-api -n grainflow-prod
```

### 2.2 База данных недоступна

```bash
# Проверить соединение с PostgreSQL
kubectl exec -n grainflow-prod deployment/grainflow-api -- \
  node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.\$connect().then(()=>console.log('DB OK')).catch(e=>console.error('DB FAIL',e.message))"

# Проверить статус PostgreSQL StatefulSet
kubectl get pods -n grainflow-prod -l app=postgresql

# Если primary упал — проверить failover реплики
kubectl exec -n grainflow-prod postgresql-0 -- pg_controldata | grep "Database cluster state"
```

### 2.3 Деплой сломан

```bash
# Немедленный откат через ArgoCD
argocd app rollback grainflow-api --revision HEAD~1

# Или через kubectl
kubectl rollout history deployment/grainflow-api -n grainflow-prod
kubectl rollout undo deployment/grainflow-api -n grainflow-prod --to-revision=<номер>
```

### 2.4 Проблема с образом контейнера

```bash
# Проверить доступность registry
docker pull cr.yandex/grainflow/api:latest

# Форсировать пересоздание Pod'ов
kubectl rollout restart deployment/grainflow-api -n grainflow-prod
```

## 3. Коммуникация

1. Создать инцидент в PagerDuty
2. Уведомить CEO + CTO в Telegram
3. Обновлять статус каждые 10 минут в канале `#incidents`

## 4. Post-mortem

После восстановления — заполнить шаблон в `/docs/ops/postmortem-template.md` в течение 24 часов.
