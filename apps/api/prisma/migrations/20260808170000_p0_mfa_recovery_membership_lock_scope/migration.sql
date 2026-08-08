-- The organization MFA-recovery preparation authority updates only the target
-- membership version.  Locking the joined user row would also require UPDATE
-- authority on public.users, widening the organization-command principal far
-- beyond that fixed tuple.  Keep the serializable membership CAS lock while
-- treating user state as a read-only eligibility input; confirmation performs
-- its own current identity/password checks under the recovery-token authority.

CREATE OR REPLACE FUNCTION auth.prepare_organization_mfa_recovery_target(
  p_session_id text,
  p_actor_user_id text,
  p_actor_membership_id text,
  p_organization_id text,
  p_tenant_id text,
  p_target_membership_id text,
  p_expected_version bigint
)
RETURNS TABLE (
  prepared boolean,
  target_user_id text,
  target_email text,
  has_other_membership boolean,
  has_staff_assignment boolean,
  mfa_enabled boolean,
  has_mfa_secret boolean,
  new_version bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
DECLARE
  target record;
  affected integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.resolve_organization_admin_session(
      p_session_id, p_actor_user_id, p_actor_membership_id,
      p_organization_id, p_tenant_id
    )
  ) OR p_target_membership_id = p_actor_membership_id THEN
    RAISE EXCEPTION 'Organization administrator authority is required'
      USING ERRCODE = '42501';
  END IF;

  SELECT membership."userId" AS user_id, subject."email",
         credential.mfa_enabled,
         credential.mfa_secret_ciphertext IS NOT NULL AS has_mfa_secret,
         EXISTS (
           SELECT 1 FROM public."user_orgs" other_membership
           WHERE other_membership."userId" = membership."userId"
             AND other_membership."organizationId" <> membership."organizationId"
             AND other_membership."status" IN ('PENDING', 'ACTIVE', 'SUSPENDED')
         ) AS has_other_membership,
         EXISTS (
           SELECT 1 FROM auth.staff_assignments assignment
           WHERE assignment.user_id = membership."userId"
             AND assignment.status IN ('ELIGIBLE', 'ACTIVE')
             AND assignment.valid_from <= now()
             AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
         ) AS has_staff_assignment
  INTO target
  FROM public."user_orgs" membership
  JOIN public."organizations" organization
    ON organization."id" = membership."organizationId"
   AND organization."tenantId" = p_tenant_id
   AND organization."status" = 'VERIFIED'
  JOIN public."users" subject
    ON subject."id" = membership."userId"
   AND subject."status" = 'ACTIVE'
   AND subject."deletedAt" IS NULL
  JOIN auth.credential_states credential ON credential.user_id = subject."id"
  WHERE membership."id" = p_target_membership_id
    AND membership."organizationId" = p_organization_id
    AND membership."status" = 'ACTIVE'
    AND membership."version" = p_expected_version
  FOR UPDATE OF membership;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF target.has_other_membership OR target.has_staff_assignment
     OR NOT target.mfa_enabled OR NOT target.has_mfa_secret THEN
    RETURN QUERY SELECT false, target.user_id, target."email",
      target.has_other_membership, target.has_staff_assignment,
      target.mfa_enabled, target.has_mfa_secret, p_expected_version;
    RETURN;
  END IF;

  UPDATE public."user_orgs"
  SET "version" = "version" + 1
  WHERE "id" = p_target_membership_id
    AND "organizationId" = p_organization_id
    AND "status" = 'ACTIVE'
    AND "version" = p_expected_version;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT true, target.user_id, target."email",
    false, false, true, true, p_expected_version + 1;
END;
$function$;

