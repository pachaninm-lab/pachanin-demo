#!/usr/bin/env bash
set -Eeuo pipefail

source scripts/release/production-like-kubernetes-build.sh

MINIO_SERVER_RELEASE="RELEASE.2024-05-10T01-41-38Z"
MINIO_SERVER_ASSET="minio.linux-amd64.${MINIO_SERVER_RELEASE}"
MINIO_SERVER_SHA256="bd3a3e65c48d35613fe1c556e77a18bccb8aee911b6293ca5f6112f73376c105"
MINIO_MC_RELEASE="RELEASE.2024-05-09T17-04-24Z"
MINIO_MC_ASSET="mc.linux-amd64.${MINIO_MC_RELEASE}"
MINIO_MC_SHA256="360196aa51e7664996abbd3a522bdf4749188744a4d36d9bc0c4068d7dfad9e2"
MINIO_BUILD_BASE="alpine:3.20.3@sha256:1e42bbe2508154c9126d48c2b8a75420c3544343bf86fd041fb7527e017a4b4a"
MINIO_SERVER_SOURCE_REF="quay.io/minio/minio:RELEASE.2024-05-10T01-41-38Z@sha256:420663b8685c5396f06405ad516d611db4465939a141cc7d40266342d0f2632d"
MINIO_MC_SOURCE_REF="quay.io/minio/mc:RELEASE.2024-05-09T17-04-24Z@sha256:3e9666a093d0a8fcbbac606346c415ae9277a0ca96989a6bdddd3d03e90a21b4"

prepare_minio_acceptance_images() {
  local work_dir server_repo mc_repo server_tag mc_tag server_push_log mc_push_log
  local server_digest mc_digest
  work_dir="$(mktemp -d)"
  server_repo="${REGISTRY}/pc-crop-minio-server"
  mc_repo="${REGISTRY}/pc-crop-minio-mc"
  server_tag="${server_repo}:release-2024-05-10"
  mc_tag="${mc_repo}:release-2024-05-09"
  server_push_log="$K8S_DIR/minio-server-push.log"
  mc_push_log="$K8S_DIR/minio-mc-push.log"

  test "$(grep -F -c "$MINIO_SERVER_SOURCE_REF" infra/kind/production-like/dependencies.yaml)" = "1"
  test "$(grep -F -c "$MINIO_MC_SOURCE_REF" scripts/release/production-like-kubernetes-cluster.sh)" = "1"
  test "$(grep -F -c "$MINIO_MC_SOURCE_REF" infra/kind/production-like/minio-tls-check.yaml)" = "1"

  curl --fail --location --retry 5 \
    "https://github.com/minio/minio/releases/download/${MINIO_SERVER_RELEASE}/${MINIO_SERVER_ASSET}" \
    -o "$work_dir/minio"
  printf '%s  %s\n' "$MINIO_SERVER_SHA256" "$work_dir/minio" | sha256sum --check

  curl --fail --location --retry 5 \
    "https://github.com/minio/mc/releases/download/${MINIO_MC_RELEASE}/${MINIO_MC_ASSET}" \
    -o "$work_dir/mc"
  printf '%s  %s\n' "$MINIO_MC_SHA256" "$work_dir/mc" | sha256sum --check

  chmod 0755 "$work_dir/minio" "$work_dir/mc"
  "$work_dir/minio" --version | tee "$K8S_DIR/minio-server-version.txt"
  "$work_dir/mc" --version | tee "$K8S_DIR/minio-mc-version.txt"
  grep -Fq "$MINIO_SERVER_RELEASE" "$K8S_DIR/minio-server-version.txt"
  grep -Fq "$MINIO_MC_RELEASE" "$K8S_DIR/minio-mc-version.txt"

  docker pull "$MINIO_BUILD_BASE" 2>&1 | tee "$K8S_DIR/minio-base-pull.log"

  mkdir -p "$work_dir/server" "$work_dir/mc-image"
  cp "$work_dir/minio" "$work_dir/server/minio"
  cp "$work_dir/mc" "$work_dir/mc-image/mc"

  cat > "$work_dir/server/Dockerfile" <<EOF
FROM ${MINIO_BUILD_BASE}
COPY --chmod=0755 minio /usr/local/bin/minio
ENTRYPOINT ["/usr/local/bin/minio"]
EOF
  cat > "$work_dir/mc-image/Dockerfile" <<EOF
FROM ${MINIO_BUILD_BASE}
COPY --chmod=0755 mc /usr/local/bin/mc
ENTRYPOINT ["/usr/local/bin/mc"]
EOF

  docker build --pull=false -t "$server_tag" "$work_dir/server" \
    2>&1 | tee "$K8S_DIR/minio-server-build.log"
  docker build --pull=false -t "$mc_tag" "$work_dir/mc-image" \
    2>&1 | tee "$K8S_DIR/minio-mc-build.log"

  docker push "$server_tag" 2>&1 | tee "$server_push_log"
  docker push "$mc_tag" 2>&1 | tee "$mc_push_log"
  server_digest="$(grep -Eo 'digest: sha256:[0-9a-f]{64}' "$server_push_log" | tail -1 | awk '{print $2}')"
  mc_digest="$(grep -Eo 'digest: sha256:[0-9a-f]{64}' "$mc_push_log" | tail -1 | awk '{print $2}')"
  [[ "$server_digest" =~ ^sha256:[0-9a-f]{64}$ ]]
  [[ "$mc_digest" =~ ^sha256:[0-9a-f]{64}$ ]]

  MINIO_SERVER_IMAGE="${server_repo}@${server_digest}"
  MINIO_MC_IMAGE="${mc_repo}@${mc_digest}"
  export MINIO_SERVER_IMAGE MINIO_MC_IMAGE

  jq -n \
    --arg serverRelease "$MINIO_SERVER_RELEASE" \
    --arg serverAssetSha256 "$MINIO_SERVER_SHA256" \
    --arg mcRelease "$MINIO_MC_RELEASE" \
    --arg mcAssetSha256 "$MINIO_MC_SHA256" \
    --arg baseImage "$MINIO_BUILD_BASE" \
    --arg serverImage "$MINIO_SERVER_IMAGE" \
    --arg mcImage "$MINIO_MC_IMAGE" \
    '{
      source: "first-party GitHub release assets",
      serverRelease: $serverRelease,
      serverAssetSha256: $serverAssetSha256,
      mcRelease: $mcRelease,
      mcAssetSha256: $mcAssetSha256,
      baseImage: $baseImage,
      serverImage: $serverImage,
      mcImage: $mcImage
    }' > "$K8S_DIR/minio-local-image-provenance.json"

  rm -rf "$work_dir"
}

