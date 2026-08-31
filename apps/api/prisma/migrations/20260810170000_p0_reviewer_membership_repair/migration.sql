-- P0 one-time reviewer membership repair authority (#3799).
--
-- Production currently contains one active PLATFORM_OWNER assignment and one
-- active identity, but no usable organization membership, password or TOTP.
-- This migration does not create or change a staff assignment, identity,
-- password, MFA factor or session. It exposes one no-argument, fail-closed
-- SECURITY DEFINER ceremony that can create only the fixed internal platform
-- organization and the single GUEST/default membership required for the human
-- password-reset and TOTP-enrollment path.

DO $p0_reviewer_membership_repair_role$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_reviewer_membership_repair_authority'
  ) THEN
    CREATE ROLE pc_reviewer_membership_repair_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;

  ALTER ROLE pc_reviewer_membership_repair_authority
    NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_reviewer_membership_repair_authority'
      AND (
        rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls
        OR rolcreatedb OR rolcreaterole
      )
  ) THEN
    RAISE EXCEPTION 'reviewer membership repair authority is not confined'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    WHERE granted.rolname = 'pc_reviewer_membership_repair_authority'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles member ON member.oid = membership.member
    WHERE member.rolname = 'pc_reviewer_membership_repair_authority'
  ) THEN
    RAISE EXCEPTION 'reviewer membership repair authority must remain membership-isolated'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_staff_runtime'
      AND rolcanlogin
      AND NOT rolinherit
      AND NOT rolsuper
      AND NOT rolbypassrls
      AND NOT rolcreatedb
      AND NOT rolcreaterole
  ) THEN
    RAISE EXCEPTION 'confined pc_staff_runtime is required'
      USING ERRCODE = '42501';
  END IF;
END;
$p0_reviewer_membership_repair_role$;

DO $p0_reviewer_membership_repair_prerequisites$
BEGIN
  IF to_regprocedure('auth.staff_reviewer_login_readiness()') IS NULL THEN
    RAISE EXCEPTION 'aggregate reviewer login-readiness authority is required'
      USING ERRCODE = '42883';
  END IF;

  IF to_regprocedure('auth.lock_staff_access_event_chain(text)') IS NULL THEN
    RAISE EXCEPTION 'staff audit-chain lock is required'
      USING ERRCODE = '42883';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_catalog.pg_class relation
    JOIN pg_catalog.pg_namespace schema ON schema.oid = relation.relnamespace
    WHERE schema.nspname = 'public'
      AND relation.relname IN ('users', 'user_orgs', 'organizations', 'outbox_entries')
      AND relation.relrowsecurity
      AND relation.relforcerowsecurity
  ) <> 4 THEN
    RAISE EXCEPTION 'identity and outbox tables must remain ENABLE + FORCE RLS'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger trigger
    JOIN pg_catalog.pg_class relation ON relation.oid = trigger.tgrelid
    JOIN pg_catalog.pg_namespace schema ON schema.oid = relation.relnamespace
    WHERE schema.nspname = 'auth'
      AND relation.relname = 'staff_access_events'
      AND trigger.tgname = 'auth_staff_access_events_append_only'
      AND trigger.tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'staff access evidence must remain append-only'
      USING ERRCODE = '42501';
  END IF;
END;
$p0_reviewer_membership_repair_prerequisites$;

GRANT USAGE ON SCHEMA public, auth TO pc_reviewer_membership_repair_authority;

-- Revoke first, then grant the exact read/insert columns required by the fixed
-- function. The authority owns no tables and has no UPDATE/DELETE/TRUNCATE path.
REVOKE ALL PRIVILEGES ON TABLE
  public."users",
  public."user_orgs",
  public."organizations",
  public."outbox_entries",
  auth.staff_assignments,
  auth.staff_access_events
FROM pc_reviewer_membership_repair_authority;

GRANT SELECT (
  "id", "email", "status", "deletedAt"
) ON public."users" TO pc_reviewer_membership_repair_authority;

