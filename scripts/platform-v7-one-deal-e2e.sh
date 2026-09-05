#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADMIN_URL="${ONE_DEAL_ADMIN_URL:?ONE_DEAL_ADMIN_URL is required}"
AUTH_URL="${ONE_DEAL_AUTH_URL:?ONE_DEAL_AUTH_URL is required}"
STAFF_URL="${ONE_DEAL_STAFF_URL:?ONE_DEAL_STAFF_URL is required}"
APP_URL="${ONE_DEAL_APP_URL:?ONE_DEAL_APP_URL is required}"
STORAGE_URL="${ONE_DEAL_STORAGE_URL:?ONE_DEAL_STORAGE_URL is required}"
EVIDENCE_LOG="${ONE_DEAL_EVIDENCE_LOG:-/tmp/platform-v7-one-deal-e2e.log}"
DRIFT_SQL="${ONE_DEAL_DRIFT_SQL:-/tmp/platform-v7-one-deal-schema-drift.sql}"

if [[ "${NODE_ENV:-}" == "production" ]]; then
  echo "Refusing one-deal E2E with NODE_ENV=production" >&2
  exit 2
fi
if [[ -n "${DATABASE_URL:-}" && "$ADMIN_URL" == "$DATABASE_URL" ]]; then
  echo "Refusing one-deal E2E: admin URL equals ambient DATABASE_URL" >&2
  exit 2
fi
for candidate in "$ADMIN_URL" "$AUTH_URL" "$STAFF_URL" "$APP_URL" "$STORAGE_URL"; do
  if [[ "$candidate" =~ (^|[^a-z])(prod|production)([^a-z]|$) ]]; then
    echo "Refusing one-deal E2E: datasource appears production-like" >&2
    exit 2
  fi
done
if [[ "$ADMIN_URL" == "$AUTH_URL" || "$ADMIN_URL" == "$STAFF_URL" || "$ADMIN_URL" == "$APP_URL" || "$ADMIN_URL" == "$STORAGE_URL" \
  || "$AUTH_URL" == "$STAFF_URL" || "$AUTH_URL" == "$APP_URL" || "$AUTH_URL" == "$STORAGE_URL" \
  || "$STAFF_URL" == "$APP_URL" || "$STAFF_URL" == "$STORAGE_URL" || "$APP_URL" == "$STORAGE_URL" ]]; then
  echo "Refusing one-deal E2E: admin, auth, staff, application and storage URLs must differ" >&2
  exit 2
fi

command -v psql >/dev/null || { echo "psql is required" >&2; exit 2; }
command -v pnpm >/dev/null || { echo "pnpm is required" >&2; exit 2; }

mkdir -p "$(dirname "$EVIDENCE_LOG")"
: > "$EVIDENCE_LOG"
: > "$DRIFT_SQL"
exec > >(tee -a "$EVIDENCE_LOG") 2>&1

cd "$ROOT_DIR"
echo "[one-deal] applying Prisma migrations to isolated PostgreSQL"
DATABASE_URL="$ADMIN_URL" pnpm --filter @pc/api exec prisma migrate deploy --schema prisma/schema.prisma

echo "[one-deal] checking complete migration-to-schema drift"
set +e
DATABASE_URL="$ADMIN_URL" pnpm --filter @pc/api exec prisma migrate diff \
  --from-url "$ADMIN_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script \
  --exit-code > "$DRIFT_SQL"
DRIFT_EXIT=$?
set -e
cat "$DRIFT_SQL"
if [[ "$DRIFT_EXIT" -eq 2 ]]; then
  echo "[one-deal] migration history does not produce the canonical Prisma schema" >&2
  exit 1
fi
if [[ "$DRIFT_EXIT" -ne 0 ]]; then
  echo "[one-deal] Prisma drift command failed with exit code $DRIFT_EXIT" >&2
  exit "$DRIFT_EXIT"
fi

echo "[one-deal] generating Prisma client from the migrated PostgreSQL schema"
DATABASE_URL="$ADMIN_URL" pnpm --filter @pc/api exec prisma generate --schema prisma/schema.prisma

echo "[one-deal] seeding canonical deal and persistent PostgreSQL identities"
NODE_ENV=test \
DATABASE_URL="$ADMIN_URL" \
JWT_SECRET="${JWT_SECRET:?JWT_SECRET is required}" \
AUTH_TOKEN_PEPPER="${AUTH_TOKEN_PEPPER:?AUTH_TOKEN_PEPPER is required}" \
MFA_ENCRYPTION_KEY="${MFA_ENCRYPTION_KEY:?MFA_ENCRYPTION_KEY is required}" \
BANK_HMAC_SECRET="${BANK_HMAC_SECRET:?BANK_HMAC_SECRET is required}" \
SEED_CANONICAL_TEST_DEAL=true \
pnpm --filter @pc/api exec ts-node test/one-deal/seed.ts

PARTICIPANT_PROOF="$(psql "$ADMIN_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT count(*) FILTER (WHERE status='ACTIVE')::text || ':' || count(*) FILTER (WHERE role='EXECUTIVE' AND \"accessLevel\"='READ' AND status='ACTIVE')::text FROM public.deal_participants WHERE \"dealId\"='DEAL-INDUSTRIAL-001'")"
echo "[one-deal] participant proof active:executive-read = $PARTICIPANT_PROOF"
if [[ "$PARTICIPANT_PROOF" != "12:1" ]]; then
  echo "Canonical participant projection is incomplete: $PARTICIPANT_PROOF" >&2
  exit 1
fi

echo "[one-deal] applying canonical PostgreSQL RLS policies"
psql "$ADMIN_URL" -X --set ON_ERROR_STOP=1 --file infra/sql/production-rls-policies.sql

echo "[one-deal] applying PostgreSQL deal-authority RLS overlay"
psql "$ADMIN_URL" -X --set ON_ERROR_STOP=1 --file infra/sql/postgresql-deal-authority-policies.sql

echo "[one-deal] applying PostgreSQL document-authority RLS overlay"
psql "$ADMIN_URL" -X --set ON_ERROR_STOP=1 --file infra/sql/postgresql-document-authority-policies.sql

