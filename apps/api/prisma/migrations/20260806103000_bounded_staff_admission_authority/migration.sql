-- Bounded staff authority over the identity tables (#3670).
--
-- 20260806090000 put RLS under public.users, public.user_orgs and
-- public.organizations, and admitted admission reviewers through a branch in
-- the generic SELECT policies. That branch was measured and removed: it keyed
-- on public.app_identity_is_reviewer(), which resolves the acting identity from
-- app.current_user_id and app.current_session_id. Both are settings the tenant
-- runtime writes itself. Substituting a real reviewer's user id together with
-- that reviewer's real, live, MFA-verified session id returned every
-- organization and every user in the isolation harness.
--
-- The lesson is not that the predicate was too loose. Row identifiers are not
-- proof of identity, and the secrecy of a session identifier is not a
-- PostgreSQL authority: the tenant runtime can read auth.sessions. Any generic
-- cross-tenant branch reachable by the tenant runtime is forgeable in
-- principle, however many rows the predicate consults.
--
-- So staff read across tenants through a different principal instead, one the
-- tenant runtime cannot become, and only through three fixed functions:
--
--   * the admission queue,
--   * one admission application,
--   * a decision on one application.
--
-- There is no generic cross-tenant SELECT anywhere in this file. Each function
-- demands a capability that is bound to the actor, the staff access session,
-- the secret that session was issued with, the permission, the organization in
-- scope, the MFA level and the remaining time to live — the whole tuple, not a
-- pair of identifiers.

-- 1. Principals ---------------------------------------------------------------
--
-- Two roles, because the authority to read and the ability to invoke must not
-- be the same principal.
--
--   pc_staff_authority  owns the functions and holds the reads they perform.
--                       NOLOGIN, with no members, so the only way its
--                       privileges are ever exercised is through the function
--                       bodies fixed by this migration.
--
--   pc_staff_runtime    is what the staff-facing server connects as. It holds
--                       EXECUTE on the three functions and no table privilege
--                       at all, so a query it writes itself reaches nothing.

DO $staff_authority_roles$
DECLARE
  offending text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_authority') THEN
    CREATE ROLE pc_staff_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;

  -- Created without a password on purpose. Under scram-sha-256 the role cannot
  -- authenticate until ops sets one, so a deployment that reaches this
  -- migration before the staff datasource is provisioned fails closed rather
  -- than opening a login nobody is watching.
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_runtime') THEN
    CREATE ROLE pc_staff_runtime
      LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;

  -- An authority role that could log in would be a second front door into the
  -- data it exists to keep behind three functions.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_staff_authority'
      AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)
  ) THEN
    RAISE EXCEPTION 'Staff authority role is unsafe' USING ERRCODE = '42501';
  END IF;

  -- The staff runtime logs in, so only the privilege attributes are checked.
  -- BYPASSRLS here would defeat every policy below in one attribute.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_staff_runtime'
      AND (rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)
  ) THEN
    RAISE EXCEPTION 'Staff runtime role is unsafe' USING ERRCODE = '42501';
  END IF;

  -- The separation is only real while no other runtime can reach these roles.
  -- A membership would make SET ROLE pc_staff_runtime available to the tenant
  -- runtime, and the whole arrangement would collapse into one principal.
  FOR offending IN
    SELECT member.rolname
    FROM pg_catalog.pg_auth_members m
    JOIN pg_catalog.pg_roles grantee ON grantee.oid = m.roleid
    JOIN pg_catalog.pg_roles member ON member.oid = m.member
    WHERE grantee.rolname IN ('pc_staff_authority', 'pc_staff_runtime')
      AND member.rolname <> grantee.rolname
  LOOP
    EXECUTE format('REVOKE pc_staff_authority FROM %I', offending);
    EXECUTE format('REVOKE pc_staff_runtime FROM %I', offending);
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members m
    JOIN pg_catalog.pg_roles grantee ON grantee.oid = m.roleid
    WHERE grantee.rolname IN ('pc_staff_authority', 'pc_staff_runtime')
  ) THEN
    RAISE EXCEPTION 'Staff roles must have no members' USING ERRCODE = '42501';
  END IF;

  -- And the reverse direction: the staff principals must not inherit a tenant
  -- runtime's privileges either.
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members m
    JOIN pg_catalog.pg_roles member ON member.oid = m.member
    WHERE member.rolname IN ('pc_staff_authority', 'pc_staff_runtime')
  ) THEN
    RAISE EXCEPTION 'Staff roles must not be members of other roles' USING ERRCODE = '42501';
  END IF;
