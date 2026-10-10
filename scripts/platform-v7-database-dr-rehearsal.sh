#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_ADMIN_URL="${DR_SOURCE_ADMIN_URL:?DR_SOURCE_ADMIN_URL is required}"
RESTORE_ADMIN_URL="${DR_RESTORE_ADMIN_URL:?DR_RESTORE_ADMIN_URL is required}"
RESTORE_AUTH_URL="${DR_RESTORE_AUTH_URL:?DR_RESTORE_AUTH_URL is required}"
RESTORE_STAFF_URL="${DR_RESTORE_STAFF_URL:?DR_RESTORE_STAFF_URL is required}"
RESTORE_APP_URL="${DR_RESTORE_APP_URL:?DR_RESTORE_APP_URL is required}"
RESTORE_STORAGE_URL="${DR_RESTORE_STORAGE_URL:?DR_RESTORE_STORAGE_URL is required}"
BACKUP_PATH="${DR_BACKUP_PATH:-/tmp/platform-v7-predeploy.backup}"
MANIFEST_PATH="${DR_MANIFEST_PATH:-/tmp/platform-v7-dr-manifest.json}"
EVIDENCE_LOG="${DR_EVIDENCE_LOG:-/tmp/platform-v7-dr-rehearsal.log}"

if [[ "${NODE_ENV:-}" == "production" ]]; then
  echo "Refusing DR rehearsal with NODE_ENV=production" >&2
  exit 2
fi
for candidate in "$SOURCE_ADMIN_URL" "$RESTORE_ADMIN_URL" "$RESTORE_AUTH_URL" "$RESTORE_STAFF_URL" "$RESTORE_APP_URL" "$RESTORE_STORAGE_URL"; do
  if [[ "$candidate" =~ (^|[^a-z])(prod|production)([^a-z]|$) ]]; then
    echo "Refusing DR rehearsal: datasource appears production-like" >&2
    exit 2
  fi
done
if [[ "$SOURCE_ADMIN_URL" == "$RESTORE_ADMIN_URL" ]]; then
  echo "Refusing DR rehearsal: source and restore admin URLs are identical" >&2
  exit 2
fi
if [[ "$RESTORE_AUTH_URL" == "$RESTORE_STAFF_URL" || "$RESTORE_AUTH_URL" == "$RESTORE_APP_URL" || "$RESTORE_AUTH_URL" == "$RESTORE_STORAGE_URL" \
  || "$RESTORE_STAFF_URL" == "$RESTORE_APP_URL" || "$RESTORE_STAFF_URL" == "$RESTORE_STORAGE_URL" \
  || "$RESTORE_APP_URL" == "$RESTORE_STORAGE_URL" ]]; then
  echo "Refusing DR rehearsal: restore auth, staff, app and storage URLs must use different principals" >&2
  exit 2
fi

for command in node psql pg_dump pg_restore createdb dropdb sha256sum date; do
  command -v "$command" >/dev/null || { echo "$command is required" >&2; exit 2; }
done

mkdir -p "$(dirname "$BACKUP_PATH")" "$(dirname "$MANIFEST_PATH")" "$(dirname "$EVIDENCE_LOG")"
: > "$EVIDENCE_LOG"
exec > >(tee -a "$EVIDENCE_LOG") 2>&1
cd "$ROOT_DIR"

url_database() {
  node -e "const u=new URL(process.argv[1]); console.log(decodeURIComponent(u.pathname.replace(/^\\//,'')))" "$1"
}
maintenance_url() {
  node -e "const u=new URL(process.argv[1]); u.pathname='/postgres'; console.log(u.toString())" "$1"
}