GRANT SELECT (
  "id", "userId", "organizationId", "role", "status",
  "requested_workspace", "isDefault", "is_org_admin",
  "joinedAt", "activated_at", "revoked_at"
) ON public."user_orgs" TO pc_reviewer_membership_repair_authority;
GRANT INSERT (
  "id", "userId", "organizationId", "role", "status",
  "requested_workspace", "isDefault", "is_org_admin",
  "joinedAt", "activated_at", "revoked_at", "version"
) ON public."user_orgs" TO pc_reviewer_membership_repair_authority;

GRANT SELECT (
  "id", "inn", "name", "type", "status", "tenantId",
  "verifiedAt", "kycStatus", "amlStatus", "sanctionHit"
) ON public."organizations" TO pc_reviewer_membership_repair_authority;
GRANT INSERT (
  "id", "inn", "name", "type", "status", "tenantId",
  "verifiedAt", "kycStatus", "amlStatus", "sanctionHit",
  "createdAt", "updatedAt"
) ON public."organizations" TO pc_reviewer_membership_repair_authority;

GRANT SELECT (
  id, user_id, role, status, valid_from, valid_until,
  activated_at, suspended_at, revoked_at
) ON auth.staff_assignments TO pc_reviewer_membership_repair_authority;

GRANT SELECT, INSERT ON auth.staff_access_events
  TO pc_reviewer_membership_repair_authority;
GRANT SELECT, INSERT ON public."outbox_entries"
  TO pc_reviewer_membership_repair_authority;
GRANT EXECUTE ON FUNCTION auth.staff_reviewer_login_readiness()
  TO pc_reviewer_membership_repair_authority;
GRANT EXECUTE ON FUNCTION auth.lock_staff_access_event_chain(text)
  TO pc_reviewer_membership_repair_authority;

-- FORCE-RLS marker policies. The marker is transaction-local and the admitted
-- role is NOLOGIN, has no members and is reachable only as the fixed function
-- owner. The LOGIN runtime cannot SET ROLE into this authority.
DROP POLICY IF EXISTS users_reviewer_membership_repair_select
  ON public."users";
CREATE POLICY users_reviewer_membership_repair_select
ON public."users"
FOR SELECT TO pc_reviewer_membership_repair_authority
USING (
  current_user = 'pc_reviewer_membership_repair_authority'
  AND current_setting('app.reviewer_membership_repair_scope', true) = 'single'
  AND EXISTS (
    SELECT 1
    FROM auth.staff_assignments assignment
    WHERE assignment.user_id = public."users"."id"
      AND assignment.role = 'PLATFORM_OWNER'
      AND assignment.status = 'ACTIVE'
      AND assignment.activated_at IS NOT NULL
      AND assignment.suspended_at IS NULL
      AND assignment.revoked_at IS NULL
      AND assignment.valid_from <= now()
      AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
  )
);

DROP POLICY IF EXISTS organizations_reviewer_membership_repair_select
  ON public."organizations";
CREATE POLICY organizations_reviewer_membership_repair_select
ON public."organizations"
FOR SELECT TO pc_reviewer_membership_repair_authority
USING (
  current_user = 'pc_reviewer_membership_repair_authority'
  AND current_setting('app.reviewer_membership_repair_scope', true) = 'single'
  AND (
    "id" = 'org_pc_internal_platform_v1'
    OR "inn" = '0000000000'
    OR "tenantId" = 'tenant_pc_internal_platform_v1'
  )
);

DROP POLICY IF EXISTS organizations_reviewer_membership_repair_insert
  ON public."organizations";
CREATE POLICY organizations_reviewer_membership_repair_insert
ON public."organizations"
FOR INSERT TO pc_reviewer_membership_repair_authority
WITH CHECK (
  current_user = 'pc_reviewer_membership_repair_authority'
  AND current_setting('app.reviewer_membership_repair_scope', true) = 'single'
  AND "id" = 'org_pc_internal_platform_v1'
  AND "inn" = '0000000000'
  AND "name" = 'Прозрачная Цена — внутренний контур'
  AND "type" = 'PLATFORM_INTERNAL'
  AND "status" = 'VERIFIED'
  AND "tenantId" = 'tenant_pc_internal_platform_v1'
  AND "verifiedAt" IS NOT NULL
  AND "kycStatus" = 'VERIFIED'
  AND "amlStatus" = 'CLEAR'
  AND "sanctionHit" = false
);

