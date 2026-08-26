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
STAFF_DB_PASSWORD="$(openssl rand -hex 24)"
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
  "$POSTGRES_PASSWORD" "$APP_DB_PASSWORD" "$AUTH_DB_PASSWORD" "$STAFF_DB_PASSWORD" "$STORAGE_DB_PASSWORD" "$OUTBOX_DB_PASSWORD" \
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
  --from-literal=STAFF_DATABASE_URL="postgresql://app_staff:${STAFF_DB_PASSWORD}@postgresql:5432/grainflow?schema=public" \
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
kubectl patch deployment kafka -n "$NAMESPACE" --type=strategic \
  --patch-file infra/kind/production-like/kafka-runtime-patch.yaml \
  > "$K8S_DIR/kafka-runtime-patch.log"

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
printf '%s:%s\n' "$postgres_current_revision" "$postgres_update_revision" > "$K8S_DIR/cluster/postgresql-revision-proof.txt"
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
  -v staff_password="$STAFF_DB_PASSWORD" \
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
  "SELECT (SELECT count(*) FROM pg_roles WHERE rolname IN ('app_runtime','app_auth','app_staff','app_storage','app_outbox') AND (rolsuper OR rolbypassrls OR rolinherit)) || ':' || (SELECT count(*) FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname IN ('app_runtime','app_auth','app_staff','app_storage','app_outbox'));")"
printf '%s\n' "$principal_proof" | tee "$K8S_DIR/cluster/principal-proof.txt"
test "$principal_proof" = "0:0"

auth_identity_proof="$(kubectl exec -n "$NAMESPACE" statefulset/postgresql -- env PGPASSWORD="$POSTGRES_PASSWORD" \
  psql -U postgres -d grainflow -Atc \
  "SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('users','user_orgs','organizations') AND c.relrowsecurity AND c.relforcerowsecurity) || ':' || (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname='public' AND c.relname IN ('users','user_orgs','organizations') AND r.rolname='app_auth') || ':' || (has_function_privilege('app_auth','auth.resolve_login_credential(text)','EXECUTE') AND has_function_privilege('app_auth','auth.resolve_login_default_membership(text)','EXECUTE') AND has_function_privilege('app_auth','auth.resolve_login_context_by_membership(text,text)','EXECUTE') AND has_function_privilege('app_auth','auth.resolve_session_identity(text,text,text,text)','EXECUTE') AND has_function_privilege('app_auth','auth.resolve_post_password_membership_ids(text)','EXECUTE') AND has_function_privilege('app_auth','auth.resolve_post_password_membership_context(text,text)','EXECUTE') AND has_function_privilege('app_auth','auth.resolve_session_identity_v2(text,text,text,text)','EXECUTE') AND has_function_privilege('app_auth','auth.finalize_authenticated_user_mfa(text,text,text)','EXECUTE') AND has_function_privilege('app_auth','auth.prepare_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)','EXECUTE') AND has_function_privilege('app_auth','auth.restart_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)','EXECUTE') AND has_function_privilege('app_auth','auth.mark_registration_email_verified(text,text,text)','EXECUTE') AND has_function_privilege('app_auth','auth.registration_join_notification_recipients(text,text,text)','EXECUTE') AND NOT (has_function_privilege('app_auth','auth.resolve_login_identity(text)','EXECUTE') OR has_function_privilege('app_auth','auth.resolve_login_identity_by_id(text)','EXECUTE') OR has_function_privilege('app_auth','auth.resolve_login_memberships(text)','EXECUTE') OR has_function_privilege('app_auth','auth.resolve_login_memberships_ordered(text)','EXECUTE') OR has_function_privilege('app_auth','auth.resolve_login_context_by_email(text)','EXECUTE')))::int || ':' || (SELECT count(*) FROM (VALUES ('app_auth'),('app_runtime'),('app_storage'),('app_outbox')) AS p(role) WHERE has_function_privilege(p.role,'auth.resolve_staff_target_scope(text,text,text,text,text)','EXECUTE') OR has_function_privilege(p.role,'auth.resolve_staff_deal_target_scope(text,text,text)','EXECUTE') OR has_function_privilege(p.role,'auth.staff_admission_queue(text,text,text,integer)','EXECUTE') OR has_function_privilege(p.role,'auth.staff_admission_application(text,text,text,text)','EXECUTE') OR has_function_privilege(p.role,'auth.staff_admission_decision(text,text,text,text,text,text)','EXECUTE') OR has_function_privilege(p.role,'auth.staff_organization_directory(text,text,text)','EXECUTE') OR has_function_privilege(p.role,'auth.staff_organization_users(text,text,text,text)','EXECUTE') OR has_function_privilege(p.role,'auth.staff_cabinet_deals(text,text,text,text,text)','EXECUTE')) || ':' || (SELECT count(*) FROM (VALUES ('app_runtime'),('app_storage'),('app_outbox')) AS p(role) WHERE has_function_privilege(p.role,'auth.resolve_post_password_membership_ids(text)','EXECUTE') OR has_function_privilege(p.role,'auth.resolve_post_password_membership_context(text,text)','EXECUTE') OR has_function_privilege(p.role,'auth.resolve_session_identity_v2(text,text,text,text)','EXECUTE') OR has_function_privilege(p.role,'auth.finalize_authenticated_user_mfa(text,text,text)','EXECUTE') OR has_function_privilege(p.role,'auth.prepare_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)','EXECUTE') OR has_function_privilege(p.role,'auth.restart_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)','EXECUTE') OR has_function_privilege(p.role,'auth.mark_registration_email_verified(text,text,text)','EXECUTE') OR has_function_privilege(p.role,'auth.registration_join_notification_recipients(text,text,text)','EXECUTE'));")"