RESTORE_DATABASE="$(url_database "$RESTORE_ADMIN_URL")"
RESTORE_MAINTENANCE_URL="$(maintenance_url "$RESTORE_ADMIN_URL")"
if [[ ! "$RESTORE_DATABASE" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "Unsafe restore database name: $RESTORE_DATABASE" >&2
  exit 2
fi

fingerprint() {
  local url="$1"
  psql "$url" -X -At --set ON_ERROR_STOP=1 <<'SQL'
SELECT md5(jsonb_build_object(
  'deal', (SELECT jsonb_build_object('id', id, 'status', status, 'totalKopecks', "totalKopecks", 'closedAt', "closedAt") FROM public.deals WHERE id='DEAL-INDUSTRIAL-001'),
  'participants', (SELECT count(*) FROM public.deal_participants WHERE "dealId"='DEAL-INDUSTRIAL-001'),
  'events', (SELECT jsonb_build_object('count', count(*), 'chain', md5(COALESCE(string_agg(id || ':' || hash || ':' || COALESCE("prevHash", ''), '|' ORDER BY "createdAt", id), ''))) FROM public.deal_events WHERE "dealId"='DEAL-INDUSTRIAL-001'),
  'audits', (SELECT jsonb_build_object('count', count(*), 'chain', md5(COALESCE(string_agg(id || ':' || hash || ':' || COALESCE("prevHash", ''), '|' ORDER BY "createdAt", id), ''))) FROM public.audit_events WHERE "dealId"='DEAL-INDUSTRIAL-001'),
  'documents', (SELECT count(*) FROM public.deal_documents WHERE "dealId"='DEAL-INDUSTRIAL-001' AND status='SIGNED'),
  'bankOperations', (SELECT jsonb_build_object('count', count(*), 'done', count(*) FILTER (WHERE status='DONE')) FROM public.bank_operations WHERE "dealId"='DEAL-INDUSTRIAL-001'),
  'ledger', (SELECT jsonb_build_object('count', count(*), 'amount', COALESCE(sum("amountKopecks"), 0)) FROM public.ledger_entries WHERE "dealId"='DEAL-INDUSTRIAL-001'),
  'settlementPayment', (SELECT jsonb_build_object(
      'status', status,
      'reserved', confirmed_reserved_minor,
      'released', confirmed_released_minor,
      'refunded', confirmed_refunded_minor,
      'hold', active_hold_minor,
      'version', version
    ) FROM settlement.payments WHERE deal_id='DEAL-INDUSTRIAL-001'),
  'settlementOperations', (SELECT jsonb_build_object(
      'count', count(*),
      'chain', md5(COALESCE(string_agg(id || ':' || operation_type || ':' || status || ':' || amount_minor::text, '|' ORDER BY created_at, id), ''))
    ) FROM settlement.bank_operations WHERE deal_id='DEAL-INDUSTRIAL-001'),
  'settlementCallbacks', (SELECT jsonb_build_object(
      'count', count(*),
      'chain', md5(COALESCE(string_agg(event_id || ':' || operation_id || ':' || callback_status || ':' || payload_fingerprint, '|' ORDER BY received_at, id), ''))
    ) FROM settlement.bank_callbacks WHERE deal_id='DEAL-INDUSTRIAL-001'),
  'settlementLedger', (SELECT jsonb_build_object(
      'count', count(*),
      'chain', md5(COALESCE(string_agg(id || ':' || hash || ':' || COALESCE(prev_hash, ''), '|' ORDER BY created_at, id), ''))
    ) FROM settlement.ledger_entries WHERE deal_id='DEAL-INDUSTRIAL-001'),
  'settlementOutbox', (SELECT jsonb_build_object(
      'bankRequests', count(*) FILTER (WHERE left(type, 5)='BANK_'),
      'confirmedBankRequests', count(*) FILTER (WHERE left(type, 5)='BANK_' AND status='CONFIRMED'),
      'receipts', count(*) FILTER (WHERE type='settlement.command.receipt'),
      'confirmedReceipts', count(*) FILTER (WHERE type='settlement.command.receipt' AND status='CONFIRMED'),
      'chain', md5(COALESCE(string_agg(id || ':' || type || ':' || status || ':' || COALESCE("idempotencyKey", ''), '|' ORDER BY "createdAt", id), ''))
    ) FROM public.outbox_entries WHERE "dealId"='DEAL-INDUSTRIAL-001' AND (left(type, 5)='BANK_' OR type='settlement.command.receipt')),
  'authSessions', (SELECT jsonb_build_object('count', count(*), 'active', count(*) FILTER (WHERE status='ACTIVE')) FROM auth.sessions),
  'refreshTokens', (SELECT count(*) FROM auth.refresh_tokens),
  'migrations', (SELECT md5(COALESCE(string_agg(migration_name || ':' || COALESCE(checksum, '') || ':' || COALESCE(finished_at::text, ''), '|' ORDER BY migration_name), '')) FROM public._prisma_migrations),
  'publicRls', (SELECT md5(COALESCE(string_agg(c.relname || ':' || c.relrowsecurity::text || ':' || c.relforcerowsecurity::text, '|' ORDER BY c.relname), '')) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('deals','organizations','audit_events','ledger_entries','integration_events','outbox_entries','deal_workspace_runtime_snapshots','deal_workspace_runtime_transaction_attempts')),
  'settlementRls', (SELECT md5(COALESCE(string_agg(c.relname || ':' || c.relrowsecurity::text || ':' || c.relforcerowsecurity::text, '|' ORDER BY c.relname), '')) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='settlement' AND c.relname IN ('payment_terms','beneficiaries','payments','holds','bank_operations','bank_callbacks','ledger_entries','reconciliation_facts')),
  'publicPolicies', (SELECT md5(COALESCE(string_agg(tablename || ':' || policyname || ':' || cmd || ':' || permissive, '|' ORDER BY tablename, policyname), '')) FROM pg_policies WHERE schemaname='public'),
  'settlementPolicies', (SELECT md5(COALESCE(string_agg(tablename || ':' || policyname || ':' || cmd || ':' || permissive, '|' ORDER BY tablename, policyname), '')) FROM pg_policies WHERE schemaname='settlement')
)::text);
SQL
}

SOURCE_FINGERPRINT="$(fingerprint "$SOURCE_ADMIN_URL")"
if [[ -z "$SOURCE_FINGERPRINT" ]]; then
  echo "Source fingerprint is empty" >&2
  exit 1
fi

echo "[dr] source fingerprint: $SOURCE_FINGERPRINT"
BACKUP_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
BACKUP_STARTED_EPOCH="$(date +%s)"
rm -f "$BACKUP_PATH" "$BACKUP_PATH.sha256"
pg_dump "$SOURCE_ADMIN_URL" \
  --format=custom \
  --compress=6 \
  --no-owner \
  --no-acl \
  --file="$BACKUP_PATH"
sha256sum "$BACKUP_PATH" > "$BACKUP_PATH.sha256"
sha256sum --check "$BACKUP_PATH.sha256"
BACKUP_COMPLETED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
BACKUP_SECONDS="$(( $(date +%s) - BACKUP_STARTED_EPOCH ))"
BACKUP_SHA256="$(cut -d' ' -f1 "$BACKUP_PATH.sha256")"
BACKUP_BYTES="$(wc -c < "$BACKUP_PATH" | tr -d ' ')"

echo "[dr] recreating isolated restore database: $RESTORE_DATABASE"
dropdb --if-exists --force --maintenance-db="$RESTORE_MAINTENANCE_URL" "$RESTORE_DATABASE"
createdb --maintenance-db="$RESTORE_MAINTENANCE_URL" "$RESTORE_DATABASE"

RESTORE_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RESTORE_STARTED_EPOCH="$(date +%s)"
pg_restore \
  --dbname="$RESTORE_ADMIN_URL" \
  --exit-on-error \
  --no-owner \
  --no-acl \
  "$BACKUP_PATH"
RESTORE_COMPLETED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RESTORE_SECONDS="$(( $(date +%s) - RESTORE_STARTED_EPOCH ))"

echo "[dr] restoring least-privilege runtime grants"
psql "$RESTORE_ADMIN_URL" -X --set ON_ERROR_STOP=1 <<SQL
GRANT CONNECT ON DATABASE "$RESTORE_DATABASE" TO one_deal_app, one_deal_auth, one_deal_staff, one_deal_storage;

GRANT USAGE ON SCHEMA public, security, logistics, labs, settlement, auth TO one_deal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO one_deal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA security TO one_deal_app;
GRANT SELECT ON ALL TABLES IN SCHEMA logistics TO one_deal_app;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA logistics FROM one_deal_app;
GRANT SELECT, INSERT, UPDATE ON
  labs.laboratories,
  labs.authorized_actors,
  labs.methods,
  labs.equipment,
  labs.sample_admissions
TO one_deal_app;
GRANT SELECT, INSERT ON labs.sample_custody_events TO one_deal_app;
GRANT SELECT ON labs.protocols TO one_deal_app;
REVOKE DELETE ON ALL TABLES IN SCHEMA labs FROM one_deal_app;
GRANT SELECT, INSERT ON
  settlement.payment_terms,
  settlement.beneficiaries,
  settlement.bank_callbacks,
  settlement.ledger_entries,
  settlement.reconciliation_facts
TO one_deal_app;
GRANT SELECT, INSERT, UPDATE ON
  settlement.payments,
  settlement.holds,
  settlement.bank_operations
TO one_deal_app;
REVOKE DELETE ON ALL TABLES IN SCHEMA settlement FROM one_deal_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO one_deal_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO one_deal_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA settlement TO one_deal_app;

GRANT USAGE ON SCHEMA public TO one_deal_storage;
GRANT SELECT ON public.deals, public.deal_participants TO one_deal_storage;
GRANT SELECT, UPDATE ON public.deal_documents TO one_deal_storage;
REVOKE INSERT, DELETE ON public.deal_documents FROM one_deal_storage;

GRANT USAGE ON SCHEMA public, auth TO one_deal_auth;
GRANT SELECT, INSERT, UPDATE ON public.users, public.user_orgs, public.organizations TO one_deal_auth;
GRANT SELECT, INSERT, UPDATE ON
  auth.login_throttles,
  auth.credential_states,
  auth.sessions,
  auth.refresh_tokens,
  auth.mfa_challenges
TO one_deal_auth;
GRANT SELECT, INSERT ON auth.audit_events TO one_deal_auth;

GRANT USAGE ON SCHEMA auth TO one_deal_staff;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public, auth FROM one_deal_staff;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public, auth FROM one_deal_staff;
SQL

# pg_restore ran with --no-owner --no-acl. Recovery therefore must restore not
# only definer ownership but also the separation between auth and staff runtime
# principals. Otherwise a DR event could silently reintroduce the authority that
# #3670 removed from normal deployment.
echo "[dr] re-establishing identity definer ownership and execution privileges"
psql "$RESTORE_ADMIN_URL" -X --set ON_ERROR_STOP=1 <<'SQL'
DO $identity_recovery$
DECLARE
  bootstrap_owned text[] := ARRAY[
    'auth.resolve_login_identity(text)',
    'auth.resolve_login_identity_by_id(text)',
    'auth.resolve_login_memberships(text)',
    'auth.resolve_login_memberships_ordered(text)',
    'auth.resolve_login_context_by_email(text)',
    'auth.resolve_login_credential(text)',
    'auth.resolve_login_default_membership(text)',
    'auth.resolve_login_context_by_membership(text,text)',
    'auth.resolve_session_identity(text,text,text,text)',
    'auth.resolve_post_password_membership_ids(text)',
    'auth.resolve_post_password_membership_context(text,text)',
    'auth.resolve_session_identity_v2(text,text,text,text)',
    'auth.resolve_staff_target_scope(text,text,text,text,text)',
    'auth.validate_deal_creation_actors(text,text,text,text,text)',
    'public.app_logistics_assignment_projection(text,text,text,text,text,text,text)',
    'public.app_identity_is_org_admin()',
    'public.app_identity_is_reviewer()'
  ];
  authority_owned text[] := ARRAY[
    'auth.staff_admission_capability(text,text,text,text,text)',
    'auth.staff_projection_capability(text,text,text,text,text,text,boolean)',
    'auth.resolve_staff_deal_target_scope(text,text,text)',
    'auth.staff_admission_queue(text,text,text,integer)',
    'auth.staff_admission_application(text,text,text,text)',
    'auth.staff_admission_decision(text,text,text,text,text,text)',
    'auth.staff_organization_directory(text,text,text)',
    'auth.staff_organization_users(text,text,text,text)',
    'auth.staff_cabinet_deals(text,text,text,text,text)'
  ];
  registration_lifecycle_owned text[] := ARRAY[
    'auth.prepare_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)',
    'auth.restart_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)',
    'auth.mark_registration_email_verified(text,text,text)',
    'auth.registration_join_notification_recipients(text,text,text)'
  ];
  password_reset_owned text[] := ARRAY[
    'auth.resolve_password_reset_subject(text)',
    'auth.replace_password_after_reset(text,text,text,timestamptz)'
  ];
  -- Owned by its own authority, not by the reset one. A dump carries the
  -- function but not the cluster-level role, so a restore leaves it owned by
  -- whoever ran the restore unless this puts it back.
  password_format_owned text[] := ARRAY[
    'auth.upgrade_password_hash_format(text,text,text)'
  ];
  organization_access_owned text[] := ARRAY[
    'auth.organization_team_snapshot(text,text,text,text,text)',
    'auth.resolve_organization_admin_session(text,text,text,text,text)',
    'auth.organization_membership_exists_for_email(text,text,text,text,text,text)'
  ];
  invitation_acceptance_owned text[] := ARRAY[
    'auth.resolve_invitation_acceptance_credential(text,text)',
    'auth.accept_organization_invitation_identity(text,text,bigint,text,text,boolean,text,text,text,text)'
  ];
  organization_membership_command_owned text[] := ARRAY[
    'auth.change_organization_membership_role(text,text,text,text,text,text,bigint,text)',
    'auth.revoke_organization_membership(text,text,text,text,text,text,bigint)',
    'auth.prepare_organization_mfa_recovery_target(text,text,text,text,text,text,bigint)',
    'auth.organization_mfa_recovery_snapshot(text,text,text,text,text,text)'
  ];
  mfa_recovery_identity_owned text[] := ARRAY[
    'auth.resolve_mfa_recovery_identity(text,text)',
    'auth.finalize_mfa_recovery_identity(text,text,text,bigint)'
  ];
  registration_decision_owned text[] := ARRAY[
    'auth.registration_platform_actor_authorized(text,text)',
    'auth.registration_role_assignment_allowed(text,text)',
    'auth.registration_organization_admin_context(text,text,text,text,text)',
    'auth.registration_platform_review_queue(text,text,integer)',
    'auth.registration_organization_join_queue(text,text,text,text,text,integer)',
    'auth.lock_registration_decision_application(text,text,text,text,text,text,text)',
    'auth.apply_registration_identity_transition(text,text,text,text,text,text,text,text)'
  ];
  account_export_owned text[] := ARRAY[
    'auth.account_data_export(text,text,text,text,text)'
  ];
  account_anonymization_owned text[] := ARRAY[
    'auth.anonymize_account_identity(text,text,text,text,text)'
  ];
  registration_function text := 'auth.create_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text)';
  mfa_finalize_function text := 'auth.finalize_authenticated_user_mfa(text,text,text)';
  target text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_identity_bootstrap') THEN
    FOREACH target IN ARRAY bootstrap_owned LOOP
      IF to_regprocedure(target) IS NOT NULL THEN
        EXECUTE format('ALTER FUNCTION %s OWNER TO pc_identity_bootstrap', target);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', target);
      END IF;
    END LOOP;
    GRANT USAGE ON SCHEMA auth, public, logistics TO pc_identity_bootstrap;
    GRANT SELECT ON auth.staff_assignments, auth.sessions, auth.credential_states
      TO pc_identity_bootstrap;
    GRANT SELECT ON public.users, public.user_orgs, public.organizations, public.deal_participants
      TO pc_identity_bootstrap;
    GRANT SELECT ON logistics.deal_admissions TO pc_identity_bootstrap;
    GRANT EXECUTE ON FUNCTION public.app_identity_is_org_admin() TO PUBLIC;
    GRANT EXECUTE ON FUNCTION public.app_identity_is_reviewer() TO PUBLIC;

    GRANT EXECUTE ON FUNCTION auth.resolve_login_credential(text) TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.resolve_login_default_membership(text) TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.resolve_login_context_by_membership(text,text) TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.resolve_session_identity(text,text,text,text) TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.resolve_post_password_membership_ids(text) TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.resolve_post_password_membership_context(text,text) TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.resolve_session_identity_v2(text,text,text,text) TO one_deal_auth;
    REVOKE ALL ON FUNCTION auth.resolve_login_identity(text) FROM one_deal_auth;
    REVOKE ALL ON FUNCTION auth.resolve_login_identity_by_id(text) FROM one_deal_auth;
    REVOKE ALL ON FUNCTION auth.resolve_login_memberships(text) FROM one_deal_auth;
    REVOKE ALL ON FUNCTION auth.resolve_login_memberships_ordered(text) FROM one_deal_auth;
    REVOKE ALL ON FUNCTION auth.resolve_login_context_by_email(text) FROM one_deal_auth;

    REVOKE ALL ON FUNCTION auth.resolve_staff_target_scope(text,text,text,text,text) FROM one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.resolve_staff_target_scope(text,text,text,text,text) TO one_deal_staff;

    GRANT EXECUTE ON FUNCTION auth.validate_deal_creation_actors(text,text,text,text,text)
      TO one_deal_app;
    GRANT EXECUTE ON FUNCTION public.app_logistics_assignment_projection(text,text,text,text,text,text,text)
      TO one_deal_app;
    REVOKE ALL ON FUNCTION auth.validate_deal_creation_actors(text,text,text,text,text)
      FROM one_deal_auth, one_deal_staff, one_deal_storage;
    REVOKE ALL ON FUNCTION public.app_logistics_assignment_projection(text,text,text,text,text,text,text)
      FROM one_deal_auth, one_deal_staff, one_deal_storage;

    REVOKE ALL ON FUNCTION auth.resolve_login_credential(text) FROM one_deal_staff, one_deal_app, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.resolve_login_default_membership(text) FROM one_deal_staff, one_deal_app, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.resolve_login_context_by_membership(text,text) FROM one_deal_staff, one_deal_app, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.resolve_session_identity(text,text,text,text) FROM one_deal_staff, one_deal_app, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.resolve_post_password_membership_ids(text) FROM one_deal_staff, one_deal_app, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.resolve_post_password_membership_context(text,text) FROM one_deal_staff, one_deal_app, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.resolve_session_identity_v2(text,text,text,text) FROM one_deal_staff, one_deal_app, one_deal_storage;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_auth_mfa_authority')
     AND to_regprocedure(mfa_finalize_function) IS NOT NULL THEN
    ALTER ROLE pc_auth_mfa_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    IF EXISTS (
      SELECT 1 FROM pg_auth_members membership
      JOIN pg_roles granted ON granted.oid = membership.roleid
      WHERE granted.rolname = 'pc_auth_mfa_authority'
    ) THEN
      RAISE EXCEPTION 'pc_auth_mfa_authority must have no members after restore';
    END IF;
    EXECUTE format('ALTER FUNCTION %s OWNER TO pc_auth_mfa_authority', mfa_finalize_function);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', mfa_finalize_function);
    GRANT USAGE ON SCHEMA public, auth TO pc_auth_mfa_authority;
    REVOKE ALL PRIVILEGES ON auth.sessions, auth.mfa_challenges, auth.credential_states
      FROM pc_auth_mfa_authority;
    GRANT SELECT ON auth.sessions, auth.mfa_challenges, auth.credential_states
      TO pc_auth_mfa_authority;
    REVOKE ALL PRIVILEGES ON public.users, public.user_orgs, public.organizations
      FROM pc_auth_mfa_authority;
    GRANT SELECT ("id"), UPDATE ("mfaEnabled") ON public.users
      TO pc_auth_mfa_authority;
    GRANT EXECUTE ON FUNCTION auth.finalize_authenticated_user_mfa(text,text,text) TO one_deal_auth;
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM one_deal_app, one_deal_staff, one_deal_storage',
      mfa_finalize_function
    );
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_registration_authority')
     AND to_regprocedure(registration_function) IS NOT NULL THEN
    ALTER ROLE pc_registration_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    EXECUTE format('ALTER FUNCTION %s OWNER TO pc_registration_authority', registration_function);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', registration_function);
    GRANT USAGE ON SCHEMA public, auth TO pc_registration_authority;
    REVOKE ALL PRIVILEGES ON public.users, public.user_orgs, public.organizations
      FROM pc_registration_authority;
    REVOKE ALL ON FUNCTION auth.create_pending_registration_identity(
      text,text,text,text,text,text,text,text,text,text,text,text
    ) FROM one_deal_auth, one_deal_app, one_deal_staff, one_deal_storage;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_registration_lifecycle_authority') THEN
    ALTER ROLE pc_registration_lifecycle_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    IF EXISTS (
      SELECT 1 FROM pg_auth_members membership
      JOIN pg_roles granted ON granted.oid = membership.roleid
      WHERE granted.rolname = 'pc_registration_lifecycle_authority'
    ) THEN
      RAISE EXCEPTION 'pc_registration_lifecycle_authority must have no members after restore';
    END IF;
    FOREACH target IN ARRAY registration_lifecycle_owned LOOP
      IF to_regprocedure(target) IS NOT NULL THEN
        EXECUTE format('ALTER FUNCTION %s OWNER TO pc_registration_lifecycle_authority', target);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', target);
      END IF;
    END LOOP;
    GRANT USAGE ON SCHEMA public, auth TO pc_registration_lifecycle_authority;
    REVOKE ALL PRIVILEGES ON public.users, public.user_orgs, public.organizations
      FROM pc_registration_lifecycle_authority;
    GRANT SELECT, INSERT, UPDATE ON public.users, public.user_orgs, public.organizations
      TO pc_registration_lifecycle_authority;
    GRANT SELECT ON auth.registration_applications, auth.registration_email_challenges
      TO pc_registration_lifecycle_authority;

    GRANT EXECUTE ON FUNCTION auth.prepare_pending_registration_identity(
      text,text,text,text,text,text,text,text,text,text,text,text,text,text,text
    ) TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.restart_pending_registration_identity(
      text,text,text,text,text,text,text,text,text,text,text,text,text,text,text
    ) TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.mark_registration_email_verified(text,text,text) TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.registration_join_notification_recipients(text,text,text) TO one_deal_auth;
    REVOKE ALL ON FUNCTION auth.prepare_pending_registration_identity(
      text,text,text,text,text,text,text,text,text,text,text,text,text,text,text
    ) FROM one_deal_app, one_deal_staff, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.restart_pending_registration_identity(
      text,text,text,text,text,text,text,text,text,text,text,text,text,text,text
    ) FROM one_deal_app, one_deal_staff, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.mark_registration_email_verified(text,text,text)
      FROM one_deal_app, one_deal_staff, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.registration_join_notification_recipients(text,text,text)
      FROM one_deal_app, one_deal_staff, one_deal_storage;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_password_reset_authority') THEN
    ALTER ROLE pc_password_reset_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    IF EXISTS (
      SELECT 1 FROM pg_auth_members membership
      JOIN pg_roles granted ON granted.oid = membership.roleid
      WHERE granted.rolname = 'pc_password_reset_authority'
    ) THEN
      RAISE EXCEPTION 'pc_password_reset_authority must have no members after restore';
    END IF;
    FOREACH target IN ARRAY password_reset_owned LOOP
      IF to_regprocedure(target) IS NOT NULL THEN
        EXECUTE format('ALTER FUNCTION %s OWNER TO pc_password_reset_authority', target);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', target);
      END IF;
    END LOOP;
    GRANT USAGE ON SCHEMA public, auth TO pc_password_reset_authority;
    REVOKE ALL PRIVILEGES ON public.users FROM pc_password_reset_authority;
    GRANT SELECT ("id", "email", "status", "deletedAt") ON public.users
      TO pc_password_reset_authority;
    GRANT UPDATE ("passwordHash", "updatedAt") ON public.users
      TO pc_password_reset_authority;
    GRANT SELECT ON auth.password_reset_challenges TO pc_password_reset_authority;
    GRANT EXECUTE ON FUNCTION auth.resolve_password_reset_subject(text) TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.replace_password_after_reset(text,text,text,timestamptz) TO one_deal_auth;
    REVOKE ALL ON FUNCTION auth.resolve_password_reset_subject(text)
      FROM one_deal_app, one_deal_staff, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.replace_password_after_reset(text,text,text,timestamptz)
      FROM one_deal_app, one_deal_staff, one_deal_storage;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_password_format_authority') THEN
    ALTER ROLE pc_password_format_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    IF EXISTS (
      SELECT 1 FROM pg_auth_members membership
      JOIN pg_roles granted ON granted.oid = membership.roleid
      WHERE granted.rolname = 'pc_password_format_authority') THEN
      RAISE EXCEPTION 'pc_password_format_authority must have no members after restore';
    END IF;
    FOREACH target IN ARRAY password_format_owned LOOP
      EXECUTE format('ALTER FUNCTION %s OWNER TO pc_password_format_authority', target);
    END LOOP;
    GRANT USAGE ON SCHEMA public, auth TO pc_password_format_authority;
    REVOKE ALL PRIVILEGES ON public.users FROM pc_password_format_authority;
    GRANT SELECT ("id", "passwordHash") ON public.users TO pc_password_format_authority;
    GRANT UPDATE ("passwordHash") ON public.users TO pc_password_format_authority;
    GRANT EXECUTE ON FUNCTION auth.upgrade_password_hash_format(text,text,text) TO one_deal_auth;
    REVOKE ALL ON FUNCTION auth.upgrade_password_hash_format(text,text,text)
      FROM one_deal_app, one_deal_staff, one_deal_storage;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_organization_access_authority') THEN
    ALTER ROLE pc_organization_access_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    IF EXISTS (
      SELECT 1 FROM pg_auth_members membership
      JOIN pg_roles granted ON granted.oid = membership.roleid
      WHERE granted.rolname = 'pc_organization_access_authority'
    ) THEN
      RAISE EXCEPTION 'pc_organization_access_authority must have no members after restore';
    END IF;
    FOREACH target IN ARRAY organization_access_owned LOOP
      IF to_regprocedure(target) IS NOT NULL THEN
        EXECUTE format('ALTER FUNCTION %s OWNER TO pc_organization_access_authority', target);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', target);
      END IF;
    END LOOP;
    GRANT USAGE ON SCHEMA public, auth TO pc_organization_access_authority;
    REVOKE ALL PRIVILEGES ON public.users, public.user_orgs, public.organizations
      FROM pc_organization_access_authority;
    GRANT SELECT ("id", "fullName", "email", "status", "deletedAt")
      ON public.users TO pc_organization_access_authority;
    GRANT SELECT (
      "id", "userId", "organizationId", "role", "status", "is_org_admin",
      "version", "isDefault", "joinedAt"
    ) ON public.user_orgs TO pc_organization_access_authority;
    GRANT SELECT ("id", "tenantId", "name", "status")
      ON public.organizations TO pc_organization_access_authority;
    GRANT SELECT (
      "id", user_id, membership_id, organization_id, tenant_id, "status",
      credential_version, mfa_verified_at, last_seen_at, expires_at, revoked_at
    ) ON auth.sessions TO pc_organization_access_authority;
    GRANT SELECT (user_id, credential_version)
      ON auth.credential_states TO pc_organization_access_authority;
    GRANT EXECUTE ON FUNCTION auth.organization_team_snapshot(text,text,text,text,text)
      TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.resolve_organization_admin_session(text,text,text,text,text)
      TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.organization_membership_exists_for_email(text,text,text,text,text,text)
      TO one_deal_auth;
    REVOKE ALL ON FUNCTION auth.organization_team_snapshot(text,text,text,text,text)
      FROM one_deal_app, one_deal_staff, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.resolve_organization_admin_session(text,text,text,text,text)
      FROM one_deal_app, one_deal_staff, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.organization_membership_exists_for_email(text,text,text,text,text,text)
      FROM one_deal_app, one_deal_staff, one_deal_storage;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_invitation_acceptance_authority') THEN
    ALTER ROLE pc_invitation_acceptance_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    IF EXISTS (
      SELECT 1 FROM pg_auth_members membership
      JOIN pg_roles granted ON granted.oid = membership.roleid
      WHERE granted.rolname = 'pc_invitation_acceptance_authority'
    ) THEN
      RAISE EXCEPTION 'pc_invitation_acceptance_authority must have no members after restore';
    END IF;
    FOREACH target IN ARRAY invitation_acceptance_owned LOOP
      IF to_regprocedure(target) IS NOT NULL THEN
        EXECUTE format('ALTER FUNCTION %s OWNER TO pc_invitation_acceptance_authority', target);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', target);
      END IF;
    END LOOP;
    GRANT USAGE ON SCHEMA public, auth TO pc_invitation_acceptance_authority;
    REVOKE ALL PRIVILEGES ON public.users, public.user_orgs, public.organizations
      FROM pc_invitation_acceptance_authority;
    GRANT SELECT ("id", "email", "passwordHash", "status", "deletedAt")
      ON public.users TO pc_invitation_acceptance_authority;
    GRANT INSERT ("id", "email", "phone", "passwordHash", "fullName", "status")
      ON public.users TO pc_invitation_acceptance_authority;
    GRANT SELECT ("id", "userId", "organizationId", "status")
      ON public.user_orgs TO pc_invitation_acceptance_authority;
    GRANT INSERT (
      "id", "userId", "organizationId", "role", "status", "isDefault",
      "is_org_admin", "activated_at"
    ) ON public.user_orgs TO pc_invitation_acceptance_authority;
    GRANT SELECT ("id", "tenantId", "name", "status")
      ON public.organizations TO pc_invitation_acceptance_authority;
    GRANT SELECT ON auth.organization_invitations TO pc_invitation_acceptance_authority;
    GRANT UPDATE (
      status, accepted_at, accepted_by_user_id, accepted_membership_id, version, updated_at
    ) ON auth.organization_invitations TO pc_invitation_acceptance_authority;
    GRANT EXECUTE ON FUNCTION auth.resolve_invitation_acceptance_credential(text,text)
      TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.accept_organization_invitation_identity(
      text,text,bigint,text,text,boolean,text,text,text,text
    ) TO one_deal_auth;
    REVOKE ALL ON FUNCTION auth.resolve_invitation_acceptance_credential(text,text)
      FROM one_deal_app, one_deal_staff, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.accept_organization_invitation_identity(
      text,text,bigint,text,text,boolean,text,text,text,text
    ) FROM one_deal_app, one_deal_staff, one_deal_storage;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_organization_membership_command_authority') THEN
    ALTER ROLE pc_organization_membership_command_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    IF EXISTS (
      SELECT 1 FROM pg_auth_members membership
      JOIN pg_roles granted ON granted.oid = membership.roleid
      WHERE granted.rolname = 'pc_organization_membership_command_authority'
    ) THEN
      RAISE EXCEPTION 'pc_organization_membership_command_authority must have no members after restore';
    END IF;
    FOREACH target IN ARRAY organization_membership_command_owned LOOP
      IF to_regprocedure(target) IS NOT NULL THEN
        EXECUTE format('ALTER FUNCTION %s OWNER TO pc_organization_membership_command_authority', target);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', target);
      END IF;
    END LOOP;
    GRANT USAGE ON SCHEMA public, auth TO pc_organization_membership_command_authority;
    REVOKE ALL PRIVILEGES ON public.users, public.user_orgs, public.organizations
      FROM pc_organization_membership_command_authority;
    GRANT SELECT ("id", "email", "status", "deletedAt")
      ON public.users TO pc_organization_membership_command_authority;
    GRANT SELECT (
      "id", "userId", "organizationId", "role", "status", "isDefault",
      "is_org_admin", "version"
    ) ON public.user_orgs TO pc_organization_membership_command_authority;
    GRANT SELECT ("id", "tenantId", "status")
      ON public.organizations TO pc_organization_membership_command_authority;
    GRANT UPDATE (
      "role", "status", "isDefault", "is_org_admin", "revoked_at", "version"
    ) ON public.user_orgs TO pc_organization_membership_command_authority;
    GRANT SELECT ON auth.mfa_recovery_challenges
      TO pc_organization_membership_command_authority;
    GRANT SELECT (user_id, mfa_enabled, mfa_secret_ciphertext)
      ON auth.credential_states TO pc_organization_membership_command_authority;
    GRANT SELECT (user_id, status, valid_from, valid_until)
      ON auth.staff_assignments TO pc_organization_membership_command_authority;
    GRANT EXECUTE ON FUNCTION auth.resolve_organization_admin_session(text,text,text,text,text)
      TO pc_organization_membership_command_authority;
    GRANT EXECUTE ON FUNCTION auth.change_organization_membership_role(
      text,text,text,text,text,text,bigint,text
    ) TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.revoke_organization_membership(
      text,text,text,text,text,text,bigint
    ) TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.prepare_organization_mfa_recovery_target(
      text,text,text,text,text,text,bigint
    ) TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.organization_mfa_recovery_snapshot(
      text,text,text,text,text,text
    ) TO one_deal_auth;
    REVOKE ALL ON FUNCTION auth.change_organization_membership_role(
      text,text,text,text,text,text,bigint,text
    ) FROM one_deal_app, one_deal_staff, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.revoke_organization_membership(
      text,text,text,text,text,text,bigint
    ) FROM one_deal_app, one_deal_staff, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.prepare_organization_mfa_recovery_target(
      text,text,text,text,text,text,bigint
    ) FROM one_deal_app, one_deal_staff, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.organization_mfa_recovery_snapshot(
      text,text,text,text,text,text
    ) FROM one_deal_app, one_deal_staff, one_deal_storage;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_mfa_recovery_identity_authority') THEN
    ALTER ROLE pc_mfa_recovery_identity_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    IF EXISTS (
      SELECT 1 FROM pg_auth_members membership
      JOIN pg_roles granted ON granted.oid = membership.roleid
      WHERE granted.rolname = 'pc_mfa_recovery_identity_authority'
    ) THEN
      RAISE EXCEPTION 'pc_mfa_recovery_identity_authority must have no members after restore';
    END IF;
    FOREACH target IN ARRAY mfa_recovery_identity_owned LOOP
      IF to_regprocedure(target) IS NOT NULL THEN
        EXECUTE format('ALTER FUNCTION %s OWNER TO pc_mfa_recovery_identity_authority', target);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', target);
      END IF;
    END LOOP;
    GRANT USAGE ON SCHEMA public, auth TO pc_mfa_recovery_identity_authority;
    REVOKE ALL PRIVILEGES ON public.users, public.user_orgs, public.organizations
      FROM pc_mfa_recovery_identity_authority;
    GRANT SELECT ("id", "email", "passwordHash", "status", "deletedAt")
      ON public.users TO pc_mfa_recovery_identity_authority;
    GRANT SELECT ("id", "userId", "organizationId", "status")
      ON public.user_orgs TO pc_mfa_recovery_identity_authority;
    GRANT SELECT ("id", "tenantId", "status")
      ON public.organizations TO pc_mfa_recovery_identity_authority;
    GRANT UPDATE ("mfaEnabled", "updatedAt") ON public.users
      TO pc_mfa_recovery_identity_authority;
    GRANT SELECT, UPDATE ON auth.mfa_recovery_challenges
      TO pc_mfa_recovery_identity_authority;
    GRANT SELECT ON auth.credential_states TO pc_mfa_recovery_identity_authority;
    GRANT UPDATE (
      mfa_enabled, mfa_secret_ciphertext, mfa_key_version, mfa_backup_hashes,
      credential_version, updated_at
    ) ON auth.credential_states TO pc_mfa_recovery_identity_authority;
    GRANT SELECT (user_id, status, valid_from, valid_until)
      ON auth.staff_assignments TO pc_mfa_recovery_identity_authority;
    GRANT EXECUTE ON FUNCTION auth.resolve_mfa_recovery_identity(text,text)
      TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.finalize_mfa_recovery_identity(
      text,text,text,bigint
    ) TO one_deal_auth;
    REVOKE ALL ON FUNCTION auth.resolve_mfa_recovery_identity(text,text)
      FROM one_deal_app, one_deal_staff, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.finalize_mfa_recovery_identity(
      text,text,text,bigint
    ) FROM one_deal_app, one_deal_staff, one_deal_storage;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_registration_decision_authority') THEN
    ALTER ROLE pc_registration_decision_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    IF EXISTS (
      SELECT 1 FROM pg_auth_members membership
      JOIN pg_roles granted ON granted.oid = membership.roleid
      WHERE granted.rolname = 'pc_registration_decision_authority'
    ) THEN
      RAISE EXCEPTION 'pc_registration_decision_authority must have no members after restore';
    END IF;
    FOREACH target IN ARRAY registration_decision_owned LOOP
      IF to_regprocedure(target) IS NOT NULL THEN
        EXECUTE format('ALTER FUNCTION %s OWNER TO pc_registration_decision_authority', target);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', target);
      END IF;
    END LOOP;
    GRANT USAGE ON SCHEMA public, auth TO pc_registration_decision_authority;
    REVOKE ALL PRIVILEGES ON public.users, public.user_orgs, public.organizations
      FROM pc_registration_decision_authority;
    REVOKE ALL PRIVILEGES ON auth.registration_applications
      FROM pc_registration_decision_authority;
    GRANT SELECT ON public.users, public.user_orgs, public.organizations
      TO pc_registration_decision_authority;
    GRANT UPDATE ("status", "updatedAt") ON public.users
      TO pc_registration_decision_authority;
    GRANT UPDATE (
      "status", "role", "activated_at", "revoked_at", "is_org_admin", "version"
    ) ON public.user_orgs TO pc_registration_decision_authority;
    GRANT UPDATE ("status", "verifiedAt", "version", "updatedAt")
      ON public.organizations TO pc_registration_decision_authority;
    GRANT SELECT ON auth.sessions, auth.credential_states, auth.staff_assignments, auth.registration_applications
      TO pc_registration_decision_authority;
    GRANT UPDATE (id) ON TABLE auth.registration_applications
      TO pc_registration_decision_authority;

    GRANT EXECUTE ON FUNCTION auth.registration_platform_actor_authorized(text,text)
      TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.registration_organization_admin_context(text,text,text,text,text)
      TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.registration_platform_review_queue(text,text,integer)
      TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.registration_organization_join_queue(text,text,text,text,text,integer)
      TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.lock_registration_decision_application(text,text,text,text,text,text,text)
      TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.apply_registration_identity_transition(text,text,text,text,text,text,text,text)
      TO one_deal_auth;
    REVOKE ALL ON FUNCTION auth.registration_role_assignment_allowed(text,text)
      FROM one_deal_auth, one_deal_app, one_deal_staff, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.registration_platform_actor_authorized(text,text)
      FROM one_deal_app, one_deal_staff, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.registration_organization_admin_context(text,text,text,text,text)
      FROM one_deal_app, one_deal_staff, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.registration_platform_review_queue(text,text,integer)
      FROM one_deal_app, one_deal_staff, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.registration_organization_join_queue(text,text,text,text,text,integer)
      FROM one_deal_app, one_deal_staff, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.lock_registration_decision_application(text,text,text,text,text,text,text)
      FROM one_deal_app, one_deal_staff, one_deal_storage;
    REVOKE ALL ON FUNCTION auth.apply_registration_identity_transition(text,text,text,text,text,text,text,text)
      FROM one_deal_app, one_deal_staff, one_deal_storage;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_account_export_authority') THEN
    ALTER ROLE pc_account_export_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    IF EXISTS (
      SELECT 1 FROM pg_auth_members membership
      JOIN pg_roles granted ON granted.oid = membership.roleid
      WHERE granted.rolname = 'pc_account_export_authority'
    ) THEN
      RAISE EXCEPTION 'pc_account_export_authority must have no members after restore';
    END IF;
    FOREACH target IN ARRAY account_export_owned LOOP
      IF to_regprocedure(target) IS NOT NULL THEN
        EXECUTE format('ALTER FUNCTION %s OWNER TO pc_account_export_authority', target);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', target);
      END IF;
    END LOOP;
    GRANT USAGE ON SCHEMA public, auth TO pc_account_export_authority;
    REVOKE ALL PRIVILEGES ON public.users, public.user_orgs, public.organizations
      FROM pc_account_export_authority;
    GRANT SELECT ("id", "email", "phone", "fullName", "status", "createdAt", "deletedAt")
      ON public.users TO pc_account_export_authority;
    GRANT SELECT ("id", "userId", "organizationId", "role", "status", "joinedAt")
      ON public.user_orgs TO pc_account_export_authority;
    GRANT SELECT ("id", "name", "tenantId", "status")
      ON public.organizations TO pc_account_export_authority;
    GRANT SELECT (
      id, user_id, membership_id, organization_id, tenant_id, status,
      credential_version, expires_at, revoked_at
    ) ON auth.sessions TO pc_account_export_authority;
    GRANT SELECT (user_id, credential_version, mfa_enabled, consent_version, consent_at)
      ON auth.credential_states TO pc_account_export_authority;
    GRANT EXECUTE ON FUNCTION auth.account_data_export(text,text,text,text,text)
      TO one_deal_auth;
    REVOKE ALL ON FUNCTION auth.account_data_export(text,text,text,text,text)
      FROM one_deal_app, one_deal_staff, one_deal_storage;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_account_anonymization_authority') THEN
    ALTER ROLE pc_account_anonymization_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    IF EXISTS (
      SELECT 1 FROM pg_auth_members membership
      JOIN pg_roles granted ON granted.oid = membership.roleid
      WHERE granted.rolname = 'pc_account_anonymization_authority'
    ) THEN
      RAISE EXCEPTION 'pc_account_anonymization_authority must have no members after restore';
    END IF;
    FOREACH target IN ARRAY account_anonymization_owned LOOP
      IF to_regprocedure(target) IS NOT NULL THEN
        EXECUTE format('ALTER FUNCTION %s OWNER TO pc_account_anonymization_authority', target);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', target);
      END IF;
    END LOOP;
    GRANT USAGE ON SCHEMA public, auth TO pc_account_anonymization_authority;
    REVOKE ALL PRIVILEGES ON public.users, public.user_orgs, public.organizations
      FROM pc_account_anonymization_authority;
    GRANT SELECT ("id", "status", "deletedAt")
      ON public.users TO pc_account_anonymization_authority;
    GRANT UPDATE (
      "email", "phone", "passwordHash", "fullName", "status", "mfaEnabled",
      "mfaSecret", "mfaBackup", "updatedAt", "deletedAt"
    ) ON public.users TO pc_account_anonymization_authority;
    GRANT SELECT ("id", "userId", "organizationId", "status")
      ON public.user_orgs TO pc_account_anonymization_authority;
    GRANT SELECT ("id", "tenantId", "status")
      ON public.organizations TO pc_account_anonymization_authority;
    GRANT SELECT (
      id, user_id, membership_id, organization_id, tenant_id, status,
      credential_version, expires_at, revoked_at
    ) ON auth.sessions TO pc_account_anonymization_authority;
    GRANT UPDATE (status, revoked_at, revocation_reason, updated_at)
      ON auth.sessions TO pc_account_anonymization_authority;
    GRANT SELECT (session_id, status)
      ON auth.refresh_tokens TO pc_account_anonymization_authority;
    GRANT UPDATE (status, revoked_at, revocation_reason)
      ON auth.refresh_tokens TO pc_account_anonymization_authority;
    GRANT SELECT (user_id, credential_version)
      ON auth.credential_states TO pc_account_anonymization_authority;
    GRANT UPDATE (
      credential_version, failed_login_count, locked_until, password_changed_at,
      last_login_at, mfa_enabled,
      mfa_secret_ciphertext, mfa_key_version, mfa_backup_hashes, updated_at
    ) ON auth.credential_states TO pc_account_anonymization_authority;
    GRANT EXECUTE ON FUNCTION auth.anonymize_account_identity(text,text,text,text,text)
      TO one_deal_auth;
    REVOKE ALL ON FUNCTION auth.anonymize_account_identity(text,text,text,text,text)
      FROM one_deal_app, one_deal_staff, one_deal_storage;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_staff_authority') THEN
    FOREACH target IN ARRAY authority_owned LOOP
      IF to_regprocedure(target) IS NOT NULL THEN
        EXECUTE format('ALTER FUNCTION %s OWNER TO pc_staff_authority', target);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', target);
      END IF;
    END LOOP;
    GRANT USAGE ON SCHEMA public, auth TO pc_staff_authority;
    GRANT SELECT ON auth.staff_access_sessions, auth.staff_access_grants, auth.staff_assignments, auth.credential_states
      TO pc_staff_authority;
    GRANT SELECT ON public.organizations, public.users, public.user_orgs, public.deals TO pc_staff_authority;
    GRANT UPDATE ("status", "kycStatus", "verifiedAt", "updatedAt")
      ON public.organizations TO pc_staff_authority;
    GRANT SELECT ON public.kyc_tasks TO pc_staff_authority;
    GRANT UPDATE ("status", "assignedTo", "notes", "resolvedAt", "updatedAt")
      ON public.kyc_tasks TO pc_staff_authority;
    GRANT EXECUTE ON FUNCTION auth.staff_admission_capability(text,text,text,text,text)
      TO pc_staff_authority;
    GRANT EXECUTE ON FUNCTION auth.staff_projection_capability(text,text,text,text,text,text,boolean)
      TO pc_staff_authority;

    GRANT USAGE ON SCHEMA auth TO one_deal_staff;
    GRANT EXECUTE ON FUNCTION auth.resolve_staff_deal_target_scope(text,text,text) TO one_deal_staff;
    GRANT EXECUTE ON FUNCTION auth.staff_admission_queue(text,text,text,integer) TO one_deal_staff;
    GRANT EXECUTE ON FUNCTION auth.staff_admission_application(text,text,text,text) TO one_deal_staff;
    GRANT EXECUTE ON FUNCTION auth.staff_admission_decision(text,text,text,text,text,text) TO one_deal_staff;
    GRANT EXECUTE ON FUNCTION auth.staff_organization_directory(text,text,text) TO one_deal_staff;
    GRANT EXECUTE ON FUNCTION auth.staff_organization_users(text,text,text,text) TO one_deal_staff;
    GRANT EXECUTE ON FUNCTION auth.staff_cabinet_deals(text,text,text,text,text) TO one_deal_staff;
    REVOKE ALL ON FUNCTION auth.staff_admission_capability(text,text,text,text,text) FROM one_deal_staff;
    REVOKE ALL ON FUNCTION auth.staff_projection_capability(text,text,text,text,text,text,boolean) FROM one_deal_staff;
    REVOKE ALL ON FUNCTION auth.resolve_staff_deal_target_scope(text,text,text) FROM one_deal_auth;
    REVOKE ALL ON FUNCTION auth.staff_admission_queue(text,text,text,integer) FROM one_deal_auth;
    REVOKE ALL ON FUNCTION auth.staff_admission_application(text,text,text,text) FROM one_deal_auth;
    REVOKE ALL ON FUNCTION auth.staff_admission_decision(text,text,text,text,text,text) FROM one_deal_auth;
    REVOKE ALL ON FUNCTION auth.staff_organization_directory(text,text,text) FROM one_deal_auth;
    REVOKE ALL ON FUNCTION auth.staff_organization_users(text,text,text,text) FROM one_deal_auth;
    REVOKE ALL ON FUNCTION auth.staff_cabinet_deals(text,text,text,text,text) FROM one_deal_auth;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_staff_runtime') THEN
      GRANT USAGE ON SCHEMA auth TO pc_staff_runtime;
      GRANT EXECUTE ON FUNCTION auth.resolve_staff_deal_target_scope(text,text,text) TO pc_staff_runtime;
      GRANT EXECUTE ON FUNCTION auth.staff_admission_queue(text,text,text,integer) TO pc_staff_runtime;
      GRANT EXECUTE ON FUNCTION auth.staff_admission_application(text,text,text,text) TO pc_staff_runtime;
      GRANT EXECUTE ON FUNCTION auth.staff_admission_decision(text,text,text,text,text,text) TO pc_staff_runtime;
      GRANT EXECUTE ON FUNCTION auth.staff_organization_directory(text,text,text) TO pc_staff_runtime;
      GRANT EXECUTE ON FUNCTION auth.staff_organization_users(text,text,text,text) TO pc_staff_runtime;
      GRANT EXECUTE ON FUNCTION auth.staff_cabinet_deals(text,text,text,text,text) TO pc_staff_runtime;
    END IF;
  END IF;

  -- Keep the isolated one-deal auth principal aligned with the runtime boundary
  -- asserted by restored-database-acceptance. Only the deal principal is
  -- narrowed to the self-service public.users columns here; the production
  -- pc_auth_runtime restriction is already restored from migration history.
  REVOKE UPDATE ON public.users FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'one_deal_app') THEN
    REVOKE UPDATE ON public.users FROM one_deal_app;
    GRANT UPDATE ("email", "phone", "fullName", "updatedAt")
      ON public.users TO one_deal_app;
  END IF;
