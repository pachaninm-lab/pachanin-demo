-- Keep the reviewer recovery gate aligned with the password format written by
-- the current password-reset service. This migration changes only bounded
-- SECURITY DEFINER helpers and their format predicate; it does not mutate any
-- identity, credential, session, challenge, audit, or outbox row.

CREATE OR REPLACE FUNCTION auth.staff_reviewer_credential_format_ready(candidate text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
SECURITY INVOKER
PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT
    candidate ~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'
    OR candidate ~ '^\$scrypt\$v=1\$n=131072,r=8,p=1\$[A-Za-z0-9_-]{21}[AQgw]\$[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
$function$;

DO $p0_reviewer_scrypt_truth_table$
DECLARE
  bcrypt_sample text := '$2b$12$' || repeat('A', 53);
  scrypt_sample text := '$scrypt$v=1$n=131072,r=8,p=1$'
    || repeat('A', 22) || '$' || repeat('B', 42) || 'A';
  stale_scrypt_sample text := '$scrypt$v=1$n=65536,r=8,p=1$'
    || repeat('A', 22) || '$' || repeat('B', 42) || 'A';
  noncanonical_salt_sample text := '$scrypt$v=1$n=131072,r=8,p=1$'
    || repeat('A', 21) || 'B$' || repeat('B', 42) || 'A';
  noncanonical_key_sample text := '$scrypt$v=1$n=131072,r=8,p=1$'
    || repeat('A', 22) || '$' || repeat('B', 43);
  wrong_version_sample text := '$scrypt$v=2$n=131072,r=8,p=1$'
    || repeat('A', 22) || '$' || repeat('B', 42) || 'A';
  wrong_r_sample text := '$scrypt$v=1$n=131072,r=16,p=1$'
    || repeat('A', 22) || '$' || repeat('B', 42) || 'A';
  wrong_p_sample text := '$scrypt$v=1$n=131072,r=8,p=2$'
    || repeat('A', 22) || '$' || repeat('B', 42) || 'A';
  short_salt_sample text := '$scrypt$v=1$n=131072,r=8,p=1$'
    || repeat('A', 21) || '$' || repeat('B', 42) || 'A';
  long_key_sample text := '$scrypt$v=1$n=131072,r=8,p=1$'
    || repeat('A', 22) || '$' || repeat('B', 43) || 'A';
  invalid_alphabet_sample text := '$scrypt$v=1$n=131072,r=8,p=1$'
    || repeat('A', 20) || '!A$' || repeat('B', 42) || 'A';
BEGIN
  IF NOT auth.staff_reviewer_credential_format_ready(bcrypt_sample)
     OR NOT auth.staff_reviewer_credential_format_ready(scrypt_sample)
     OR auth.staff_reviewer_credential_format_ready(stale_scrypt_sample)
     OR auth.staff_reviewer_credential_format_ready(noncanonical_salt_sample)
     OR auth.staff_reviewer_credential_format_ready(noncanonical_key_sample)
     OR auth.staff_reviewer_credential_format_ready(wrong_version_sample)
     OR auth.staff_reviewer_credential_format_ready(wrong_r_sample)
     OR auth.staff_reviewer_credential_format_ready(wrong_p_sample)
     OR auth.staff_reviewer_credential_format_ready(short_salt_sample)
     OR auth.staff_reviewer_credential_format_ready(long_key_sample)
     OR auth.staff_reviewer_credential_format_ready(invalid_alphabet_sample)
     OR auth.staff_reviewer_credential_format_ready('malformed')
     OR auth.staff_reviewer_credential_format_ready(NULL) IS NOT NULL
  THEN
    RAISE EXCEPTION 'reviewer credential-format truth table is invalid'
      USING ERRCODE = '23514';
  END IF;
END;
$p0_reviewer_scrypt_truth_table$;

ALTER FUNCTION auth.staff_reviewer_credential_format_ready(text)
  OWNER TO pc_staff_authority;
REVOKE ALL ON FUNCTION auth.staff_reviewer_credential_format_ready(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.staff_reviewer_credential_format_ready(text)
  TO pc_staff_runtime;

COMMENT ON FUNCTION auth.staff_reviewer_credential_format_ready(text) IS
  'P0_REVIEWER_CREDENTIAL_FORMAT_V2_BCRYPT_OR_SCRYPT_131072_R8_P1';

CREATE OR REPLACE FUNCTION auth.staff_reviewer_login_readiness()
RETURNS TABLE (
  assignment_ready_count integer,
  active_identity_ready_count integer,
  membership_ready_count integer,
  password_ready_count integer,
  mfa_enrolled_ready_count integer,
  login_ready_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, pg_temp
SET row_security = on
AS $function$
BEGIN
  PERFORM pg_catalog.set_config(
    'app.staff_reviewer_readiness_scope',
    'aggregate',
    true
  );

  RETURN QUERY
  WITH reviewer_candidates AS (
    SELECT DISTINCT assignment.user_id
    FROM auth.staff_assignments assignment
    WHERE assignment.role IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF')
      AND assignment.status = 'ACTIVE'
      AND assignment.revoked_at IS NULL
      AND assignment.suspended_at IS NULL
      AND assignment.valid_from <= now()
      AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
  ), readiness AS (
    SELECT
      candidate.user_id,
      (
        subject."id" IS NOT NULL
        AND subject."status" = 'ACTIVE'
        AND subject."deletedAt" IS NULL
        AND subject."email" = lower(btrim(subject."email"))
        AND position('@' IN subject."email") > 1
      ) AS identity_ready,
      EXISTS (
        SELECT 1
        FROM public."user_orgs" membership
        JOIN public."organizations" organization
          ON organization."id" = membership."organizationId"
        WHERE membership."userId" = candidate.user_id
          AND membership."status" = 'ACTIVE'
          AND organization."status" = 'VERIFIED'
          AND coalesce(btrim(organization."tenantId"), '') <> ''
      ) AS membership_ready,
      auth.staff_reviewer_credential_format_ready(subject."passwordHash") AS password_ready,
      (
        credential.credential_version > 0
        AND credential.mfa_enabled = true
        AND subject."mfaEnabled" = true
        AND credential.mfa_key_version = 'v1'
        AND credential.mfa_secret_ciphertext
          ~ '^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'
      ) AS mfa_enrolled_ready,
      (
        credential.locked_until IS NULL
        OR credential.locked_until <= now()
      ) AS credential_unlocked
    FROM reviewer_candidates candidate
    LEFT JOIN public."users" subject
      ON subject."id" = candidate.user_id
    LEFT JOIN auth.credential_states credential
      ON credential.user_id = candidate.user_id
  )
  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE identity_ready)::integer,
    count(*) FILTER (
      WHERE identity_ready AND membership_ready
    )::integer,
    count(*) FILTER (
      WHERE identity_ready AND membership_ready AND password_ready
    )::integer,
    count(*) FILTER (
      WHERE identity_ready AND membership_ready AND password_ready
        AND mfa_enrolled_ready
    )::integer,
    count(*) FILTER (
      WHERE identity_ready AND membership_ready AND password_ready
        AND mfa_enrolled_ready AND credential_unlocked
    )::integer
  FROM readiness;

  PERFORM pg_catalog.set_config(
    'app.staff_reviewer_readiness_scope',
    '',
    true
  );
END;
$function$;

ALTER FUNCTION auth.staff_reviewer_login_readiness() OWNER TO pc_staff_authority;
REVOKE ALL ON FUNCTION auth.staff_reviewer_login_readiness() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.staff_reviewer_login_readiness() TO pc_staff_runtime;

CREATE OR REPLACE FUNCTION auth.staff_reviewer_password_reset_subject()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, pg_temp
SET row_security = on
AS $function$
DECLARE
  v_candidate_count integer;
  v_subject_count integer;
  v_email text;
BEGIN
  PERFORM pg_catalog.set_config(
    'app.staff_reviewer_password_reset_scope',
    'subject',
    true
  );

  SELECT count(DISTINCT assignment.user_id)::integer
  INTO v_candidate_count
  FROM auth.staff_assignments assignment
  WHERE assignment.role = 'PLATFORM_OWNER'
    AND assignment.status = 'ACTIVE'
    AND assignment.revoked_at IS NULL
    AND assignment.suspended_at IS NULL
    AND assignment.valid_from <= now()
    AND (assignment.valid_until IS NULL OR assignment.valid_until > now());

  IF v_candidate_count <> 1 THEN
    RAISE EXCEPTION 'reviewer password-reset subject cardinality is %', v_candidate_count
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::integer, min(subject."email")
  INTO v_subject_count, v_email
  FROM public."users" subject
  JOIN auth.staff_assignments assignment
    ON assignment.user_id = subject."id"
   AND assignment.role = 'PLATFORM_OWNER'
   AND assignment.status = 'ACTIVE'
   AND assignment.revoked_at IS NULL
   AND assignment.suspended_at IS NULL
   AND assignment.valid_from <= now()
   AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
  WHERE subject."status" = 'ACTIVE'
    AND subject."deletedAt" IS NULL
    AND subject."email" = lower(btrim(subject."email"))
    AND subject."email" ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$'
    AND (
      subject."passwordHash" IS NULL
      OR NOT auth.staff_reviewer_credential_format_ready(subject."passwordHash")
    )
    AND EXISTS (
      SELECT 1
      FROM public."user_orgs" membership
      JOIN public."organizations" organization
        ON organization."id" = membership."organizationId"
      WHERE membership."id" = 'membership_pc_reviewer_internal_v1'
        AND membership."userId" = subject."id"
        AND membership."organizationId" = 'org_pc_internal_platform_v1'
        AND membership."status" = 'ACTIVE'
        AND organization."id" = 'org_pc_internal_platform_v1'
        AND organization."status" = 'VERIFIED'
        AND coalesce(btrim(organization."tenantId"), '') <> ''
    );

  IF v_subject_count <> 1 OR v_email IS NULL THEN
    RAISE EXCEPTION 'reviewer password-reset subject is not uniquely eligible'
      USING ERRCODE = '23514';
  END IF;

  PERFORM pg_catalog.set_config(
    'app.staff_reviewer_password_reset_scope',
    '',
    true
  );
  RETURN v_email;
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_catalog.set_config(
    'app.staff_reviewer_password_reset_scope',
    '',
    true
  );
  RAISE;
END;
$function$;

ALTER FUNCTION auth.staff_reviewer_password_reset_subject()
  OWNER TO pc_staff_authority;
REVOKE ALL ON FUNCTION auth.staff_reviewer_password_reset_subject() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.staff_reviewer_password_reset_subject()
  TO pc_staff_runtime;

DO $p0_reviewer_scrypt_runtime_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('app_staff', 'one_deal_staff')
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA auth TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.staff_reviewer_login_readiness() TO %I',
      runtime_role
    );
  END LOOP;

  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'app_staff', 'one_deal_staff',
      'pc_auth_runtime', 'pc_deal_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
      'app_auth', 'app_runtime', 'app_storage', 'app_outbox',
      'one_deal_auth', 'one_deal_app', 'one_deal_storage'
    )
  LOOP
    IF runtime_role NOT IN ('app_staff', 'one_deal_staff') THEN
      EXECUTE format(
        'REVOKE ALL ON FUNCTION auth.staff_reviewer_login_readiness() FROM %I',
        runtime_role
      );
    END IF;
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.staff_reviewer_credential_format_ready(text) FROM %I',
      runtime_role
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.staff_reviewer_password_reset_subject() FROM %I',
      runtime_role
    );
  END LOOP;