echo "[one-deal] applying PostgreSQL logistics-authority RLS overlay"
psql "$ADMIN_URL" -X --set ON_ERROR_STOP=1 --file infra/sql/postgresql-logistics-authority-policies.sql

echo "[one-deal] applying PostgreSQL labs-authority RLS overlay"
psql "$ADMIN_URL" -X --set ON_ERROR_STOP=1 --file infra/sql/postgresql-labs-authority-policies.sql

echo "[one-deal] applying PostgreSQL settlement-authority RLS overlay"
psql "$ADMIN_URL" -X --set ON_ERROR_STOP=1 --file infra/sql/postgresql-settlement-authority-policies.sql

echo "[one-deal] creating restricted deal-execution principal"
psql "$ADMIN_URL" -X --set ON_ERROR_STOP=1 <<'SQL'
DO $one_deal_role$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'one_deal_app') THEN
    DROP OWNED BY one_deal_app;
    DROP ROLE one_deal_app;
  END IF;
  CREATE ROLE one_deal_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD 'ephemeral_one_deal_app_only';
END
$one_deal_role$;
GRANT CONNECT ON DATABASE one_deal_e2e TO one_deal_app;
GRANT USAGE ON SCHEMA public, security, logistics, labs, settlement, auth TO one_deal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO one_deal_app;
GRANT USAGE ON SCHEMA inventory TO one_deal_app;
GRANT SELECT ON ALL TABLES IN SCHEMA inventory TO one_deal_app;
GRANT EXECUTE ON FUNCTION inventory.execute_command(jsonb), inventory.position_view(inventory.positions) TO one_deal_app;
-- Provider registry is deliberately narrower than the generic disposable
-- harness grant: organization commands cannot delete authority rows, and the
-- application principal can only read server-held verification evidence.
REVOKE DELETE, TRUNCATE ON
  public.providers,
  public.provider_capabilities,
  public.service_offerings,
  public.provider_registry_events
FROM one_deal_app;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.provider_registry_evidence
FROM one_deal_app;
-- Integration bindings use the same command boundary. The application may
-- declare/update bindings and append command events, while acceptance evidence
-- stays under the separate server authority.
REVOKE DELETE, TRUNCATE ON public.integration_bindings
FROM one_deal_app;
REVOKE UPDATE, DELETE, TRUNCATE ON public.integration_binding_events
FROM one_deal_app;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.integration_capability_evidence
FROM one_deal_app;
-- Commercial versions may transition through the governed command boundary,
-- but published definitions, decisions and event evidence are never deletable.
REVOKE DELETE, TRUNCATE ON
  public.commercial_rule_sets,
  public.commercial_rule_packs
FROM one_deal_app;
REVOKE UPDATE, DELETE, TRUNCATE ON
  public.commercial_decisions,
  public.commercial_rule_events
FROM one_deal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA security TO one_deal_app;
GRANT SELECT ON ALL TABLES IN SCHEMA logistics TO one_deal_app;
GRANT SELECT ON
  logistics.carriers,
  logistics.drivers,
  logistics.vehicles,
  logistics.driver_vehicle_links,
  logistics.facilities,
  logistics.deal_admissions,
  logistics.shipment_bindings
TO one_deal_app;
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
GRANT EXECUTE ON FUNCTION auth.validate_deal_creation_actors(TEXT, TEXT, TEXT, TEXT, TEXT) TO one_deal_app;
REVOKE ALL ON FUNCTION auth.create_pending_registration_identity(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM one_deal_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO one_deal_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA security GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO one_deal_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA logistics GRANT SELECT ON TABLES TO one_deal_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO one_deal_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO one_deal_app;
SQL

echo "[one-deal] creating isolated evidence-finalization principal"
psql "$ADMIN_URL" -X --set ON_ERROR_STOP=1 <<'SQL'
DO $one_deal_storage_role$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'one_deal_storage') THEN
    DROP OWNED BY one_deal_storage;
    DROP ROLE one_deal_storage;
  END IF;
  CREATE ROLE one_deal_storage LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD 'ephemeral_one_deal_storage_only';
END
$one_deal_storage_role$;
GRANT CONNECT ON DATABASE one_deal_e2e TO one_deal_storage;
GRANT USAGE ON SCHEMA public TO one_deal_storage;
GRANT SELECT ON public.deals, public.deal_participants TO one_deal_storage;
GRANT SELECT, UPDATE ON public.deal_documents TO one_deal_storage;
REVOKE INSERT, DELETE ON public.deal_documents FROM one_deal_storage;
SQL

echo "[one-deal] creating isolated trusted identity principal"
psql "$ADMIN_URL" -X --set ON_ERROR_STOP=1 <<'SQL'
DO $one_deal_auth_role$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'one_deal_auth') THEN
    DROP OWNED BY one_deal_auth;
    DROP ROLE one_deal_auth;
  END IF;
  CREATE ROLE one_deal_auth LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD 'ephemeral_one_deal_auth_only';
END
$one_deal_auth_role$;
GRANT CONNECT ON DATABASE one_deal_e2e TO one_deal_auth;
GRANT USAGE ON SCHEMA public, auth TO one_deal_auth;
GRANT SELECT, INSERT, UPDATE ON public.users, public.user_orgs, public.organizations TO one_deal_auth;
GRANT SELECT, INSERT, UPDATE ON
  auth.login_throttles,
  auth.credential_states,
  auth.sessions,
  auth.refresh_tokens,
  auth.mfa_challenges,
  auth.staff_assignments,
  auth.staff_access_requests,
  auth.staff_access_approvals,
  auth.staff_access_grants,
  auth.staff_access_sessions,
  auth.staff_critical_action_requests,
  auth.staff_critical_action_approvals,
  auth.break_glass_activations
TO one_deal_auth;
GRANT SELECT, INSERT ON auth.audit_events, auth.staff_access_events TO one_deal_auth;
REVOKE UPDATE, DELETE ON auth.staff_access_events FROM one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.lock_staff_access_event_chain(TEXT) TO one_deal_auth;