prepare_minio_acceptance_images

REAL_KUBECTL="$(command -v kubectl)"
kubectl() {
  if [[ "$#" -eq 3 && "$1" = "apply" && "$2" = "-f" && "$3" = "infra/kind/production-like/dependencies.yaml" ]]; then
    local rendered="$K8S_DIR/rendered/dependencies-local-minio.yaml"
    sed "s|${MINIO_SERVER_SOURCE_REF}|${MINIO_SERVER_IMAGE}|" "$3" > "$rendered"
    test "$(grep -F -c "$MINIO_SERVER_IMAGE" "$rendered")" = "1"
    test "$(grep -F -c "$MINIO_SERVER_SOURCE_REF" "$rendered")" = "0"
    "$REAL_KUBECTL" apply -f "$rendered"
    return
  fi

  if [[ "$#" -eq 3 && "$1" = "apply" && "$2" = "-f" && "$3" = "infra/kind/production-like/minio-tls-check.yaml" ]]; then
    local rendered="$K8S_DIR/rendered/minio-tls-check-local-mc.yaml"
    sed "s|${MINIO_MC_SOURCE_REF}|${MINIO_MC_IMAGE}|" "$3" > "$rendered"
    test "$(grep -F -c "$MINIO_MC_IMAGE" "$rendered")" = "1"
    test "$(grep -F -c "$MINIO_MC_SOURCE_REF" "$rendered")" = "0"
    "$REAL_KUBECTL" apply -f "$rendered"
    return
  fi

  if [[ "$#" -gt 2 && "$1" = "run" && "$2" = "minio-init" ]]; then
    local -a rewritten=("$@")
    local index replacements=0
    for index in "${!rewritten[@]}"; do
      if [[ "${rewritten[$index]}" = "--image=${MINIO_MC_SOURCE_REF}" ]]; then
        rewritten[$index]="--image=${MINIO_MC_IMAGE}"
        replacements=$((replacements + 1))
      fi
    done
    test "$replacements" = "1"
    "$REAL_KUBECTL" "${rewritten[@]}"
    return
  fi

  "$REAL_KUBECTL" "$@"
}

node scripts/release/production-like-kubernetes-migration-runtime.mjs
source scripts/release/production-like-kubernetes-evidence-collection.sh
source scripts/release/production-like-kubernetes-cluster.sh