printf '%s\n' "$auth_identity_proof" | tee "$K8S_DIR/cluster/auth-identity-proof.txt"
test "$auth_identity_proof" = "3:0:1:0:0"

staff_authority_proof="$(kubectl exec -n "$NAMESPACE" statefulset/postgresql -- env PGPASSWORD="$POSTGRES_PASSWORD" \
  psql -U postgres -d grainflow -Atc \
  "SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname IN ('public','auth') AND r.rolname='app_staff') || ':' || (SELECT count(*) FROM information_schema.role_table_grants g WHERE g.grantee='app_staff' AND g.table_schema IN ('public','auth')) || ':' || has_function_privilege('app_staff','auth.resolve_staff_target_scope(text,text,text,text,text)','EXECUTE')::int || ':' || has_function_privilege('app_staff','auth.resolve_staff_deal_target_scope(text,text,text)','EXECUTE')::int || ':' || has_function_privilege('app_staff','auth.staff_admission_queue(text,text,text,integer)','EXECUTE')::int || ':' || has_function_privilege('app_staff','auth.staff_admission_application(text,text,text,text)','EXECUTE')::int || ':' || has_function_privilege('app_staff','auth.staff_admission_decision(text,text,text,text,text,text)','EXECUTE')::int || ':' || has_function_privilege('app_staff','auth.staff_organization_directory(text,text,text)','EXECUTE')::int || ':' || has_function_privilege('app_staff','auth.staff_organization_users(text,text,text,text)','EXECUTE')::int || ':' || has_function_privilege('app_staff','auth.staff_cabinet_deals(text,text,text,text,text)','EXECUTE')::int || ':' || has_function_privilege('app_staff','auth.staff_admission_capability(text,text,text,text,text)','EXECUTE')::int || ':' || has_function_privilege('app_staff','auth.staff_projection_capability(text,text,text,text,text,text,boolean)','EXECUTE')::int || ':' || (has_function_privilege('app_staff','auth.resolve_login_credential(text)','EXECUTE') OR has_function_privilege('app_staff','auth.resolve_login_default_membership(text)','EXECUTE') OR has_function_privilege('app_staff','auth.resolve_login_context_by_membership(text,text)','EXECUTE') OR has_function_privilege('app_staff','auth.resolve_session_identity(text,text,text,text)','EXECUTE') OR has_function_privilege('app_staff','auth.resolve_post_password_membership_ids(text)','EXECUTE') OR has_function_privilege('app_staff','auth.resolve_post_password_membership_context(text,text)','EXECUTE') OR has_function_privilege('app_staff','auth.resolve_session_identity_v2(text,text,text,text)','EXECUTE') OR has_function_privilege('app_staff','auth.finalize_authenticated_user_mfa(text,text,text)','EXECUTE') OR has_function_privilege('app_staff','auth.prepare_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)','EXECUTE') OR has_function_privilege('app_staff','auth.restart_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)','EXECUTE') OR has_function_privilege('app_staff','auth.mark_registration_email_verified(text,text,text)','EXECUTE') OR has_function_privilege('app_staff','auth.registration_join_notification_recipients(text,text,text)','EXECUTE') OR has_function_privilege('app_staff','auth.resolve_login_identity(text)','EXECUTE') OR has_function_privilege('app_staff','auth.resolve_login_context_by_email(text)','EXECUTE'))::int;")"
printf '%s\n' "$staff_authority_proof" | tee "$K8S_DIR/cluster/staff-authority-proof.txt"
test "$staff_authority_proof" = "0:0:1:1:1:1:1:1:1:1:0:0:0"

mfa_authority_proof="$(kubectl exec -n "$NAMESPACE" statefulset/postgresql -- env PGPASSWORD="$POSTGRES_PASSWORD" \
  psql -U postgres -d grainflow -Atc \
  "SELECT (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles owner ON owner.oid=p.proowner WHERE n.nspname='auth' AND p.proname='finalize_authenticated_user_mfa' AND p.prosecdef AND owner.rolname='pc_auth_mfa_authority') || ':' || (SELECT count(*) FROM pg_roles WHERE rolname='pc_auth_mfa_authority' AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole) || ':' || (SELECT count(*) FROM pg_auth_members membership JOIN pg_roles granted ON granted.oid=membership.roleid WHERE granted.rolname='pc_auth_mfa_authority') || ':' || (has_table_privilege('pc_auth_mfa_authority','auth.sessions','SELECT') AND has_table_privilege('pc_auth_mfa_authority','auth.mfa_challenges','SELECT') AND has_table_privilege('pc_auth_mfa_authority','auth.credential_states','SELECT') AND has_column_privilege('pc_auth_mfa_authority','public.users','id','SELECT') AND has_column_privilege('pc_auth_mfa_authority','public.users','mfaEnabled','UPDATE') AND NOT has_table_privilege('pc_auth_mfa_authority','public.users','INSERT') AND NOT has_table_privilege('pc_auth_mfa_authority','public.users','DELETE') AND NOT has_table_privilege('pc_auth_mfa_authority','public.user_orgs','SELECT') AND NOT has_table_privilege('pc_auth_mfa_authority','public.organizations','SELECT'))::int || ':' || has_function_privilege('app_auth','auth.finalize_authenticated_user_mfa(text,text,text)','EXECUTE')::int || ':' || (SELECT count(*) FROM (VALUES ('app_runtime'),('app_staff'),('app_storage'),('app_outbox')) AS p(role) WHERE has_function_privilege(p.role,'auth.finalize_authenticated_user_mfa(text,text,text)','EXECUTE')) || ':' || (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='users' AND policyname IN ('users_mfa_finalize_select','users_mfa_finalize_update') AND 'pc_auth_mfa_authority'=ANY(roles));")"
