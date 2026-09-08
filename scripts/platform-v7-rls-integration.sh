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
MINIMAL_LOGIN_MIGRATION="$MIGRATIONS_DIR/20260807005000_minimal_login_bootstrap/migration.sql"
P0_PASSWORD_FIRST_MIGRATION="$MIGRATIONS_DIR/20260808100000_p0_password_first_multi_membership/migration.sql"
P0_AUTHENTICATED_TOTP_COMPATIBILITY_MIGRATION="$MIGRATIONS_DIR/20260822143000_p0_authenticated_totp_compatibility/migration.sql"
P0_REGISTRATION_LIFECYCLE_MIGRATION="$MIGRATIONS_DIR/20260808110000_p0_registration_lifecycle_authority/migration.sql"
P0_PASSWORD_RESET_MIGRATION="$MIGRATIONS_DIR/20260808120000_p0_password_reset_authority/migration.sql"
P0_ORGANIZATION_TEAM_MIGRATION="$MIGRATIONS_DIR/20260808130000_p0_organization_team_authority/migration.sql"
P0_INVITATION_ACCEPTANCE_MIGRATION="$MIGRATIONS_DIR/20260808140000_p0_invitation_acceptance_authority/migration.sql"
P0_REGISTRATION_DECISION_MIGRATION="$MIGRATIONS_DIR/20260808140000_p0_registration_decision_authority/migration.sql"
P0_REGISTRATION_DECISION_LOCK_PRIVILEGE_MIGRATION="$MIGRATIONS_DIR/20260826180000_p0_registration_decision_application_lock_privilege/migration.sql"
P0_MEMBERSHIP_RECOVERY_MIGRATION="$MIGRATIONS_DIR/20260808150000_p0_invitation_recovery_authority/migration.sql"
P0_ACCOUNT_LIFECYCLE_MIGRATION="$MIGRATIONS_DIR/20260808160000_p0_account_lifecycle_authority/migration.sql"
PRODUCT_SESSION_SCOPE_MIGRATION="$MIGRATIONS_DIR/20260813060000_gekta_product_session_scope/migration.sql"
GEKTA_REGISTRATION_MIGRATION="$MIGRATIONS_DIR/20260813070000_gekta_registration_identity/migration.sql"

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
[[ -f "$MINIMAL_LOGIN_MIGRATION" ]] || { echo "Missing $MINIMAL_LOGIN_MIGRATION" >&2; exit 2; }
[[ -f "$P0_PASSWORD_FIRST_MIGRATION" ]] || { echo "Missing $P0_PASSWORD_FIRST_MIGRATION" >&2; exit 2; }
[[ -f "$P0_AUTHENTICATED_TOTP_COMPATIBILITY_MIGRATION" ]] || { echo "Missing $P0_AUTHENTICATED_TOTP_COMPATIBILITY_MIGRATION" >&2; exit 2; }
[[ -f "$P0_REGISTRATION_LIFECYCLE_MIGRATION" ]] || { echo "Missing $P0_REGISTRATION_LIFECYCLE_MIGRATION" >&2; exit 2; }
[[ -f "$P0_PASSWORD_RESET_MIGRATION" ]] || { echo "Missing $P0_PASSWORD_RESET_MIGRATION" >&2; exit 2; }
[[ -f "$P0_ORGANIZATION_TEAM_MIGRATION" ]] || { echo "Missing $P0_ORGANIZATION_TEAM_MIGRATION" >&2; exit 2; }
[[ -f "$P0_INVITATION_ACCEPTANCE_MIGRATION" ]] || { echo "Missing $P0_INVITATION_ACCEPTANCE_MIGRATION" >&2; exit 2; }
[[ -f "$P0_REGISTRATION_DECISION_MIGRATION" ]] || { echo "Missing $P0_REGISTRATION_DECISION_MIGRATION" >&2; exit 2; }
[[ -f "$P0_REGISTRATION_DECISION_LOCK_PRIVILEGE_MIGRATION" ]] || { echo "Missing $P0_REGISTRATION_DECISION_LOCK_PRIVILEGE_MIGRATION" >&2; exit 2; }
[[ -f "$P0_MEMBERSHIP_RECOVERY_MIGRATION" ]] || { echo "Missing $P0_MEMBERSHIP_RECOVERY_MIGRATION" >&2; exit 2; }
[[ -f "$P0_ACCOUNT_LIFECYCLE_MIGRATION" ]] || { echo "Missing $P0_ACCOUNT_LIFECYCLE_MIGRATION" >&2; exit 2; }

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