DROP POLICY IF EXISTS user_orgs_reviewer_membership_repair_select
  ON public."user_orgs";
CREATE POLICY user_orgs_reviewer_membership_repair_select
ON public."user_orgs"
FOR SELECT TO pc_reviewer_membership_repair_authority
USING (
  current_user = 'pc_reviewer_membership_repair_authority'
  AND current_setting('app.reviewer_membership_repair_scope', true) = 'single'
  AND (
    "id" = 'membership_pc_reviewer_internal_v1'
    OR EXISTS (
      SELECT 1
      FROM auth.staff_assignments assignment
      WHERE assignment.user_id = public."user_orgs"."userId"
        AND assignment.role = 'PLATFORM_OWNER'
        AND assignment.status = 'ACTIVE'
        AND assignment.activated_at IS NOT NULL
        AND assignment.suspended_at IS NULL
        AND assignment.revoked_at IS NULL
        AND assignment.valid_from <= now()
        AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
    )
  )
);

DROP POLICY IF EXISTS user_orgs_reviewer_membership_repair_insert
  ON public."user_orgs";
CREATE POLICY user_orgs_reviewer_membership_repair_insert
ON public."user_orgs"
FOR INSERT TO pc_reviewer_membership_repair_authority
WITH CHECK (
  current_user = 'pc_reviewer_membership_repair_authority'
  AND current_setting('app.reviewer_membership_repair_scope', true) = 'single'
  AND "id" = 'membership_pc_reviewer_internal_v1'
  AND "organizationId" = 'org_pc_internal_platform_v1'
  AND "role" = 'GUEST'
  AND "status" = 'ACTIVE'
  AND "requested_workspace" = 'employee'
  AND "isDefault" = true
  AND "is_org_admin" = true
  AND "activated_at" IS NOT NULL
  AND "revoked_at" IS NULL
  AND EXISTS (
    SELECT 1
    FROM auth.staff_assignments assignment
    WHERE assignment.user_id = public."user_orgs"."userId"
      AND assignment.role = 'PLATFORM_OWNER'
      AND assignment.status = 'ACTIVE'
      AND assignment.activated_at IS NOT NULL
      AND assignment.suspended_at IS NULL
      AND assignment.revoked_at IS NULL
      AND assignment.valid_from <= now()
      AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
  )
);

DROP POLICY IF EXISTS outbox_entries_reviewer_membership_repair_select
  ON public."outbox_entries";
CREATE POLICY outbox_entries_reviewer_membership_repair_select
ON public."outbox_entries"
FOR SELECT TO pc_reviewer_membership_repair_authority
USING (
  current_user = 'pc_reviewer_membership_repair_authority'
  AND current_setting('app.reviewer_membership_repair_scope', true) = 'single'
  AND "type" = 'auth.staff.reviewer.membership.repaired'
  AND "idempotencyKey" = 'p0-reviewer-membership-repair:v1'
);

DROP POLICY IF EXISTS outbox_entries_reviewer_membership_repair_insert
  ON public."outbox_entries";
CREATE POLICY outbox_entries_reviewer_membership_repair_insert
ON public."outbox_entries"
FOR INSERT TO pc_reviewer_membership_repair_authority
WITH CHECK (
  current_user = 'pc_reviewer_membership_repair_authority'
  AND current_setting('app.reviewer_membership_repair_scope', true) = 'single'
  AND "id" = 'outbox_p0_reviewer_membership_repair_v1'
  AND "type" = 'auth.staff.reviewer.membership.repaired'
  AND "dealId" IS NULL
  AND "status" = 'PENDING'
  AND "triggeredByUserId" IS NULL
  AND "idempotencyKey" = 'p0-reviewer-membership-repair:v1'
  AND "maxRetries" = 5
  AND "retryCount" = 0
  AND "correlationId" = 'p0-reviewer-membership-repair-v1'
  AND "auditId" = 'sae_p0_reviewer_membership_repair_v1'
  AND "payload" ->> 'schemaVersion' = 'auth.staff.reviewer.membership.repaired.v1'
  AND "payload" ->> 'organizationKind' = 'PLATFORM_INTERNAL'
  AND "payload" ->> 'membershipRole' = 'GUEST'
  AND "payload" ->> 'auditId' = 'sae_p0_reviewer_membership_repair_v1'
  AND "payload" ->> 'correlationId' = 'p0-reviewer-membership-repair-v1'
);

