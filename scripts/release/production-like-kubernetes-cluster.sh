FAILURE_REASON="kind cluster or CNI installation failed"
kind create cluster \
  --name "$CLUSTER_NAME" \
  --config infra/kind/production-like/kind-config.yaml \
  --image kindest/node:v1.30.4 \
  2>&1 | tee "$K8S_DIR/kind-create.log"
docker network connect kind "$REGISTRY_NAME" 2>/dev/null || true
kubectl cluster-info --context "kind-${CLUSTER_NAME}" > "$K8S_DIR/cluster-info.txt"

CALICO_URL="https://raw.githubusercontent.com/projectcalico/calico/v3.28.2/manifests/calico.yaml"
INGRESS_URL="https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/kind/deploy.yaml"
curl --fail --location --retry 5 "$CALICO_URL" -o "$K8S_DIR/external-manifests/calico.yaml"
curl --fail --location --retry 5 "$INGRESS_URL" -o "$K8S_DIR/external-manifests/ingress-nginx.yaml"
sha256sum "$K8S_DIR/external-manifests/calico.yaml" | awk '{print $1}' > "$K8S_DIR/external-manifests/calico.sha256"
sha256sum "$K8S_DIR/external-manifests/ingress-nginx.yaml" | awk '{print $1}' > "$K8S_DIR/external-manifests/ingress-nginx.sha256"
kubectl apply -f "$K8S_DIR/external-manifests/calico.yaml" > "$K8S_DIR/calico-apply.log"
kubectl wait --for=condition=Ready nodes --all --timeout=360s
kubectl apply -f "$K8S_DIR/external-manifests/ingress-nginx.yaml" > "$K8S_DIR/ingress-apply.log"
kubectl wait --namespace ingress-nginx \
  --for=condition=Ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=300s

kubectl create namespace "$NAMESPACE"
kubectl label namespace "$NAMESPACE" environment=production-like team=grainflow --overwrite

POSTGRES_PASSWORD="$(openssl rand -hex 24)"
APP_DB_PASSWORD="$(openssl rand -hex 24)"
AUTH_DB_PASSWORD="$(openssl rand -hex 24)"
STORAGE_DB_PASSWORD="$(openssl rand -hex 24)"
OUTBOX_DB_PASSWORD="$(openssl rand -hex 24)"
MINIO_ACCESS_KEY="acceptance$(openssl rand -hex 8)"
MINIO_SECRET_KEY="$(openssl rand -hex 24)"
JWT_SECRET="$(openssl rand -hex 32)"
AUTH_TOKEN_PEPPER="$(openssl rand -hex 32)"
MFA_ENCRYPTION_KEY="$(openssl rand -hex 32)"
RATE_LIMIT_KEY_PEPPER="$(openssl rand -hex 32)"
BANK_HMAC_SECRET="$(openssl rand -hex 32)"
FGIS_WEBHOOK_SECRET="$(openssl rand -hex 32)"
EDO_WEBHOOK_SECRET="$(openssl rand -hex 32)"
for secret in \
  "$POSTGRES_PASSWORD" "$APP_DB_PASSWORD" "$AUTH_DB_PASSWORD" "$STORAGE_DB_PASSWORD" "$OUTBOX_DB_PASSWORD" \
  "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" "$JWT_SECRET" "$AUTH_TOKEN_PEPPER" "$MFA_ENCRYPTION_KEY" \
  "$RATE_LIMIT_KEY_PEPPER" "$BANK_HMAC_SECRET" "$FGIS_WEBHOOK_SECRET" "$EDO_WEBHOOK_SECRET"; do
  mask "$secret"
done

kubectl create secret generic grainflow-postgresql-secrets -n "$NAMESPACE" \
  --from-literal=POSTGRES_DB=grainflow \
  --from-literal=POSTGRES_USER=postgres \
  --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD"
kubectl create secret generic grainflow-minio-secrets -n "$NAMESPACE" \
  --from-literal=MINIO_ROOT_USER="$MINIO_ACCESS_KEY" \
  --from-literal=MINIO_ROOT_PASSWORD="$MINIO_SECRET_KEY"
kubectl create secret generic grainflow-migration-secrets -n "$NAMESPACE" \
  --from-literal=DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@postgresql:5432/grainflow?schema=public"
kubectl create secret generic grainflow-api-secrets -n "$NAMESPACE" \
  --from-literal=DATABASE_URL="postgresql://app_runtime:${APP_DB_PASSWORD}@postgresql:5432/grainflow?schema=public" \
  --from-literal=AUTH_DATABASE_URL="postgresql://app_auth:${AUTH_DB_PASSWORD}@postgresql:5432/grainflow?schema=public" \
  --from-literal=STORAGE_DATABASE_URL="postgresql://app_storage:${STORAGE_DB_PASSWORD}@postgresql:5432/grainflow?schema=public" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=AUTH_TOKEN_PEPPER="$AUTH_TOKEN_PEPPER" \
  --from-literal=MFA_ENCRYPTION_KEY="$MFA_ENCRYPTION_KEY" \
  --from-literal=RATE_LIMIT_KEY_PEPPER="$RATE_LIMIT_KEY_PEPPER" \
  --from-literal=BANK_HMAC_SECRET="$BANK_HMAC_SECRET" \
  --from-literal=FGIS_WEBHOOK_SECRET="$FGIS_WEBHOOK_SECRET" \
  --from-literal=EDO_WEBHOOK_SECRET="$EDO_WEBHOOK_SECRET" \
  --from-literal=S3_ACCESS_KEY="$MINIO_ACCESS_KEY" \
  --from-literal=S3_SECRET_KEY="$MINIO_SECRET_KEY"