# These migrations contain conditional grants to principals that may not exist
# during the first migration pass. Replaying them after provisioning models ops.
# The minimal-login migration MUST be last: 0900/1200 contain historical wider
# bootstrap grants, and 070050 is the forward-only revocation that narrows them
# to credential -> post-password membership -> session authority. The P0
# migration is replayed after it so a newly created runtime receives only the
# bounded multi-membership and MFA-finalization functions.
admin -f "$IDENTITY_MIGRATION" >/dev/null
admin -f "$STAFF_MIGRATION" >/dev/null
admin -f "$LOGIN_CONTEXT_MIGRATION" >/dev/null
admin -f "$MINIMAL_LOGIN_MIGRATION" >/dev/null
admin -f "$P0_PASSWORD_FIRST_MIGRATION" >/dev/null
admin -f "$P0_AUTHENTICATED_TOTP_COMPATIBILITY_MIGRATION" >/dev/null
admin -f "$P0_REGISTRATION_LIFECYCLE_MIGRATION" >/dev/null
admin -f "$P0_PASSWORD_RESET_MIGRATION" >/dev/null
admin -f "$P0_ORGANIZATION_TEAM_MIGRATION" >/dev/null
admin -f "$P0_INVITATION_ACCEPTANCE_MIGRATION" >/dev/null
admin -f "$P0_REGISTRATION_DECISION_MIGRATION" >/dev/null
admin -f "$P0_REGISTRATION_DECISION_LOCK_PRIVILEGE_MIGRATION" >/dev/null
admin -f "$P0_MEMBERSHIP_RECOVERY_MIGRATION" >/dev/null
admin -f "$P0_ACCOUNT_LIFECYCLE_MIGRATION" >/dev/null
admin -f "$PRODUCT_SESSION_SCOPE_MIGRATION" >/dev/null
admin -f "$GEKTA_REGISTRATION_MIGRATION" >/dev/null

echo "== proving registration application lock privilege =="
admin <<'SQL'
BEGIN;
SET LOCAL ROLE pc_registration_decision_authority;
SELECT id
FROM auth.registration_applications
WHERE false
FOR UPDATE;
ROLLBACK;
SQL

if denied_output="$(admin 2>&1 <<'SQL'
\set VERBOSITY sqlstate
BEGIN;
SET LOCAL ROLE pc_registration_decision_authority;
UPDATE auth.registration_applications
SET status = status, version = version
WHERE false;
ROLLBACK;
SQL
)"; then
  echo "Registration decision authority unexpectedly updated non-id application columns" >&2
  exit 1
fi
grep -Fq '42501' <<< "$denied_output" || {
  echo "Registration decision non-id UPDATE did not fail with SQLSTATE 42501" >&2
  exit 1
}
unset denied_output

echo "== seeding two tenants, a member of staff and two admission applications =="
admin <<'SQL'
INSERT INTO public."organizations"("id","inn","name","type","status","kycStatus","tenantId","createdAt","updatedAt")
VALUES ('org-a','1111111111','Alpha','LEGAL','VERIFIED','VERIFIED','tenant-a',now(),now()),
       ('org-b','2222222222','Beta','LEGAL','VERIFIED','VERIFIED','tenant-b',now(),now()),
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

-- Сессия продукта Гекта: тот же пользователь, но без членства, организации и
-- тенанта. Нужна, чтобы измерить, что платформенные запросы её не разрешают.
INSERT INTO auth.sessions(id,user_id,membership_id,organization_id,tenant_id,scope,status,refresh_family_id,credential_version,mfa_level,mfa_verified_at,expires_at,created_at,updated_at)
VALUES ('sess-gekta','user-new',NULL,NULL,NULL,'GEKTA','ACTIVE','fam-gekta',1,'TOTP',now(),now()+interval '1 hour',now(),now());

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
  'single application review','TICKET-2','TOTP', now(),now()+interval '1 hour');

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

echo
echo "== session scope constraint: a platform session still cannot lose its organization =="
admin <<'SQL'
DO $scope_checks$
DECLARE
  failures integer := 0;