CREATE OR REPLACE FUNCTION auth.repair_single_reviewer_membership()
RETURNS TABLE (
  result_code text,
  assignment_ready_count integer,
  active_identity_ready_count integer,
  membership_ready_count integer,
  password_ready_count integer,
  mfa_enrolled_ready_count integer,
  login_ready_count integer,
  internal_organization_count integer,
  internal_membership_count integer,
  audit_event_count integer,
  outbox_event_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET row_security = on
AS $function$
DECLARE
  v_assignment_count integer;
  v_identity_count integer;
  v_membership_ready_count integer;
  v_password_count integer;
  v_mfa_count integer;
  v_login_count integer;
  v_user_id text;
  v_assignment_id text;
  v_candidate_count integer;
  v_candidate_membership_count integer;
  v_fixed_membership_collision_count integer;
  v_organization_candidate_count integer;
  v_exact_organization_count integer;
  v_exact_membership_count integer;
  v_audit_count integer;
  v_outbox_count integer;
  v_prev_hash text;
  v_audit_hash text;
  v_audit_material jsonb;
  v_outbox_payload jsonb;
  v_result text := 'REPAIRED';
BEGIN
  IF session_user <> 'pc_staff_runtime' THEN
    RAISE EXCEPTION 'reviewer membership repair caller denied'
      USING ERRCODE = '42501';
  END IF;

  IF current_setting('transaction_isolation') <> 'serializable' THEN
    RAISE EXCEPTION 'reviewer membership repair requires SERIALIZABLE transaction'
      USING ERRCODE = '25001';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('auth.repair_single_reviewer_membership.v1', 0)
  );
  PERFORM pg_catalog.set_config(
    'app.reviewer_membership_repair_scope',
    'single',
    true
  );

  SELECT
    readiness.assignment_ready_count,
    readiness.active_identity_ready_count,
    readiness.membership_ready_count,
    readiness.password_ready_count,
    readiness.mfa_enrolled_ready_count,
    readiness.login_ready_count
  INTO
    v_assignment_count,
    v_identity_count,
    v_membership_ready_count,
    v_password_count,
    v_mfa_count,
    v_login_count
  FROM auth.staff_reviewer_login_readiness() readiness;

  IF v_assignment_count <> 1
     OR v_identity_count <> 1
     OR v_password_count <> 0
     OR v_mfa_count <> 0
     OR v_login_count <> 0
     OR v_membership_ready_count NOT IN (0, 1)
  THEN
    RAISE EXCEPTION 'reviewer membership repair structural precondition failed'
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::integer, min(assignment.user_id), min(assignment.id)
  INTO v_candidate_count, v_user_id, v_assignment_id
  FROM auth.staff_assignments assignment
  JOIN public."users" subject ON subject."id" = assignment.user_id
  WHERE assignment.role = 'PLATFORM_OWNER'
    AND assignment.status = 'ACTIVE'
    AND assignment.activated_at IS NOT NULL
    AND assignment.suspended_at IS NULL
    AND assignment.revoked_at IS NULL
    AND assignment.valid_from <= now()
    AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
    AND subject."status" = 'ACTIVE'
    AND subject."deletedAt" IS NULL
    AND subject."email" = lower(btrim(subject."email"))
    AND position('@' IN subject."email") > 1;

  IF v_candidate_count <> 1
     OR coalesce(v_user_id, '') = ''
     OR coalesce(v_assignment_id, '') = ''
  THEN
    RAISE EXCEPTION 'unique active PLATFORM_OWNER identity is required'
      USING ERRCODE = '23514';
  END IF;

  PERFORM auth.lock_staff_access_event_chain(v_user_id);

  SELECT count(*)::integer
  INTO v_candidate_membership_count
  FROM public."user_orgs" membership
  WHERE membership."userId" = v_user_id;

  SELECT count(*)::integer
  INTO v_fixed_membership_collision_count
  FROM public."user_orgs" membership
  WHERE membership."id" = 'membership_pc_reviewer_internal_v1'
    AND (
      membership."userId" <> v_user_id
      OR membership."organizationId" <> 'org_pc_internal_platform_v1'
    );

  IF v_fixed_membership_collision_count <> 0 THEN
    RAISE EXCEPTION 'fixed reviewer membership identifier is already occupied'
      USING ERRCODE = '23505';
  END IF;

  SELECT
    count(*)::integer,
    count(*) FILTER (
      WHERE organization."id" = 'org_pc_internal_platform_v1'
        AND organization."inn" = '0000000000'
        AND organization."name" = 'Прозрачная Цена — внутренний контур'
        AND organization."type" = 'PLATFORM_INTERNAL'
        AND organization."status" = 'VERIFIED'
        AND organization."tenantId" = 'tenant_pc_internal_platform_v1'
        AND organization."verifiedAt" IS NOT NULL
        AND organization."kycStatus" = 'VERIFIED'
        AND organization."amlStatus" = 'CLEAR'
        AND organization."sanctionHit" = false
    )::integer
  INTO v_organization_candidate_count, v_exact_organization_count
  FROM public."organizations" organization
  WHERE organization."id" = 'org_pc_internal_platform_v1'
     OR organization."inn" = '0000000000'
     OR organization."tenantId" = 'tenant_pc_internal_platform_v1';

  IF v_organization_candidate_count = 0 THEN
    INSERT INTO public."organizations" (
      "id", "inn", "name", "type", "status", "tenantId",
      "verifiedAt", "kycStatus", "amlStatus", "sanctionHit",
      "createdAt", "updatedAt"
    ) VALUES (
      'org_pc_internal_platform_v1',
      '0000000000',
      'Прозрачная Цена — внутренний контур',
      'PLATFORM_INTERNAL',
      'VERIFIED',
      'tenant_pc_internal_platform_v1',
      clock_timestamp(),
      'VERIFIED',
      'CLEAR',
      false,
      clock_timestamp(),
      clock_timestamp()
    );
    v_exact_organization_count := 1;
  ELSIF v_organization_candidate_count <> 1 OR v_exact_organization_count <> 1 THEN
    RAISE EXCEPTION 'internal platform organization identifiers conflict'
      USING ERRCODE = '23505';
  END IF;

  SELECT count(*)::integer
  INTO v_exact_membership_count
  FROM public."user_orgs" membership
  WHERE membership."id" = 'membership_pc_reviewer_internal_v1'
    AND membership."userId" = v_user_id
    AND membership."organizationId" = 'org_pc_internal_platform_v1'
    AND membership."role" = 'GUEST'
    AND membership."status" = 'ACTIVE'
    AND membership."requested_workspace" = 'employee'
    AND membership."isDefault" = true
    AND membership."is_org_admin" = true
    AND membership."activated_at" IS NOT NULL
    AND membership."revoked_at" IS NULL;

  IF v_candidate_membership_count = 0 THEN
    IF v_membership_ready_count <> 0 OR v_exact_membership_count <> 0 THEN
      RAISE EXCEPTION 'reviewer membership pre-state is inconsistent'
        USING ERRCODE = '23514';
    END IF;

    INSERT INTO public."user_orgs" (
      "id", "userId", "organizationId", "role", "status",
      "requested_workspace", "isDefault", "is_org_admin",
      "joinedAt", "activated_at", "revoked_at", "version"
    ) VALUES (
      'membership_pc_reviewer_internal_v1',
      v_user_id,
      'org_pc_internal_platform_v1',
      'GUEST',
      'ACTIVE',
      'employee',
      true,
      true,
      clock_timestamp(),
      clock_timestamp(),
      NULL,
      0
    );
    v_exact_membership_count := 1;
  ELSIF v_candidate_membership_count = 1
        AND v_exact_membership_count = 1
        AND v_membership_ready_count = 1
  THEN
    v_result := 'ALREADY_REPAIRED';
  ELSE
    RAISE EXCEPTION 'reviewer has a conflicting pre-existing membership state'
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::integer
  INTO v_audit_count
  FROM auth.staff_access_events event
  WHERE event.id = 'sae_p0_reviewer_membership_repair_v1'
    AND event.actor_user_id = v_user_id
    AND event.staff_role = 'PLATFORM_OWNER'
    AND event.action = 'staff.identity.membership.repaired'
    AND event.resource_type = 'user_org_membership'
    AND event.resource_id = 'membership_pc_reviewer_internal_v1'
    AND event.outcome = 'SUCCESS'
    AND event.reason = 'P0_REVIEWER_MEMBERSHIP_REPAIR_3799'
    AND event.correlation_id = 'p0-reviewer-membership-repair-v1'
    AND event.hash ~ '^[0-9a-f]{64}$';

  IF v_audit_count = 0 THEN
    SELECT event.hash
    INTO v_prev_hash
    FROM auth.staff_access_events event
    WHERE event.actor_user_id = v_user_id
    ORDER BY event.created_at DESC, event.id DESC
    LIMIT 1;

    v_audit_material := pg_catalog.jsonb_build_object(
      'id', 'sae_p0_reviewer_membership_repair_v1',
      'actorUserId', v_user_id,
      'staffRole', 'PLATFORM_OWNER',
      'action', 'staff.identity.membership.repaired',
      'resourceType', 'user_org_membership',
      'resourceId', 'membership_pc_reviewer_internal_v1',
      'outcome', 'SUCCESS',
      'reason', 'P0_REVIEWER_MEMBERSHIP_REPAIR_3799',
      'correlationId', 'p0-reviewer-membership-repair-v1',
      'metadata', pg_catalog.jsonb_build_object(
        'schemaVersion', 'auth.staff.reviewer.membership.repaired.v1',
        'organizationKind', 'PLATFORM_INTERNAL',
        'membershipRole', 'GUEST',
        'oneTime', true
      ),
      'prevHash', v_prev_hash
    );
    v_audit_hash := pg_catalog.encode(
      public.digest(pg_catalog.convert_to(v_audit_material::text, 'UTF8'), 'sha256'),
      'hex'
    );

    INSERT INTO auth.staff_access_events (
      id, actor_user_id, staff_role, access_session_id, grant_id,
      effective_tenant_id, effective_organization_id, effective_user_id,
      effective_role, access_mode, action, resource_type, resource_id,
      outcome, reason, ticket_id, correlation_id, metadata, prev_hash, hash,
      created_at
    ) VALUES (
      'sae_p0_reviewer_membership_repair_v1',
      v_user_id,
      'PLATFORM_OWNER',
      NULL,
      NULL,
      'tenant_pc_internal_platform_v1',
      'org_pc_internal_platform_v1',
      v_user_id,
      'GUEST',
      NULL,
      'staff.identity.membership.repaired',
      'user_org_membership',
      'membership_pc_reviewer_internal_v1',
      'SUCCESS',
      'P0_REVIEWER_MEMBERSHIP_REPAIR_3799',
      NULL,
      'p0-reviewer-membership-repair-v1',
      pg_catalog.jsonb_build_object(
        'schemaVersion', 'auth.staff.reviewer.membership.repaired.v1',
        'organizationKind', 'PLATFORM_INTERNAL',
        'membershipRole', 'GUEST',
        'oneTime', true
      ),
      v_prev_hash,
      v_audit_hash,
      clock_timestamp()
    );
    v_audit_count := 1;
  ELSIF v_audit_count <> 1 THEN
    RAISE EXCEPTION 'reviewer membership repair audit evidence conflicts'
      USING ERRCODE = '23505';
  END IF;

  SELECT event.hash
  INTO v_audit_hash
  FROM auth.staff_access_events event
  WHERE event.id = 'sae_p0_reviewer_membership_repair_v1'
    AND event.actor_user_id = v_user_id;

  v_outbox_payload := pg_catalog.jsonb_build_object(
    'schemaVersion', 'auth.staff.reviewer.membership.repaired.v1',
    'organizationKind', 'PLATFORM_INTERNAL',
    'membershipRole', 'GUEST',
    'auditId', 'sae_p0_reviewer_membership_repair_v1',
    'auditHash', v_audit_hash,
    'correlationId', 'p0-reviewer-membership-repair-v1'
  );

  SELECT count(*)::integer
  INTO v_outbox_count
  FROM public."outbox_entries" entry
  WHERE entry."id" = 'outbox_p0_reviewer_membership_repair_v1'
    AND entry."type" = 'auth.staff.reviewer.membership.repaired'
    AND entry."dealId" IS NULL
    AND entry."triggeredByUserId" IS NULL
    AND entry."idempotencyKey" = 'p0-reviewer-membership-repair:v1'
    AND entry."correlationId" = 'p0-reviewer-membership-repair-v1'
    AND entry."auditId" = 'sae_p0_reviewer_membership_repair_v1'
    AND entry."payload" = v_outbox_payload;

  IF v_outbox_count = 0 THEN
    INSERT INTO public."outbox_entries" (
      "id", "type", "dealId", "payload", "status", "triggeredByUserId",
      "idempotencyKey", "maxRetries", "retryCount", "nextRetryAt",
      "correlationId", "auditId", "createdAt"
    ) VALUES (
      'outbox_p0_reviewer_membership_repair_v1',
      'auth.staff.reviewer.membership.repaired',
      NULL,
      v_outbox_payload,
      'PENDING',
      NULL,
      'p0-reviewer-membership-repair:v1',
      5,
      0,
      clock_timestamp(),
      'p0-reviewer-membership-repair-v1',
      'sae_p0_reviewer_membership_repair_v1',
      clock_timestamp()
    );
    v_outbox_count := 1;
  ELSIF v_outbox_count <> 1 THEN
    RAISE EXCEPTION 'reviewer membership repair outbox evidence conflicts'
      USING ERRCODE = '23505';
  END IF;

  SELECT
    readiness.assignment_ready_count,
    readiness.active_identity_ready_count,
    readiness.membership_ready_count,
    readiness.password_ready_count,
    readiness.mfa_enrolled_ready_count,
    readiness.login_ready_count
  INTO
    v_assignment_count,
    v_identity_count,
    v_membership_ready_count,
    v_password_count,
    v_mfa_count,
    v_login_count
  FROM auth.staff_reviewer_login_readiness() readiness;

  IF v_assignment_count <> 1
     OR v_identity_count <> 1
     OR v_membership_ready_count <> 1
     OR v_password_count <> 0
     OR v_mfa_count <> 0
     OR v_login_count <> 0
     OR v_exact_organization_count <> 1
     OR v_exact_membership_count <> 1
     OR v_audit_count <> 1
     OR v_outbox_count <> 1
  THEN
    RAISE EXCEPTION 'reviewer membership repair postcondition failed'
      USING ERRCODE = '23514';
  END IF;

  RETURN QUERY SELECT
    v_result,
    v_assignment_count,
    v_identity_count,
    v_membership_ready_count,
    v_password_count,
    v_mfa_count,
    v_login_count,
    v_exact_organization_count,
    v_exact_membership_count,
    v_audit_count,
    v_outbox_count;