kubectl create secret generic grainflow-outbox-worker-secrets -n "$NAMESPACE" \
  --from-literal=DATABASE_URL="postgresql://app_outbox:${OUTBOX_DB_PASSWORD}@postgresql:5432/grainflow?schema=public"

FAILURE_REASON="production-like dependencies did not become ready"
kubectl apply -f infra/kind/production-like/dependencies.yaml > "$K8S_DIR/dependencies-apply.log"
kubectl patch statefulset postgresql -n "$NAMESPACE" --type=strategic \
  --patch-file infra/kind/production-like/postgresql-runtime-patch.yaml \
  > "$K8S_DIR/postgresql-runtime-patch.log"
if [[ "${PRODUCTION_LIKE_POSTGRES_TARGET_LOAD:-false}" = "true" ]]; then
  kubectl patch statefulset postgresql -n "$NAMESPACE" --type=strategic \
    --patch-file infra/kind/production-like/postgresql-target-load-patch.yaml \
    > "$K8S_DIR/postgresql-target-load-patch.log"
fi
kubectl patch deployment kafka -n "$NAMESPACE" --type=strategic \
  --patch-file infra/kind/production-like/kafka-runtime-patch.yaml \
  > "$K8S_DIR/kafka-runtime-patch.log"

# The initial apply can create the pre-patch PostgreSQL pod and Kafka ReplicaSet
# before the hardened templates are accepted. Force those disposable pods out so
# rollout status observes only the patched revisions.
kubectl delete pod postgresql-0 -n "$NAMESPACE" --ignore-not-found=true --wait=true \
  > "$K8S_DIR/postgresql-prepatch-pod-delete.log"
kubectl delete pods -n "$NAMESPACE" -l app.kubernetes.io/name=kafka --ignore-not-found=true --wait=true \
  > "$K8S_DIR/kafka-prepatch-pod-delete.log"

for workload in \
  statefulset/postgresql \
  deployment/kafka \
  deployment/redis \
  deployment/minio \
  deployment/otel-collector \
  deployment/prometheus \
  deployment/alertmanager; do
  kubectl rollout status -n "$NAMESPACE" "$workload" --timeout=360s
done

postgres_current_revision="$(kubectl get statefulset postgresql -n "$NAMESPACE" -o jsonpath='{.status.currentRevision}')"
postgres_update_revision="$(kubectl get statefulset postgresql -n "$NAMESPACE" -o jsonpath='{.status.updateRevision}')"
printf '%s:%s\n' "$postgres_current_revision" "$postgres_update_revision" \
  > "$K8S_DIR/cluster/postgresql-revision-proof.txt"
test -n "$postgres_current_revision"
test "$postgres_current_revision" = "$postgres_update_revision"
test "$(kubectl get deployment kafka -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')" = "1"
test "$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=kafka --no-headers | wc -l | tr -d ' ')" = "1"

kubectl run minio-init -n "$NAMESPACE" --restart=Never \
  --image=minio/mc:RELEASE.2024-05-09T17-04-24Z \
  --env="MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}" \
  --env="MINIO_SECRET_KEY=${MINIO_SECRET_KEY}" \
  --command -- /bin/sh -ec \
  'mc alias set acceptance http://minio:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"; mc mb --ignore-existing acceptance/grainflow-documents; mc stat acceptance/grainflow-documents'
for _ in $(seq 1 90); do
  phase="$(kubectl get pod minio-init -n "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || true)"
  [[ "$phase" = Succeeded ]] && break
  [[ "$phase" = Failed ]] && { kubectl logs -n "$NAMESPACE" minio-init; exit 1; }
  sleep 2
done
test "$(kubectl get pod minio-init -n "$NAMESPACE" -o jsonpath='{.status.phase}')" = Succeeded
kubectl logs -n "$NAMESPACE" minio-init > "$K8S_DIR/minio-init.log"

FAILURE_REASON="database principal bootstrap failed"
kubectl exec -i -n "$NAMESPACE" statefulset/postgresql -- \
  env PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -U postgres -d grainflow \
  -v app_password="$APP_DB_PASSWORD" \
  -v auth_password="$AUTH_DB_PASSWORD" \
  -v storage_password="$STORAGE_DB_PASSWORD" \
  -v outbox_password="$OUTBOX_DB_PASSWORD" \
  < infra/kind/production-like/postgresql-principals-bootstrap.sql