BEGIN
  -- Прежние три NOT NULL сохранены для платформенной сессии. Проверяется не
  -- намерение, а реакция базы: вставка обязана провалиться.
  BEGIN
    INSERT INTO auth.sessions(id,user_id,membership_id,organization_id,tenant_id,status,refresh_family_id,credential_version,expires_at)
    VALUES ('sess-bad-platform','user-staff',NULL,NULL,NULL,'ACTIVE','fam-bad',1,now()+interval '1 hour');
    RAISE WARNING 'FAIL  S1 platform session without an organization was accepted';
    failures := failures + 1;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS  S1 platform session without an organization is rejected';
  END;

  -- Продуктовая сессия не может нести организационную принадлежность даже по
  -- ошибке приложения.
  BEGIN
    INSERT INTO auth.sessions(id,user_id,membership_id,organization_id,tenant_id,scope,status,refresh_family_id,credential_version,expires_at)
    VALUES ('sess-bad-gekta','user-staff','m-staff','org-a','tenant-a','GEKTA','ACTIVE','fam-bad',1,now()+interval '1 hour');
    RAISE WARNING 'FAIL  S2 product session carrying an organization was accepted';
    failures := failures + 1;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS  S2 product session carrying an organization is rejected';
  END;

  -- Область действия ограничена перечнем: третьего значения не существует.
  BEGIN
    INSERT INTO auth.sessions(id,user_id,membership_id,organization_id,tenant_id,scope,status,refresh_family_id,credential_version,expires_at)
    VALUES ('sess-bad-scope','user-staff',NULL,NULL,NULL,'ADMIN','ACTIVE','fam-bad',1,now()+interval '1 hour');
    RAISE WARNING 'FAIL  S3 unknown session scope was accepted';
    failures := failures + 1;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS  S3 unknown session scope is rejected';
  END;

  -- Уже существовавшие строки остались платформенными.
  IF (SELECT count(*) FROM auth.sessions WHERE id = 'sess-staff' AND scope = 'PLATFORM') = 1 THEN
    RAISE NOTICE 'PASS  S4 an existing session stayed platform-scoped';
  ELSE
    RAISE WARNING 'FAIL  S4 an existing session did not stay platform-scoped';
    failures := failures + 1;
  END IF;

  IF failures > 0 THEN
    RAISE EXCEPTION 'session scope constraints: % failed', failures;
  END IF;
END;
$scope_checks$;
SQL

echo
echo "== Gekta registration: no organization is created and none can be borrowed =="
admin <<'SQL'
DO $gekta_registration_checks$
DECLARE
  failures integer := 0;
  measured text;
  created_user text;
  verified boolean;