printf '%s\n' "$mfa_authority_proof" | tee "$K8S_DIR/cluster/mfa-authority-proof.txt"
test "$mfa_authority_proof" = "1:1:0:1:1:0:2"

registration_lifecycle_proof="$(kubectl exec -n "$NAMESPACE" statefulset/postgresql -- env PGPASSWORD="$POSTGRES_PASSWORD" \
  psql -U postgres -d grainflow -Atc \
  "SELECT (SELECT count(*) FROM pg_proc function JOIN pg_namespace schema ON schema.oid=function.pronamespace JOIN pg_roles owner ON owner.oid=function.proowner WHERE schema.nspname='auth' AND function.proname IN ('prepare_pending_registration_identity','restart_pending_registration_identity','mark_registration_email_verified','registration_join_notification_recipients') AND function.prosecdef AND owner.rolname='pc_registration_lifecycle_authority') || ':' || (SELECT count(*) FROM pg_roles WHERE rolname='pc_registration_lifecycle_authority' AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole) || ':' || (SELECT count(*) FROM pg_auth_members membership JOIN pg_roles granted ON granted.oid=membership.roleid WHERE granted.rolname='pc_registration_lifecycle_authority') || ':' || (has_table_privilege('pc_registration_lifecycle_authority','public.users','SELECT') AND has_table_privilege('pc_registration_lifecycle_authority','public.users','INSERT') AND has_table_privilege('pc_registration_lifecycle_authority','public.users','UPDATE') AND NOT has_table_privilege('pc_registration_lifecycle_authority','public.users','DELETE') AND has_table_privilege('pc_registration_lifecycle_authority','public.user_orgs','SELECT') AND has_table_privilege('pc_registration_lifecycle_authority','public.user_orgs','INSERT') AND has_table_privilege('pc_registration_lifecycle_authority','public.user_orgs','UPDATE') AND NOT has_table_privilege('pc_registration_lifecycle_authority','public.user_orgs','DELETE') AND has_table_privilege('pc_registration_lifecycle_authority','public.organizations','SELECT') AND has_table_privilege('pc_registration_lifecycle_authority','public.organizations','INSERT') AND has_table_privilege('pc_registration_lifecycle_authority','public.organizations','UPDATE') AND NOT has_table_privilege('pc_registration_lifecycle_authority','public.organizations','DELETE'))::int || ':' || (has_function_privilege('app_auth','auth.prepare_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)','EXECUTE') AND has_function_privilege('app_auth','auth.restart_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)','EXECUTE') AND has_function_privilege('app_auth','auth.mark_registration_email_verified(text,text,text)','EXECUTE') AND has_function_privilege('app_auth','auth.registration_join_notification_recipients(text,text,text)','EXECUTE'))::int || ':' || (SELECT count(*) FROM (VALUES ('app_runtime'),('app_staff'),('app_storage'),('app_outbox')) AS runtime(role) WHERE has_function_privilege(runtime.role,'auth.prepare_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)','EXECUTE') OR has_function_privilege(runtime.role,'auth.restart_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)','EXECUTE') OR has_function_privilege(runtime.role,'auth.mark_registration_email_verified(text,text,text)','EXECUTE') OR has_function_privilege(runtime.role,'auth.registration_join_notification_recipients(text,text,text)','EXECUTE')) || ':' || (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN ('users','user_orgs','organizations') AND policyname LIKE '%_registration_lifecycle_%' AND 'pc_registration_lifecycle_authority'=ANY(roles));")"
printf '%s\n' "$registration_lifecycle_proof" | tee "$K8S_DIR/cluster/registration-lifecycle-proof.txt"
test "$registration_lifecycle_proof" = "4:1:0:1:1:0:9"

password_reset_authority_proof="$(kubectl exec -i -n "$NAMESPACE" statefulset/postgresql -- \
  env PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -d grainflow -At --set ON_ERROR_STOP=1 <<'SQL'
