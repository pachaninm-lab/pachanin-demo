FAILURE_REASON="PgBouncer configuration or runtime routing failed"

kubectl create secret generic grainflow-pgbouncer-secrets -n "$NAMESPACE" \
  --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  --from-literal=APP_DB_PASSWORD="$APP_DB_PASSWORD" \
  --from-literal=AUTH_DB_PASSWORD="$AUTH_DB_PASSWORD" \
  --from-literal=STORAGE_DB_PASSWORD="$STORAGE_DB_PASSWORD" \
  --from-literal=OUTBOX_DB_PASSWORD="$OUTBOX_DB_PASSWORD"

kubectl apply -f infra/kind/production-like/pgbouncer.yaml > "$K8S_DIR/pgbouncer-apply.log"
kubectl apply -f infra/kind/production-like/pgbouncer-network-policy.yaml > "$K8S_DIR/pgbouncer-network-policy-apply.log"
kubectl rollout status -n "$NAMESPACE" deployment/pgbouncer --timeout=300s

kubectl create secret generic grainflow-api-secrets -n "$NAMESPACE" \
  --from-literal=DATABASE_URL="postgresql://app_runtime:${APP_DB_PASSWORD}@pgbouncer:5432/grainflow?schema=public&connection_limit=20&pool_timeout=10" \
  --from-literal=AUTH_DATABASE_URL="postgresql://app_auth:${AUTH_DB_PASSWORD}@pgbouncer:5432/grainflow?schema=public&connection_limit=10&pool_timeout=10" \
  --from-literal=STORAGE_DATABASE_URL="postgresql://app_storage:${STORAGE_DB_PASSWORD}@pgbouncer:5432/grainflow?schema=public&connection_limit=10&pool_timeout=10" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=AUTH_TOKEN_PEPPER="$AUTH_TOKEN_PEPPER" \
  --from-literal=MFA_ENCRYPTION_KEY="$MFA_ENCRYPTION_KEY" \
  --from-literal=RATE_LIMIT_KEY_PEPPER="$RATE_LIMIT_KEY_PEPPER" \
  --from-literal=BANK_HMAC_SECRET="$BANK_HMAC_SECRET" \
  --from-literal=FGIS_WEBHOOK_SECRET="$FGIS_WEBHOOK_SECRET" \
  --from-literal=EDO_WEBHOOK_SECRET="$EDO_WEBHOOK_SECRET" \
  --from-literal=S3_ACCESS_KEY="$MINIO_ACCESS_KEY" \
  --from-literal=S3_SECRET_KEY="$MINIO_SECRET_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic grainflow-outbox-worker-secrets -n "$NAMESPACE" \
  --from-literal=DATABASE_URL="postgresql://app_outbox:${OUTBOX_DB_PASSWORD}@pgbouncer:5432/grainflow?schema=public&connection_limit=10&pool_timeout=10" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl run pgbouncer-runtime-check -n "$NAMESPACE" --restart=Never \
  --image=postgres:16.4-alpine3.20 \
  --labels=app.kubernetes.io/name=grainflow-api \
  --env="APP_DB_PASSWORD=${APP_DB_PASSWORD}" \
  --env="OUTBOX_DB_PASSWORD=${OUTBOX_DB_PASSWORD}" \
  --command -- sh -ec \
  'PGPASSWORD="$APP_DB_PASSWORD" psql -h pgbouncer -p 5432 -U app_runtime -d grainflow -v ON_ERROR_STOP=1 -c "SELECT current_user, current_database()"; PGPASSWORD="$OUTBOX_DB_PASSWORD" psql -h pgbouncer -p 5432 -U app_outbox -d grainflow -v ON_ERROR_STOP=1 -c "SELECT current_user, current_database()"'

for _ in $(seq 1 90); do
  phase="$(kubectl get pod pgbouncer-runtime-check -n "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || true)"
  [[ "$phase" = Succeeded ]] && break
  [[ "$phase" = Failed ]] && break
  sleep 1
done
kubectl logs -n "$NAMESPACE" pgbouncer-runtime-check > "$K8S_DIR/cluster/pgbouncer-runtime-check.log" 2>&1 || true
test "$(kubectl get pod pgbouncer-runtime-check -n "$NAMESPACE" -o jsonpath='{.status.phase}')" = Succeeded