END;
$function$;

ALTER FUNCTION auth.repair_single_reviewer_membership()
  OWNER TO pc_reviewer_membership_repair_authority;
REVOKE ALL ON FUNCTION auth.repair_single_reviewer_membership() FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO pc_staff_runtime;
GRANT EXECUTE ON FUNCTION auth.repair_single_reviewer_membership()
  TO pc_staff_runtime;

DO $p0_reviewer_membership_repair_runtime_revocations$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_auth_runtime', 'pc_deal_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
      'one_deal_auth', 'one_deal_app', 'one_deal_staff', 'one_deal_storage',
      'app_auth', 'app_runtime', 'app_staff', 'app_storage', 'app_outbox',
      'app_service'
    )
  LOOP
    EXECUTE pg_catalog.format(
      'REVOKE ALL ON FUNCTION auth.repair_single_reviewer_membership() FROM %I',
      runtime_role
    );
  END LOOP;
END;
$p0_reviewer_membership_repair_runtime_revocations$;

DO $p0_reviewer_membership_repair_proof$
DECLARE
  function_definition text;
  relation_name text;
  privilege_name text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(function.oid)
  INTO function_definition
  FROM pg_catalog.pg_proc function
  JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
  JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
  WHERE schema.nspname = 'auth'
    AND function.proname = 'repair_single_reviewer_membership'
    AND function.pronargs = 0
    AND function.prosecdef
    AND owner.rolname = 'pc_reviewer_membership_repair_authority';

  IF function_definition IS NULL
     OR function_definition NOT LIKE '%SET row_security TO ''on''%'
     OR function_definition NOT LIKE '%session_user <> ''pc_staff_runtime''%'
     OR function_definition NOT LIKE '%transaction_isolation%serializable%'
     OR function_definition NOT LIKE '%org_pc_internal_platform_v1%'
     OR function_definition NOT LIKE '%membership_pc_reviewer_internal_v1%'
     OR function_definition NOT LIKE '%auth.staff.reviewer.membership.repaired%'
     OR function_definition NOT LIKE '%P0_REVIEWER_MEMBERSHIP_REPAIR_3799%'
  THEN
    RAISE EXCEPTION 'reviewer membership repair function is not fixed and bounded'
      USING ERRCODE = '42501';
  END IF;

  IF NOT has_function_privilege(
    'pc_staff_runtime',
    'auth.repair_single_reviewer_membership()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'pc_staff_runtime repair EXECUTE grant is missing'
      USING ERRCODE = '42501';
  END IF;

  FOREACH relation_name IN ARRAY ARRAY[
    'public.users',
    'public.user_orgs',
    'public.organizations',
    'public.outbox_entries',
    'auth.staff_assignments',
    'auth.staff_access_events'
  ]
  LOOP
    FOREACH privilege_name IN ARRAY ARRAY['UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
    LOOP
      IF has_table_privilege(
        'pc_reviewer_membership_repair_authority',
        relation_name,
        privilege_name
      ) THEN
        RAISE EXCEPTION 'reviewer repair authority received % on %',
          privilege_name,
          relation_name
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END LOOP;

  IF has_table_privilege('pc_staff_runtime', 'public.users', 'SELECT')
     OR has_table_privilege('pc_staff_runtime', 'public.user_orgs', 'SELECT')
     OR has_table_privilege('pc_staff_runtime', 'public.organizations', 'SELECT')
     OR has_table_privilege('pc_staff_runtime', 'public.outbox_entries', 'INSERT')
     OR has_table_privilege('pc_staff_runtime', 'auth.staff_assignments', 'SELECT')
     OR has_table_privilege('pc_staff_runtime', 'auth.staff_access_events', 'INSERT')
  THEN
    RAISE EXCEPTION 'pc_staff_runtime must remain function-only for reviewer repair'
      USING ERRCODE = '42501';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_catalog.pg_policies policy
    WHERE policy.policyname IN (
      'users_reviewer_membership_repair_select',
      'organizations_reviewer_membership_repair_select',
      'organizations_reviewer_membership_repair_insert',
      'user_orgs_reviewer_membership_repair_select',
      'user_orgs_reviewer_membership_repair_insert',
      'outbox_entries_reviewer_membership_repair_select',
      'outbox_entries_reviewer_membership_repair_insert'
    )
  ) <> 7 THEN
    RAISE EXCEPTION 'reviewer membership repair RLS policy set is incomplete'
      USING ERRCODE = '42501';
  END IF;
END;
$p0_reviewer_membership_repair_proof$;
