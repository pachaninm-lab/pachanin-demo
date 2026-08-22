-- P0 owner-access password-reset subject authority (#3785).
--
-- This forward-only authority is intentionally separate from
-- auth.staff_reviewer_password_reset_subject(). The generic reviewer reset
-- subject remains eligible only before a usable password exists. This owner
-- access subject is eligible only for the unique password-ready PLATFORM_OWNER
-- who has not enrolled MFA and is therefore not login-ready.
--
-- The function returns one normalized email to the confined table-free
-- pc_staff_runtime caller. The function body is independently proved read-only;
-- it never writes password, MFA, role, membership, tenant, challenge or outbox
-- state and does not disturb the existing admission authority ACLs.

DO $p0_owner_access_principals$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_authority') THEN
    RAISE EXCEPTION 'pc_staff_authority is required for owner-access reset'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_runtime') THEN
    RAISE EXCEPTION 'pc_staff_runtime is required for owner-access reset'
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
    RAISE EXCEPTION 'owner-access authority roles must remain membership-isolated'
      USING ERRCODE = '42501';
  END IF;
END;
$p0_owner_access_principals$;

GRANT USAGE ON SCHEMA public, auth TO pc_staff_authority;
GRANT SELECT ("mfaSecret", "mfaBackup")
  ON public."users" TO pc_staff_authority;
GRANT SELECT (
  user_id, credential_version, locked_until, mfa_enabled,
  mfa_secret_ciphertext, mfa_key_version, mfa_backup_hashes
) ON auth.credential_states TO pc_staff_authority;

REVOKE ALL ON public."users", public."user_orgs", public."organizations", auth.credential_states
  FROM pc_staff_runtime;

CREATE OR REPLACE FUNCTION auth.staff_owner_access_password_reset_subject()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, pg_temp
SET row_security = on
AS $function$
DECLARE
  v_active_owner_count integer;
  v_usable_reviewer_count integer;
  v_assignment_ready_count integer;
  v_active_identity_ready_count integer;
  v_membership_ready_count integer;
  v_password_ready_count integer;
  v_mfa_enrolled_ready_count integer;
  v_login_ready_count integer;
  v_candidate_count integer;
  v_subject_count integer;
  v_email text;
BEGIN
  -- pc_staff_authority also owns the admission ceremony. A caller-controlled
  -- transaction-local marker must never carry that legacy write capability into
  -- this read-only projection.
  PERFORM pg_catalog.set_config('app.staff_admission_scope', '', true);
  PERFORM pg_catalog.set_config('app.staff_admission_decision', '', true);

  SELECT
    preflight.active_owner_count,
    preflight.usable_reviewer_count,
    readiness.assignment_ready_count,
    readiness.active_identity_ready_count,
    readiness.membership_ready_count,
    readiness.password_ready_count,
    readiness.mfa_enrolled_ready_count,
    readiness.login_ready_count
  INTO
    v_active_owner_count,
    v_usable_reviewer_count,
    v_assignment_ready_count,
    v_active_identity_ready_count,
    v_membership_ready_count,
    v_password_ready_count,
    v_mfa_enrolled_ready_count,
    v_login_ready_count
  FROM auth.staff_reviewer_preflight() preflight
  CROSS JOIN auth.staff_reviewer_login_readiness() readiness;

  IF NOT FOUND
     OR v_active_owner_count <> 1
     OR v_usable_reviewer_count <> 1
     OR v_assignment_ready_count <> 1
     OR v_active_identity_ready_count <> 1
     OR v_membership_ready_count <> 1
     OR v_password_ready_count <> 1
     OR v_mfa_enrolled_ready_count <> 0
     OR v_login_ready_count <> 0
  THEN
    RAISE EXCEPTION 'owner-access password-reset readiness is not exact'
      USING ERRCODE = '23514';
  END IF;

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
    RAISE EXCEPTION 'owner-access subject cardinality is %', v_candidate_count
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
  JOIN auth.credential_states credential
    ON credential.user_id = subject."id"
  WHERE subject."status" = 'ACTIVE'
    AND subject."deletedAt" IS NULL
    AND subject."email" = lower(btrim(subject."email"))
    AND subject."email" ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$'
    AND subject."passwordHash" ~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'
    AND subject."mfaEnabled" = false
    AND subject."mfaSecret" IS NULL
    AND subject."mfaBackup" IS NULL
    AND credential.credential_version > 0
    AND (credential.locked_until IS NULL OR credential.locked_until <= now())
    AND credential.mfa_enabled = false
    AND credential.mfa_secret_ciphertext IS NULL
    AND credential.mfa_key_version IS NULL
    AND credential.mfa_backup_hashes IS NULL
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
    RAISE EXCEPTION 'owner-access password-reset subject is not uniquely eligible'
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

ALTER FUNCTION auth.staff_owner_access_password_reset_subject() OWNER TO pc_staff_authority;
REVOKE ALL ON FUNCTION auth.staff_owner_access_password_reset_subject() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.staff_owner_access_password_reset_subject() TO pc_staff_runtime;

DO $p0_owner_access_runtime_grants$
DECLARE
  runtime_role text;
BEGIN
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
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.staff_owner_access_password_reset_subject() FROM %I',
      runtime_role
    );
  END LOOP;
END;
$p0_owner_access_runtime_grants$;

DO $p0_owner_access_boundary_proof$
DECLARE
  table_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc function
    JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
    JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
    WHERE schema.nspname = 'auth'
      AND function.proname = 'staff_owner_access_password_reset_subject'
      AND function.pronargs = 0
      AND function.prosecdef
      AND function.provolatile = 's'
      AND owner.rolname = 'pc_staff_authority'
      AND function.proconfig @> ARRAY['search_path=pg_catalog, pg_temp']::text[]
      AND function.proconfig @> ARRAY['row_security=on']::text[]
      AND function.prosrc !~* '\m(INSERT|UPDATE|DELETE|TRUNCATE|MERGE|CALL|EXECUTE)\M'
      AND function.prosrc !~* '\mkyc_tasks\M'
  ) THEN
    RAISE EXCEPTION 'owner-access password-reset subject boundary is invalid'
      USING ERRCODE = '42501';
  END IF;

  IF NOT has_function_privilege(
    'pc_staff_runtime',
    'auth.staff_owner_access_password_reset_subject()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'pc_staff_runtime owner-access subject EXECUTE grant is missing'
      USING ERRCODE = '42501';
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'public.users',
    'public.user_orgs',
    'public.organizations',
    'auth.staff_assignments',
    'auth.credential_states'
  ]
  LOOP
    IF has_any_column_privilege('pc_staff_runtime', table_name, 'SELECT')
       OR has_any_column_privilege('pc_staff_runtime', table_name, 'INSERT')
       OR has_any_column_privilege('pc_staff_runtime', table_name, 'UPDATE')
       OR has_table_privilege('pc_staff_runtime', table_name, 'DELETE')
       OR has_table_privilege('pc_staff_runtime', table_name, 'TRUNCATE')
       OR has_any_column_privilege('pc_staff_runtime', table_name, 'REFERENCES')
       OR has_table_privilege('pc_staff_runtime', table_name, 'TRIGGER')
    THEN
      RAISE EXCEPTION 'pc_staff_runtime must remain table-free for %', table_name
        USING ERRCODE = '42501';
    END IF;

  END LOOP;
END;
$p0_owner_access_boundary_proof$;
