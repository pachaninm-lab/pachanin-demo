-- Aggregate-only production reviewer login-readiness authority (#3791).
--
-- The existing reviewer preflight proves only that an assignment exists. It
-- deliberately cannot prove whether that assignment is attached to an ACTIVE
-- identity, an ACTIVE membership in a VERIFIED organization, a usable bcrypt
-- credential, or a completed TOTP enrollment. The production acceptance must
-- know those structural facts before asking a human PLATFORM_OWNER to perform
-- the visible approval ceremony, but it must never return an email, identifier,
-- password hash, MFA ciphertext, backup code, token or tenant value.
--
-- Reuse the existing confined pc_staff_authority owner and function-only
-- pc_staff_runtime caller. The authority is NOLOGIN/NOINHERIT/NOBYPASSRLS and
-- has no members; the caller receives EXECUTE only. Identity FORCE RLS remains
-- active. Marker policies are scoped to the fixed SECURITY DEFINER body and are
-- not usable by the runtime principal itself.

DO $p0_reviewer_readiness_principals$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_authority') THEN
    RAISE EXCEPTION 'pc_staff_authority is required for reviewer login readiness'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_runtime') THEN
    RAISE EXCEPTION 'pc_staff_runtime is required for reviewer login readiness'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_staff_authority'
      AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)
  ) THEN
    RAISE EXCEPTION 'pc_staff_authority is not confined'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_staff_runtime'
      AND (NOT rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)
  ) THEN
    RAISE EXCEPTION 'pc_staff_runtime is not confined'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    WHERE granted.rolname IN ('pc_staff_authority', 'pc_staff_runtime')
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles member ON member.oid = membership.member
    WHERE member.rolname IN ('pc_staff_authority', 'pc_staff_runtime')
  ) THEN
    RAISE EXCEPTION 'staff authority/runtime roles must remain membership-isolated'
      USING ERRCODE = '42501';
  END IF;
END;
$p0_reviewer_readiness_principals$;

-- pc_staff_authority already owns the bounded staff projections and reviewer
-- preflight. Preserve those reads and add only the columns needed to calculate
-- structural login readiness. Explicitly remove every write privilege first.
GRANT USAGE ON SCHEMA public, auth TO pc_staff_authority;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public."users", public."user_orgs", public."organizations", auth.credential_states
  FROM pc_staff_authority;

GRANT SELECT ("id", "email", "passwordHash", "status", "mfaEnabled", "deletedAt")
  ON public."users" TO pc_staff_authority;
GRANT SELECT ("id", "userId", "organizationId", "status")
  ON public."user_orgs" TO pc_staff_authority;
GRANT SELECT ("id", "tenantId", "status")
  ON public."organizations" TO pc_staff_authority;
GRANT SELECT (
  user_id, credential_version, locked_until, mfa_enabled,
  mfa_secret_ciphertext, mfa_key_version
) ON auth.credential_states TO pc_staff_authority;

-- The marker is transaction-local and useful only to pc_staff_authority. The
-- LOGIN runtime can set an identically named GUC, but no policy below is granted
-- to that runtime and it cannot SET ROLE into the NOLOGIN authority.
DROP POLICY IF EXISTS users_staff_reviewer_readiness ON public."users";
CREATE POLICY users_staff_reviewer_readiness
ON public."users"
FOR SELECT
TO pc_staff_authority
USING (
  current_setting('app.staff_reviewer_readiness_scope', true) = 'aggregate'
  AND EXISTS (
    SELECT 1
    FROM auth.staff_assignments assignment
    WHERE assignment.user_id = public."users"."id"
      AND assignment.role IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF')
      AND assignment.status = 'ACTIVE'
      AND assignment.revoked_at IS NULL
      AND assignment.suspended_at IS NULL
      AND assignment.valid_from <= now()
      AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
  )
);

DROP POLICY IF EXISTS user_orgs_staff_reviewer_readiness ON public."user_orgs";
CREATE POLICY user_orgs_staff_reviewer_readiness
ON public."user_orgs"
FOR SELECT
TO pc_staff_authority
USING (
  current_setting('app.staff_reviewer_readiness_scope', true) = 'aggregate'
  AND EXISTS (
    SELECT 1
    FROM auth.staff_assignments assignment
    WHERE assignment.user_id = public."user_orgs"."userId"
      AND assignment.role IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF')
      AND assignment.status = 'ACTIVE'
      AND assignment.revoked_at IS NULL
      AND assignment.suspended_at IS NULL
      AND assignment.valid_from <= now()
      AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
  )
);

DROP POLICY IF EXISTS organizations_staff_reviewer_readiness ON public."organizations";
CREATE POLICY organizations_staff_reviewer_readiness
ON public."organizations"
FOR SELECT
TO pc_staff_authority
USING (
  current_setting('app.staff_reviewer_readiness_scope', true) = 'aggregate'
  AND EXISTS (
    SELECT 1
    FROM public."user_orgs" membership
    JOIN auth.staff_assignments assignment
      ON assignment.user_id = membership."userId"
    WHERE membership."organizationId" = public."organizations"."id"
      AND assignment.role IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF')
      AND assignment.status = 'ACTIVE'
      AND assignment.revoked_at IS NULL
      AND assignment.suspended_at IS NULL
      AND assignment.valid_from <= now()
      AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
  )
);

