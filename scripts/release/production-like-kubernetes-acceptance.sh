#!/usr/bin/env bash
set -Eeuo pipefail

source scripts/release/production-like-kubernetes-build.sh
node scripts/release/production-like-kubernetes-migration-runtime.mjs
source scripts/release/production-like-kubernetes-evidence-collection.sh
source scripts/release/production-like-kubernetes-cluster.sh

FAILURE_REASON="canonical PostgreSQL RLS authority failed"
for policy_file in \
  infra/sql/production-rls-policies.sql \
  infra/sql/postgresql-deal-authority-policies.sql; do
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

canonical_rls_proof="$(kubectl exec -n "$NAMESPACE" statefulset/postgresql -- \
  env PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -d grainflow -Atc "
SELECT
  c.relrowsecurity::int || ':' ||
  c.relforcerowsecurity::int || ':' ||
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN ('deals_select','deals_insert','integration_events_select','organizations_select','deal_participants_insert')) || ':' ||
  (SELECT count(*) FROM pg_proc p
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE pn.nspname = 'public'
      AND p.proname IN ('app_deal_basis_deal_visible','app_deal_basis_participant_allowed','enforce_single_deal_per_basis')
      AND p.prosecdef) || ':' ||
  (SELECT count(*) FROM pg_proc p
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
    WHERE pn.nspname = 'public'
      AND p.proname IN ('app_deal_basis_deal_visible','app_deal_basis_participant_allowed','enforce_single_deal_per_basis')
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE') || ':' ||
  (SELECT count(*) FROM pg_trigger
    WHERE tgrelid = 'public.deals'::regclass
      AND tgname = 'deals_single_basis'
      AND tgenabled <> 'D')
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'deals';
")"
printf '%s\n' "$canonical_rls_proof" | tee "$K8S_DIR/cluster/canonical-rls-proof.txt"
CANONICAL_RLS_VIOLATIONS=0
if [[ "$canonical_rls_proof" != "1:1:5:3:0:1" ]]; then
  CANONICAL_RLS_VIOLATIONS=1
fi
printf '%s\n' "$CANONICAL_RLS_VIOLATIONS" > "$K8S_DIR/cluster/canonical-rls-authority-violations.txt"
test "$CANONICAL_RLS_VIOLATIONS" = "0"
export CANONICAL_RLS_VIOLATIONS

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