BEGIN
  -- Регистрация в Гекте заводит пользователя и ничего кроме него.
  SELECT user_id INTO created_user
  FROM auth.prepare_gekta_registration_identity(
    'user-gekta-new', 'gekta-new@example.test', '+7 900 000-00-00',
    repeat('x', 60), 'Агроном');

  measured := coalesce(created_user, 'NONE')
              || '/' || (SELECT count(*) FROM public."user_orgs" WHERE "userId" = 'user-gekta-new')::text
              || '/' || (SELECT count(*) FROM public."organizations" WHERE "id" = 'user-gekta-new')::text
              || '/' || coalesce((SELECT "status" FROM public."users" WHERE "id" = 'user-gekta-new'), 'NONE');
  IF measured = 'user-gekta-new/0/0/PENDING_EMAIL_VERIFICATION' THEN
    RAISE NOTICE 'PASS  R1 Gekta registration creates a subject with no membership -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  R1 Gekta registration creates a subject with no membership -> % (want user-gekta-new/0/0/PENDING_EMAIL_VERIFICATION)', measured;
    failures := failures + 1;
  END IF;

  -- Занятый email отвечает ровно тем же, чем свободный: перечислить
  -- пользователей платформы через форму регистрации нельзя.
  measured := coalesce((
    SELECT outcome FROM auth.prepare_gekta_registration_identity(
      'user-gekta-dup', 'a@example.test', NULL, repeat('x', 60), 'Кто-то')
  ), 'NONE');
  IF measured = 'SUPPRESSED' THEN
    RAISE NOTICE 'PASS  R2 an existing email is suppressed rather than reported -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  R2 an existing email is suppressed rather than reported -> % (want SUPPRESSED)', measured;
    failures := failures + 1;
  END IF;

  -- Продуктовый challenge не может сослаться на корпоративную заявку.
  BEGIN
    INSERT INTO auth.registration_email_challenges(id, application_id, user_id, token_hash, scope, expires_at)
    VALUES ('rec-bad-gekta', 'app-any', 'user-gekta-new', 'digest-bad-1', 'GEKTA', now()+interval '1 hour');
    RAISE WARNING 'FAIL  R3 a product challenge referencing an application was accepted';
    failures := failures + 1;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RAISE NOTICE 'PASS  R3 a product challenge referencing an application is rejected';
  END;

  -- Корпоративный challenge по-прежнему невозможен без заявки.
  BEGIN
    INSERT INTO auth.registration_email_challenges(id, application_id, user_id, token_hash, expires_at)
    VALUES ('rec-bad-platform', NULL, 'user-a', 'digest-bad-2', now()+interval '1 hour');
    RAISE WARNING 'FAIL  R4 a platform challenge without an application was accepted';
    failures := failures + 1;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS  R4 a platform challenge without an application is rejected';
  END;

  -- Вход в Гекту доступен только субъекту без членства: пользователь
  -- платформы должен входить обычным путём.
  measured := coalesce((SELECT user_id FROM auth.resolve_gekta_login_credential('gekta-new@example.test')), 'NONE');
  IF measured = 'user-gekta-new' THEN
    RAISE NOTICE 'PASS  R5 Gekta login credential resolves a product subject -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  R5 Gekta login credential resolves a product subject -> % (want user-gekta-new)', measured;
    failures := failures + 1;
  END IF;

  measured := coalesce((SELECT user_id FROM auth.resolve_gekta_login_credential('a@example.test')), 'NONE');
  IF measured = 'NONE' THEN
    RAISE NOTICE 'PASS  R6 Gekta login credential refuses a platform member -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  R6 Gekta login credential refuses a platform member -> % (want NONE)', measured;
    failures := failures + 1;
  END IF;

  -- Email не подтверждается, пока одноразовый токен не потреблён.
  INSERT INTO auth.registration_email_challenges(id, application_id, user_id, token_hash, scope, status, expires_at)
  VALUES ('rec-gekta-1', NULL, 'user-gekta-new', 'digest-gekta-1', 'GEKTA', 'PENDING', now()+interval '1 hour');
  -- Вызов и чтение результата — отдельные операторы: внутри одного выражения
  -- PostgreSQL не гарантирует порядок вычисления подзапросов, поэтому статус
  -- мог быть прочитан до того, как функция его изменит.
  SELECT updated INTO verified FROM auth.mark_gekta_email_verified('rec-gekta-1', 'user-gekta-new');
  measured := verified::text || '/' || (SELECT "status" FROM public."users" WHERE "id" = 'user-gekta-new');
  IF measured = 'false/PENDING_EMAIL_VERIFICATION' THEN
    RAISE NOTICE 'PASS  R7 an unconsumed challenge does not verify the email -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  R7 an unconsumed challenge does not verify the email -> % (want false/PENDING_EMAIL_VERIFICATION)', measured;
    failures := failures + 1;
  END IF;

  UPDATE auth.registration_email_challenges SET status = 'CONSUMED', consumed_at = now() WHERE id = 'rec-gekta-1';
  -- Вызов и сравнение разнесены намеренно: порядок вычисления операндов AND в
  -- PostgreSQL не определён, поэтому побочный эффект внутри условия мог бы
  -- вовсе не выполниться.
  SELECT updated INTO verified FROM auth.mark_gekta_email_verified('rec-gekta-1', 'user-gekta-new');
  measured := verified::text || '/' || (SELECT "status" FROM public."users" WHERE "id" = 'user-gekta-new');
  IF measured = 'true/ACTIVE' THEN
    RAISE NOTICE 'PASS  R8 a consumed challenge activates the subject -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  R8 a consumed challenge activates the subject -> % (want true/ACTIVE)', measured;
    failures := failures + 1;
  END IF;

  -- Активный пользователь Гекты по-прежнему не разрешается платформенным
  -- резолвером: членства у него нет.
  measured := coalesce((
    SELECT user_id FROM auth.resolve_session_identity_v2('user-gekta-new', 'm-a', 'org-a', 'tenant-a')
  ), 'NONE');
  IF measured = 'NONE' THEN
    RAISE NOTICE 'PASS  R9 an active Gekta subject cannot borrow a membership -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  R9 an active Gekta subject cannot borrow a membership -> % (want NONE)', measured;
    failures := failures + 1;
  END IF;

  -- Заявленный номер выдаётся только узкому регистрационному резолверу и
  -- только для субъекта без членства. Он нужен BFF после email verification,
  -- чтобы связать номер уже после обязательного MFA.
  measured := coalesce((
    SELECT phone FROM auth.resolve_gekta_registration_subject_v1('user-gekta-new')
  ), 'NONE');
  IF measured = '+7 900 000-00-00' THEN
    RAISE NOTICE 'PASS  R10 registration resolver returns the declared phone -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  R10 registration resolver returns the declared phone -> % (want +7 900 000-00-00)', measured;
    failures := failures + 1;
  END IF;

  measured := coalesce((
    SELECT user_id FROM auth.resolve_gekta_registration_subject_v1('user-a')
  ), 'NONE');
  IF measured = 'NONE' THEN
    RAISE NOTICE 'PASS  R11 registration resolver refuses a platform member -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  R11 registration resolver refuses a platform member -> % (want NONE)', measured;
    failures := failures + 1;
  END IF;

  IF failures > 0 THEN
    RAISE EXCEPTION 'Gekta registration checks: % failed', failures;
  END IF;
END;
$gekta_registration_checks$;
SQL