FAILURE_REASON="dedicated migration Job failed"
kubectl apply -f "$K8S_DIR/rendered/initial-migration.yaml" > "$K8S_DIR/migration-apply.log"
migration_job="grainflow-migration-${EXACT_HEAD:0:12}"
kubectl wait --for=condition=Complete -n "$NAMESPACE" "job/${migration_job}" --timeout=900s
kubectl logs -n "$NAMESPACE" "job/${migration_job}" > "$K8S_DIR/logs/migration.log"
MIGRATION_EXECUTIONS="$(kubectl get jobs -n "$NAMESPACE" -l app.kubernetes.io/component=migration -o json | jq '[.items[] | select(.status.succeeded == 1)] | length')"
test "$MIGRATION_EXECUTIONS" = "1"

FAILURE_REASON="post-migration least-privilege grants failed"
kubectl exec -i -n "$NAMESPACE" statefulset/postgresql -- \
  env PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -U postgres -d grainflow \
  < infra/kind/production-like/postgresql-runtime-grants.sql

principal_proof="$(kubectl exec -n "$NAMESPACE" statefulset/postgresql -- env PGPASSWORD="$POSTGRES_PASSWORD" \
  psql -U postgres -d grainflow -Atc \
  "SELECT (SELECT count(*) FROM pg_roles WHERE rolname IN ('app_runtime','app_storage','app_outbox') AND (rolsuper OR rolbypassrls OR rolinherit)) || ':' || (SELECT count(*) FROM pg_roles WHERE rolname='app_auth' AND (rolsuper OR NOT rolbypassrls OR rolinherit)) || ':' || (SELECT count(*) FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname IN ('app_runtime','app_auth','app_storage','app_outbox'));")"
printf '%s\n' "$principal_proof" | tee "$K8S_DIR/cluster/principal-proof.txt"
test "$principal_proof" = "0:0:0"

ddl_privileges="$(kubectl exec -n "$NAMESPACE" statefulset/postgresql -- env PGPASSWORD="$APP_DB_PASSWORD" \
  psql -U app_runtime -d grainflow -Atc \
  "SELECT (has_database_privilege(current_user,current_database(),'CREATE')::int + has_schema_privilege(current_user,'public','CREATE')::int);")"
printf '%s\n' "$ddl_privileges" > "$K8S_DIR/cluster/application-ddl-privileges.txt"
test "$ddl_privileges" = "0"

outbox_proof="$(kubectl exec -n "$NAMESPACE" statefulset/postgresql -- env PGPASSWORD="$POSTGRES_PASSWORD" \
  psql -U postgres -d grainflow -Atc \
  "SELECT has_table_privilege('app_outbox','public.outbox_entries','SELECT')::int || ':' || has_table_privilege('app_outbox','public.outbox_entries','INSERT')::int || ':' || has_table_privilege('app_outbox','public.outbox_entries','DELETE')::int || ':' || has_table_privilege('app_outbox','public.deals','SELECT')::int;")"
printf '%s\n' "$outbox_proof" | tee "$K8S_DIR/cluster/outbox-principal-proof.txt"
test "$outbox_proof" = "1:0:0:0"

apply_release_marker() {
  local document="$1"
  local manifest_id source_commit migration_digest api_digest web_digest worker_digest migration_image_digest
  manifest_id="$(jq -r '.manifestId // .targetManifestId' "$document")"
  source_commit="$(jq -r '.sourceCommit // .targetSourceCommit' "$document")"
  migration_digest="$(jq -r '.migrationSetDigest // .targetMigrationSetDigest' "$document")"
  api_digest="$(jq -r '.components.api.digest // .targetComponents.api.digest' "$document")"
  web_digest="$(jq -r '.components.web.digest // .targetComponents.web.digest' "$document")"
  worker_digest="$(jq -r '.components.outboxWorker.digest // .targetComponents.outboxWorker.digest' "$document")"
  migration_image_digest="$(jq -r '.components.migration.digest // .targetComponents.migration.digest' "$document")"
  kubectl create configmap grainflow-release-authority -n "$NAMESPACE" \
    --from-literal=manifestId="$manifest_id" \
    --from-literal=sourceCommit="$source_commit" \
    --from-literal=migrationSetDigest="$migration_digest" \
    --from-literal=apiDigest="$api_digest" \
    --from-literal=webDigest="$web_digest" \
    --from-literal=outboxWorkerDigest="$worker_digest" \
    --from-literal=migrationDigest="$migration_image_digest" \
    --dry-run=client -o yaml | kubectl apply -f -
}

patch_web_hardening() {
  kubectl patch deployment grainflow-web -n "$NAMESPACE" --type=strategic --patch-file /dev/stdin <<'PATCH'
spec:
  template:
    spec:
      automountServiceAccountToken: false
      terminationGracePeriodSeconds: 60
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            - labelSelector:
                matchExpressions:
                  - key: app.kubernetes.io/name
                    operator: In
                    values: [grainflow-web]
              topologyKey: kubernetes.io/hostname
      containers:
        - name: web
          resources:
            requests:
              cpu: 100m
              memory: 192Mi
            limits:
              cpu: "1"
              memory: 768Mi
          startupProbe:
            httpGet:
              path: /api/health
              port: 3000
            periodSeconds: 5
            failureThreshold: 36
            timeoutSeconds: 3
PATCH
}