SELECT
  (SELECT count(*) FROM pg_proc function
   JOIN pg_namespace schema ON schema.oid = function.pronamespace
   JOIN pg_roles owner ON owner.oid = function.proowner
   WHERE schema.nspname = 'auth'
     AND function.proname IN ('resolve_password_reset_subject', 'replace_password_after_reset')
     AND function.prosecdef
     AND owner.rolname = 'pc_password_reset_authority')::text
  || ':' ||
  (SELECT count(*) FROM pg_roles
   WHERE rolname = 'pc_password_reset_authority'
     AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls
     AND NOT rolcreatedb AND NOT rolcreaterole)::text
  || ':' ||
  (SELECT count(*) FROM pg_auth_members membership
   JOIN pg_roles granted ON granted.oid = membership.roleid
   WHERE granted.rolname = 'pc_password_reset_authority')::text
  || ':' ||
  (
    has_schema_privilege('pc_password_reset_authority', 'auth', 'USAGE')
    AND has_schema_privilege('pc_password_reset_authority', 'public', 'USAGE')
    AND has_column_privilege('pc_password_reset_authority', 'public.users', 'id', 'SELECT')
    AND has_column_privilege('pc_password_reset_authority', 'public.users', 'email', 'SELECT')
    AND has_column_privilege('pc_password_reset_authority', 'public.users', 'status', 'SELECT')
    AND has_column_privilege('pc_password_reset_authority', 'public.users', 'deletedAt', 'SELECT')
    AND has_column_privilege('pc_password_reset_authority', 'public.users', 'passwordHash', 'UPDATE')
    AND has_column_privilege('pc_password_reset_authority', 'public.users', 'updatedAt', 'UPDATE')
    AND has_table_privilege('pc_password_reset_authority', 'auth.password_reset_challenges', 'SELECT')
    AND NOT has_table_privilege('pc_password_reset_authority', 'public.users', 'INSERT')
    AND NOT has_table_privilege('pc_password_reset_authority', 'public.users', 'DELETE')
    AND NOT has_table_privilege('pc_password_reset_authority', 'public.user_orgs', 'SELECT')
    AND NOT has_table_privilege('pc_password_reset_authority', 'public.organizations', 'SELECT')
  )::int::text
  || ':' ||
  (
    has_function_privilege('app_auth', 'auth.resolve_password_reset_subject(text)', 'EXECUTE')
    AND has_function_privilege('app_auth', 'auth.replace_password_after_reset(text,text,text,timestamptz)', 'EXECUTE')
  )::int::text
  || ':' ||
  (SELECT count(*) FROM (VALUES ('app_runtime'),('app_staff'),('app_storage'),('app_outbox')) AS runtime(role)
   WHERE has_function_privilege(runtime.role, 'auth.resolve_password_reset_subject(text)', 'EXECUTE')
      OR has_function_privilege(runtime.role, 'auth.replace_password_after_reset(text,text,text,timestamptz)', 'EXECUTE'))::text
  || ':' ||
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'users'
     AND policyname IN ('users_password_reset_select', 'users_password_reset_update')
     AND 'pc_password_reset_authority' = ANY (roles))::text;
SQL
)"
printf '%s\n' "$password_reset_authority_proof" | tee "$K8S_DIR/cluster/password-reset-authority-proof.txt"
test "$password_reset_authority_proof" = "2:1:0:1:1:0:2"

organization_team_authority_proof="$(kubectl exec -i -n "$NAMESPACE" statefulset/postgresql -- \
  env PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -d grainflow -At --set ON_ERROR_STOP=1 <<'SQL'
SELECT
  (SELECT count(*) FROM pg_proc function
   JOIN pg_namespace schema ON schema.oid = function.pronamespace
   JOIN pg_roles owner ON owner.oid = function.proowner
   WHERE schema.nspname = 'auth'
     AND function.proname IN (
       'organization_team_snapshot',
       'resolve_organization_admin_session',
       'organization_membership_exists_for_email'
     )
     AND function.prosecdef
     AND owner.rolname = 'pc_organization_access_authority')::text
  || ':' ||
  (SELECT count(*) FROM pg_roles
   WHERE rolname = 'pc_organization_access_authority'
     AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls
     AND NOT rolcreatedb AND NOT rolcreaterole)::text
  || ':' ||
  (SELECT count(*) FROM pg_auth_members membership
   JOIN pg_roles granted ON granted.oid = membership.roleid
   WHERE granted.rolname = 'pc_organization_access_authority')::text
  || ':' ||
  (
    has_column_privilege('pc_organization_access_authority', 'public.users', 'id', 'SELECT')
    AND has_column_privilege('pc_organization_access_authority', 'public.user_orgs', 'id', 'SELECT')
    AND has_column_privilege('pc_organization_access_authority', 'public.organizations', 'id', 'SELECT')
    AND has_column_privilege('pc_organization_access_authority', 'auth.sessions', 'id', 'SELECT')
    AND has_column_privilege('pc_organization_access_authority', 'auth.credential_states', 'credential_version', 'SELECT')
    AND NOT has_table_privilege('pc_organization_access_authority', 'public.users', 'UPDATE')
    AND NOT has_table_privilege('pc_organization_access_authority', 'public.user_orgs', 'UPDATE')
    AND NOT has_table_privilege('pc_organization_access_authority', 'public.organizations', 'UPDATE')
  )::int::text
  || ':' ||
  (
    has_function_privilege(
      'app_auth', 'auth.organization_team_snapshot(text,text,text,text,text)', 'EXECUTE'
    )
    AND has_function_privilege(
      'app_auth', 'auth.resolve_organization_admin_session(text,text,text,text,text)', 'EXECUTE'
    )
    AND has_function_privilege(
      'app_auth', 'auth.organization_membership_exists_for_email(text,text,text,text,text,text)', 'EXECUTE'
    )
  )::int::text
  || ':' ||
  (SELECT count(*) FROM (VALUES ('app_runtime'),('app_staff'),('app_storage'),('app_outbox')) AS runtime(role)
   WHERE has_function_privilege(
     runtime.role, 'auth.organization_team_snapshot(text,text,text,text,text)', 'EXECUTE'
   ) OR has_function_privilege(
     runtime.role, 'auth.resolve_organization_admin_session(text,text,text,text,text)', 'EXECUTE'
   ) OR has_function_privilege(
     runtime.role, 'auth.organization_membership_exists_for_email(text,text,text,text,text,text)', 'EXECUTE'
   ))::text
  || ':' ||
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('users', 'user_orgs', 'organizations')
     AND policyname LIKE '%_organization_team_select'
     AND 'pc_organization_access_authority' = ANY (roles))::text;