echo
echo "== authenticated TOTP compatibility: pc_auth_runtime =="
admin <<'SQL'
INSERT INTO public."users"(
  "id","email","passwordHash","fullName","status","mfaEnabled",
  "mfaSecret","mfaBackup","createdAt","updatedAt"
)
VALUES
  ('user-mfa-fresh','mfa-fresh@example.test','hash-mfa-fresh','MFA Fresh','ACTIVE',false,NULL,NULL,now(),now()),
  ('user-mfa-true','mfa-true@example.test','hash-mfa-true','MFA True','ACTIVE',true,NULL,NULL,now(),now()),
  ('user-mfa-backup','mfa-backup@example.test','hash-mfa-backup','MFA Backup','ACTIVE',false,NULL,NULL,now(),now()),
  ('user-mfa-mismatch','mfa-mismatch@example.test','hash-mfa-mismatch','MFA Mismatch','ACTIVE',false,NULL,NULL,now(),now()),
  ('user-mfa-expired','mfa-expired@example.test','hash-mfa-expired','MFA Expired','ACTIVE',false,NULL,NULL,now(),now()),
  ('user-mfa-stale','mfa-stale@example.test','hash-mfa-stale','MFA Stale','ACTIVE',false,NULL,NULL,now(),now()),
  ('user-mfa-version','mfa-version@example.test','hash-mfa-version','MFA Version','ACTIVE',false,NULL,NULL,now(),now());

INSERT INTO public."user_orgs"(
  "id","userId","organizationId","role","isDefault","joinedAt"
)
VALUES
  ('m-mfa-fresh','user-mfa-fresh','org-a','FARMER',true,now()),
  ('m-mfa-true','user-mfa-true','org-a','FARMER',true,now()),
  ('m-mfa-backup','user-mfa-backup','org-a','FARMER',true,now()),
  ('m-mfa-mismatch','user-mfa-mismatch','org-a','FARMER',true,now()),
  ('m-mfa-expired','user-mfa-expired','org-a','FARMER',true,now()),
  ('m-mfa-stale','user-mfa-stale','org-a','FARMER',true,now()),
  ('m-mfa-version','user-mfa-version','org-a','FARMER',true,now());

INSERT INTO auth.credential_states(
  user_id, credential_version, mfa_enabled, mfa_secret_ciphertext,
  mfa_key_version
)
VALUES
  ('user-mfa-fresh',1,true,'v1:nonce:cipher:tag','v1'),
  ('user-mfa-true',1,true,'v1:nonce:cipher:tag','v1'),
  ('user-mfa-backup',1,true,'v1:nonce:cipher:tag','v1'),
  ('user-mfa-mismatch',1,true,'v1:nonce:cipher:tag','v1'),
  ('user-mfa-expired',1,true,'v1:nonce:cipher:tag','v1'),
  ('user-mfa-stale',1,true,'v1:nonce:cipher:tag','v1'),
  ('user-mfa-version',2,true,'v1:nonce:cipher:tag','v1');

INSERT INTO auth.sessions(
  id,user_id,membership_id,organization_id,tenant_id,status,
  refresh_family_id,credential_version,mfa_level,mfa_verified_at,
  mfa_verified_method,expires_at,created_at,updated_at
)
VALUES
  ('sess-mfa-fresh','user-mfa-fresh','m-mfa-fresh','org-a','tenant-a','ACTIVE','fam-mfa-fresh',1,'TOTP',now(),'TOTP',now()+interval '1 hour',now(),now()),
  ('sess-mfa-true','user-mfa-true','m-mfa-true','org-a','tenant-a','ACTIVE','fam-mfa-true',1,'TOTP',now(),'TOTP',now()+interval '1 hour',now(),now()),
  ('sess-mfa-backup','user-mfa-backup','m-mfa-backup','org-a','tenant-a','ACTIVE','fam-mfa-backup',1,'BACKUP',now(),'BACKUP',now()+interval '1 hour',now(),now()),
  ('sess-mfa-mismatch','user-mfa-mismatch','m-mfa-mismatch','org-a','tenant-a','ACTIVE','fam-mfa-mismatch',1,'TOTP',now(),'TOTP',now()+interval '1 hour',now(),now()),
  ('sess-mfa-mismatch-other','user-mfa-mismatch','m-mfa-mismatch','org-a','tenant-a','ACTIVE','fam-mfa-mismatch-other',1,'TOTP',now(),'TOTP',now()+interval '1 hour',now(),now()),
  ('sess-mfa-expired','user-mfa-expired','m-mfa-expired','org-a','tenant-a','ACTIVE','fam-mfa-expired',1,'TOTP',now(),'TOTP',now()+interval '1 hour',now(),now()),
  ('sess-mfa-stale','user-mfa-stale','m-mfa-stale','org-a','tenant-a','ACTIVE','fam-mfa-stale',1,'TOTP',now(),'TOTP',now()+interval '1 hour',now(),now()),
  ('sess-mfa-version','user-mfa-version','m-mfa-version','org-a','tenant-a','ACTIVE','fam-mfa-version',1,'TOTP',now(),'TOTP',now()+interval '1 hour',now(),now());