END;
$identity_recovery$;
SQL

RESTORE_IDENTITY_PROOF="$(psql "$RESTORE_ADMIN_URL" -X -At --set ON_ERROR_STOP=1 <<'SQL'
SELECT
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname IN ('users','user_orgs','organizations')
     AND c.relrowsecurity AND c.relforcerowsecurity)::text
  || ':' ||
  (SELECT count(*) FROM pg_proc p JOIN pg_roles owner ON owner.oid = p.proowner
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE ((
       n.nspname = 'auth'
       AND p.proname IN (
         'resolve_login_identity', 'resolve_login_identity_by_id',
         'resolve_login_memberships', 'resolve_login_memberships_ordered',
         'resolve_login_context_by_email', 'resolve_login_credential',
         'resolve_login_default_membership', 'resolve_login_context_by_membership',
         'resolve_session_identity', 'resolve_post_password_membership_ids',
         'resolve_post_password_membership_context', 'resolve_session_identity_v2',
         'resolve_staff_target_scope',
         'validate_deal_creation_actors')
     ) OR (
       n.nspname = 'public'
       AND p.proname = 'app_logistics_assignment_projection'
     ))
     AND owner.rolname = 'pc_identity_bootstrap')::text
  || ':' ||
  (SELECT count(*) FROM pg_roles WHERE rolname = 'one_deal_auth' AND rolbypassrls)::text
  || ':' ||
  (
    has_function_privilege('one_deal_auth', 'auth.resolve_login_credential(text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.resolve_login_default_membership(text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.resolve_login_context_by_membership(text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.resolve_session_identity(text,text,text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.resolve_post_password_membership_ids(text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.resolve_post_password_membership_context(text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.resolve_session_identity_v2(text,text,text,text)', 'EXECUTE')
    AND NOT (
      has_function_privilege('one_deal_auth', 'auth.resolve_login_identity(text)', 'EXECUTE')
      OR has_function_privilege('one_deal_auth', 'auth.resolve_login_identity_by_id(text)', 'EXECUTE')
      OR has_function_privilege('one_deal_auth', 'auth.resolve_login_memberships(text)', 'EXECUTE')
      OR has_function_privilege('one_deal_auth', 'auth.resolve_login_memberships_ordered(text)', 'EXECUTE')
      OR has_function_privilege('one_deal_auth', 'auth.resolve_login_context_by_email(text)', 'EXECUTE')
    )
  )::int::text
  || ':' ||
  has_function_privilege('one_deal_app', 'auth.validate_deal_creation_actors(text,text,text,text,text)', 'EXECUTE')::int::text
  || ':' ||
  has_function_privilege('one_deal_auth', 'auth.validate_deal_creation_actors(text,text,text,text,text)', 'EXECUTE')::int::text
  || ':' ||
  has_function_privilege('one_deal_app', 'public.app_logistics_assignment_projection(text,text,text,text,text,text,text)', 'EXECUTE')::int::text
  || ':' ||
  has_function_privilege('one_deal_auth', 'public.app_logistics_assignment_projection(text,text,text,text,text,text,text)', 'EXECUTE')::int::text;