SQL
)"
printf '%s\n' "$organization_team_authority_proof" | tee "$K8S_DIR/cluster/organization-team-authority-proof.txt"
test "$organization_team_authority_proof" = "3:1:0:1:1:0:3"

invitation_membership_recovery_authority_proof="$(kubectl exec -i -n "$NAMESPACE" statefulset/postgresql -- \
  env PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -d grainflow -At --set ON_ERROR_STOP=1 <<'SQL'
SELECT
  (SELECT count(*) FROM pg_proc function
   JOIN pg_namespace schema ON schema.oid = function.pronamespace
   JOIN pg_roles owner ON owner.oid = function.proowner
   WHERE schema.nspname = 'auth'
     AND function.proname IN (
       'resolve_invitation_acceptance_credential',
       'accept_organization_invitation_identity'
     )
     AND function.prosecdef
     AND owner.rolname = 'pc_invitation_acceptance_authority')::text
  || ':' ||
  (SELECT count(*) FROM pg_proc function
   JOIN pg_namespace schema ON schema.oid = function.pronamespace
   JOIN pg_roles owner ON owner.oid = function.proowner
   WHERE schema.nspname = 'auth'
     AND function.proname IN (
       'change_organization_membership_role',
       'revoke_organization_membership',
       'prepare_organization_mfa_recovery_target',
       'organization_mfa_recovery_snapshot'
     )
     AND function.prosecdef
     AND owner.rolname = 'pc_organization_membership_command_authority')::text
  || ':' ||
  (SELECT count(*) FROM pg_proc function
   JOIN pg_namespace schema ON schema.oid = function.pronamespace
   JOIN pg_roles owner ON owner.oid = function.proowner
   WHERE schema.nspname = 'auth'
     AND function.proname IN (
       'resolve_mfa_recovery_identity',
       'finalize_mfa_recovery_identity'
     )
     AND function.prosecdef
     AND owner.rolname = 'pc_mfa_recovery_identity_authority')::text
  || ':' ||
  (SELECT count(*) FROM pg_roles
   WHERE rolname IN (
     'pc_invitation_acceptance_authority',
     'pc_organization_membership_command_authority',
     'pc_mfa_recovery_identity_authority'
   )
     AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls
     AND NOT rolcreatedb AND NOT rolcreaterole)::text
  || ':' ||
  (SELECT count(*) FROM pg_auth_members membership
   JOIN pg_roles granted ON granted.oid = membership.roleid
   WHERE granted.rolname IN (
     'pc_invitation_acceptance_authority',
     'pc_organization_membership_command_authority',
     'pc_mfa_recovery_identity_authority'
   ))::text
  || ':' ||
  (
    has_column_privilege('pc_invitation_acceptance_authority', 'public.users', 'id', 'INSERT')
    AND has_column_privilege('pc_invitation_acceptance_authority', 'public.user_orgs', 'id', 'INSERT')
    AND has_column_privilege('pc_invitation_acceptance_authority', 'auth.organization_invitations', 'status', 'UPDATE')
    AND NOT has_table_privilege('pc_invitation_acceptance_authority', 'auth.organization_invitations', 'UPDATE')
    AND NOT has_table_privilege('pc_invitation_acceptance_authority', 'public.users', 'UPDATE')
    AND NOT has_table_privilege('pc_invitation_acceptance_authority', 'public.user_orgs', 'UPDATE')
    AND has_column_privilege('pc_organization_membership_command_authority', 'public.users', 'id', 'SELECT')
    AND has_column_privilege('pc_organization_membership_command_authority', 'public.user_orgs', 'status', 'UPDATE')
    AND NOT has_table_privilege('pc_organization_membership_command_authority', 'public.users', 'UPDATE')
    AND NOT has_table_privilege('pc_organization_membership_command_authority', 'public.user_orgs', 'INSERT')
    AND has_column_privilege('pc_mfa_recovery_identity_authority', 'public.users', 'mfaEnabled', 'UPDATE')
    AND has_column_privilege('pc_mfa_recovery_identity_authority', 'auth.credential_states', 'mfa_enabled', 'UPDATE')
    AND NOT has_table_privilege('pc_mfa_recovery_identity_authority', 'auth.credential_states', 'UPDATE')
    AND NOT has_table_privilege('pc_mfa_recovery_identity_authority', 'public.users', 'INSERT')
    AND NOT has_table_privilege('pc_mfa_recovery_identity_authority', 'public.user_orgs', 'UPDATE')
    AND NOT has_table_privilege('pc_mfa_recovery_identity_authority', 'public.organizations', 'UPDATE')
  )::int::text
  || ':' ||
  (
    has_function_privilege('app_auth', 'auth.resolve_invitation_acceptance_credential(text,text)', 'EXECUTE')
    AND has_function_privilege('app_auth', 'auth.accept_organization_invitation_identity(text,text,bigint,text,text,boolean,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege('app_auth', 'auth.change_organization_membership_role(text,text,text,text,text,text,bigint,text)', 'EXECUTE')
    AND has_function_privilege('app_auth', 'auth.revoke_organization_membership(text,text,text,text,text,text,bigint)', 'EXECUTE')
    AND has_function_privilege('app_auth', 'auth.prepare_organization_mfa_recovery_target(text,text,text,text,text,text,bigint)', 'EXECUTE')
    AND has_function_privilege('app_auth', 'auth.organization_mfa_recovery_snapshot(text,text,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege('app_auth', 'auth.resolve_mfa_recovery_identity(text,text)', 'EXECUTE')
    AND has_function_privilege('app_auth', 'auth.finalize_mfa_recovery_identity(text,text,text,bigint)', 'EXECUTE')
  )::int::text
  || ':' ||
  (SELECT count(*) FROM (VALUES ('app_runtime'),('app_staff'),('app_storage'),('app_outbox')) AS runtime(role)
   WHERE has_function_privilege(runtime.role, 'auth.resolve_invitation_acceptance_credential(text,text)', 'EXECUTE')
      OR has_function_privilege(runtime.role, 'auth.accept_organization_invitation_identity(text,text,bigint,text,text,boolean,text,text,text,text)', 'EXECUTE')
      OR has_function_privilege(runtime.role, 'auth.change_organization_membership_role(text,text,text,text,text,text,bigint,text)', 'EXECUTE')
      OR has_function_privilege(runtime.role, 'auth.revoke_organization_membership(text,text,text,text,text,text,bigint)', 'EXECUTE')
      OR has_function_privilege(runtime.role, 'auth.prepare_organization_mfa_recovery_target(text,text,text,text,text,text,bigint)', 'EXECUTE')
      OR has_function_privilege(runtime.role, 'auth.organization_mfa_recovery_snapshot(text,text,text,text,text,text)', 'EXECUTE')
      OR has_function_privilege(runtime.role, 'auth.resolve_mfa_recovery_identity(text,text)', 'EXECUTE')
      OR has_function_privilege(runtime.role, 'auth.finalize_mfa_recovery_identity(text,text,text,bigint)', 'EXECUTE'))::text
  || ':' ||
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('users', 'user_orgs', 'organizations')
     AND policyname IN (
       'users_invitation_acceptance_select',
       'users_invitation_acceptance_insert',
       'user_orgs_invitation_acceptance_select',
       'user_orgs_invitation_acceptance_insert',
       'organizations_invitation_acceptance_select',
       'users_membership_command_select',
       'users_mfa_recovery_identity_select',
       'users_mfa_recovery_identity_update',
       'user_orgs_membership_command_select',
       'user_orgs_membership_command_update',
       'user_orgs_mfa_recovery_identity_select',
       'organizations_membership_command_select',
       'organizations_mfa_recovery_identity_select'
     ))::text;
SQL
)"
printf '%s\n' "$invitation_membership_recovery_authority_proof" | tee "$K8S_DIR/cluster/invitation-membership-recovery-authority-proof.txt"
test "$invitation_membership_recovery_authority_proof" = "2:4:2:3:0:1:1:0:13"

