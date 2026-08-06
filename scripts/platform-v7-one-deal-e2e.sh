#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADMIN_URL="${ONE_DEAL_ADMIN_URL:?ONE_DEAL_ADMIN_URL is required}"
AUTH_URL="${ONE_DEAL_AUTH_URL:?ONE_DEAL_AUTH_URL is required}"
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
for candidate in "$ADMIN_URL" "$AUTH_URL" "$APP_URL" "$STORAGE_URL"; do
  if [[ "$candidate" =~ (^|[^a-z])(prod|production)([^a-z]|$) ]]; then
    echo "Refusing one-deal E2E: datasource appears production-like" >&2
    exit 2
  fi
done
if [[ "$ADMIN_URL" == "$AUTH_URL" || "$ADMIN_URL" == "$APP_URL" || "$ADMIN_URL" == "$STORAGE_URL" \
  || "$AUTH_URL" == "$APP_URL" || "$AUTH_URL" == "$STORAGE_URL" || "$APP_URL" == "$STORAGE_URL" ]]; then
  echo "Refusing one-deal E2E: admin, auth, application and storage URLs must differ" >&2
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
  -- NOBYPASSRLS (#3670). This role used to carry BYPASSRLS so that login could
  -- read an identity before any tenant context existed. That bought the login
  -- lookup at the price of every statement after it: with the attribute set,
  -- no policy on any table applies to anything this principal does. The
  -- pre-context read now goes through the bounded auth.resolve_login_*
  -- functions granted by name below.
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
GRANT EXECUTE ON FUNCTION auth.staff_organization_directory(TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.staff_organization_users(TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.staff_cabinet_deals(TEXT, TEXT, TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.staff_resolve_deal_scope(TEXT, TEXT) TO one_deal_auth;

-- The bounded pre-authentication surface, by exact signature. These seven are
-- what the auth principal has instead of BYPASSRLS. The role is created after
-- migrations in this harness, so migration-time conditional grants cannot
-- reach it; provisioning must reproduce the complete exact list.
GRANT EXECUTE ON FUNCTION auth.resolve_login_identity(TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_login_identity_by_id(TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_login_memberships(TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_login_memberships_ordered(TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_login_context_by_email(TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_login_context_by_membership(TEXT, TEXT) TO one_deal_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_session_identity(TEXT, TEXT, TEXT, TEXT) TO one_deal_auth;

-- And explicitly not the staff admission surface, which belongs to
-- pc_staff_runtime. Named here so a later blanket grant cannot quietly hand
-- the auth principal a cross-tenant read.
REVOKE ALL ON FUNCTION auth.staff_admission_capability(TEXT, TEXT, TEXT, TEXT, TEXT) FROM one_deal_auth;
REVOKE ALL ON FUNCTION auth.staff_admission_queue(TEXT, TEXT, TEXT, INTEGER) FROM one_deal_auth;
REVOKE ALL ON FUNCTION auth.staff_admission_application(TEXT, TEXT, TEXT, TEXT) FROM one_deal_auth;
REVOKE ALL ON FUNCTION auth.staff_admission_decision(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM one_deal_auth;
REVOKE ALL ON FUNCTION auth.validate_deal_creation_actors(TEXT, TEXT, TEXT, TEXT, TEXT) FROM one_deal_auth;
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

# Losing BYPASSRLS is only safe while the boundary that replaced it is actually
# in place: policies forcing the identity tables, the bootstrap functions
# granted by name, no ownership, no membership of the bootstrap role, and no
# reach into the staff admission surface.
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
  (has_function_privilege('one_deal_auth', 'auth.resolve_login_identity(text)', 'EXECUTE')
   AND has_function_privilege('one_deal_auth', 'auth.resolve_login_identity_by_id(text)', 'EXECUTE')
   AND has_function_privilege('one_deal_auth', 'auth.resolve_login_memberships(text)', 'EXECUTE')
   AND has_function_privilege('one_deal_auth', 'auth.resolve_login_memberships_ordered(text)', 'EXECUTE')
   AND has_function_privilege('one_deal_auth', 'auth.resolve_login_context_by_email(text)', 'EXECUTE')
   AND has_function_privilege('one_deal_auth', 'auth.resolve_login_context_by_membership(text,text)', 'EXECUTE')
   AND has_function_privilege('one_deal_auth', 'auth.resolve_session_identity(text,text,text,text)', 'EXECUTE'))::text
  || ':' ||
  (has_function_privilege('one_deal_auth', 'auth.staff_admission_queue(text,text,text,integer)', 'EXECUTE')
   OR has_function_privilege('one_deal_auth', 'auth.staff_admission_application(text,text,text,text)', 'EXECUTE')
   OR has_function_privilege('one_deal_auth', 'auth.staff_admission_decision(text,text,text,text,text,text)', 'EXECUTE'))::text
  || ':' ||
  (SELECT EXISTS (SELECT 1 FROM pg_auth_members m
   JOIN pg_roles grantee ON grantee.oid = m.roleid
   JOIN pg_roles member ON member.oid = m.member
   WHERE member.rolname = 'one_deal_auth'))::text;
SQL
)"
echo "[one-deal] auth identity proof forced-rls:owns:bootstrap-execute:staff-execute:memberships = $AUTH_IDENTITY_PROOF"
if [[ "$AUTH_IDENTITY_PROOF" != "true:false:true:false:false" && "$AUTH_IDENTITY_PROOF" != "t:f:t:f:f" ]]; then
  echo "Auth principal identity boundary is invalid: $AUTH_IDENTITY_PROOF" >&2
  exit 1
fi

# The read that BYPASSRLS used to buy must still work, and must still be the
# only pre-context read available: a direct SELECT without context returns
# nothing, while the bootstrap function returns the identity.
AUTH_BOOTSTRAP_PROOF="$(psql "$AUTH_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT (SELECT count(*) FROM public.users)::text || ':' || (SELECT count(*) FROM auth.resolve_login_identity('nobody@example.invalid'))::text")"
echo "[one-deal] auth bootstrap proof direct-users:bootstrap-rows = $AUTH_BOOTSTRAP_PROOF"
if [[ "$AUTH_BOOTSTRAP_PROOF" != "0:0" ]]; then
  echo "Auth principal reads identities without context: $AUTH_BOOTSTRAP_PROOF" >&2
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
STORAGE_DATABASE_URL="$STORAGE_URL" \
DB_PRINCIPAL_BOUNDARY_ENFORCED=true \
pnpm --filter @pc/api exec ts-node test/one-deal/runtime-principal-startup-proof.ts

echo "[one-deal] running persistent-auth-backed exploitation suite"
NODE_ENV=test \
DATABASE_URL="$APP_URL" \
AUTH_DATABASE_URL="$AUTH_URL" \
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
STORAGE_DATABASE_URL="$STORAGE_URL" \
DB_PRINCIPAL_BOUNDARY_ENFORCED=true \
JWT_SECRET="$JWT_SECRET" \
AUTH_TOKEN_PEPPER="$AUTH_TOKEN_PEPPER" \
MFA_ENCRYPTION_KEY="$MFA_ENCRYPTION_KEY" \
BANK_HMAC_SECRET="$BANK_HMAC_SECRET" \
pnpm --filter @pc/api exec jest --runInBand --config test/staff-access/jest.e2e.config.json

echo "[one-deal] exploitation gate passed"