SQL
)"
echo "[dr] restored identity proof forced-rls:bootstrap-owned:auth-bypassrls:minimal-bootstrap:deal-actor-execute:auth-actor-execute:logistics-execute:auth-logistics-execute = $RESTORE_IDENTITY_PROOF"
if [[ "$RESTORE_IDENTITY_PROOF" != "3:15:0:1:1:0:1:0" ]]; then
  echo "Restored identity boundary is invalid: $RESTORE_IDENTITY_PROOF" >&2
  exit 1
fi

RESTORE_MFA_AUTHORITY_PROOF="$(psql "$RESTORE_ADMIN_URL" -X -At --set ON_ERROR_STOP=1 <<'SQL'
SELECT
  (SELECT count(*) FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   JOIN pg_roles owner ON owner.oid = p.proowner
   WHERE n.nspname = 'auth'
     AND p.proname = 'finalize_authenticated_user_mfa'
     AND p.prosecdef
     AND owner.rolname = 'pc_auth_mfa_authority'
     AND p.proconfig @> ARRAY['search_path=pg_catalog, pg_temp']::text[]
     AND p.proconfig @> ARRAY['row_security=on']::text[]
     AND p.prosrc LIKE '%challenge."type" IN (''TOTP_ENROLL'', ''TOTP_VERIFY'')%'
     AND p.prosrc LIKE '%challenge.verified_at = pg_catalog.transaction_timestamp()%'
     AND p.prosrc LIKE '%session.mfa_verified_method = ''TOTP''%'
     AND p.prosrc LIKE '%session.mfa_verified_at = pg_catalog.transaction_timestamp()%'
     AND p.prosrc LIKE '%challenge.verified_at = session.mfa_verified_at%'
     AND p.prosrc LIKE '%session.credential_version = credential.credential_version%'
     AND p.prosrc ~ 'UPDATE public\."users"'
     AND p.prosrc !~* '\m(INSERT|DELETE|TRUNCATE|MERGE|CALL|EXECUTE)\M')::text
  || ':' ||
  (SELECT count(*) FROM pg_roles
   WHERE rolname = 'pc_auth_mfa_authority'
     AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls
     AND NOT rolcreatedb AND NOT rolcreaterole)::text
  || ':' ||
  (SELECT count(*) FROM pg_auth_members membership
   JOIN pg_roles granted ON granted.oid = membership.roleid
   WHERE granted.rolname = 'pc_auth_mfa_authority')::text
  || ':' ||
  (
    has_table_privilege('pc_auth_mfa_authority', 'auth.sessions', 'SELECT')
    AND has_table_privilege('pc_auth_mfa_authority', 'auth.mfa_challenges', 'SELECT')
    AND has_table_privilege('pc_auth_mfa_authority', 'auth.credential_states', 'SELECT')
    AND has_column_privilege('pc_auth_mfa_authority', 'public.users', 'id', 'SELECT')
    AND has_column_privilege('pc_auth_mfa_authority', 'public.users', 'mfaEnabled', 'UPDATE')
    AND NOT has_table_privilege('pc_auth_mfa_authority', 'public.users', 'INSERT')
    AND NOT has_table_privilege('pc_auth_mfa_authority', 'public.users', 'DELETE')
    AND NOT has_table_privilege('pc_auth_mfa_authority', 'public.user_orgs', 'SELECT')
    AND NOT has_table_privilege('pc_auth_mfa_authority', 'public.organizations', 'SELECT')
  )::int::text
  || ':' ||
  has_function_privilege('one_deal_auth', 'auth.finalize_authenticated_user_mfa(text,text,text)', 'EXECUTE')::int::text
  || ':' ||
  has_function_privilege('one_deal_app', 'auth.finalize_authenticated_user_mfa(text,text,text)', 'EXECUTE')::int::text
  || ':' ||
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'users'
     AND policyname IN ('users_mfa_finalize_select', 'users_mfa_finalize_update')
     AND 'pc_auth_mfa_authority' = ANY (roles))::text;