FAILURE_REASON="canonical PostgreSQL RLS authority failed"
for policy_file in \
  infra/sql/production-rls-policies.sql \
  infra/sql/postgresql-deal-authority-policies.sql \
  infra/sql/postgresql-outbox-worker-policies.sql; do
  policy_name="$(basename "$policy_file" .sql)"
  kubectl exec -i -n "$NAMESPACE" statefulset/postgresql -- \
    env PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -U postgres -d grainflow \
    < "$policy_file" \
    > "$K8S_DIR/${policy_name}-apply.log" 2>&1
done

# Canonical policy functions are created after the first grant pass. Reapply the
# idempotent least-privilege grants so the runtime principal can execute only the
# policy helpers it needs while DDL authority remains absent.
kubectl exec -i -n "$NAMESPACE" statefulset/postgresql -- \
  env PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -U postgres -d grainflow \
  < infra/kind/production-like/postgresql-runtime-grants.sql \
  > "$K8S_DIR/post-rls-runtime-grants.log" 2>&1

# Use the same acceptance contract as platform-v7-rls-apply-rehearsal.sh. The
# proof covers every protected authority table, final deal-basis policies,
# SECURITY DEFINER and PUBLIC EXECUTE boundaries, both Deal triggers, and the
# canonical app_outbox worker policy without tenant-table access.
canonical_rls_proof="$(kubectl exec -n "$NAMESPACE" statefulset/postgresql -- \
  env PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -d grainflow -Atc "
SELECT
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('deals','organizations','audit_events','ledger_entries','integration_events','outbox_entries','deal_workspace_runtime_snapshots','deal_workspace_runtime_transaction_attempts')
      AND c.relrowsecurity) || ':' ||
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('deals','organizations','audit_events','ledger_entries','integration_events','outbox_entries','deal_workspace_runtime_snapshots','deal_workspace_runtime_transaction_attempts')
      AND c.relforcerowsecurity) || ':' ||
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('deals','organizations','audit_events','ledger_entries','integration_events','outbox_entries','deal_workspace_runtime_snapshots','deal_workspace_runtime_transaction_attempts')) || ':' ||
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('app_deal_basis_deal_visible','app_deal_basis_participant_allowed','enforce_single_deal_per_basis')
      AND p.prosecdef) || ':' ||
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'forbid_deal_basis_mutation') || ':' ||
  (SELECT count(*) FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
    WHERE n.nspname = 'public'
      AND p.proname IN ('app_deal_basis_deal_visible','app_deal_basis_participant_allowed','enforce_single_deal_per_basis','forbid_deal_basis_mutation')
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE') || ':' ||
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND (tablename, policyname) IN (
        ('deals','deals_select'),
        ('deals','deals_insert'),
        ('integration_events','integration_events_select'),
        ('organizations','organizations_context_select'),
        ('deal_participants','deal_participants_insert')
      )) || ':' ||
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'deals'
      AND policyname = 'deals_insert'
      AND with_check ILIKE '%app_deal_basis_deal_visible%'
      AND with_check ILIKE '%FARMER%'
      AND with_check NOT ILIKE '%app_rls_privileged%') || ':' ||
  (SELECT count(*) FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'deals'
      AND t.tgname IN ('deals_single_basis','deals_basis_immutable')
      AND NOT t.tgisinternal
      AND t.tgenabled IN ('O','A')) || ':' ||
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outbox_entries'
      AND (
        (policyname = 'outbox_entries_worker_select'
          AND qual ILIKE '%app_outbox%'
          AND qual NOT ILIKE '%app_outbox_worker%')
        OR (policyname = 'outbox_entries_worker_update'
          AND qual ILIKE '%app_outbox%'
          AND qual NOT ILIKE '%app_outbox_worker%'
          AND with_check ILIKE '%app_outbox%'
          AND with_check NOT ILIKE '%app_outbox_worker%')
        OR (policyname = 'outbox_entries_worker_insert'
          AND with_check ILIKE '%app_service%'
          AND with_check NOT ILIKE '%app_outbox%')
      ));
")"
printf '%s\n' "$canonical_rls_proof" | tee "$K8S_DIR/cluster/canonical-rls-proof.txt"
IFS=: read -r \
  rls_enabled_count \
  rls_forced_count \
  rls_policy_count \
  rls_authority_function_count \
  rls_immutability_function_count \
  rls_public_execute_count \
  rls_required_policy_count \
  rls_basis_only_insert_count \
  rls_authority_trigger_count \
  rls_outbox_principal_policy_count \
  <<< "$canonical_rls_proof"

