#!/usr/bin/env bash
# Direct-SQL identity isolation gate (#3670).
#
# Applies the whole migration chain to a throwaway PostgreSQL 16 database,
# provisions the runtime principals the way ops does, seeds a fixture with two
# tenants and a real member of staff, and then attacks the boundary as the
# restricted roles themselves.
#
# Every check here is a negative one that a previous revision of the migration
# actually failed. The assertions are made by the database, under the same
# roles production uses, rather than by a mock.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/apps/api/prisma/migrations"
IDENTITY_MIGRATION="$MIGRATIONS_DIR/20260806090000_identity_row_level_security/migration.sql"
STAFF_MIGRATION="$MIGRATIONS_DIR/20260806103000_bounded_staff_admission_authority/migration.sql"
LOGIN_CONTEXT_MIGRATION="$MIGRATIONS_DIR/20260806120000_identity_bootstrap_login_context/migration.sql"

: "${RLS_INTEGRATION_ADMIN_URL:?Set RLS_INTEGRATION_ADMIN_URL to a dedicated throwaway PostgreSQL database}"

if [[ "${NODE_ENV:-}" == "production" ]]; then
  echo "Refusing identity isolation gate with NODE_ENV=production" >&2
  exit 2
fi
if [[ -n "${DATABASE_URL:-}" && "$RLS_INTEGRATION_ADMIN_URL" == "$DATABASE_URL" ]]; then
  echo "Refusing identity isolation gate: admin URL equals DATABASE_URL" >&2
  exit 2
fi
if [[ "$RLS_INTEGRATION_ADMIN_URL" =~ (^|[^a-z])(prod|production)([^a-z]|$) ]]; then
  echo "Refusing identity isolation gate: URL appears production-like" >&2
  exit 2
fi

command -v psql >/dev/null || { echo "psql is required" >&2; exit 2; }
command -v node >/dev/null || { echo "node is required" >&2; exit 2; }
[[ -f "$IDENTITY_MIGRATION" ]] || { echo "Missing $IDENTITY_MIGRATION" >&2; exit 2; }
[[ -f "$STAFF_MIGRATION" ]] || { echo "Missing $STAFF_MIGRATION" >&2; exit 2; }
[[ -f "$LOGIN_CONTEXT_MIGRATION" ]] || { echo "Missing $LOGIN_CONTEXT_MIGRATION" >&2; exit 2; }

# The runtime principals log in over TCP in CI, so they need a password. It is
# minted per run and never leaves this process tree.
RUNTIME_PASSWORD="$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("base64url"))')"

admin() { psql "$RLS_INTEGRATION_ADMIN_URL" -v ON_ERROR_STOP=1 -q "$@"; }

runtime_url() {
  node -e '
    const url = new URL(process.argv[1]);
    url.username = process.argv[2];
    url.password = process.argv[3];
    process.stdout.write(url.toString());
  ' "$RLS_INTEGRATION_ADMIN_URL" "$1" "$RUNTIME_PASSWORD"
}

echo "== applying the migration chain =="
# The chain creates a schema per bounded context, so resetting only public and
# auth leaves the rest behind and the second run fails on "already exists".
# Everything outside the system schemas goes; the guards above are what make
# that safe to say.
admin <<'SQL'
DO $reset$
DECLARE
  target text;
BEGIN
  FOR target IN
    SELECT nspname FROM pg_catalog.pg_namespace
    WHERE nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      AND nspname NOT LIKE 'pg_temp%'
      AND nspname NOT LIKE 'pg_toast_temp%'
  LOOP
    EXECUTE format('DROP SCHEMA %I CASCADE', target);
  END LOOP;
  CREATE SCHEMA public;
END;
$reset$;
SQL
# The chain records itself in the ledger Prisma would otherwise have created.
# Applying the SQL directly keeps the gate independent of a generated client.
admin <<'SQL'
CREATE TABLE "_prisma_migrations" (
  id TEXT PRIMARY KEY,
  checksum TEXT NOT NULL DEFAULT '',
  finished_at TIMESTAMPTZ,
  migration_name TEXT NOT NULL DEFAULT '',
  logs TEXT,
  rolled_back_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_steps_count INTEGER NOT NULL DEFAULT 0
);
SQL
for migration in $(find "$MIGRATIONS_DIR" -mindepth 2 -maxdepth 2 -name migration.sql | sort); do
  if ! output="$(admin -f "$migration" 2>&1)"; then
    echo "MIGRATION FAILED: $migration" >&2
    echo "$output" | grep -v '^NOTICE' | head -20 >&2
    exit 1
  fi
done

echo "== provisioning the runtime principals =="
admin <<SQL
DO \$provision\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_auth_runtime') THEN
    CREATE ROLE pc_auth_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
\$provision\$;
ALTER ROLE pc_auth_runtime PASSWORD '$RUNTIME_PASSWORD';
ALTER ROLE pc_staff_runtime PASSWORD '$RUNTIME_PASSWORD';