GRANT EXECUTE ON FUNCTION auth.resolve_login_credential(TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_login_default_membership(TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_login_context_by_membership(TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_session_identity(TEXT, TEXT, TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_post_password_membership_ids(TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_post_password_membership_context(TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_session_identity_v2(TEXT, TEXT, TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.finalize_authenticated_user_mfa(TEXT, TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.prepare_pending_registration_identity(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.restart_pending_registration_identity(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.mark_registration_email_verified(TEXT, TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.registration_join_notification_recipients(TEXT, TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_password_reset_subject(TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.replace_password_after_reset(TEXT, TEXT, TEXT, TIMESTAMPTZ) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.upgrade_password_hash_format(TEXT, TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.organization_team_snapshot(TEXT, TEXT, TEXT, TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_organization_admin_session(TEXT, TEXT, TEXT, TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.organization_membership_exists_for_email(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_invitation_acceptance_credential(TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.accept_organization_invitation_identity(
  TEXT, TEXT, BIGINT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT
) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.change_organization_membership_role(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT
) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.revoke_organization_membership(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT
) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.prepare_organization_mfa_recovery_target(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT
) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.organization_mfa_recovery_snapshot(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_mfa_recovery_identity(TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.finalize_mfa_recovery_identity(TEXT, TEXT, TEXT, BIGINT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.registration_platform_actor_authorized(TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.registration_organization_admin_context(TEXT, TEXT, TEXT, TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.registration_platform_review_queue(TEXT, TEXT, INTEGER) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.registration_organization_join_queue(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.lock_registration_decision_application(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.apply_registration_identity_transition(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.account_data_export(TEXT, TEXT, TEXT, TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.anonymize_account_identity(TEXT, TEXT, TEXT, TEXT, TEXT) TO one_deal_auth;
REVOKE ALL ON FUNCTION auth.registration_role_assignment_allowed(TEXT, TEXT) FROM one_deal_auth;
REVOKE ALL ON FUNCTION auth.create_pending_registration_identity(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM one_deal_auth;
REVOKE ALL ON FUNCTION auth.resolve_login_identity(TEXT) FROM one_deal_auth;
REVOKE ALL ON FUNCTION auth.resolve_login_identity_by_id(TEXT) FROM one_deal_auth;
REVOKE ALL ON FUNCTION auth.resolve_login_memberships(TEXT) FROM one_deal_auth;
REVOKE ALL ON FUNCTION auth.resolve_login_memberships_ordered(TEXT) FROM one_deal_auth;
REVOKE ALL ON FUNCTION auth.resolve_login_context_by_email(TEXT) FROM one_deal_auth;

REVOKE ALL ON FUNCTION auth.resolve_staff_target_scope(TEXT, TEXT, TEXT, TEXT, TEXT) FROM one_deal_auth;
REVOKE ALL ON FUNCTION auth.resolve_staff_deal_target_scope(TEXT, TEXT, TEXT) FROM one_deal_auth;
REVOKE ALL ON FUNCTION auth.staff_admission_capability(TEXT, TEXT, TEXT, TEXT, TEXT) FROM one_deal_auth;
REVOKE ALL ON FUNCTION auth.staff_projection_capability(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM one_deal_auth;
REVOKE ALL ON FUNCTION auth.staff_admission_queue(TEXT, TEXT, TEXT, INTEGER) FROM one_deal_auth;
REVOKE ALL ON FUNCTION auth.staff_admission_application(TEXT, TEXT, TEXT, TEXT) FROM one_deal_auth;
REVOKE ALL ON FUNCTION auth.staff_admission_decision(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM one_deal_auth;
REVOKE ALL ON FUNCTION auth.staff_organization_directory(TEXT, TEXT, TEXT) FROM one_deal_auth;
REVOKE ALL ON FUNCTION auth.staff_organization_users(TEXT, TEXT, TEXT, TEXT) FROM one_deal_auth;
REVOKE ALL ON FUNCTION auth.staff_cabinet_deals(TEXT, TEXT, TEXT, TEXT, TEXT) FROM one_deal_auth;
REVOKE ALL ON FUNCTION auth.validate_deal_creation_actors(TEXT, TEXT, TEXT, TEXT, TEXT) FROM one_deal_auth;
SQL

echo "[one-deal] creating isolated function-only staff principal"
psql "$ADMIN_URL" -X --set ON_ERROR_STOP=1 <<'SQL'
DO $one_deal_staff_role$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'one_deal_staff') THEN
    DROP OWNED BY one_deal_staff;
    DROP ROLE one_deal_staff;
  END IF;
  CREATE ROLE one_deal_staff LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD 'ephemeral_one_deal_staff_only';
END
$one_deal_staff_role$;
GRANT CONNECT ON DATABASE one_deal_e2e TO one_deal_staff;
GRANT USAGE ON SCHEMA auth TO one_deal_staff;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public, auth FROM one_deal_staff;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public, auth FROM one_deal_staff;
GRANT EXECUTE ON FUNCTION auth.resolve_staff_target_scope(TEXT, TEXT, TEXT, TEXT, TEXT) TO one_deal_staff;
GRANT EXECUTE ON FUNCTION auth.resolve_staff_deal_target_scope(TEXT, TEXT, TEXT) TO one_deal_staff;
GRANT EXECUTE ON FUNCTION auth.staff_admission_queue(TEXT, TEXT, TEXT, INTEGER) TO one_deal_staff;
GRANT EXECUTE ON FUNCTION auth.staff_admission_application(TEXT, TEXT, TEXT, TEXT) TO one_deal_staff;
GRANT EXECUTE ON FUNCTION auth.staff_admission_decision(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO one_deal_staff;
GRANT EXECUTE ON FUNCTION auth.staff_organization_directory(TEXT, TEXT, TEXT) TO one_deal_staff;
GRANT EXECUTE ON FUNCTION auth.staff_organization_users(TEXT, TEXT, TEXT, TEXT) TO one_deal_staff;
GRANT EXECUTE ON FUNCTION auth.staff_cabinet_deals(TEXT, TEXT, TEXT, TEXT, TEXT) TO one_deal_staff;
REVOKE ALL ON FUNCTION auth.staff_admission_capability(TEXT, TEXT, TEXT, TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.staff_projection_capability(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.resolve_login_credential(TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.resolve_login_default_membership(TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.resolve_login_identity(TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.resolve_login_identity_by_id(TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.resolve_login_memberships(TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.resolve_login_memberships_ordered(TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.resolve_login_context_by_email(TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.resolve_login_context_by_membership(TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.resolve_session_identity(TEXT, TEXT, TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.resolve_post_password_membership_ids(TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.resolve_post_password_membership_context(TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.resolve_session_identity_v2(TEXT, TEXT, TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.finalize_authenticated_user_mfa(TEXT, TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.prepare_pending_registration_identity(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.restart_pending_registration_identity(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.mark_registration_email_verified(TEXT, TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.registration_join_notification_recipients(TEXT, TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.resolve_password_reset_subject(TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.replace_password_after_reset(TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.upgrade_password_hash_format(TEXT, TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.organization_team_snapshot(TEXT, TEXT, TEXT, TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.resolve_organization_admin_session(TEXT, TEXT, TEXT, TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.organization_membership_exists_for_email(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.resolve_invitation_acceptance_credential(TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.accept_organization_invitation_identity(
  TEXT, TEXT, BIGINT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT
) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.change_organization_membership_role(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT
) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.revoke_organization_membership(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT
) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.prepare_organization_mfa_recovery_target(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT
) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.organization_mfa_recovery_snapshot(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.resolve_mfa_recovery_identity(TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.finalize_mfa_recovery_identity(TEXT, TEXT, TEXT, BIGINT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.registration_platform_actor_authorized(TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.registration_organization_admin_context(TEXT, TEXT, TEXT, TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.registration_platform_review_queue(TEXT, TEXT, INTEGER) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.registration_organization_join_queue(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.lock_registration_decision_application(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.apply_registration_identity_transition(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.account_data_export(TEXT, TEXT, TEXT, TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.anonymize_account_identity(TEXT, TEXT, TEXT, TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.registration_role_assignment_allowed(TEXT, TEXT) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.create_pending_registration_identity(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM one_deal_staff;
REVOKE ALL ON FUNCTION auth.validate_deal_creation_actors(TEXT, TEXT, TEXT, TEXT, TEXT) FROM one_deal_staff;
SQL

ROLE_PROOF="$(psql "$ADMIN_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT rolsuper::text || ':' || rolbypassrls::text FROM pg_roles WHERE rolname='one_deal_app'")"
if [[ "$ROLE_PROOF" != "false:false" && "$ROLE_PROOF" != "f:f" ]]; then
  echo "Deal application principal is not NOSUPERUSER NOBYPASSRLS: $ROLE_PROOF" >&2
  exit 1
fi
DEAL_ACTOR_AUTHORITY_PROOF="$(psql "$ADMIN_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT has_schema_privilege('one_deal_app','auth','USAGE')::text || ':' || has_function_privilege('one_deal_app','auth.validate_deal_creation_actors(text,text,text,text,text)','EXECUTE')::text || ':' || has_function_privilege('one_deal_auth','auth.validate_deal_creation_actors(text,text,text,text,text)','EXECUTE')::text")"
echo "[one-deal] deal actor authority proof app-usage:app-execute:auth-execute = $DEAL_ACTOR_AUTHORITY_PROOF"
if [[ "$DEAL_ACTOR_AUTHORITY_PROOF" != "true:true:false" && "$DEAL_ACTOR_AUTHORITY_PROOF" != "t:t:f" ]]; then
  echo "Deal actor authority boundary is invalid: $DEAL_ACTOR_AUTHORITY_PROOF" >&2
  exit 1
fi
LOGISTICS_ROLE_PROOF="$(psql "$APP_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT has_schema_privilege(current_user,'logistics','USAGE')::text || ':' || has_table_privilege(current_user,'logistics.deal_admissions','SELECT')::text || ':' || has_table_privilege(current_user,'logistics.deal_admissions','UPDATE')::text")"
echo "[one-deal] logistics principal proof usage:select:update = $LOGISTICS_ROLE_PROOF"
if [[ "$LOGISTICS_ROLE_PROOF" != "true:true:false" && "$LOGISTICS_ROLE_PROOF" != "t:t:f" ]]; then
  echo "Deal application logistics privilege boundary is invalid: $LOGISTICS_ROLE_PROOF" >&2
  exit 1
fi
LABS_ROLE_PROOF="$(psql "$APP_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT has_schema_privilege(current_user,'labs','USAGE')::text || ':' || has_table_privilege(current_user,'labs.laboratories','SELECT')::text || ':' || has_table_privilege(current_user,'labs.laboratories','INSERT')::text || ':' || has_table_privilege(current_user,'labs.protocols','DELETE')::text")"
echo "[one-deal] labs principal proof usage:select:insert:protocol-delete = $LABS_ROLE_PROOF"
if [[ "$LABS_ROLE_PROOF" != "true:true:true:false" && "$LABS_ROLE_PROOF" != "t:t:t:f" ]]; then
  echo "Deal application labs privilege boundary is invalid: $LABS_ROLE_PROOF" >&2
  exit 1
fi
SETTLEMENT_ROLE_PROOF="$(psql "$APP_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT has_schema_privilege(current_user,'settlement','USAGE')::text || ':' || has_table_privilege(current_user,'settlement.payments','SELECT')::text || ':' || has_table_privilege(current_user,'settlement.payments','UPDATE')::text || ':' || has_table_privilege(current_user,'settlement.ledger_entries','DELETE')::text")"
echo "[one-deal] settlement principal proof usage:select:update:ledger-delete = $SETTLEMENT_ROLE_PROOF"
if [[ "$SETTLEMENT_ROLE_PROOF" != "true:true:true:false" && "$SETTLEMENT_ROLE_PROOF" != "t:t:t:f" ]]; then
  echo "Deal application settlement privilege boundary is invalid: $SETTLEMENT_ROLE_PROOF" >&2
  exit 1
fi
AUTH_ROLE_PROOF="$(psql "$ADMIN_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT rolsuper::text || ':' || rolbypassrls::text || ':' || has_table_privilege('one_deal_auth','public.deals','SELECT')::text FROM pg_roles WHERE rolname='one_deal_auth'")"
echo "[one-deal] auth principal proof super:bypass:deal-select = $AUTH_ROLE_PROOF"
if [[ "$AUTH_ROLE_PROOF" != "false:false:false" && "$AUTH_ROLE_PROOF" != "f:f:f" ]]; then
  echo "Auth principal privilege boundary is invalid: $AUTH_ROLE_PROOF" >&2
  exit 1
fi

AUTH_IDENTITY_PROOF="$(psql "$ADMIN_URL" -X -At --set ON_ERROR_STOP=1 <<'SQL'
SELECT
  (SELECT count(*) = 3 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname IN ('users','user_orgs','organizations')
     AND c.relrowsecurity AND c.relforcerowsecurity)::text
  || ':' ||
  (SELECT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   JOIN pg_roles r ON r.oid = c.relowner
   WHERE n.nspname = 'public' AND c.relname IN ('users','user_orgs','organizations')
     AND r.rolname = 'one_deal_auth'))::text
  || ':' ||
  (
    has_function_privilege('one_deal_auth', 'auth.resolve_login_credential(text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.resolve_login_default_membership(text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.resolve_login_context_by_membership(text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.resolve_session_identity(text,text,text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.resolve_post_password_membership_ids(text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.resolve_post_password_membership_context(text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.resolve_session_identity_v2(text,text,text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.finalize_authenticated_user_mfa(text,text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.prepare_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.restart_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.mark_registration_email_verified(text,text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.registration_join_notification_recipients(text,text,text)', 'EXECUTE')
    AND NOT has_function_privilege('one_deal_auth', 'auth.create_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text)', 'EXECUTE')
    AND NOT (
      has_function_privilege('one_deal_auth', 'auth.resolve_login_identity(text)', 'EXECUTE')
      OR has_function_privilege('one_deal_auth', 'auth.resolve_login_identity_by_id(text)', 'EXECUTE')
      OR has_function_privilege('one_deal_auth', 'auth.resolve_login_memberships(text)', 'EXECUTE')
      OR has_function_privilege('one_deal_auth', 'auth.resolve_login_memberships_ordered(text)', 'EXECUTE')
      OR has_function_privilege('one_deal_auth', 'auth.resolve_login_context_by_email(text)', 'EXECUTE')
    )
  )::text
  || ':' ||
  (has_function_privilege('one_deal_auth', 'auth.resolve_staff_target_scope(text,text,text,text,text)', 'EXECUTE')
   OR has_function_privilege('one_deal_auth', 'auth.resolve_staff_deal_target_scope(text,text,text)', 'EXECUTE')
   OR has_function_privilege('one_deal_auth', 'auth.staff_admission_queue(text,text,text,integer)', 'EXECUTE')
   OR has_function_privilege('one_deal_auth', 'auth.staff_admission_application(text,text,text,text)', 'EXECUTE')
   OR has_function_privilege('one_deal_auth', 'auth.staff_admission_decision(text,text,text,text,text,text)', 'EXECUTE')
   OR has_function_privilege('one_deal_auth', 'auth.staff_organization_directory(text,text,text)', 'EXECUTE')
   OR has_function_privilege('one_deal_auth', 'auth.staff_organization_users(text,text,text,text)', 'EXECUTE')
   OR has_function_privilege('one_deal_auth', 'auth.staff_cabinet_deals(text,text,text,text,text)', 'EXECUTE'))::text
  || ':' ||
  (SELECT EXISTS (SELECT 1 FROM pg_auth_members m
   JOIN pg_roles grantee ON grantee.oid = m.roleid
   JOIN pg_roles member ON member.oid = m.member
   WHERE member.rolname = 'one_deal_auth'))::text;
SQL
)"
echo "[one-deal] auth identity proof forced-rls:owns:minimal-bootstrap:staff-execute:memberships = $AUTH_IDENTITY_PROOF"
if [[ "$AUTH_IDENTITY_PROOF" != "true:false:true:false:false" && "$AUTH_IDENTITY_PROOF" != "t:f:t:f:f" ]]; then
  echo "Auth principal identity boundary is invalid: $AUTH_IDENTITY_PROOF" >&2
  exit 1
fi

REGISTRATION_LIFECYCLE_PROOF="$(psql "$ADMIN_URL" -X -At --set ON_ERROR_STOP=1 <<'SQL'
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
echo "[one-deal] registration lifecycle proof definers:confined:members:least-privilege:auth:non-auth:policies = $REGISTRATION_LIFECYCLE_PROOF"
if [[ "$REGISTRATION_LIFECYCLE_PROOF" != "4:1:0:1:1:0:9" ]]; then
  echo "Registration lifecycle authority boundary is invalid: $REGISTRATION_LIFECYCLE_PROOF" >&2
  exit 1
fi

PASSWORD_RESET_AUTHORITY_PROOF="$(psql "$ADMIN_URL" -X -At --set ON_ERROR_STOP=1 <<'SQL'
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
    has_function_privilege('one_deal_auth', 'auth.resolve_password_reset_subject(text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.replace_password_after_reset(text,text,text,timestamptz)', 'EXECUTE')
  )::int::text
  || ':' ||
  (SELECT count(*) FROM (VALUES ('one_deal_app'),('one_deal_staff'),('one_deal_storage')) AS runtime(role)
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
echo "[one-deal] password-reset authority proof definers:confined:members:least-privilege:auth:non-auth:policies = $PASSWORD_RESET_AUTHORITY_PROOF"
if [[ "$PASSWORD_RESET_AUTHORITY_PROOF" != "2:1:0:1:1:0:2" ]]; then
  echo "Password-reset authority boundary is invalid: $PASSWORD_RESET_AUTHORITY_PROOF" >&2
  exit 1
fi

ORGANIZATION_TEAM_AUTHORITY_PROOF="$(psql "$ADMIN_URL" -X -At --set ON_ERROR_STOP=1 <<'SQL'
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
echo "[one-deal] organization-team authority proof definer:confined:members:read-only:auth:non-auth:policies = $ORGANIZATION_TEAM_AUTHORITY_PROOF"
if [[ "$ORGANIZATION_TEAM_AUTHORITY_PROOF" != "3:1:0:1:1:0:3" ]]; then
  echo "Organization-team authority boundary is invalid: $ORGANIZATION_TEAM_AUTHORITY_PROOF" >&2
  exit 1
fi

INVITATION_MEMBERSHIP_RECOVERY_AUTHORITY_PROOF="$(psql "$ADMIN_URL" -X -At --set ON_ERROR_STOP=1 <<'SQL'
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
echo "[one-deal] invitation/membership/recovery authority proof acceptance:commands:recovery:confined:members:least-privilege:auth:non-auth:policies = $INVITATION_MEMBERSHIP_RECOVERY_AUTHORITY_PROOF"
if [[ "$INVITATION_MEMBERSHIP_RECOVERY_AUTHORITY_PROOF" != "2:4:2:3:0:1:1:0:13" ]]; then
  echo "Invitation/membership/recovery authority boundary is invalid: $INVITATION_MEMBERSHIP_RECOVERY_AUTHORITY_PROOF" >&2
  exit 1
fi
REGISTRATION_DECISION_AUTHORITY_PROOF="$(psql "$ADMIN_URL" -X -At --set ON_ERROR_STOP=1 <<'SQL'
SELECT
  (SELECT count(*) FROM pg_proc function
   JOIN pg_namespace schema ON schema.oid = function.pronamespace
   JOIN pg_roles owner ON owner.oid = function.proowner
   WHERE schema.nspname = 'auth' AND function.prosecdef
     AND function.proname IN ('registration_platform_actor_authorized','registration_organization_admin_context','registration_platform_review_queue','registration_organization_join_queue','lock_registration_decision_application','apply_registration_identity_transition')
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
   WHERE schemaname = 'public' AND tablename IN ('users','user_orgs','organizations')
     AND policyname LIKE '%_registration_decision_%'
     AND 'pc_registration_decision_authority' = ANY (roles))::text;
SQL
)"
echo "[one-deal] registration-decision proof definers:confined:members:least-privilege:auth:non-auth:policies = $REGISTRATION_DECISION_AUTHORITY_PROOF"
if [[ "$REGISTRATION_DECISION_AUTHORITY_PROOF" != "6:1:0:1:1:0:6" ]]; then
  echo "Registration-decision authority boundary is invalid: $REGISTRATION_DECISION_AUTHORITY_PROOF" >&2
  exit 1
fi

ACCOUNT_LIFECYCLE_AUTHORITY_PROOF="$(psql "$ADMIN_URL" -X -At --set ON_ERROR_STOP=1 <<'SQL'
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
    has_function_privilege('one_deal_auth', 'auth.account_data_export(text,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege('one_deal_auth', 'auth.anonymize_account_identity(text,text,text,text,text)', 'EXECUTE')
  )::int::text
  || ':' ||
  (SELECT count(*) FROM (VALUES ('one_deal_app'),('one_deal_staff'),('one_deal_storage')) AS runtime(role)
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
echo "[one-deal] account-lifecycle authority proof export:anonymize:roles:members:least-privilege:auth:non-auth:policies = $ACCOUNT_LIFECYCLE_AUTHORITY_PROOF"
if [[ "$ACCOUNT_LIFECYCLE_AUTHORITY_PROOF" != "1:1:2:0:1:1:0:7" ]]; then
  echo "Account-lifecycle authority boundary is invalid: $ACCOUNT_LIFECYCLE_AUTHORITY_PROOF" >&2
  exit 1
fi

MFA_AUTHORITY_PROOF="$(psql "$ADMIN_URL" -X -At --set ON_ERROR_STOP=1 <<'SQL'
SELECT
  (SELECT count(*) FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   JOIN pg_roles owner ON owner.oid = p.proowner
   WHERE n.nspname = 'auth'
     AND p.proname = 'finalize_authenticated_user_mfa'
     AND p.prosecdef
     AND owner.rolname = 'pc_auth_mfa_authority')::text
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
    has_schema_privilege('pc_auth_mfa_authority', 'auth', 'USAGE')
    AND has_schema_privilege('pc_auth_mfa_authority', 'public', 'USAGE')
    AND has_table_privilege('pc_auth_mfa_authority', 'auth.sessions', 'SELECT')
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
  has_function_privilege('one_deal_staff', 'auth.finalize_authenticated_user_mfa(text,text,text)', 'EXECUTE')::int::text
  || ':' ||
  has_function_privilege('one_deal_storage', 'auth.finalize_authenticated_user_mfa(text,text,text)', 'EXECUTE')::int::text;
SQL
)"
echo "[one-deal] MFA authority proof definer:confined:members:least-privilege:auth:deal:staff:storage = $MFA_AUTHORITY_PROOF"
if [[ "$MFA_AUTHORITY_PROOF" != "1:1:0:1:1:0:0:0" ]]; then
  echo "MFA finalizer authority boundary is invalid: $MFA_AUTHORITY_PROOF" >&2
  exit 1
fi

REGISTRATION_AUTHORITY_PROOF="$(psql "$ADMIN_URL" -X -At --set ON_ERROR_STOP=1 <<'SQL'
SELECT
  (SELECT count(*) FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   JOIN pg_roles owner ON owner.oid = p.proowner
   WHERE n.nspname='auth' AND p.proname='create_pending_registration_identity'
     AND p.prosecdef AND owner.rolname='pc_registration_authority')::text
  || ':' ||
  (SELECT count(*) FROM pg_roles
   WHERE rolname='pc_registration_authority'
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
  has_function_privilege(
    'one_deal_staff',
    'auth.create_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  )::int::text
  || ':' ||
  has_function_privilege(
    'one_deal_storage',
    'auth.create_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  )::int::text;
SQL
)"
echo "[one-deal] retired registration proof definer:confined:auth:deal:staff:storage = $REGISTRATION_AUTHORITY_PROOF"
if [[ "$REGISTRATION_AUTHORITY_PROOF" != "1:1:0:0:0:0" ]]; then
  echo "Registration authority boundary is invalid: $REGISTRATION_AUTHORITY_PROOF" >&2
  exit 1
fi

STAFF_ROLE_PROOF="$(psql "$ADMIN_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT rolsuper::text || ':' || rolbypassrls::text || ':' || rolinherit::text || ':' || (SELECT count(*) FROM information_schema.role_table_grants WHERE grantee='one_deal_staff' AND table_schema IN ('public','auth'))::text || ':' || has_function_privilege('one_deal_staff','auth.resolve_staff_target_scope(text,text,text,text,text)','EXECUTE')::text || ':' || has_function_privilege('one_deal_staff','auth.resolve_staff_deal_target_scope(text,text,text)','EXECUTE')::text || ':' || has_function_privilege('one_deal_staff','auth.staff_admission_queue(text,text,text,integer)','EXECUTE')::text || ':' || has_function_privilege('one_deal_staff','auth.staff_admission_application(text,text,text,text)','EXECUTE')::text || ':' || has_function_privilege('one_deal_staff','auth.staff_admission_decision(text,text,text,text,text,text)','EXECUTE')::text || ':' || has_function_privilege('one_deal_staff','auth.staff_organization_directory(text,text,text)','EXECUTE')::text || ':' || has_function_privilege('one_deal_staff','auth.staff_organization_users(text,text,text,text)','EXECUTE')::text || ':' || has_function_privilege('one_deal_staff','auth.staff_cabinet_deals(text,text,text,text,text)','EXECUTE')::text || ':' || has_function_privilege('one_deal_staff','auth.staff_admission_capability(text,text,text,text,text)','EXECUTE')::text || ':' || has_function_privilege('one_deal_staff','auth.staff_projection_capability(text,text,text,text,text,text,boolean)','EXECUTE')::text FROM pg_roles WHERE rolname='one_deal_staff'")"
echo "[one-deal] staff principal proof super:bypass:inherit:table-grants:target:deal-target:queue:application:decision:directory:users:cabinet:admission-capability:projection-capability = $STAFF_ROLE_PROOF"
if [[ "$STAFF_ROLE_PROOF" != "false:false:false:0:true:true:true:true:true:true:true:true:false:false" && "$STAFF_ROLE_PROOF" != "f:f:f:0:t:t:t:t:t:t:t:t:f:f" ]]; then
  echo "Staff principal privilege boundary is invalid: $STAFF_ROLE_PROOF" >&2
  exit 1
fi

AUTH_BOOTSTRAP_PROOF="$(psql "$AUTH_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT (SELECT count(*) FROM public.users)::text || ':' || (SELECT count(*) FROM auth.resolve_login_credential('nobody@example.invalid'))::text || ':' || (has_function_privilege(current_user,'auth.resolve_post_password_membership_ids(text)','EXECUTE') AND has_function_privilege(current_user,'auth.resolve_post_password_membership_context(text,text)','EXECUTE') AND has_function_privilege(current_user,'auth.resolve_session_identity_v2(text,text,text,text)','EXECUTE') AND has_function_privilege(current_user,'auth.finalize_authenticated_user_mfa(text,text,text)','EXECUTE'))::text || ':' || (has_function_privilege(current_user,'auth.prepare_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)','EXECUTE') AND has_function_privilege(current_user,'auth.restart_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)','EXECUTE') AND has_function_privilege(current_user,'auth.mark_registration_email_verified(text,text,text)','EXECUTE') AND has_function_privilege(current_user,'auth.registration_join_notification_recipients(text,text,text)','EXECUTE'))::text || ':' || has_function_privilege(current_user,'auth.resolve_login_context_by_email(text)','EXECUTE')::text")"
echo "[one-deal] auth bootstrap proof direct-users:minimal-credential-rows:post-password-surface:registration-lifecycle:legacy-context-execute = $AUTH_BOOTSTRAP_PROOF"
if [[ "$AUTH_BOOTSTRAP_PROOF" != "0:0:true:true:false" && "$AUTH_BOOTSTRAP_PROOF" != "0:0:t:t:f" ]]; then
  echo "Auth principal minimal bootstrap boundary failed: $AUTH_BOOTSTRAP_PROOF" >&2
  exit 1
fi
STORAGE_ROLE_PROOF="$(psql "$ADMIN_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT rolsuper::text || ':' || rolbypassrls::text || ':' || has_table_privilege('one_deal_storage','public.deal_documents','SELECT')::text || ':' || has_table_privilege('one_deal_storage','public.deal_documents','UPDATE')::text || ':' || has_table_privilege('one_deal_storage','public.deal_documents','INSERT')::text || ':' || has_table_privilege('one_deal_storage','public.deal_documents','DELETE')::text FROM pg_roles WHERE rolname='one_deal_storage'")"
echo "[one-deal] storage principal proof super:bypass:select:update:insert:delete = $STORAGE_ROLE_PROOF"
if [[ "$STORAGE_ROLE_PROOF" != "false:false:true:true:false:false" && "$STORAGE_ROLE_PROOF" != "f:f:t:t:f:f" ]]; then
  echo "Storage principal privilege boundary is invalid: $STORAGE_ROLE_PROOF" >&2
  exit 1
fi

DATABASE_PROOF="$(psql "$APP_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT current_user || ':' || pg_get_userbyid(c.relowner) || ':' || c.relrowsecurity::text || ':' || c.relforcerowsecurity::text || ':' || current_setting('row_security') FROM pg_class c WHERE c.oid='public.deals'::regclass")"
echo "[one-deal] database role proof: $DATABASE_PROOF"
IFS=':' read -r DB_USER DB_OWNER DB_RLS DB_FORCE DB_ROW_SECURITY <<< "$DATABASE_PROOF"
if [[ "$DB_USER" != "one_deal_app" ]]; then
  echo "Application datasource is not connected as one_deal_app: $DB_USER" >&2
  exit 1
fi
if [[ "$DB_OWNER" == "one_deal_app" ]]; then
  echo "Application principal unexpectedly owns protected table deals" >&2
  exit 1
fi
if [[ "$DB_RLS" != "true" && "$DB_RLS" != "t" ]]; then
  echo "RLS is not enabled on deals: $DB_RLS" >&2
  exit 1
fi
if [[ "$DB_FORCE" != "true" && "$DB_FORCE" != "t" ]]; then
  echo "FORCE ROW LEVEL SECURITY is not enabled on deals: $DB_FORCE" >&2
  exit 1
fi
if [[ "$DB_ROW_SECURITY" != "on" ]]; then
  echo "row_security is not on for application datasource: $DB_ROW_SECURITY" >&2
  exit 1
fi

CROSS_TENANT_COUNT="$(
  PGOPTIONS="-c app.current_user_id=buyer-e2e -c app.current_org_id=org-canonical-buyer -c app.current_tenant_id=tenant-other -c app.current_role=BUYER -c app.current_session_id=cross-tenant-sql-proof" \
    psql "$APP_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.deals WHERE id='DEAL-INDUSTRIAL-001'"
)"
echo "[one-deal] SQL cross-tenant visible deal rows: $CROSS_TENANT_COUNT"
if [[ "$CROSS_TENANT_COUNT" != "0" ]]; then
  echo "PostgreSQL RLS cross-tenant Deal isolation failed: $CROSS_TENANT_COUNT visible row(s)" >&2
  exit 1
fi

CROSS_TENANT_PARTICIPANTS="$(
  PGOPTIONS="-c app.current_user_id=buyer-e2e -c app.current_org_id=org-canonical-buyer -c app.current_tenant_id=tenant-other -c app.current_role=BUYER -c app.current_session_id=cross-tenant-participant-proof" \
    psql "$APP_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.deal_participants WHERE \"dealId\"='DEAL-INDUSTRIAL-001'"
)"
echo "[one-deal] SQL cross-tenant visible participant rows: $CROSS_TENANT_PARTICIPANTS"
if [[ "$CROSS_TENANT_PARTICIPANTS" != "0" ]]; then
  echo "PostgreSQL RLS cross-tenant DealParticipant isolation failed: $CROSS_TENANT_PARTICIPANTS visible row(s)" >&2
  exit 1
fi

echo "[one-deal] proving strict Nest runtime datasource boundaries"
NODE_ENV=test \
DATABASE_URL="$APP_URL" \
AUTH_DATABASE_URL="$AUTH_URL" \
STAFF_DATABASE_URL="$STAFF_URL" \
STORAGE_DATABASE_URL="$STORAGE_URL" \
DB_PRINCIPAL_BOUNDARY_ENFORCED=true \
pnpm --filter @pc/api exec ts-node test/one-deal/runtime-principal-startup-proof.ts

echo "[one-deal] running persistent-auth-backed exploitation suite"
NODE_ENV=test \
DATABASE_URL="$APP_URL" \
AUTH_DATABASE_URL="$AUTH_URL" \
STAFF_DATABASE_URL="$STAFF_URL" \
STORAGE_DATABASE_URL="$STORAGE_URL" \
DB_PRINCIPAL_BOUNDARY_ENFORCED=true \
JWT_SECRET="$JWT_SECRET" \
AUTH_TOKEN_PEPPER="$AUTH_TOKEN_PEPPER" \
MFA_ENCRYPTION_KEY="$MFA_ENCRYPTION_KEY" \
BANK_HMAC_SECRET="$BANK_HMAC_SECRET" \
pnpm --filter @pc/api exec jest --runInBand --config test/one-deal/jest.config.json

echo "[one-deal] running staff-access PostgreSQL exploitation suite"
NODE_ENV=test \
DATABASE_URL="$APP_URL" \
AUTH_DATABASE_URL="$AUTH_URL" \
STAFF_DATABASE_URL="$STAFF_URL" \
STORAGE_DATABASE_URL="$STORAGE_URL" \
DB_PRINCIPAL_BOUNDARY_ENFORCED=true \
JWT_SECRET="$JWT_SECRET" \
AUTH_TOKEN_PEPPER="$AUTH_TOKEN_PEPPER" \
MFA_ENCRYPTION_KEY="$MFA_ENCRYPTION_KEY" \
BANK_HMAC_SECRET="$BANK_HMAC_SECRET" \
pnpm --filter @pc/api exec jest --runInBand --config test/staff-access/jest.e2e.config.json

echo "[one-deal] running organization-capability PostgreSQL authority suite"
NODE_ENV=test \
DATABASE_URL="$APP_URL" \
ONE_DEAL_ADMIN_URL="$ADMIN_URL" \
ONE_DEAL_APP_URL="$APP_URL" \
DB_PRINCIPAL_BOUNDARY_ENFORCED=true \
pnpm --filter @pc/api exec jest --runInBand \
  --config test/industrial/jest.config.json \
  --runTestsByPath test/industrial/organization-capability-authority.e2e-spec.ts

echo "[one-deal] running provider-registry PostgreSQL authority suite"
NODE_ENV=test \
DATABASE_URL="$APP_URL" \
ONE_DEAL_ADMIN_URL="$ADMIN_URL" \
ONE_DEAL_APP_URL="$APP_URL" \
DB_PRINCIPAL_BOUNDARY_ENFORCED=true \
pnpm --filter @pc/api exec jest --runInBand \
  --config test/industrial/jest.config.json \
  --runTestsByPath test/industrial/provider-registry-authority.e2e-spec.ts

echo "[one-deal] running integration-binding PostgreSQL authority suite"
NODE_ENV=test \
DATABASE_URL="$APP_URL" \
ONE_DEAL_ADMIN_URL="$ADMIN_URL" \
ONE_DEAL_APP_URL="$APP_URL" \
DB_PRINCIPAL_BOUNDARY_ENFORCED=true \
pnpm --filter @pc/api exec jest --runInBand \
  --config test/industrial/jest.config.json \
  --runTestsByPath test/industrial/integration-binding-authority.e2e-spec.ts

echo "[one-deal] running commercial-rules PostgreSQL authority suite"
NODE_ENV=test \
DATABASE_URL="$APP_URL" \
ONE_DEAL_ADMIN_URL="$ADMIN_URL" \
ONE_DEAL_APP_URL="$APP_URL" \
DB_PRINCIPAL_BOUNDARY_ENFORCED=true \
pnpm --filter @pc/api exec jest --runInBand \
  --config test/industrial/jest.config.json \
  --runTestsByPath test/industrial/commercial-rules-authority.e2e-spec.ts

echo "[one-deal] running inventory PostgreSQL reservation authority suite"
NODE_ENV=test \
DATABASE_URL="$APP_URL" \
ONE_DEAL_ADMIN_URL="$ADMIN_URL" \
ONE_DEAL_APP_URL="$APP_URL" \
DB_PRINCIPAL_BOUNDARY_ENFORCED=true \
pnpm --filter @pc/api exec jest --runInBand \
  --config test/industrial/jest.config.json \
  --runTestsByPath test/industrial/inventory-reservation-authority.e2e-spec.ts

echo "[one-deal] exploitation gate passed"