CANONICAL_RLS_VIOLATIONS=0
[[ "$rls_enabled_count" = "8" ]] || CANONICAL_RLS_VIOLATIONS=$((CANONICAL_RLS_VIOLATIONS + 1))
[[ "$rls_forced_count" = "8" ]] || CANONICAL_RLS_VIOLATIONS=$((CANONICAL_RLS_VIOLATIONS + 1))
(( rls_policy_count >= 16 )) || CANONICAL_RLS_VIOLATIONS=$((CANONICAL_RLS_VIOLATIONS + 1))
[[ "$rls_authority_function_count" = "3" ]] || CANONICAL_RLS_VIOLATIONS=$((CANONICAL_RLS_VIOLATIONS + 1))
[[ "$rls_immutability_function_count" = "1" ]] || CANONICAL_RLS_VIOLATIONS=$((CANONICAL_RLS_VIOLATIONS + 1))
[[ "$rls_public_execute_count" = "0" ]] || CANONICAL_RLS_VIOLATIONS=$((CANONICAL_RLS_VIOLATIONS + 1))
[[ "$rls_required_policy_count" = "5" ]] || CANONICAL_RLS_VIOLATIONS=$((CANONICAL_RLS_VIOLATIONS + 1))
[[ "$rls_basis_only_insert_count" = "1" ]] || CANONICAL_RLS_VIOLATIONS=$((CANONICAL_RLS_VIOLATIONS + 1))
[[ "$rls_authority_trigger_count" = "2" ]] || CANONICAL_RLS_VIOLATIONS=$((CANONICAL_RLS_VIOLATIONS + 1))
[[ "$rls_outbox_principal_policy_count" = "3" ]] || CANONICAL_RLS_VIOLATIONS=$((CANONICAL_RLS_VIOLATIONS + 1))
printf '%s\n' "$CANONICAL_RLS_VIOLATIONS" > "$K8S_DIR/cluster/canonical-rls-authority-violations.txt"
test "$CANONICAL_RLS_VIOLATIONS" = "0"
export CANONICAL_RLS_VIOLATIONS

# Prove the worker and tenant policy role sets are disjoint, then execute a
# read/lock query as app_outbox before any application pod starts. This catches
# accidental evaluation of tenant visibility functions without granting the
# worker access to Deal or participant tables.
outbox_policy_role_proof="$(kubectl exec -n "$NAMESPACE" statefulset/postgresql -- \
  env PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -d grainflow -Atc "
SELECT
  (SELECT count(*) FROM pg_policies
    WHERE schemaname='public' AND tablename='outbox_entries'
      AND policyname IN ('outbox_entries_worker_select','outbox_entries_worker_update')
      AND roles @> ARRAY['app_outbox']::name[]) || ':' ||
  (SELECT count(*) FROM pg_policies
    WHERE schemaname='public' AND tablename='outbox_entries'
      AND policyname IN ('outbox_entries_select','outbox_entries_insert')
      AND roles @> ARRAY['app_runtime']::name[]
      AND NOT (roles && ARRAY['public','app_outbox']::name[]));
")"
printf '%s\n' "$outbox_policy_role_proof" | tee "$K8S_DIR/cluster/outbox-policy-role-proof.txt"
test "$outbox_policy_role_proof" = "2:2"

kubectl exec -n "$NAMESPACE" statefulset/postgresql -- \
  env PGPASSWORD="$OUTBOX_DB_PASSWORD" psql -v ON_ERROR_STOP=1 -U app_outbox -d grainflow \
  -c "SELECT current_user; SELECT count(*) FROM (SELECT id FROM public.\"outbox_entries\" WHERE status IN ('PENDING','PROCESSING') FOR UPDATE SKIP LOCKED LIMIT 1) candidate;" \
  > "$K8S_DIR/cluster/outbox-principal-rls-smoke.log" 2>&1

grep -q app_outbox "$K8S_DIR/cluster/outbox-principal-rls-smoke.log"

source scripts/release/production-like-kubernetes-object-storage.sh

patch_web_hardening() {
  patch_api_object_storage
  kubectl patch deployment grainflow-web -n "$NAMESPACE" --type=json \
    --patch-file infra/kind/production-like/web-runtime-hardening-patch.json \
    > "$K8S_DIR/web-runtime-hardening-patch.log" 2>&1
  kubectl apply -f infra/kind/production-like/api-ingress.yaml \
    > "$K8S_DIR/api-ingress-apply.log"
  kubectl apply -f infra/kind/production-like/web-health-ingress.yaml \
    > "$K8S_DIR/web-health-ingress-apply.log"
}

source scripts/release/production-like-kubernetes-pgbouncer.sh
source scripts/release/production-like-kubernetes-runtime-config.sh
source scripts/release/production-like-kubernetes-pgbouncer-evidence.sh
source scripts/release/production-like-kubernetes-verify.sh
source scripts/release/production-like-kubernetes-worker-smoke.sh