END;
$staff_authority_roles$;

-- 2. Scope markers ------------------------------------------------------------
--
-- The policies below are written against transaction-local settings, which is
-- exactly the pattern this migration's predecessor had to abandon for tenant
-- context. It is sound here for one reason that did not hold there: these
-- policies apply only TO pc_staff_authority, a role with no members and no
-- login. Nothing that can write the setting can be the role that reads it, and
-- the only statements that ever run as that role are the function bodies
-- below, each of which sets the marker itself before it reads.
--
--   app.staff_admission_scope     'queue:pending' for the queue, otherwise the
--                                 single organization id under review.
--   app.staff_admission_decision  the single organization id a decision may
--                                 write, set only by the decision function, so
--                                 the two read functions cannot write.
--
-- A cuid contains no colon, so 'queue:pending' cannot collide with an id.

-- 3. Capability resolution ----------------------------------------------------
--
-- One place decides whether a call is authorized, and it raises rather than
-- returning false, so a caller that forgets to check cannot proceed.
--
-- INVOKER, not DEFINER: it is only ever called from inside the three functions
-- below, which already run as pc_staff_authority. Making it DEFINER would give
-- it an owner's privileges in its own right for no gain.
CREATE OR REPLACE FUNCTION auth.staff_admission_capability(
  p_actor_user_id TEXT,
  p_access_session_id TEXT,
  p_capability_hash TEXT,
  p_permission TEXT,
  p_organization_id TEXT,
  OUT staff_role TEXT,
  OUT grant_id TEXT,
  OUT access_mode TEXT,
  OUT ticket_id TEXT,
  OUT reason TEXT
)
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF coalesce(trim(p_actor_user_id), '') = ''
     OR coalesce(trim(p_access_session_id), '') = ''
     OR coalesce(trim(p_capability_hash), '') = ''
     OR coalesce(trim(p_permission), '') = ''
  THEN
    RAISE EXCEPTION 'staff admission capability is incomplete' USING ERRCODE = '42501';
  END IF;

  SELECT a.role, g.id, s.access_mode, s.ticket_id, s.reason
  INTO staff_role, grant_id, access_mode, ticket_id, reason
  FROM auth.staff_access_sessions s
  JOIN auth.staff_access_grants g ON g.id = s.grant_id
  JOIN auth.staff_assignments a ON a.id = g.assignment_id
  WHERE s.id = p_access_session_id
    AND s.actor_user_id = p_actor_user_id
    -- The secret the session was issued with, not merely its identifier. A
    -- staff session id that leaks is not a credential; this column is the
    -- digest of the token handed to the requester, and the runtime holds no
    -- SELECT on this table with which to look one up.
    AND s.token_hash = p_capability_hash
    AND s.status = 'ACTIVE'
    AND s.ended_at IS NULL
    AND s.expires_at > now()
    AND s.mfa_level IN ('TOTP', 'BACKUP', 'WEBAUTHN')
    AND s.permissions ? p_permission
    -- Admission review is control-plane work. VIEW_AS and BREAK_GLASS exist
    -- for impersonation and for outages; neither reviews an application.
    AND s.access_mode IN ('CONTROL_PLANE', 'OPERATIONS')
    -- The grant behind the session must still stand on its own: a session that
    -- outlived its grant is not authority.
    AND g.grantee_user_id = p_actor_user_id
    AND g.status = 'ACTIVE'
    AND g.revoked_at IS NULL
    AND g.starts_at <= now()
    AND g.expires_at > now()
    AND g.permissions ? p_permission
    -- Scope. A grant issued for one organization cannot be spent on another;
    -- a grant with no organization is platform-wide and may serve the queue.
    AND (
      p_organization_id IS NULL
      OR g.target_organization_id IS NULL
      OR g.target_organization_id = p_organization_id
    )
    AND (
      s.effective_organization_id IS NULL
      OR p_organization_id IS NULL
      OR s.effective_organization_id = p_organization_id
    )
    -- And the durable assignment behind the grant.
    AND a.user_id = p_actor_user_id
    AND a.status IN ('ELIGIBLE', 'ACTIVE')
    AND a.revoked_at IS NULL
    AND a.suspended_at IS NULL
    AND a.valid_from <= now()
    AND (a.valid_until IS NULL OR a.valid_until > now())
    -- The same three roles auth.staff_organization_directory already admits to
    -- the cross-organization directory. These are the roles whose permission
    -- ceiling can carry organization:list at all, so a wider list here would
    -- name authorities that cannot exist.
    AND a.role IN (
      'PLATFORM_OWNER',
      'PLATFORM_ADMIN',
      'COMPLIANCE_STAFF'
    )
  LIMIT 1;

  IF staff_role IS NULL THEN
    RAISE EXCEPTION 'staff admission capability denied' USING ERRCODE = '42501';
  END IF;