registration_decision_authority_proof="$(kubectl exec -i -n "$NAMESPACE" statefulset/postgresql -- \
  env PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -d grainflow -At --set ON_ERROR_STOP=1 <<'SQL'
SELECT
  (SELECT count(*) FROM pg_proc function
   JOIN pg_namespace schema ON schema.oid = function.pronamespace
   JOIN pg_roles owner ON owner.oid = function.proowner
   WHERE schema.nspname = 'auth'
     AND function.prosecdef
     AND function.proname IN (
       'registration_platform_actor_authorized',
       'registration_organization_admin_context',
       'registration_platform_review_queue',
       'registration_organization_join_queue',
       'lock_registration_decision_application',
       'apply_registration_identity_transition'
     )
     AND owner.rolname = 'pc_registration_decision_authority')::text
  || ':' ||
  (SELECT count(*) FROM pg_roles
   WHERE rolname = 'pc_registration_decision_authority'
     AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls
     AND NOT rolcreatedb AND NOT rolcreaterole)::text
  || ':' ||
  (SELECT count(*) FROM pg_auth_members membership
   JOIN pg_roles granted ON granted.oid = membership.roleid
   WHERE granted.rolname = 'pc_registration_decision_authority')::text
  || ':' ||
  (
    has_column_privilege('pc_registration_decision_authority', 'public.users', 'status', 'UPDATE')
    AND has_column_privilege('pc_registration_decision_authority', 'public.user_orgs', 'status', 'UPDATE')
    AND has_column_privilege('pc_registration_decision_authority', 'public.organizations', 'status', 'UPDATE')
    AND NOT has_table_privilege('pc_registration_decision_authority', 'public.users', 'INSERT')
    AND NOT has_table_privilege('pc_registration_decision_authority', 'public.user_orgs', 'INSERT')
    AND NOT has_table_privilege('pc_registration_decision_authority', 'public.organizations', 'INSERT')
    AND NOT has_table_privilege('pc_registration_decision_authority', 'auth.registration_applications', 'UPDATE')
    AND has_column_privilege('pc_registration_decision_authority', 'auth.registration_applications', 'id', 'UPDATE')
    AND NOT has_any_column_privilege('pc_registration_decision_authority', 'auth.registration_applications', 'UPDATE WITH GRANT OPTION')
    AND (SELECT count(*) FROM pg_attribute attribute
         WHERE attribute.attrelid = 'auth.registration_applications'::regclass
           AND attribute.attnum > 0
           AND NOT attribute.attisdropped
           AND has_column_privilege(
             'pc_registration_decision_authority',
             'auth.registration_applications',
             attribute.attname,
             'UPDATE'
           )) = 1
    AND NOT has_table_privilege('pc_registration_decision_authority', 'auth.registration_applications', 'INSERT')
    AND NOT has_any_column_privilege('pc_registration_decision_authority', 'auth.registration_applications', 'INSERT')
    AND NOT has_table_privilege('pc_registration_decision_authority', 'auth.registration_applications', 'DELETE')
  )::int::text
  || ':' ||
  (
    has_function_privilege('app_auth', 'auth.registration_platform_actor_authorized(text,text)', 'EXECUTE')
    AND has_function_privilege('app_auth', 'auth.registration_organization_admin_context(text,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege('app_auth', 'auth.registration_platform_review_queue(text,text,integer)', 'EXECUTE')
    AND has_function_privilege('app_auth', 'auth.registration_organization_join_queue(text,text,text,text,text,integer)', 'EXECUTE')
    AND has_function_privilege('app_auth', 'auth.lock_registration_decision_application(text,text,text,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege('app_auth', 'auth.apply_registration_identity_transition(text,text,text,text,text,text,text,text)', 'EXECUTE')
    AND NOT has_function_privilege('app_auth', 'auth.registration_role_assignment_allowed(text,text)', 'EXECUTE')
  )::int::text
  || ':' ||
  (SELECT count(*) FROM (VALUES ('app_runtime'),('app_staff'),('app_storage'),('app_outbox')) AS runtime(role)
   WHERE has_function_privilege(runtime.role, 'auth.registration_platform_actor_authorized(text,text)', 'EXECUTE')
      OR has_function_privilege(runtime.role, 'auth.registration_organization_admin_context(text,text,text,text,text)', 'EXECUTE')
      OR has_function_privilege(runtime.role, 'auth.registration_platform_review_queue(text,text,integer)', 'EXECUTE')
      OR has_function_privilege(runtime.role, 'auth.registration_organization_join_queue(text,text,text,text,text,integer)', 'EXECUTE')
      OR has_function_privilege(runtime.role, 'auth.lock_registration_decision_application(text,text,text,text,text,text,text)', 'EXECUTE')
      OR has_function_privilege(runtime.role, 'auth.apply_registration_identity_transition(text,text,text,text,text,text,text,text)', 'EXECUTE'))::text
  || ':' ||
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('users', 'user_orgs', 'organizations')
     AND policyname LIKE '%_registration_decision_%'
     AND 'pc_registration_decision_authority' = ANY (roles))::text;
SQL
)"
printf '%s\n' "$registration_decision_authority_proof" | tee "$K8S_DIR/cluster/registration-decision-authority-proof.txt"
test "$registration_decision_authority_proof" = "6:1:0:1:1:0:6"