CREATE OR REPLACE FUNCTION auth.resolve_mfa_recovery_identity(
  p_challenge_id text,
  p_token_hash text
)
RETURNS TABLE (
  id text, user_id text, membership_id text, organization_id text,
  tenant_id text, token_hash text, status text, expires_at timestamptz,
  attempts integer, max_attempts integer, version bigint, email text,
  password_hash text, user_status text, user_deleted_at timestamptz,
  membership_status text, organization_status text,
  has_other_membership boolean, has_staff_assignment boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
BEGIN
  RETURN QUERY
  SELECT challenge.id, challenge.user_id, challenge.membership_id,
         challenge.organization_id, challenge.tenant_id, challenge.token_hash,
         challenge.status, challenge.expires_at, challenge.attempts,
         challenge.max_attempts, challenge.version, subject."email",
         subject."passwordHash", subject."status",
         subject."deletedAt"::timestamptz,
         membership."status", organization."status",
         EXISTS (
           SELECT 1 FROM public."user_orgs" other_membership
           WHERE other_membership."userId" = challenge.user_id
             AND other_membership."organizationId" <> challenge.organization_id
             AND other_membership."status" IN ('PENDING', 'ACTIVE', 'SUSPENDED')
         ),
         EXISTS (
           SELECT 1 FROM auth.staff_assignments assignment
           WHERE assignment.user_id = challenge.user_id
             AND assignment.status IN ('ELIGIBLE', 'ACTIVE')
             AND assignment.valid_from <= now()
             AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
         )
  FROM auth.mfa_recovery_challenges challenge
  JOIN public."users" subject ON subject."id" = challenge.user_id
  JOIN public."user_orgs" membership
    ON membership."id" = challenge.membership_id
   AND membership."userId" = challenge.user_id
   AND membership."organizationId" = challenge.organization_id
  JOIN public."organizations" organization
    ON organization."id" = challenge.organization_id
   AND organization."tenantId" = challenge.tenant_id
  WHERE challenge.id = p_challenge_id
    AND challenge.token_hash = p_token_hash
    AND challenge.status = 'PENDING'
  FOR UPDATE OF challenge, subject;
END;
$function$;

CREATE OR REPLACE FUNCTION auth.finalize_mfa_recovery_identity(
  p_challenge_id text,
  p_token_hash text,
  p_expected_password_hash text,
  p_expected_version bigint
)
RETURNS TABLE (
  user_id text, membership_id text, organization_id text,
  tenant_id text, email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
DECLARE
  challenge record;
  affected integer;
BEGIN
  SELECT candidate.id, candidate.user_id, candidate.membership_id,
         candidate.organization_id, candidate.tenant_id,
         candidate.version, subject."email"
  INTO challenge
  FROM auth.mfa_recovery_challenges candidate
  JOIN public."users" subject
    ON subject."id" = candidate.user_id
   AND subject."status" = 'ACTIVE'
   AND subject."deletedAt" IS NULL
   AND subject."passwordHash" = p_expected_password_hash
  JOIN public."user_orgs" membership
    ON membership."id" = candidate.membership_id
   AND membership."userId" = candidate.user_id
   AND membership."organizationId" = candidate.organization_id
   AND membership."status" = 'ACTIVE'
  JOIN public."organizations" organization
    ON organization."id" = candidate.organization_id
   AND organization."tenantId" = candidate.tenant_id
   AND organization."status" = 'VERIFIED'
  WHERE candidate.id = p_challenge_id
    AND candidate.token_hash = p_token_hash
    AND candidate.status = 'PENDING'
    AND candidate.version = p_expected_version
    AND candidate.expires_at > now()
    AND NOT EXISTS (
      SELECT 1 FROM public."user_orgs" other_membership
      WHERE other_membership."userId" = candidate.user_id
        AND other_membership."organizationId" <> candidate.organization_id
        AND other_membership."status" IN ('PENDING', 'ACTIVE', 'SUSPENDED')
    )
    AND NOT EXISTS (
      SELECT 1 FROM auth.staff_assignments assignment
      WHERE assignment.user_id = candidate.user_id
        AND assignment.status IN ('ELIGIBLE', 'ACTIVE')
        AND assignment.valid_from <= now()
        AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
    )
  FOR UPDATE OF candidate, subject;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE auth.credential_states credential
  SET mfa_enabled = true, mfa_secret_ciphertext = NULL,
      mfa_key_version = NULL, mfa_backup_hashes = NULL,
      credential_version = credential.credential_version + 1, updated_at = now()
  WHERE credential.user_id = challenge.user_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RETURN;
  END IF;
  UPDATE public."users"
  SET "mfaEnabled" = true, "updatedAt" = now()
  WHERE "id" = challenge.user_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RETURN;
  END IF;
  UPDATE auth.mfa_recovery_challenges
  SET status = 'CONSUMED', consumed_at = now(),
      version = version + 1, updated_at = now()
  WHERE id = challenge.id AND status = 'PENDING' AND version = challenge.version;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT challenge.user_id, challenge.membership_id,
    challenge.organization_id, challenge.tenant_id, challenge."email";
END;
$function$;

ALTER FUNCTION auth.prepare_organization_mfa_recovery_target(
  text,text,text,text,text,text,bigint
) OWNER TO pc_organization_membership_command_authority;
ALTER FUNCTION auth.resolve_mfa_recovery_identity(text,text)
  OWNER TO pc_mfa_recovery_identity_authority;
ALTER FUNCTION auth.finalize_mfa_recovery_identity(text,text,text,bigint)
  OWNER TO pc_mfa_recovery_identity_authority;
REVOKE ALL ON FUNCTION auth.prepare_organization_mfa_recovery_target(
  text,text,text,text,text,text,bigint
) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.resolve_mfa_recovery_identity(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.finalize_mfa_recovery_identity(text,text,text,bigint) FROM PUBLIC;

DO $mfa_recovery_membership_lock_runtime_grants$
DECLARE
  runtime_role text;
  function_signature text;
  function_signatures text[] := ARRAY[
    'auth.prepare_organization_mfa_recovery_target(text,text,text,text,text,text,bigint)',
    'auth.resolve_mfa_recovery_identity(text,text)',
    'auth.finalize_mfa_recovery_identity(text,text,text,bigint)'
  ];
BEGIN
  FOREACH function_signature IN ARRAY function_signatures LOOP
    FOR runtime_role IN
      SELECT rolname FROM pg_catalog.pg_roles
      WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth')
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', function_signature, runtime_role);
    END LOOP;
    FOR runtime_role IN
      SELECT rolname FROM pg_catalog.pg_roles
      WHERE rolname IN (
        'pc_deal_runtime', 'pc_staff_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
        'one_deal_app', 'one_deal_staff', 'one_deal_storage',
        'app_runtime', 'app_staff', 'app_storage', 'app_outbox'
      )
    LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', function_signature, runtime_role);
    END LOOP;
  END LOOP;
END;
$mfa_recovery_membership_lock_runtime_grants$;

DO $mfa_recovery_membership_lock_proof$
DECLARE
  prepare_source text;
  resolve_source text;
  finalize_source text;
BEGIN
  SELECT procedure.prosrc
  INTO prepare_source
  FROM pg_catalog.pg_proc procedure
  JOIN pg_catalog.pg_namespace schema ON schema.oid = procedure.pronamespace
  WHERE schema.nspname = 'auth'
    AND procedure.proname = 'prepare_organization_mfa_recovery_target';

  SELECT procedure.prosrc
  INTO resolve_source
  FROM pg_catalog.pg_proc procedure
  JOIN pg_catalog.pg_namespace schema ON schema.oid = procedure.pronamespace
  WHERE schema.nspname = 'auth'
    AND procedure.proname = 'resolve_mfa_recovery_identity';

  SELECT procedure.prosrc
  INTO finalize_source
  FROM pg_catalog.pg_proc procedure
  JOIN pg_catalog.pg_namespace schema ON schema.oid = procedure.pronamespace
  WHERE schema.nspname = 'auth'
    AND procedure.proname = 'finalize_mfa_recovery_identity';

  IF prepare_source IS NULL
     OR position('FOR UPDATE OF membership;' IN prepare_source) = 0
     OR position('FOR UPDATE OF membership, subject' IN prepare_source) > 0 THEN
    RAISE EXCEPTION 'MFA recovery preparation must lock only the bounded membership row'
      USING ERRCODE = '42501';
  END IF;
  IF resolve_source IS NULL
     OR position('FOR UPDATE OF challenge, subject;' IN resolve_source) = 0
     OR position('FOR UPDATE OF challenge, subject, membership' IN resolve_source) > 0
     OR finalize_source IS NULL
     OR position('FOR UPDATE OF candidate, subject;' IN finalize_source) = 0
     OR position('FOR UPDATE OF candidate, subject, membership' IN finalize_source) > 0 THEN
    RAISE EXCEPTION 'MFA recovery token authority must not lock read-only membership rows'
      USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*)
      FROM pg_catalog.pg_proc procedure
      JOIN pg_catalog.pg_namespace schema ON schema.oid = procedure.pronamespace
      JOIN pg_catalog.pg_roles owner ON owner.oid = procedure.proowner
      WHERE schema.nspname = 'auth'
        AND procedure.proname = 'prepare_organization_mfa_recovery_target'
        AND procedure.prosecdef
        AND owner.rolname = 'pc_organization_membership_command_authority') <> 1
     OR (SELECT count(*)
         FROM pg_catalog.pg_proc procedure
         JOIN pg_catalog.pg_namespace schema ON schema.oid = procedure.pronamespace
         JOIN pg_catalog.pg_roles owner ON owner.oid = procedure.proowner
         WHERE schema.nspname = 'auth'
           AND procedure.proname IN (
             'resolve_mfa_recovery_identity',
             'finalize_mfa_recovery_identity'
           )
           AND procedure.prosecdef
           AND owner.rolname = 'pc_mfa_recovery_identity_authority') <> 2 THEN
    RAISE EXCEPTION 'MFA recovery lock-scope function ownership is invalid'
      USING ERRCODE = '42501';
  END IF;
  IF has_table_privilege(
    'pc_organization_membership_command_authority', 'public.users', 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'Membership command authority must not update users'
      USING ERRCODE = '42501';
  END IF;
  IF has_table_privilege(
    'pc_mfa_recovery_identity_authority', 'public.user_orgs', 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'MFA recovery token authority must not update memberships'
      USING ERRCODE = '42501';
  END IF;
END;
$mfa_recovery_membership_lock_proof$;