GRANT USAGE ON SCHEMA public, auth TO pc_auth_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public."users", public."user_orgs", public."organizations" TO pc_auth_runtime;
GRANT SELECT ON public."users", public."user_orgs", public."organizations"
  TO pc_identity_bootstrap;
-- Production grants the auth principal read/write on persistent auth state
-- (evaluateAuthPrincipalBoundary requires it), which means it can read a staff
-- capability digest. The checks below depend on that being true.
GRANT SELECT, INSERT, UPDATE ON
  auth.login_throttles, auth.credential_states, auth.sessions,
  auth.refresh_tokens, auth.mfa_challenges,
  auth.staff_assignments, auth.staff_access_requests, auth.staff_access_grants,
  auth.staff_access_sessions TO pc_auth_runtime;
GRANT SELECT, INSERT ON auth.audit_events TO pc_auth_runtime;
SQL

# Re-applied so the column-level restrictions land after ops provisioning,
# exactly as they do when the runtime role already exists.
admin -f "$IDENTITY_MIGRATION" >/dev/null
admin -f "$STAFF_MIGRATION" >/dev/null
admin -f "$LOGIN_CONTEXT_MIGRATION" >/dev/null

echo "== seeding two tenants, a member of staff and two admission applications =="
admin <<'SQL'
INSERT INTO public."organizations"("id","inn","name","type","status","kycStatus","tenantId","createdAt","updatedAt")
VALUES ('org-a','1111111111','Alpha','LEGAL','ACTIVE','VERIFIED','tenant-a',now(),now()),
       ('org-b','2222222222','Beta','LEGAL','ACTIVE','VERIFIED','tenant-b',now(),now()),
       ('org-new','3333333333','Gamma','LEGAL','PENDING','PENDING','tenant-c',now(),now()),
       ('org-other','4444444444','Delta','LEGAL','PENDING','PENDING','tenant-d',now(),now());

INSERT INTO public."users"("id","email","passwordHash","fullName","status","mfaEnabled","mfaSecret","mfaBackup","createdAt","updatedAt")
VALUES ('user-a','a@example.test','hash-a','Alice','ACTIVE',true,'secret-a','backup-a',now(),now()),
       ('user-b','b@example.test','hash-b','Bob','ACTIVE',false,NULL,NULL,now(),now()),
       ('user-both','both@example.test','hash-both','Casey','ACTIVE',false,NULL,NULL,now(),now()),
       ('user-staff','staff@example.test','hash-staff','Dana','ACTIVE',false,NULL,NULL,now(),now()),
       ('user-new','new@example.test','hash-new','Erin','ACTIVE',false,NULL,NULL,now(),now());

INSERT INTO public."user_orgs"("id","userId","organizationId","role","isDefault","joinedAt")
VALUES ('m-a','user-a','org-a','ADMIN',true,now()),
       ('m-b','user-b','org-b','FARMER',true,now()),
       ('m-both-a','user-both','org-a','FARMER',true,now()),
       ('m-both-b','user-both','org-b','FARMER',false,now()),
       ('m-staff','user-staff','org-a','FARMER',true,now()),
       ('m-new','user-new','org-new','ADMIN',true,now());

INSERT INTO public.kyc_tasks("id","organizationId","type","status","createdAt","updatedAt")
VALUES ('kyc-new','org-new','ORGANIZATION_ADMISSION','PENDING',now(),now()),
       ('kyc-other','org-other','ORGANIZATION_ADMISSION','PENDING',now(),now());

-- A genuine member of staff: an ACTIVE assignment and a live MFA-verified
-- login session. Both are real rows, which is the point: the impersonation
-- checks below substitute them rather than inventing them.
INSERT INTO auth.staff_assignments(id,user_id,role,status,valid_from,activated_at,reason,created_at,updated_at)
VALUES ('sa-1','user-staff','COMPLIANCE_STAFF','ACTIVE',now()-interval '1 day',now()-interval '1 day','admission review',now(),now());

-- auth_require_mfa_on_staff_assignment already created a row for user-staff
-- when the assignment above was inserted, so this fills the rest in.
INSERT INTO auth.credential_states(user_id, credential_version, mfa_enabled)
VALUES ('user-a',1,true),('user-b',1,false),('user-both',1,false),
       ('user-staff',1,true),('user-new',1,false)
ON CONFLICT (user_id) DO UPDATE SET mfa_enabled = EXCLUDED.mfa_enabled;

INSERT INTO auth.sessions(id,user_id,membership_id,organization_id,tenant_id,status,refresh_family_id,credential_version,mfa_level,mfa_verified_at,expires_at,created_at,updated_at)
VALUES ('sess-staff','user-staff','m-staff','org-a','tenant-a','ACTIVE','fam-1',1,'TOTP',now(),now()+interval '1 hour',now(),now());