INSERT INTO auth.mfa_challenges(
  id,session_id,user_id,challenge_token_hash,type,status,expires_at,
  verified_at,created_at
)
VALUES
  ('challenge-mfa-fresh','sess-mfa-fresh','user-mfa-fresh','digest-mfa-fresh','TOTP_VERIFY','VERIFIED',now()+interval '1 hour',now(),now()),
  ('challenge-mfa-true','sess-mfa-true','user-mfa-true','digest-mfa-true','TOTP_VERIFY','VERIFIED',now()+interval '1 hour',now(),now()),
  ('challenge-mfa-backup','sess-mfa-backup','user-mfa-backup','digest-mfa-backup','BACKUP_VERIFY','VERIFIED',now()+interval '1 hour',now(),now()),
  ('challenge-mfa-mismatch','sess-mfa-mismatch-other','user-mfa-mismatch','digest-mfa-mismatch','TOTP_VERIFY','VERIFIED',now()+interval '1 hour',now(),now()),
  ('challenge-mfa-expired','sess-mfa-expired','user-mfa-expired','digest-mfa-expired','TOTP_VERIFY','VERIFIED',now()+interval '1 hour',now(),now()),
  ('challenge-mfa-stale','sess-mfa-stale','user-mfa-stale','digest-mfa-stale','TOTP_VERIFY','VERIFIED',now()+interval '1 hour',now(),now()),
  ('challenge-mfa-version','sess-mfa-version','user-mfa-version','digest-mfa-version','TOTP_VERIFY','VERIFIED',now()+interval '1 hour',now(),now());
SQL

MFA_AUTH_URL="$(runtime_url pc_auth_runtime)"
psql "$MFA_AUTH_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
BEGIN;
SELECT set_config('app.current_user_id', 'user-a', true),
       set_config('app.current_org_id', 'org-a', true),
       set_config('app.current_tenant_id', 'tenant-a', true),
       set_config('app.current_role', 'ADMIN', true),
       set_config('app.current_session_id', 'sess-a', true);

CREATE TEMP TABLE mfa_compat_subject_before ON COMMIT DROP AS
SELECT subject."id" AS user_id, to_jsonb(subject) AS snapshot
FROM public."users" subject
WHERE subject."id" LIKE 'user-mfa-%';

UPDATE auth.sessions
SET mfa_verified_at = transaction_timestamp()
WHERE id IN (
  'sess-mfa-fresh', 'sess-mfa-true', 'sess-mfa-backup',
  'sess-mfa-mismatch', 'sess-mfa-mismatch-other', 'sess-mfa-expired',
  'sess-mfa-version'
);
UPDATE auth.mfa_challenges
SET verified_at = transaction_timestamp(),
    expires_at = transaction_timestamp() + interval '1 hour'
WHERE id IN (
  'challenge-mfa-fresh', 'challenge-mfa-true', 'challenge-mfa-backup',
  'challenge-mfa-mismatch', 'challenge-mfa-version'
);
UPDATE auth.mfa_challenges
SET verified_at = transaction_timestamp(),
    expires_at = transaction_timestamp() - interval '1 second'
WHERE id = 'challenge-mfa-expired';
UPDATE auth.sessions
SET mfa_verified_at = transaction_timestamp() - interval '1 second'
WHERE id = 'sess-mfa-stale';
UPDATE auth.mfa_challenges
SET verified_at = transaction_timestamp() - interval '1 second',
    expires_at = transaction_timestamp() + interval '1 hour'
WHERE id = 'challenge-mfa-stale';

DO $authenticated_totp_compatibility_checks$
DECLARE
  changed boolean;
  changed_again boolean;
  current_flag boolean;
  current_snapshot jsonb;
  initial_snapshot jsonb;