account_lifecycle_authority_proof="$(kubectl exec -i -n "$NAMESPACE" statefulset/postgresql -- \
  env PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -d grainflow -At --set ON_ERROR_STOP=1 <<'SQL'
SELECT
  (SELECT count(*) FROM pg_proc function
   JOIN pg_namespace schema ON schema.oid = function.pronamespace
   JOIN pg_roles owner ON owner.oid = function.proowner
   WHERE schema.nspname = 'auth' AND function.proname = 'account_data_export'
     AND function.prosecdef AND owner.rolname = 'pc_account_export_authority')::text
  || ':' ||
  (SELECT count(*) FROM pg_proc function
   JOIN pg_namespace schema ON schema.oid = function.pronamespace
   JOIN pg_roles owner ON owner.oid = function.proowner
   WHERE schema.nspname = 'auth' AND function.proname = 'anonymize_account_identity'
     AND function.prosecdef AND owner.rolname = 'pc_account_anonymization_authority')::text
  || ':' ||
  (SELECT count(*) FROM pg_roles
   WHERE rolname IN ('pc_account_export_authority','pc_account_anonymization_authority')
     AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls
     AND NOT rolcreatedb AND NOT rolcreaterole)::text
  || ':' ||
  (SELECT count(*) FROM pg_auth_members membership
   JOIN pg_roles granted ON granted.oid = membership.roleid
   WHERE granted.rolname IN ('pc_account_export_authority','pc_account_anonymization_authority'))::text
  || ':' ||
  (
    has_column_privilege('pc_account_export_authority', 'public.users', 'id', 'SELECT')
    AND has_column_privilege('pc_account_export_authority', 'auth.credential_states', 'consent_version', 'SELECT')
    AND NOT has_table_privilege('pc_account_export_authority', 'public.users', 'UPDATE')
    AND NOT has_table_privilege('pc_account_export_authority', 'auth.sessions', 'UPDATE')
    AND has_column_privilege('pc_account_anonymization_authority', 'public.users', 'status', 'UPDATE')
    AND has_column_privilege('pc_account_anonymization_authority', 'auth.sessions', 'status', 'UPDATE')
    AND has_column_privilege('pc_account_anonymization_authority', 'auth.refresh_tokens', 'status', 'UPDATE')
    AND has_column_privilege('pc_account_anonymization_authority', 'auth.credential_states', 'credential_version', 'UPDATE')
    AND NOT has_table_privilege('pc_account_anonymization_authority', 'public.users', 'INSERT')
    AND NOT has_table_privilege('pc_account_anonymization_authority', 'public.users', 'DELETE')
    AND NOT has_table_privilege('pc_account_anonymization_authority', 'public.user_orgs', 'UPDATE')
    AND NOT has_table_privilege('pc_account_anonymization_authority', 'public.organizations', 'UPDATE')
  )::int::text
  || ':' ||
  (
    has_function_privilege('app_auth', 'auth.account_data_export(text,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege('app_auth', 'auth.anonymize_account_identity(text,text,text,text,text)', 'EXECUTE')
  )::int::text
  || ':' ||
  (SELECT count(*) FROM (VALUES ('app_runtime'),('app_staff'),('app_storage'),('app_outbox')) AS runtime(role)
   WHERE has_function_privilege(runtime.role, 'auth.account_data_export(text,text,text,text,text)', 'EXECUTE')
      OR has_function_privilege(runtime.role, 'auth.anonymize_account_identity(text,text,text,text,text)', 'EXECUTE'))::text
  || ':' ||
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'public' AND tablename IN ('users','user_orgs','organizations')
     AND policyname IN (
       'users_account_export_select',
       'user_orgs_account_export_select',
       'organizations_account_export_select',
       'users_account_anonymization_select',
       'users_account_anonymization_update',
       'user_orgs_account_anonymization_select',
       'organizations_account_anonymization_select'
     ))::text;