SQL
)"
echo "[dr] restored MFA authority proof definer:confined:members:least-privilege:auth-execute:deal-execute:policies = $RESTORE_MFA_AUTHORITY_PROOF"
if [[ "$RESTORE_MFA_AUTHORITY_PROOF" != "1:1:0:1:1:0:2" ]]; then
  echo "Restored MFA finalizer authority boundary is invalid: $RESTORE_MFA_AUTHORITY_PROOF" >&2
  exit 1
fi

RESTORE_REGISTRATION_LIFECYCLE_PROOF="$(psql "$RESTORE_ADMIN_URL" -X -At --set ON_ERROR_STOP=1 <<'SQL'
SELECT
  (SELECT count(*) FROM pg_proc function
   JOIN pg_namespace schema ON schema.oid = function.pronamespace
   JOIN pg_roles owner ON owner.oid = function.proowner
   WHERE schema.nspname = 'auth'
     AND function.proname IN (
       'prepare_pending_registration_identity',
       'restart_pending_registration_identity',
       'mark_registration_email_verified',
       'registration_join_notification_recipients'
     )
     AND function.prosecdef
     AND owner.rolname = 'pc_registration_lifecycle_authority')::text
  || ':' ||
  (SELECT count(*) FROM pg_roles
   WHERE rolname = 'pc_registration_lifecycle_authority'
     AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls
     AND NOT rolcreatedb AND NOT rolcreaterole)::text
  || ':' ||
  (SELECT count(*) FROM pg_auth_members membership
   JOIN pg_roles granted ON granted.oid = membership.roleid
   WHERE granted.rolname = 'pc_registration_lifecycle_authority')::text
  || ':' ||
  (
    has_table_privilege('pc_registration_lifecycle_authority', 'public.users', 'SELECT')
    AND has_table_privilege('pc_registration_lifecycle_authority', 'public.users', 'INSERT')
    AND has_table_privilege('pc_registration_lifecycle_authority', 'public.users', 'UPDATE')
    AND NOT has_table_privilege('pc_registration_lifecycle_authority', 'public.users', 'DELETE')
    AND has_table_privilege('pc_registration_lifecycle_authority', 'public.user_orgs', 'SELECT')
    AND has_table_privilege('pc_registration_lifecycle_authority', 'public.user_orgs', 'INSERT')
    AND has_table_privilege('pc_registration_lifecycle_authority', 'public.user_orgs', 'UPDATE')
    AND NOT has_table_privilege('pc_registration_lifecycle_authority', 'public.user_orgs', 'DELETE')
    AND has_table_privilege('pc_registration_lifecycle_authority', 'public.organizations', 'SELECT')
    AND has_table_privilege('pc_registration_lifecycle_authority', 'public.organizations', 'INSERT')
    AND has_table_privilege('pc_registration_lifecycle_authority', 'public.organizations', 'UPDATE')
    AND NOT has_table_privilege('pc_registration_lifecycle_authority', 'public.organizations', 'DELETE')
  )::int::text
  || ':' ||
  (
    has_function_privilege('one_deal_auth', 'auth.prepare_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.restart_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.mark_registration_email_verified(text,text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.registration_join_notification_recipients(text,text,text)', 'EXECUTE')
  )::int::text
  || ':' ||
  (SELECT count(*) FROM (VALUES ('one_deal_app'),('one_deal_staff'),('one_deal_storage')) AS runtime(role)
   WHERE has_function_privilege(runtime.role, 'auth.prepare_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)', 'EXECUTE')
      OR has_function_privilege(runtime.role, 'auth.restart_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)', 'EXECUTE')
      OR has_function_privilege(runtime.role, 'auth.mark_registration_email_verified(text,text,text)', 'EXECUTE')
      OR has_function_privilege(runtime.role, 'auth.registration_join_notification_recipients(text,text,text)', 'EXECUTE'))::text
  || ':' ||
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('users', 'user_orgs', 'organizations')
     AND policyname LIKE '%_registration_lifecycle_%'
     AND 'pc_registration_lifecycle_authority' = ANY (roles))::text;