-- A platform-wide admission capability.
INSERT INTO auth.staff_access_requests(
  id, requester_user_id, assignment_id, access_mode, requested_permissions,
  reason, ticket_id, status, max_duration_seconds, requested_at, expires_at)
VALUES ('sar-1','user-staff','sa-1','CONTROL_PLANE',
  '["organization:list","organization:read","organization:admission:decide"]'::jsonb,
  'admission review queue','TICKET-1','GRANTED',3600,now(),now()+interval '1 hour');
INSERT INTO auth.staff_access_grants(
  id, request_id, grantee_user_id, assignment_id, access_mode, permissions,
  status, starts_at, expires_at)
VALUES ('sag-1','sar-1','user-staff','sa-1','CONTROL_PLANE',
  '["organization:list","organization:read","organization:admission:decide"]'::jsonb,
  'ACTIVE', now()-interval '1 minute', now()+interval '1 hour');
INSERT INTO auth.staff_access_sessions(
  id, grant_id, actor_user_id, token_hash, status, access_mode, permissions,
  reason, ticket_id, mfa_level, started_at, expires_at)
VALUES ('sas-1','sag-1','user-staff','capability-secret-digest','ACTIVE','CONTROL_PLANE',
  '["organization:list","organization:read","organization:admission:decide"]'::jsonb,
  'admission review queue','TICKET-1','TOTP', now(), now()+interval '1 hour');

-- A capability scoped to one organization.
INSERT INTO auth.staff_access_requests(
  id, requester_user_id, assignment_id, access_mode, target_organization_id,
  requested_permissions, reason, ticket_id, status, max_duration_seconds,
  requested_at, expires_at)
VALUES ('sar-2','user-staff','sa-1','CONTROL_PLANE','org-new',
  '["organization:read","organization:admission:decide"]'::jsonb,
  'single application review','TICKET-2','GRANTED',3600,now(),now()+interval '1 hour');
INSERT INTO auth.staff_access_grants(
  id, request_id, grantee_user_id, assignment_id, access_mode,
  target_organization_id, permissions, status, starts_at, expires_at)
VALUES ('sag-2','sar-2','user-staff','sa-1','CONTROL_PLANE','org-new',
  '["organization:read","organization:admission:decide"]'::jsonb,
  'ACTIVE', now()-interval '1 minute', now()+interval '1 hour');
INSERT INTO auth.staff_access_sessions(
  id, grant_id, actor_user_id, token_hash, status, access_mode,
  effective_organization_id, permissions, reason, ticket_id, mfa_level,
  started_at, expires_at)
VALUES ('sas-2','sag-2','user-staff','scoped-secret-digest','ACTIVE','CONTROL_PLANE','org-new',
  '["organization:read","organization:admission:decide"]'::jsonb,
  'single application review','TICKET-2','TOTP', now(), now()+interval '1 hour');

-- An expired capability.
INSERT INTO auth.staff_access_requests(
  id, requester_user_id, assignment_id, access_mode, requested_permissions,
  reason, ticket_id, status, max_duration_seconds, requested_at, expires_at)
VALUES ('sar-3','user-staff','sa-1','CONTROL_PLANE',
  '["organization:list","organization:read"]'::jsonb,
  'expired review window','TICKET-3','GRANTED',3600,
  now()-interval '3 hours', now()-interval '2 hours');
INSERT INTO auth.staff_access_grants(
  id, request_id, grantee_user_id, assignment_id, access_mode, permissions,
  status, starts_at, expires_at)
VALUES ('sag-3','sar-3','user-staff','sa-1','CONTROL_PLANE',
  '["organization:list","organization:read"]'::jsonb,
  'ACTIVE', now()-interval '3 hours', now()-interval '2 hours');
INSERT INTO auth.staff_access_sessions(
  id, grant_id, actor_user_id, token_hash, status, access_mode, permissions,
  reason, ticket_id, mfa_level, started_at, expires_at)
VALUES ('sas-3','sag-3','user-staff','expired-secret-digest','ACTIVE','CONTROL_PLANE',
  '["organization:list","organization:read"]'::jsonb,
  'expired review window','TICKET-3','TOTP',
  now()-interval '3 hours', now()-interval '2 hours');
SQL

AUTH_URL="$(runtime_url pc_auth_runtime)"
STAFF_URL="$(runtime_url pc_staff_runtime)"

echo
echo "== tenant runtime: pc_auth_runtime =="
psql "$AUTH_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT_DIR/scripts/sql/identity-rls-tenant-checks.sql" 2>&1

echo
echo "== staff runtime: pc_staff_runtime =="
psql "$STAFF_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT_DIR/scripts/sql/identity-rls-staff-checks.sql" 2>&1

echo
echo "identity isolation gate: PASS"

# Exact-head CI trigger: identity RLS acceptance.