END;
$p0_reviewer_scrypt_runtime_grants$;

DO $p0_reviewer_scrypt_boundary_proof$
DECLARE
  helper_definition text;
  readiness_definition text;
  reset_definition text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef('auth.staff_reviewer_credential_format_ready(text)'::regprocedure)
  INTO helper_definition;
  SELECT pg_catalog.pg_get_functiondef('auth.staff_reviewer_login_readiness()'::regprocedure)
  INTO readiness_definition;
  SELECT pg_catalog.pg_get_functiondef('auth.staff_reviewer_password_reset_subject()'::regprocedure)
  INTO reset_definition;

  IF position('131072,r=8,p=1' IN helper_definition) = 0
     OR position('staff_reviewer_credential_format_ready' IN readiness_definition) = 0
     OR position('staff_reviewer_credential_format_ready' IN reset_definition) = 0
  THEN
    RAISE EXCEPTION 'reviewer credential-format contract is not installed'
      USING ERRCODE = '42501';
  END IF;

  IF NOT has_function_privilege(
    'pc_staff_runtime',
    'auth.staff_reviewer_credential_format_ready(text)',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'pc_staff_runtime',
    'auth.staff_reviewer_login_readiness()',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'pc_staff_runtime',
    'auth.staff_reviewer_password_reset_subject()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'pc_staff_runtime reviewer function grants are incomplete'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc function
    JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
    JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
    WHERE schema.nspname = 'auth'
      AND function.proname = 'staff_reviewer_credential_format_ready'
      AND (
        function.pronargs <> 1
        OR function.prosecdef
        OR NOT function.proisstrict
        OR function.provolatile <> 'i'
        OR owner.rolname <> 'pc_staff_authority'
      )
  ) THEN
    RAISE EXCEPTION 'reviewer credential-format helper boundary is invalid'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc function
    JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      coalesce(function.proacl, pg_catalog.acldefault('f', function.proowner))
    ) acl
    WHERE schema.nspname = 'auth'
      AND function.proname = 'staff_reviewer_credential_format_ready'
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PUBLIC must not execute the reviewer credential-format helper'
      USING ERRCODE = '42501';
  END IF;
END;
$p0_reviewer_scrypt_boundary_proof$;
