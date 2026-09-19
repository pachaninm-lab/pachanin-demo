# P1 Runbook: Database Failure (ТЗ 13.5)

**Severity:** P1 — RTO < 30 min  
**Escalation:** On-call DBA + Backend lead + CTO

## Symptoms

- `grainflow_db_connections_available` < 5
- `grainflow_outbox_dead_total` rising fast
- API returning 503 / 500 for write operations
- `/health/detailed` shows `database: down`

## Impact

Full write outage. Read operations may continue from read-replicas. No new deals, payments, or documents can be created.

## Diagnosis

```bash
# 1. Check DB pod status
kubectl get pods -n grainflow-prod -l app=postgresql

# 2. Check DB logs
kubectl logs -n grainflow-prod -l app=postgresql --tail=100

# 3. Check API connection pool
curl -s https://api.grainflow.ru/health/detailed | jq '.checks.database'

# 4. Check outbox dead queue
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.grainflow.ru/api/settlement-engine/outbox/dead | jq length
```

## Resolution Steps

### Case A: Primary pod crashed (auto-recovery < 2 min)

1. K8s will restart the pod automatically via liveness probe
2. Monitor: `kubectl rollout status deployment/postgresql -n grainflow-prod`
3. Verify: `curl https://api.grainflow.ru/health/detailed`
4. If not recovered in 5 min → go to Case B

### Case B: Primary failed, promote read-replica

```bash
# Identify current primary and replicas
kubectl exec -n grainflow-prod postgresql-0 -- pg_controldata | grep "Database cluster state"

# Promote replica (PostgreSQL 16)
kubectl exec -n grainflow-prod postgresql-1 -- pg_ctl promote

# Update connection string in secret
kubectl patch secret grainflow-secrets -n grainflow-prod \
  --type='json' \
  -p='[{"op":"replace","path":"/data/DATABASE_URL","value":"'"$(echo -n "postgresql://app:$PASS@postgresql-1:5432/grainflow" | base64)"'"}]'

# Restart API to reconnect
kubectl rollout restart deployment/grainflow-api -n grainflow-prod
```

### Case C: Full datacenter failure

1. Switch DNS to DR site (Yandex Cloud AZ-2)
2. Activate standby PostgreSQL (RPO < 5 min, RTO < 30 min)
3. Verify data integrity: `SELECT COUNT(*) FROM deal WHERE created_at > NOW() - INTERVAL '1 hour'`
4. Replay outbox entries that failed during failover

## Post-Incident

- [ ] Root cause analysis within 24h
- [ ] Update this runbook if needed
- [ ] Check data consistency: `SELECT verify_debit_credit_balance()`
- [ ] Review dead outbox entries and replay if needed
- [ ] Alert compliance if financial data gap > 0

## Contacts

| Role | Contact |
|------|---------|
| On-call DBA | PagerDuty: grainflow-dba |
| Backend Lead | PagerDuty: grainflow-backend |
| CTO (P1 escalation) | Telegram: @cto_handle |