SQL
)"
echo "[dr] restored registration lifecycle proof definers:confined:members:least-privilege:auth-execute:non-auth-execute:policies = $RESTORE_REGISTRATION_LIFECYCLE_PROOF"
if [[ "$RESTORE_REGISTRATION_LIFECYCLE_PROOF" != "4:1:0:1:1:0:9" ]]; then
  echo "Restored registration lifecycle authority boundary is invalid: $RESTORE_REGISTRATION_LIFECYCLE_PROOF" >&2
  exit 1
fi

RESTORE_PASSWORD_RESET_PROOF="$(psql "$RESTORE_ADMIN_URL" -X -At --set ON_ERROR_STOP=1 <<'SQL'
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
    has_column_privilege('pc_password_reset_authority', 'public.users', 'id', 'SELECT')
    AND has_column_privilege('pc_password_reset_authority', 'public.users', 'email', 'SELECT')
    AND has_column_privilege('pc_password_reset_authority', 'public.users', 'status', 'SELECT')
    AND has_column_privilege('pc_password_reset_authority', 'public.users', 'deletedAt', 'SELECT')
    AND has_column_privilege('pc_password_reset_authority', 'public.users', 'passwordHash', 'UPDATE')
    AND has_column_privilege('pc_password_reset_authority', 'public.users', 'updatedAt', 'UPDATE')
    AND NOT has_table_privilege('pc_password_reset_authority', 'public.users', 'INSERT')
    AND NOT has_table_privilege('pc_password_reset_authority', 'public.users', 'DELETE')
    AND NOT has_table_privilege('pc_password_reset_authority', 'public.user_orgs', 'SELECT')
    AND NOT has_table_privilege('pc_password_reset_authority', 'public.organizations', 'SELECT')
  )::int::text
  || ':' ||
  (
    has_function_privilege('one_deal_auth', 'auth.resolve_password_reset_subject(text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.replace_password_after_reset(text,text,text,timestamptz)', 'EXECUTE')
  )::int::text
  || ':' ||
  (SELECT count(*) FROM (VALUES ('one_deal_app'),('one_deal_staff'),('one_deal_storage')) AS runtime(role)
   WHERE has_function_privilege(runtime.role, 'auth.resolve_password_reset_subject(text)', 'EXECUTE')
      OR has_function_privilege(runtime.role, 'auth.replace_password_after_reset(text,text,text,timestamptz)', 'EXECUTE'))::text
  || ':' ||
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'users'
     AND policyname IN ('users_password_reset_select', 'users_password_reset_update')
     AND 'pc_password_reset_authority' = ANY (roles))::text;
SQL
)"
echo "[dr] restored password-reset proof definers:confined:members:least-privilege:auth:non-auth:policies = $RESTORE_PASSWORD_RESET_PROOF"
if [[ "$RESTORE_PASSWORD_RESET_PROOF" != "2:1:0:1:1:0:2" ]]; then
  echo "Restored password-reset authority boundary is invalid: $RESTORE_PASSWORD_RESET_PROOF" >&2
  exit 1
fi