END;
$function$;

ALTER FUNCTION auth.staff_admission_capability(TEXT, TEXT, TEXT, TEXT, TEXT)
  OWNER TO pc_staff_authority;

-- 4. The three functions ------------------------------------------------------

-- The queue: organizations awaiting admission, and nothing about the people in
-- them. Reviewing a queue does not require reading anyone's identity.
CREATE OR REPLACE FUNCTION auth.staff_admission_queue(
  p_actor_user_id TEXT,
  p_access_session_id TEXT,
  p_capability_hash TEXT,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  task_id TEXT,
  task_type TEXT,
  task_status TEXT,
  organization_id TEXT,
  tenant_id TEXT,
  organization_name TEXT,
  inn TEXT,
  organization_status TEXT,
  kyc_status TEXT,
  aml_status TEXT,
  sanction_hit BOOLEAN,
  created_at TIMESTAMP(3) WITHOUT TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_capability record;
BEGIN
  v_capability := auth.staff_admission_capability(
    p_actor_user_id, p_access_session_id, p_capability_hash, 'organization:list', NULL
  );

  PERFORM set_config('app.staff_admission_scope', 'queue:pending', true);

  RETURN QUERY
  SELECT
    t.id,
    t.type,
    t.status,
    o.id,
    o."tenantId",
    o.name,
    o.inn,
    o.status,
    o."kycStatus",
    o."amlStatus",
    o."sanctionHit",
    t."createdAt"
  FROM public.kyc_tasks t
  JOIN public.organizations o ON o.id = t."organizationId"
  WHERE t.status = 'PENDING'
  ORDER BY t."createdAt", t.id
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 500);

  PERFORM set_config('app.staff_admission_scope', '', true);
END;
$function$;

ALTER FUNCTION auth.staff_admission_queue(TEXT, TEXT, TEXT, INTEGER)
  OWNER TO pc_staff_authority;