BEGIN
  IF (SELECT count(*) FROM mfa_compat_subject_before) <> 7 THEN
    RAISE EXCEPTION 'MFA compatibility fixture is not visible through pc_auth_runtime';
  END IF;

  SELECT updated INTO changed
  FROM auth.finalize_authenticated_user_mfa(
    'user-mfa-fresh', 'sess-mfa-fresh', 'challenge-mfa-fresh'
  );
  SELECT subject."mfaEnabled", to_jsonb(subject), before.snapshot
  INTO current_flag, current_snapshot, initial_snapshot
  FROM public."users" subject
  JOIN mfa_compat_subject_before before ON before.user_id = subject."id"
  WHERE subject."id" = 'user-mfa-fresh';
  IF changed IS DISTINCT FROM true
     OR initial_snapshot->>'mfaEnabled' <> 'false'
     OR current_flag IS DISTINCT FROM true
     OR current_snapshot - 'mfaEnabled' IS DISTINCT FROM initial_snapshot - 'mfaEnabled' THEN
    RAISE EXCEPTION 'fresh bound TOTP_VERIFY did not change only users.mfaEnabled false to true';
  END IF;
  RAISE NOTICE 'PASS  M1 fresh same-transaction TOTP_VERIFY changes only users.mfaEnabled false -> true';

  SELECT updated INTO changed
  FROM auth.finalize_authenticated_user_mfa(
    'user-mfa-true', 'sess-mfa-true', 'challenge-mfa-true'
  );
  SELECT updated INTO changed_again
  FROM auth.finalize_authenticated_user_mfa(
    'user-mfa-true', 'sess-mfa-true', 'challenge-mfa-true'
  );
  SELECT subject."mfaEnabled", to_jsonb(subject), before.snapshot
  INTO current_flag, current_snapshot, initial_snapshot
  FROM public."users" subject
  JOIN mfa_compat_subject_before before ON before.user_id = subject."id"
  WHERE subject."id" = 'user-mfa-true';
  IF changed IS DISTINCT FROM true
     OR changed_again IS DISTINCT FROM true
     OR initial_snapshot->>'mfaEnabled' <> 'true'
     OR current_flag IS DISTINCT FROM true
     OR current_snapshot IS DISTINCT FROM initial_snapshot THEN
    RAISE EXCEPTION 'already-true MFA compatibility finalization is not idempotent';
  END IF;
  RAISE NOTICE 'PASS  M2 an already-true compatibility flag is idempotent';

  SELECT updated INTO changed
  FROM auth.finalize_authenticated_user_mfa(
    'user-mfa-backup', 'sess-mfa-backup', 'challenge-mfa-backup'
  );
  SELECT subject."mfaEnabled", to_jsonb(subject), before.snapshot
  INTO current_flag, current_snapshot, initial_snapshot
  FROM public."users" subject
  JOIN mfa_compat_subject_before before ON before.user_id = subject."id"
  WHERE subject."id" = 'user-mfa-backup';
  IF changed IS DISTINCT FROM false
     OR current_flag IS DISTINCT FROM false
     OR current_snapshot IS DISTINCT FROM initial_snapshot THEN
    RAISE EXCEPTION 'BACKUP verification changed the compatibility flag';
  END IF;
  RAISE NOTICE 'PASS  M3 BACKUP verification returns false without flag mutation';

  SELECT updated INTO changed
  FROM auth.finalize_authenticated_user_mfa(
    'user-mfa-mismatch', 'sess-mfa-mismatch', 'challenge-mfa-mismatch'
  );
  SELECT subject."mfaEnabled", to_jsonb(subject), before.snapshot
  INTO current_flag, current_snapshot, initial_snapshot
  FROM public."users" subject
  JOIN mfa_compat_subject_before before ON before.user_id = subject."id"
  WHERE subject."id" = 'user-mfa-mismatch';
  IF changed IS DISTINCT FROM false
     OR current_flag IS DISTINCT FROM false
     OR current_snapshot IS DISTINCT FROM initial_snapshot THEN
    RAISE EXCEPTION 'mismatched session/challenge tuple changed the compatibility flag';
  END IF;
  RAISE NOTICE 'PASS  M4 a mismatched session/challenge tuple returns false without flag mutation';

  SELECT updated INTO changed
  FROM auth.finalize_authenticated_user_mfa(
    'user-mfa-expired', 'sess-mfa-expired', 'challenge-mfa-expired'
  );
  SELECT subject."mfaEnabled", to_jsonb(subject), before.snapshot
  INTO current_flag, current_snapshot, initial_snapshot
  FROM public."users" subject
  JOIN mfa_compat_subject_before before ON before.user_id = subject."id"
  WHERE subject."id" = 'user-mfa-expired';
  IF changed IS DISTINCT FROM false
     OR current_flag IS DISTINCT FROM false
     OR current_snapshot IS DISTINCT FROM initial_snapshot THEN
    RAISE EXCEPTION 'expired TOTP challenge changed the compatibility flag';
  END IF;
  RAISE NOTICE 'PASS  M5 an expired TOTP challenge returns false without flag mutation';

  SELECT updated INTO changed
  FROM auth.finalize_authenticated_user_mfa(
    'user-mfa-stale', 'sess-mfa-stale', 'challenge-mfa-stale'
  );
  SELECT subject."mfaEnabled", to_jsonb(subject), before.snapshot
  INTO current_flag, current_snapshot, initial_snapshot
  FROM public."users" subject
  JOIN mfa_compat_subject_before before ON before.user_id = subject."id"
  WHERE subject."id" = 'user-mfa-stale';
  IF changed IS DISTINCT FROM false
     OR current_flag IS DISTINCT FROM false
     OR current_snapshot IS DISTINCT FROM initial_snapshot THEN
    RAISE EXCEPTION 'stale TOTP verification timestamps changed the compatibility flag';
  END IF;
  RAISE NOTICE 'PASS  M6 stale TOTP verification timestamps return false without flag mutation';

  SELECT updated INTO changed
  FROM auth.finalize_authenticated_user_mfa(
    'user-mfa-version', 'sess-mfa-version', 'challenge-mfa-version'
  );
  SELECT subject."mfaEnabled", to_jsonb(subject), before.snapshot
  INTO current_flag, current_snapshot, initial_snapshot
  FROM public."users" subject
  JOIN mfa_compat_subject_before before ON before.user_id = subject."id"
  WHERE subject."id" = 'user-mfa-version';
  IF changed IS DISTINCT FROM false
     OR current_flag IS DISTINCT FROM false
     OR current_snapshot IS DISTINCT FROM initial_snapshot THEN
    RAISE EXCEPTION 'credential-version mismatch changed the compatibility flag';
  END IF;
  RAISE NOTICE 'PASS  M7 a credential-version mismatch returns false without flag mutation';