RESTORE_ORGANIZATION_TEAM_PROOF="$(psql "$RESTORE_ADMIN_URL" -X -At --set ON_ERROR_STOP=1 <<'SQL'
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
      'one_deal_auth', 'auth.organization_team_snapshot(text,text,text,text,text)', 'EXECUTE'
    )
    AND has_function_privilege(
      'one_deal_auth', 'auth.resolve_organization_admin_session(text,text,text,text,text)', 'EXECUTE'
    )
    AND has_function_privilege(
      'one_deal_auth', 'auth.organization_membership_exists_for_email(text,text,text,text,text,text)', 'EXECUTE'
    )
  )::int::text
  || ':' ||
  (SELECT count(*) FROM (VALUES ('one_deal_app'),('one_deal_staff'),('one_deal_storage')) AS runtime(role)
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
echo "[dr] restored organization-team proof definer:confined:members:read-only:auth:non-auth:policies = $RESTORE_ORGANIZATION_TEAM_PROOF"
if [[ "$RESTORE_ORGANIZATION_TEAM_PROOF" != "3:1:0:1:1:0:3" ]]; then
  echo "Restored organization-team authority boundary is invalid: $RESTORE_ORGANIZATION_TEAM_PROOF" >&2
  exit 1
fi

RESTORE_INVITATION_MEMBERSHIP_RECOVERY_PROOF="$(psql "$RESTORE_ADMIN_URL" -X -At --set ON_ERROR_STOP=1 <<'SQL'
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
    has_function_privilege('one_deal_auth', 'auth.resolve_invitation_acceptance_credential(text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.accept_organization_invitation_identity(text,text,bigint,text,text,boolean,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.change_organization_membership_role(text,text,text,text,text,text,bigint,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.revoke_organization_membership(text,text,text,text,text,text,bigint)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.prepare_organization_mfa_recovery_target(text,text,text,text,text,text,bigint)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.organization_mfa_recovery_snapshot(text,text,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.resolve_mfa_recovery_identity(text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.finalize_mfa_recovery_identity(text,text,text,bigint)', 'EXECUTE')
  )::int::text
  || ':' ||
  (SELECT count(*) FROM (VALUES ('one_deal_app'),('one_deal_staff'),('one_deal_storage')) AS runtime(role)
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
echo "[dr] restored invitation/membership/recovery proof acceptance:commands:recovery:confined:members:least-privilege:auth:non-auth:policies = $RESTORE_INVITATION_MEMBERSHIP_RECOVERY_PROOF"
if [[ "$RESTORE_INVITATION_MEMBERSHIP_RECOVERY_PROOF" != "2:4:2:3:0:1:1:0:13" ]]; then
  echo "Restored invitation/membership/recovery authority boundary is invalid: $RESTORE_INVITATION_MEMBERSHIP_RECOVERY_PROOF" >&2
  exit 1
fi

RESTORE_REGISTRATION_DECISION_PROOF="$(psql "$RESTORE_ADMIN_URL" -X -At --set ON_ERROR_STOP=1 <<'SQL'
SELECT
  (SELECT count(*) FROM pg_proc function
   JOIN pg_namespace schema ON schema.oid = function.pronamespace
   JOIN pg_roles owner ON owner.oid = function.proowner
   WHERE schema.nspname = 'auth'
     AND function.proname IN (
       'registration_platform_actor_authorized',
       'registration_organization_admin_context',
       'registration_platform_review_queue',
       'registration_organization_join_queue',
       'lock_registration_decision_application',
       'apply_registration_identity_transition'
     )
     AND function.prosecdef
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
    has_table_privilege('pc_registration_decision_authority', 'public.users', 'SELECT')
    AND has_column_privilege('pc_registration_decision_authority', 'public.users', 'status', 'UPDATE')
    AND has_table_privilege('pc_registration_decision_authority', 'public.user_orgs', 'SELECT')
    AND has_column_privilege('pc_registration_decision_authority', 'public.user_orgs', 'status', 'UPDATE')
    AND has_table_privilege('pc_registration_decision_authority', 'public.organizations', 'SELECT')
    AND has_column_privilege('pc_registration_decision_authority', 'public.organizations', 'status', 'UPDATE')
    AND NOT has_table_privilege('pc_registration_decision_authority', 'public.users', 'INSERT')
    AND NOT has_table_privilege('pc_registration_decision_authority', 'public.users', 'DELETE')
    AND NOT has_table_privilege('pc_registration_decision_authority', 'public.user_orgs', 'INSERT')
    AND NOT has_table_privilege('pc_registration_decision_authority', 'public.user_orgs', 'DELETE')
    AND NOT has_table_privilege('pc_registration_decision_authority', 'public.organizations', 'INSERT')
    AND NOT has_table_privilege('pc_registration_decision_authority', 'public.organizations', 'DELETE')
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
    has_function_privilege('one_deal_auth', 'auth.registration_platform_actor_authorized(text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.registration_organization_admin_context(text,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.registration_platform_review_queue(text,text,integer)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.registration_organization_join_queue(text,text,text,text,text,integer)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.lock_registration_decision_application(text,text,text,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.apply_registration_identity_transition(text,text,text,text,text,text,text,text)', 'EXECUTE')
    AND NOT has_function_privilege('one_deal_auth', 'auth.registration_role_assignment_allowed(text,text)', 'EXECUTE')
  )::int::text
  || ':' ||
  (SELECT count(*) FROM (VALUES ('one_deal_app'),('one_deal_staff'),('one_deal_storage')) AS runtime(role)
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
echo "[dr] restored registration-decision proof definers:confined:members:least-privilege:auth:non-auth:policies = $RESTORE_REGISTRATION_DECISION_PROOF"
if [[ "$RESTORE_REGISTRATION_DECISION_PROOF" != "6:1:0:1:1:0:6" ]]; then
  echo "Restored registration-decision authority boundary is invalid: $RESTORE_REGISTRATION_DECISION_PROOF" >&2
  exit 1
fi

RESTORE_ACCOUNT_LIFECYCLE_PROOF="$(psql "$RESTORE_ADMIN_URL" -X -At --set ON_ERROR_STOP=1 <<'SQL'
SELECT
  (SELECT count(*) FROM pg_proc function
   JOIN pg_namespace schema ON schema.oid = function.pronamespace
   JOIN pg_roles owner ON owner.oid = function.proowner
   WHERE schema.nspname = 'auth'
     AND function.proname = 'account_data_export'
     AND function.prosecdef
     AND owner.rolname = 'pc_account_export_authority')::text
  || ':' ||
  (SELECT count(*) FROM pg_proc function
   JOIN pg_namespace schema ON schema.oid = function.pronamespace
   JOIN pg_roles owner ON owner.oid = function.proowner
   WHERE schema.nspname = 'auth'
     AND function.proname = 'anonymize_account_identity'
     AND function.prosecdef
     AND owner.rolname = 'pc_account_anonymization_authority')::text
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
    has_function_privilege('one_deal_auth', 'auth.account_data_export(text,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.anonymize_account_identity(text,text,text,text,text)', 'EXECUTE')
  )::int::text
  || ':' ||
  (SELECT count(*) FROM (VALUES ('one_deal_app'),('one_deal_staff'),('one_deal_storage')) AS runtime(role)
   WHERE has_function_privilege(runtime.role, 'auth.account_data_export(text,text,text,text,text)', 'EXECUTE')
      OR has_function_privilege(runtime.role, 'auth.anonymize_account_identity(text,text,text,text,text)', 'EXECUTE'))::text
  || ':' ||
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('users','user_orgs','organizations')
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
echo "[dr] restored account-lifecycle proof export:anonymize:roles:members:least-privilege:auth:non-auth:policies = $RESTORE_ACCOUNT_LIFECYCLE_PROOF"
if [[ "$RESTORE_ACCOUNT_LIFECYCLE_PROOF" != "1:1:2:0:1:1:0:7" ]]; then
  echo "Restored account-lifecycle authority boundary is invalid: $RESTORE_ACCOUNT_LIFECYCLE_PROOF" >&2
  exit 1
fi

RESTORE_REGISTRATION_PROOF="$(psql "$RESTORE_ADMIN_URL" -X -At --set ON_ERROR_STOP=1 <<'SQL'
SELECT
  (SELECT count(*)
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   JOIN pg_roles owner ON owner.oid = p.proowner
   WHERE n.nspname = 'auth'
     AND p.proname = 'create_pending_registration_identity'
     AND p.prosecdef
     AND owner.rolname = 'pc_registration_authority')::text
  || ':' ||
  (SELECT count(*) FROM pg_roles
   WHERE rolname = 'pc_registration_authority'
     AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls
     AND NOT rolcreatedb AND NOT rolcreaterole)::text
  || ':' ||
  has_function_privilege(
    'one_deal_auth',
    'auth.create_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  )::int::text
  || ':' ||
  has_function_privilege(
    'one_deal_app',
    'auth.create_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  )::int::text
  || ':' ||
  (
    NOT has_table_privilege('pc_registration_authority', 'public.users', 'SELECT')
    AND NOT has_table_privilege('pc_registration_authority', 'public.users', 'INSERT')
    AND NOT has_table_privilege('pc_registration_authority', 'public.users', 'UPDATE')
    AND NOT has_table_privilege('pc_registration_authority', 'public.users', 'DELETE')
    AND NOT has_table_privilege('pc_registration_authority', 'public.user_orgs', 'SELECT')
    AND NOT has_table_privilege('pc_registration_authority', 'public.user_orgs', 'INSERT')
    AND NOT has_table_privilege('pc_registration_authority', 'public.user_orgs', 'UPDATE')
    AND NOT has_table_privilege('pc_registration_authority', 'public.user_orgs', 'DELETE')
    AND NOT has_table_privilege('pc_registration_authority', 'public.organizations', 'SELECT')
    AND NOT has_table_privilege('pc_registration_authority', 'public.organizations', 'INSERT')
    AND NOT has_table_privilege('pc_registration_authority', 'public.organizations', 'UPDATE')
    AND NOT has_table_privilege('pc_registration_authority', 'public.organizations', 'DELETE')
  )::int::text;
SQL
)"
echo "[dr] restored retired registration proof definer:confined:auth-execute:deal-execute:no-table-access = $RESTORE_REGISTRATION_PROOF"
if [[ "$RESTORE_REGISTRATION_PROOF" != "1:1:0:0:1" ]]; then
  echo "Restored registration authority boundary is invalid: $RESTORE_REGISTRATION_PROOF" >&2
  exit 1
fi

RESTORE_STAFF_PROOF="$(psql "$RESTORE_ADMIN_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT (SELECT count(*) FROM information_schema.role_table_grants WHERE grantee='one_deal_staff' AND table_schema IN ('public','auth'))::text || ':' || has_function_privilege('one_deal_staff','auth.resolve_staff_target_scope(text,text,text,text,text)','EXECUTE')::int::text || ':' || has_function_privilege('one_deal_staff','auth.resolve_staff_deal_target_scope(text,text,text)','EXECUTE')::int::text || ':' || has_function_privilege('one_deal_staff','auth.staff_admission_queue(text,text,text,integer)','EXECUTE')::int::text || ':' || has_function_privilege('one_deal_staff','auth.staff_admission_application(text,text,text,text)','EXECUTE')::int::text || ':' || has_function_privilege('one_deal_staff','auth.staff_admission_decision(text,text,text,text,text,text)','EXECUTE')::int::text || ':' || has_function_privilege('one_deal_staff','auth.staff_organization_directory(text,text,text)','EXECUTE')::int::text || ':' || has_function_privilege('one_deal_staff','auth.staff_organization_users(text,text,text,text)','EXECUTE')::int::text || ':' || has_function_privilege('one_deal_staff','auth.staff_cabinet_deals(text,text,text,text,text)','EXECUTE')::int::text || ':' || has_function_privilege('one_deal_staff','auth.staff_admission_capability(text,text,text,text,text)','EXECUTE')::int::text || ':' || has_function_privilege('one_deal_staff','auth.staff_projection_capability(text,text,text,text,text,text,boolean)','EXECUTE')::int::text || ':' || has_function_privilege('one_deal_auth','auth.resolve_staff_target_scope(text,text,text,text,text)','EXECUTE')::int::text || ':' || has_function_privilege('one_deal_auth','auth.resolve_staff_deal_target_scope(text,text,text)','EXECUTE')::int::text || ':' || has_function_privilege('one_deal_auth','auth.staff_organization_directory(text,text,text)','EXECUTE')::int::text")"
echo "[dr] restored staff proof table-grants:target:deal-target:queue:application:decision:directory:users:cabinet:admission-cap:projection-cap:auth-target:auth-deal-target:auth-directory = $RESTORE_STAFF_PROOF"
if [[ "$RESTORE_STAFF_PROOF" != "0:1:1:1:1:1:1:1:1:0:0:0:0:0" ]]; then
  echo "Restored staff authority boundary is invalid: $RESTORE_STAFF_PROOF" >&2
  exit 1
fi

RESTORE_AUTH_ISOLATION="$(psql "$RESTORE_AUTH_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT (SELECT count(*) FROM public.users)::text || ':' || (SELECT count(*) FROM public.organizations)::text || ':' || (SELECT count(*) FROM auth.resolve_login_credential('nobody@example.invalid'))::text || ':' || (has_function_privilege(current_user,'auth.resolve_post_password_membership_ids(text)','EXECUTE') AND has_function_privilege(current_user,'auth.resolve_post_password_membership_context(text,text)','EXECUTE') AND has_function_privilege(current_user,'auth.resolve_session_identity_v2(text,text,text,text)','EXECUTE') AND has_function_privilege(current_user,'auth.finalize_authenticated_user_mfa(text,text,text)','EXECUTE'))::text || ':' || (has_function_privilege(current_user,'auth.prepare_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)','EXECUTE') AND has_function_privilege(current_user,'auth.restart_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)','EXECUTE') AND has_function_privilege(current_user,'auth.mark_registration_email_verified(text,text,text)','EXECUTE') AND has_function_privilege(current_user,'auth.registration_join_notification_recipients(text,text,text)','EXECUTE'))::text || ':' || (has_function_privilege(current_user,'auth.resolve_password_reset_subject(text)','EXECUTE') AND has_function_privilege(current_user,'auth.replace_password_after_reset(text,text,text,timestamptz)','EXECUTE'))::text || ':' || (has_function_privilege(current_user,'auth.organization_team_snapshot(text,text,text,text,text)','EXECUTE') AND has_function_privilege(current_user,'auth.resolve_organization_admin_session(text,text,text,text,text)','EXECUTE') AND has_function_privilege(current_user,'auth.organization_membership_exists_for_email(text,text,text,text,text,text)','EXECUTE'))::text || ':' || (has_function_privilege(current_user,'auth.resolve_invitation_acceptance_credential(text,text)','EXECUTE') AND has_function_privilege(current_user,'auth.accept_organization_invitation_identity(text,text,bigint,text,text,boolean,text,text,text,text)','EXECUTE') AND has_function_privilege(current_user,'auth.change_organization_membership_role(text,text,text,text,text,text,bigint,text)','EXECUTE') AND has_function_privilege(current_user,'auth.revoke_organization_membership(text,text,text,text,text,text,bigint)','EXECUTE') AND has_function_privilege(current_user,'auth.prepare_organization_mfa_recovery_target(text,text,text,text,text,text,bigint)','EXECUTE') AND has_function_privilege(current_user,'auth.organization_mfa_recovery_snapshot(text,text,text,text,text,text)','EXECUTE') AND has_function_privilege(current_user,'auth.resolve_mfa_recovery_identity(text,text)','EXECUTE') AND has_function_privilege(current_user,'auth.finalize_mfa_recovery_identity(text,text,text,bigint)','EXECUTE'))::text || ':' || has_function_privilege(current_user,'auth.resolve_login_context_by_email(text)','EXECUTE')::text")"
echo "[dr] restored auth proof users:orgs:minimal-credential-rows:post-password-surface:registration-lifecycle:password-reset:organization-team:invitation-recovery:legacy-context-execute = $RESTORE_AUTH_ISOLATION"
if [[ "$RESTORE_AUTH_ISOLATION" != "0:0:0:true:true:true:true:true:false" && "$RESTORE_AUTH_ISOLATION" != "0:0:0:t:t:t:t:t:f" ]]; then
  echo "Restored auth principal minimal login boundary failed: $RESTORE_AUTH_ISOLATION" >&2
  exit 1
fi

RESTORE_APP_ROLE_PROOF="$(psql "$RESTORE_APP_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT has_schema_privilege(current_user,'settlement','USAGE')::text || ':' || has_table_privilege(current_user,'settlement.payments','SELECT')::text || ':' || has_table_privilege(current_user,'settlement.payments','UPDATE')::text || ':' || has_table_privilege(current_user,'settlement.ledger_entries','DELETE')::text || ':' || has_function_privilege(current_user,'auth.validate_deal_creation_actors(text,text,text,text,text)','EXECUTE')::text")"
echo "[dr] restored settlement/deal principal proof usage:select:update:ledger-delete:actor-execute = $RESTORE_APP_ROLE_PROOF"
if [[ "$RESTORE_APP_ROLE_PROOF" != "true:true:true:false:true" && "$RESTORE_APP_ROLE_PROOF" != "t:t:t:f:t" ]]; then
  echo "Restored application Settlement/deal privilege boundary is invalid: $RESTORE_APP_ROLE_PROOF" >&2
  exit 1
fi

RESTORE_FINGERPRINT="$(fingerprint "$RESTORE_ADMIN_URL")"
echo "[dr] restore fingerprint: $RESTORE_FINGERPRINT"
if [[ "$SOURCE_FINGERPRINT" != "$RESTORE_FINGERPRINT" ]]; then
  echo "Source and restore fingerprints differ" >&2
  exit 1
fi

FAILED_MIGRATIONS="$(psql "$RESTORE_ADMIN_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL")"
if [[ "$FAILED_MIGRATIONS" != "0" ]]; then
  echo "Restored migration history contains $FAILED_MIGRATIONS failed/incomplete migration(s)" >&2
  exit 1
fi

PUBLIC_RLS_PROOF="$(psql "$RESTORE_ADMIN_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT count(*) FILTER (WHERE c.relrowsecurity)::text || ':' || count(*) FILTER (WHERE c.relforcerowsecurity)::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('deals','organizations','audit_events','ledger_entries','integration_events','outbox_entries','deal_workspace_runtime_snapshots','deal_workspace_runtime_transaction_attempts')")"
if [[ "$PUBLIC_RLS_PROOF" != "8:8" ]]; then
  echo "Restored public RLS proof failed: $PUBLIC_RLS_PROOF" >&2
  exit 1
fi
SETTLEMENT_RLS_PROOF="$(psql "$RESTORE_ADMIN_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT count(*) FILTER (WHERE c.relrowsecurity)::text || ':' || count(*) FILTER (WHERE c.relforcerowsecurity)::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='settlement' AND c.relname IN ('payment_terms','beneficiaries','payments','holds','bank_operations','bank_callbacks','ledger_entries','reconciliation_facts')")"
if [[ "$SETTLEMENT_RLS_PROOF" != "8:8" ]]; then
  echo "Restored Settlement RLS proof failed: $SETTLEMENT_RLS_PROOF" >&2
  exit 1
fi
SETTLEMENT_OUTBOX_PROOF="$(psql "$RESTORE_ADMIN_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT count(*) FILTER (WHERE left(type,5)='BANK_')::text || ':' || count(*) FILTER (WHERE left(type,5)='BANK_' AND status='CONFIRMED')::text || ':' || count(*) FILTER (WHERE type='settlement.command.receipt')::text || ':' || count(*) FILTER (WHERE type='settlement.command.receipt' AND status='CONFIRMED')::text FROM public.outbox_entries WHERE \"dealId\"='DEAL-INDUSTRIAL-001' AND (left(type,5)='BANK_' OR type='settlement.command.receipt')")"
echo "[dr] restored Settlement outbox proof bank:confirmed:receipts:confirmed = $SETTLEMENT_OUTBOX_PROOF"
if [[ "$SETTLEMENT_OUTBOX_PROOF" != "2:2:4:4" ]]; then
  echo "Restored Settlement durable outbox proof failed: $SETTLEMENT_OUTBOX_PROOF" >&2
  exit 1
fi

NODE_ENV=test \
DATABASE_URL="$RESTORE_APP_URL" \
AUTH_DATABASE_URL="$RESTORE_AUTH_URL" \
STAFF_DATABASE_URL="$RESTORE_STAFF_URL" \
STORAGE_DATABASE_URL="$RESTORE_STORAGE_URL" \
DB_PRINCIPAL_BOUNDARY_ENFORCED=true \
JWT_SECRET="${JWT_SECRET:?JWT_SECRET is required}" \
AUTH_TOKEN_PEPPER="${AUTH_TOKEN_PEPPER:?AUTH_TOKEN_PEPPER is required}" \
MFA_ENCRYPTION_KEY="${MFA_ENCRYPTION_KEY:?MFA_ENCRYPTION_KEY is required}" \
pnpm --filter @pc/api exec ts-node test/one-deal/restored-database-acceptance.ts

export SOURCE_FINGERPRINT RESTORE_FINGERPRINT BACKUP_SHA256 BACKUP_BYTES
export BACKUP_STARTED_AT BACKUP_COMPLETED_AT BACKUP_SECONDS
export RESTORE_STARTED_AT RESTORE_COMPLETED_AT RESTORE_SECONDS
export PUBLIC_RLS_PROOF SETTLEMENT_RLS_PROOF RESTORE_APP_ROLE_PROOF RESTORE_STAFF_PROOF RESTORE_REGISTRATION_PROOF SETTLEMENT_OUTBOX_PROOF
export RESTORE_IDENTITY_PROOF RESTORE_MFA_AUTHORITY_PROOF RESTORE_REGISTRATION_LIFECYCLE_PROOF RESTORE_PASSWORD_RESET_PROOF RESTORE_ORGANIZATION_TEAM_PROOF RESTORE_INVITATION_MEMBERSHIP_RECOVERY_PROOF RESTORE_REGISTRATION_DECISION_PROOF RESTORE_ACCOUNT_LIFECYCLE_PROOF RESTORE_AUTH_ISOLATION

node - "$MANIFEST_PATH" <<'NODE'
const fs = require('node:fs');
const path = process.argv[2];
const manifest = {
  rehearsal: 'isolated-postgresql-backup-restore',
  productionAcceptance: false,
  sourceFingerprint: process.env.SOURCE_FINGERPRINT,
  restoreFingerprint: process.env.RESTORE_FINGERPRINT,
  backupSha256: process.env.BACKUP_SHA256,
  backupBytes: Number(process.env.BACKUP_BYTES),
  backupStartedAt: process.env.BACKUP_STARTED_AT,
  backupCompletedAt: process.env.BACKUP_COMPLETED_AT,
  backupSeconds: Number(process.env.BACKUP_SECONDS),
  restoreStartedAt: process.env.RESTORE_STARTED_AT,
  restoreCompletedAt: process.env.RESTORE_COMPLETED_AT,
  restoreSeconds: Number(process.env.RESTORE_SECONDS),
  recoveryPoint: process.env.BACKUP_COMPLETED_AT,
  rpo: 'not-established-production-cadence-required',
  rto: 'not-established-production-observation-required',
  publicRlsProof: process.env.PUBLIC_RLS_PROOF,
  settlementRlsProof: process.env.SETTLEMENT_RLS_PROOF,
  settlementPrincipalProof: process.env.RESTORE_APP_ROLE_PROOF,
  staffPrincipalProof: process.env.RESTORE_STAFF_PROOF,
  registrationPrincipalProof: process.env.RESTORE_REGISTRATION_PROOF,
  identityPrincipalProof: process.env.RESTORE_IDENTITY_PROOF,
  mfaAuthorityProof: process.env.RESTORE_MFA_AUTHORITY_PROOF,
  registrationLifecycleProof: process.env.RESTORE_REGISTRATION_LIFECYCLE_PROOF,
  passwordResetAuthorityProof: process.env.RESTORE_PASSWORD_RESET_PROOF,
  organizationTeamAuthorityProof: process.env.RESTORE_ORGANIZATION_TEAM_PROOF,
  invitationMembershipRecoveryAuthorityProof: process.env.RESTORE_INVITATION_MEMBERSHIP_RECOVERY_PROOF,
  registrationDecisionAuthorityProof: process.env.RESTORE_REGISTRATION_DECISION_PROOF,
  accountLifecycleAuthorityProof: process.env.RESTORE_ACCOUNT_LIFECYCLE_PROOF,
  authIsolationProof: process.env.RESTORE_AUTH_ISOLATION,
  settlementOutboxProof: process.env.SETTLEMENT_OUTBOX_PROOF,
  failedMigrations: 0,
};
fs.writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
NODE

cat "$MANIFEST_PATH"
echo "[dr] backup/restore rehearsal passed without weakening RLS"