-- One application: the organization under review and the identities that would
-- gain access if it were admitted. One row per member, so the caller sees the
-- application and its people in a single bounded read.
CREATE OR REPLACE FUNCTION auth.staff_admission_application(
  p_actor_user_id TEXT,
  p_access_session_id TEXT,
  p_capability_hash TEXT,
  p_task_id TEXT
)
RETURNS TABLE (
  task_id TEXT,
  task_type TEXT,
  task_status TEXT,
  organization_id TEXT,
  tenant_id TEXT,
  organization_name TEXT,
  inn TEXT,
  ogrn TEXT,
  organization_status TEXT,
  kyc_status TEXT,
  aml_status TEXT,
  sanction_hit BOOLEAN,
  member_user_id TEXT,
  member_email TEXT,
  member_full_name TEXT,
  member_status TEXT,
  membership_role TEXT,
  membership_is_default BOOLEAN,
  membership_joined_at TIMESTAMP(3) WITHOUT TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_capability record;
  v_organization_id TEXT;
BEGIN
  -- The organization is resolved before the capability is checked, so the
  -- capability can be checked against the organization actually in scope
  -- rather than against one the caller asserts. kyc_tasks carries no row
  -- security, so this lookup discloses only which task ids exist — which the
  -- caller already presented.
  SELECT t."organizationId" INTO v_organization_id
  FROM public.kyc_tasks t
  WHERE t.id = p_task_id;

  IF v_organization_id IS NULL THEN
    -- Same error as an unauthorized call, so a caller cannot distinguish an
    -- application outside its scope from one that does not exist.
    RAISE EXCEPTION 'staff admission capability denied' USING ERRCODE = '42501';
  END IF;

  v_capability := auth.staff_admission_capability(
    p_actor_user_id, p_access_session_id, p_capability_hash, 'organization:read', v_organization_id
  );

  PERFORM set_config('app.staff_admission_scope', v_organization_id, true);

  RETURN QUERY
  SELECT
    t.id,
    t.type,
    t.status,
    o.id,
    o."tenantId",
    o.name,
    o.inn,
    o.ogrn,
    o.status,
    o."kycStatus",
    o."amlStatus",
    o."sanctionHit",
    u.id,
    u.email,
    u."fullName",
    u.status,
    m.role,
    m."isDefault",
    m."joinedAt"
  FROM public.kyc_tasks t
  JOIN public.organizations o ON o.id = t."organizationId"
  LEFT JOIN public.user_orgs m ON m."organizationId" = o.id
  LEFT JOIN public.users u ON u.id = m."userId"
  WHERE t.id = p_task_id
  ORDER BY m."joinedAt", m.id
  LIMIT 500;

  PERFORM set_config('app.staff_admission_scope', '', true);
END;
$function$;

ALTER FUNCTION auth.staff_admission_application(TEXT, TEXT, TEXT, TEXT)
  OWNER TO pc_staff_authority;

-- The decision. Writes the outcome onto the application and, on approval, onto
-- the organization's KYC state. It deliberately does not append to
-- auth.staff_access_events: that table is a hash chain whose links are computed
-- by the application from a canonical JSON encoding, and a second writer with a
-- subtly different encoding would corrupt the chain rather than extend it. The
-- staff-facing server writes the event through its existing chain writer in the
-- same transaction as this call.
CREATE OR REPLACE FUNCTION auth.staff_admission_decision(
  p_actor_user_id TEXT,
  p_access_session_id TEXT,
  p_capability_hash TEXT,
  p_task_id TEXT,
  p_decision TEXT,
  p_reason TEXT
)
RETURNS TABLE (
  task_id TEXT,
  organization_id TEXT,
  task_status TEXT,
  kyc_status TEXT,
  organization_status TEXT,
  resolved_at TIMESTAMP(3) WITHOUT TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_capability record;
  v_organization_id TEXT;
  v_decision TEXT := upper(coalesce(trim(p_decision), ''));
  v_reason TEXT := coalesce(trim(p_reason), '');
  v_now TIMESTAMP(3) WITHOUT TIME ZONE := now();
BEGIN
  IF v_decision NOT IN ('APPROVE', 'REJECT') THEN
    RAISE EXCEPTION 'staff admission decision must be APPROVE or REJECT'
      USING ERRCODE = '22023';
  END IF;

  -- A decision with no stated reason leaves nothing for the audit to carry.
  IF length(v_reason) < 10 THEN
    RAISE EXCEPTION 'staff admission decision requires a reason of at least 10 characters'
      USING ERRCODE = '22023';
  END IF;

  SELECT t."organizationId" INTO v_organization_id
  FROM public.kyc_tasks t
  WHERE t.id = p_task_id AND t.status = 'PENDING'
  FOR UPDATE;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'staff admission capability denied' USING ERRCODE = '42501';
  END IF;

  v_capability := auth.staff_admission_capability(
    p_actor_user_id, p_access_session_id, p_capability_hash,
    'organization:admission:decide', v_organization_id
  );

  -- Two markers, because an UPDATE that reads columns of its own target — this
  -- one reads o.status and o."verifiedAt" to leave a rejection's fields alone —
  -- is subject to the SELECT policy as well as the UPDATE policy. With only the
  -- write marker set the row was invisible to the read half and the statement
  -- silently matched nothing, which is how this was found.
  PERFORM set_config('app.staff_admission_scope', v_organization_id, true);
  PERFORM set_config('app.staff_admission_decision', v_organization_id, true);

  UPDATE public.kyc_tasks t
  SET status = CASE WHEN v_decision = 'APPROVE' THEN 'APPROVED' ELSE 'REJECTED' END,
      "assignedTo" = p_actor_user_id,
      notes = format(
        '%s by %s (ticket %s): %s',
        v_decision, p_actor_user_id, v_capability.ticket_id, v_reason
      ),
      "resolvedAt" = v_now,
      "updatedAt" = v_now
  WHERE t.id = p_task_id;

  UPDATE public.organizations o
  SET "kycStatus" = CASE WHEN v_decision = 'APPROVE' THEN 'VERIFIED' ELSE 'REJECTED' END,
      status = CASE WHEN v_decision = 'APPROVE' THEN 'ACTIVE' ELSE o.status END,
      "verifiedAt" = CASE WHEN v_decision = 'APPROVE' THEN v_now ELSE o."verifiedAt" END,
      "updatedAt" = v_now
  WHERE o.id = v_organization_id;

  -- The write marker is surrendered before the result is read back, so the
  -- returned row is produced under read authority alone.
  PERFORM set_config('app.staff_admission_decision', '', true);

  RETURN QUERY
  SELECT t.id, o.id, t.status, o."kycStatus", o.status, t."resolvedAt"
  FROM public.kyc_tasks t
  JOIN public.organizations o ON o.id = t."organizationId"
  WHERE t.id = p_task_id;

  PERFORM set_config('app.staff_admission_scope', '', true);
END;
$function$;

ALTER FUNCTION auth.staff_admission_decision(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  OWNER TO pc_staff_authority;

-- 5. Policies for the authority principal -------------------------------------
--
-- Scoped to the marker each function sets, so widening a function body cannot
-- widen the read behind it. An empty or unset marker matches nothing.

DROP POLICY IF EXISTS organizations_staff_admission_select ON public."organizations";
CREATE POLICY organizations_staff_admission_select ON public."organizations"
  FOR SELECT TO pc_staff_authority USING (
    coalesce(current_setting('app.staff_admission_scope', true), '') <> ''
    AND (
      "id" = current_setting('app.staff_admission_scope', true)
      OR (
        current_setting('app.staff_admission_scope', true) = 'queue:pending'
        AND ("status" = 'PENDING' OR "kycStatus" = 'PENDING')
      )
    )
  );

DROP POLICY IF EXISTS organizations_staff_admission_update ON public."organizations";
CREATE POLICY organizations_staff_admission_update ON public."organizations"
  FOR UPDATE TO pc_staff_authority
  USING (
    coalesce(current_setting('app.staff_admission_decision', true), '') <> ''
    AND "id" = current_setting('app.staff_admission_decision', true)
  )
  WITH CHECK (
    coalesce(current_setting('app.staff_admission_decision', true), '') <> ''
    AND "id" = current_setting('app.staff_admission_decision', true)
  );

-- Members of the single organization under review, and only when a single
-- organization is under review. The queue marker matches no membership row, so
-- listing the queue discloses no identities at all.
DROP POLICY IF EXISTS user_orgs_staff_admission_select ON public."user_orgs";
CREATE POLICY user_orgs_staff_admission_select ON public."user_orgs"
  FOR SELECT TO pc_staff_authority USING (
    coalesce(current_setting('app.staff_admission_scope', true), '') <> ''
    AND "organizationId" = current_setting('app.staff_admission_scope', true)
  );

DROP POLICY IF EXISTS users_staff_admission_select ON public."users";
CREATE POLICY users_staff_admission_select ON public."users"
  FOR SELECT TO pc_staff_authority USING (
    coalesce(current_setting('app.staff_admission_scope', true), '') <> ''
    AND EXISTS (
      SELECT 1
      FROM public."user_orgs" membership
      WHERE membership."userId" = public."users"."id"
        AND membership."organizationId" = current_setting('app.staff_admission_scope', true)
    )
  );

-- 6. Privileges ---------------------------------------------------------------

GRANT USAGE ON SCHEMA public, auth TO pc_staff_authority;

-- The capability resolver reads these three tables and nothing else in auth.
GRANT SELECT ON auth.staff_access_sessions, auth.staff_access_grants, auth.staff_assignments
  TO pc_staff_authority;

-- SELECT is granted at table level and then constrained by the policies above.
GRANT SELECT ON public."organizations", public."users", public."user_orgs" TO pc_staff_authority;

-- Column-level, because a policy admits or refuses a row, not a column. An
-- admission decision settles KYC state; it must not be able to rename an
-- organization or move it to another tenant.
GRANT UPDATE ("status", "kycStatus", "verifiedAt", "updatedAt")
  ON public."organizations" TO pc_staff_authority;

-- kyc_tasks carries no row security, so its restriction is entirely
-- column-level: a decision writes the outcome and nothing else.
GRANT SELECT ON public.kyc_tasks TO pc_staff_authority;
GRANT UPDATE ("status", "assignedTo", "notes", "resolvedAt", "updatedAt")
  ON public.kyc_tasks TO pc_staff_authority;

-- A SECURITY DEFINER function is executable by PUBLIC unless said otherwise,
-- which would make each of these a way around the boundary for every role that
-- can reach the database.
REVOKE ALL ON FUNCTION auth.staff_admission_capability(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.staff_admission_queue(TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.staff_admission_application(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.staff_admission_decision(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

-- The resolver is reachable only from inside the three definer bodies.
GRANT EXECUTE ON FUNCTION auth.staff_admission_capability(TEXT, TEXT, TEXT, TEXT, TEXT)
  TO pc_staff_authority;

-- The staff runtime holds these three grants and no table privilege anywhere.
GRANT USAGE ON SCHEMA auth TO pc_staff_runtime;
GRANT EXECUTE ON FUNCTION auth.staff_admission_queue(TEXT, TEXT, TEXT, INTEGER) TO pc_staff_runtime;
GRANT EXECUTE ON FUNCTION auth.staff_admission_application(TEXT, TEXT, TEXT, TEXT) TO pc_staff_runtime;
GRANT EXECUTE ON FUNCTION auth.staff_admission_decision(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO pc_staff_runtime;

-- Explicit rather than implied: the tenant and auth runtimes are refused these
-- functions by name, so a later blanket grant in an ops script cannot quietly
-- hand one of them the cross-tenant surface this file exists to bound.
DO $staff_authority_revoke_runtimes$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'pc_deal_runtime', 'app_service')
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.staff_admission_capability(TEXT, TEXT, TEXT, TEXT, TEXT) FROM %I',
      runtime_role
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.staff_admission_queue(TEXT, TEXT, TEXT, INTEGER) FROM %I',
      runtime_role
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.staff_admission_application(TEXT, TEXT, TEXT, TEXT) FROM %I',
      runtime_role
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.staff_admission_decision(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM %I',
      runtime_role
    );
  END LOOP;
END;
$staff_authority_revoke_runtimes$;