DROP POLICY IF EXISTS credential_states_staff_reviewer_readiness ON auth.credential_states;
CREATE POLICY credential_states_staff_reviewer_readiness
ON auth.credential_states
FOR SELECT
TO pc_staff_authority
USING (
  current_setting('app.staff_reviewer_readiness_scope', true) = 'aggregate'
  AND EXISTS (
    SELECT 1
    FROM auth.staff_assignments assignment
    WHERE assignment.user_id = auth.credential_states.user_id
      AND assignment.role IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF')
      AND assignment.status = 'ACTIVE'
      AND assignment.revoked_at IS NULL
      AND assignment.suspended_at IS NULL
      AND assignment.valid_from <= now()
      AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
  )
);

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
      (
        subject."passwordHash" ~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'
      ) AS password_ready,
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

DO $p0_reviewer_readiness_runtime_grants$
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
      'pc_auth_runtime', 'pc_deal_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
      'app_auth', 'app_runtime', 'app_storage', 'app_outbox',
      'one_deal_auth', 'one_deal_app', 'one_deal_storage'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.staff_reviewer_login_readiness() FROM %I',
      runtime_role
    );
  END LOOP;
END;
$p0_reviewer_readiness_runtime_grants$;

DO $p0_reviewer_readiness_boundary_proof$
DECLARE
  assignment_ready integer;
  identity_ready integer;
  membership_ready integer;
  password_ready integer;
  mfa_ready integer;
  login_ready integer;
  table_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc function
    JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
    JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
    WHERE schema.nspname = 'auth'
      AND function.proname = 'staff_reviewer_login_readiness'
      AND function.pronargs = 0
      AND function.prosecdef
      AND owner.rolname = 'pc_staff_authority'
  ) THEN
    RAISE EXCEPTION 'reviewer login-readiness definer ownership is invalid'
      USING ERRCODE = '42501';
  END IF;

  IF NOT has_function_privilege(
    'pc_staff_runtime',
    'auth.staff_reviewer_login_readiness()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'pc_staff_runtime login-readiness EXECUTE grant is missing'
      USING ERRCODE = '42501';
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'public.users',
    'public.user_orgs',
    'public.organizations',
    'auth.credential_states',
    'auth.staff_assignments'
  ]
  LOOP
    IF has_table_privilege('pc_staff_runtime', table_name, 'SELECT')
       OR has_table_privilege('pc_staff_runtime', table_name, 'INSERT')
       OR has_table_privilege('pc_staff_runtime', table_name, 'UPDATE')
       OR has_table_privilege('pc_staff_runtime', table_name, 'DELETE')
       OR has_table_privilege('pc_staff_runtime', table_name, 'TRUNCATE')
       OR has_table_privilege('pc_staff_runtime', table_name, 'REFERENCES')
       OR has_table_privilege('pc_staff_runtime', table_name, 'TRIGGER')
    THEN
      RAISE EXCEPTION 'pc_staff_runtime must remain table-free for %', table_name
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  FOREACH table_name IN ARRAY ARRAY[
    'public.users',
    'public.user_orgs',
    'public.organizations',
    'auth.credential_states',
    'auth.staff_assignments'
  ]
  LOOP
    IF has_table_privilege('pc_staff_authority', table_name, 'INSERT')
       OR has_table_privilege('pc_staff_authority', table_name, 'UPDATE')
       OR has_table_privilege('pc_staff_authority', table_name, 'DELETE')
       OR has_table_privilege('pc_staff_authority', table_name, 'TRUNCATE')
       OR has_table_privilege('pc_staff_authority', table_name, 'REFERENCES')
       OR has_table_privilege('pc_staff_authority', table_name, 'TRIGGER')
    THEN
      RAISE EXCEPTION 'pc_staff_authority received unintended write privilege on %', table_name
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  SELECT
    result.assignment_ready_count,
    result.active_identity_ready_count,
    result.membership_ready_count,
    result.password_ready_count,
    result.mfa_enrolled_ready_count,
    result.login_ready_count
  INTO
    assignment_ready,
    identity_ready,
    membership_ready,
    password_ready,
    mfa_ready,
    login_ready
  FROM auth.staff_reviewer_login_readiness() AS result;

  IF assignment_ready IS NULL OR assignment_ready < 0
     OR identity_ready IS NULL OR identity_ready < 0
     OR membership_ready IS NULL OR membership_ready < 0
     OR password_ready IS NULL OR password_ready < 0
     OR mfa_ready IS NULL OR mfa_ready < 0
     OR login_ready IS NULL OR login_ready < 0
     OR identity_ready > assignment_ready
     OR membership_ready > identity_ready
     OR password_ready > membership_ready
     OR mfa_ready > password_ready
     OR login_ready > mfa_ready
  THEN
    RAISE EXCEPTION 'reviewer login-readiness aggregate proof is invalid'
      USING ERRCODE = '42501';
  END IF;
END;
$p0_reviewer_readiness_boundary_proof$;