SQL
)"
printf '%s\n' "$account_lifecycle_authority_proof" | tee "$K8S_DIR/cluster/account-lifecycle-authority-proof.txt"
test "$account_lifecycle_authority_proof" = "1:1:2:0:1:1:0:7"

kubectl exec -i -n "$NAMESPACE" statefulset/postgresql -- \
  env PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -U postgres -d grainflow <<'SQL'
INSERT INTO public."organizations"("id","inn","name","type","status","tenantId","createdAt","updatedAt")
VALUES ('org-rls-probe','0000000000','RLS Probe','LEGAL','ACTIVE','tenant-rls-probe',now(),now());
INSERT INTO public."users"("id","email","passwordHash","fullName","status","createdAt","updatedAt")
VALUES ('user-rls-probe','probe@rls.invalid','probe-hash','RLS Probe','ACTIVE',now(),now());
INSERT INTO public."user_orgs"("id","userId","organizationId","role","isDefault","joinedAt")
VALUES ('m-rls-probe','user-rls-probe','org-rls-probe','ADMIN',true,now());
SQL

auth_bootstrap_proof="$(kubectl exec -n "$NAMESPACE" statefulset/postgresql -- env PGPASSWORD="$AUTH_DB_PASSWORD" \
  psql -U app_auth -d grainflow -Atc \
  "SELECT (SELECT count(*) FROM public.users) || ':' || (SELECT count(*) FROM public.organizations) || ':' || (SELECT count(*) FROM auth.resolve_login_credential('probe@rls.invalid')) || ':' || has_function_privilege(current_user,'auth.resolve_login_default_membership(text)','EXECUTE')::int || ':' || has_function_privilege(current_user,'auth.resolve_login_context_by_membership(text,text)','EXECUTE')::int || ':' || has_function_privilege(current_user,'auth.resolve_session_identity(text,text,text,text)','EXECUTE')::int || ':' || has_function_privilege(current_user,'auth.resolve_post_password_membership_ids(text)','EXECUTE')::int || ':' || has_function_privilege(current_user,'auth.resolve_post_password_membership_context(text,text)','EXECUTE')::int || ':' || has_function_privilege(current_user,'auth.resolve_session_identity_v2(text,text,text,text)','EXECUTE')::int || ':' || has_function_privilege(current_user,'auth.finalize_authenticated_user_mfa(text,text,text)','EXECUTE')::int || ':' || (has_function_privilege(current_user,'auth.prepare_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)','EXECUTE') AND has_function_privilege(current_user,'auth.restart_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)','EXECUTE') AND has_function_privilege(current_user,'auth.mark_registration_email_verified(text,text,text)','EXECUTE') AND has_function_privilege(current_user,'auth.registration_join_notification_recipients(text,text,text)','EXECUTE'))::int || ':' || (has_function_privilege(current_user,'auth.resolve_login_identity(text)','EXECUTE') OR has_function_privilege(current_user,'auth.resolve_login_identity_by_id(text)','EXECUTE') OR has_function_privilege(current_user,'auth.resolve_login_memberships(text)','EXECUTE') OR has_function_privilege(current_user,'auth.resolve_login_memberships_ordered(text)','EXECUTE') OR has_function_privilege(current_user,'auth.resolve_login_context_by_email(text)','EXECUTE'))::int;")"
printf '%s\n' "$auth_bootstrap_proof" | tee "$K8S_DIR/cluster/auth-bootstrap-proof.txt"

kubectl exec -i -n "$NAMESPACE" statefulset/postgresql -- \
  env PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -U postgres -d grainflow <<'SQL'
DELETE FROM public."user_orgs" WHERE id = 'm-rls-probe';
DELETE FROM public."users" WHERE id = 'user-rls-probe';
DELETE FROM public."organizations" WHERE id = 'org-rls-probe';
SQL

test "$auth_bootstrap_proof" = "0:0:1:1:1:1:1:1:1:1:1:0"

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