END;
$authenticated_totp_compatibility_checks$;
ROLLBACK;
SQL

# The runtime assertions roll back every compatibility mutation, but the
# superuser fixtures were committed before the restricted connection began.
# Remove that exact synthetic tuple set so the pre-existing tenant expected-set
# checks below keep measuring only their own baseline fixtures.
admin <<'SQL'
DELETE FROM auth.mfa_challenges
WHERE id IN (
  'challenge-mfa-fresh', 'challenge-mfa-true', 'challenge-mfa-backup',
  'challenge-mfa-mismatch', 'challenge-mfa-expired', 'challenge-mfa-stale',
  'challenge-mfa-version'
);
DELETE FROM auth.sessions
WHERE id IN (
  'sess-mfa-fresh', 'sess-mfa-true', 'sess-mfa-backup',
  'sess-mfa-mismatch', 'sess-mfa-mismatch-other', 'sess-mfa-expired',
  'sess-mfa-stale', 'sess-mfa-version'
);
DELETE FROM auth.credential_states
WHERE user_id IN (
  'user-mfa-fresh', 'user-mfa-true', 'user-mfa-backup',
  'user-mfa-mismatch', 'user-mfa-expired', 'user-mfa-stale',
  'user-mfa-version'
);
DELETE FROM public."user_orgs"
WHERE "id" IN (
  'm-mfa-fresh', 'm-mfa-true', 'm-mfa-backup', 'm-mfa-mismatch',
  'm-mfa-expired', 'm-mfa-stale', 'm-mfa-version'
);
DELETE FROM public."users"
WHERE "id" IN (
  'user-mfa-fresh', 'user-mfa-true', 'user-mfa-backup',
  'user-mfa-mismatch', 'user-mfa-expired', 'user-mfa-stale',
  'user-mfa-version'
);
SQL

AUTH_URL="$(runtime_url pc_auth_runtime)"
STAFF_URL="$(runtime_url pc_staff_runtime)"

echo
echo "== tenant runtime: pc_auth_runtime =="
psql "$AUTH_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT_DIR/scripts/sql/identity-rls-tenant-checks.sql" 2>&1

echo
echo "== staff runtime: pc_staff_runtime =="
psql "$STAFF_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT_DIR/scripts/sql/identity-rls-staff-checks.sql" 2>&1

# The PC-CROP accounting contour. Run through the admin connection because
# pc_accounting_authority is NOLOGIN until the slice that wires an API
# provisions its credential; the check does SET ROLE itself, which exercises
# the same enforcement path since the role is NOBYPASSRLS and both tables are
# FORCE ROW LEVEL SECURITY.
echo
echo "== accounting contour: pc_accounting_authority =="
psql "$RLS_INTEGRATION_ADMIN_URL" -v ON_ERROR_STOP=1 -q \
  -f "$ROOT_DIR/scripts/sql/pc-crop-accounting-rls-checks.sql" 2>&1

echo
echo "identity isolation gate: PASS"

# Exact-head CI trigger: identity RLS acceptance.
