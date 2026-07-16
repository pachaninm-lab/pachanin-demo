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

# Use the same acceptance contract as platform-v7-rls-apply-rehearsal.sh. The
# proof covers every protected authority table, final deal-basis policies,
# SECURITY DEFINER and PUBLIC EXECUTE boundaries, and both Deal triggers.
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
        ('organizations','organizations_select'),
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
      AND t.tgenabled IN ('O','A'));
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
