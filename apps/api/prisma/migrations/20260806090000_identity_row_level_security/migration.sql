-- Identity tenant isolation in PostgreSQL (#3670).
--
-- public.users, public.user_orgs and public.organizations carried no row-level
-- security at all, so identity isolation rested on application query scoping.
-- A query path that forgot its tenant predicate had nothing beneath it to fail
-- closed.
--
-- Enabling RLS here is not merely a policy change, because authentication has
-- to read an identity *before* any tenant context exists. The previous design
-- solved that by granting the auth runtime BYPASSRLS, which disables the
-- boundary for every statement that principal ever runs — the login lookup and
-- everything after it alike.
--
-- This migration replaces that with a bounded surface. A dedicated bootstrap
-- role owns one SECURITY DEFINER function whose body is fixed by this
-- migration; a policy admits that role and only that role to the pre-auth
-- lookup. The runtime principal is not a member of it and never becomes one,
-- so the only pre-context read it can perform is the one this function
-- performs on its behalf, returning a single identity and no tenant data.
--
-- FORCE is what makes the arrangement necessary rather than decorative: under
-- ENABLE alone the table owner is exempt, and a definer function owned by the
-- owner would silently see everything.

-- 1. The bootstrap principal ------------------------------------------------

DO $identity_bootstrap_role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_identity_bootstrap'
  ) THEN
    CREATE ROLE pc_identity_bootstrap
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;

  -- A bootstrap principal that could log in, inherit, bypass RLS or create
  -- roles would reintroduce exactly what this migration removes.
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_identity_bootstrap'
      AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)
  ) THEN
    RAISE EXCEPTION 'Identity bootstrap role is unsafe'
      USING ERRCODE = '42501';
  END IF;
END;
$identity_bootstrap_role$;

-- 2. Row level security on the identity tables -------------------------------

ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."users" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."user_orgs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_orgs" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" FORCE ROW LEVEL SECURITY;

-- `organizations_select` has existed since 20260712193000 on a table with RLS
-- switched off, so it has never executed. Enabling RLS above puts it in force;
-- it is recreated here beside the others so the whole identity boundary reads
-- from one place rather than from a policy written for a different purpose.
DROP POLICY IF EXISTS organizations_select ON public."organizations";

-- 3. Trusted context helpers -------------------------------------------------
--
-- Every predicate below reads the transaction-scoped settings the server sets
-- in RlsTransactionService, never a value supplied by a client. `true` as the
-- second argument to current_setting makes a missing setting NULL rather than
-- an error, and NULL fails every comparison — so a statement that runs without
-- context sees nothing instead of everything.

CREATE OR REPLACE FUNCTION public.app_identity_user_id()
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $function$
  SELECT nullif(current_setting('app.current_user_id', true), '');
$function$;

CREATE OR REPLACE FUNCTION public.app_identity_org_id()
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $function$
  SELECT nullif(current_setting('app.current_org_id', true), '');
$function$;

CREATE OR REPLACE FUNCTION public.app_identity_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $function$
  SELECT nullif(current_setting('app.current_tenant_id', true), '');
$function$;

CREATE OR REPLACE FUNCTION public.app_identity_role()
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $function$
  SELECT nullif(current_setting('app.current_role', true), '');
$function$;

CREATE OR REPLACE FUNCTION public.app_identity_session_id()
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $function$
  SELECT nullif(current_setting('app.current_session_id', true), '');
$function$;

-- An organization-level administrator of the organization in context. Derived
-- from the membership table, not from the role label alone, so a client that
-- could influence the label still could not grant itself administration of an
-- organization it does not belong to.
--
-- SECURITY DEFINER is not a convenience here. This function is called from the
-- policies on public."user_orgs" itself; as an invoker function its read would
-- re-enter those same policies and PostgreSQL would raise "infinite recursion
-- detected in policy for relation". Running as the owner reads the table once,
-- beneath the policy layer, and returns a single boolean.
CREATE OR REPLACE FUNCTION public.app_identity_is_org_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public."user_orgs" membership
    WHERE membership."userId" = public.app_identity_user_id()
      AND membership."organizationId" = public.app_identity_org_id()
      AND membership."role" IN ('ADMIN', 'EXECUTIVE')
  );
$function$;

ALTER FUNCTION public.app_identity_is_org_admin() OWNER TO pc_identity_bootstrap;

-- The admission reviewer and platform staff contour. These principals read
-- across organizations by design, so the signal admitting them must not be one
-- an ordinary tenant can hold.
--
-- It deliberately does *not* read app.current_role. In this schema 'ADMIN' is
-- an organization membership role as well as a staff label, so keying the
-- cross-tenant branch on it would hand every organization administrator a read
-- of every other tenant — which is what the first run of the direct-SQL
-- isolation test showed.
--
-- Nor does it read a staff label out of a setting. Any GUC the runtime
-- principal can write is not an authority: that principal can simply execute
-- `SET LOCAL app.current_staff_roles = 'PLATFORM_ADMIN'` and award itself the
-- cross-tenant branch. That was measured against this very migration — the
-- restricted role read every organization and every user — so the setting is
-- gone rather than merely discouraged.
--
-- Platform authority is a fact in the database or it does not exist: an ACTIVE
-- staff assignment inside its validity window, held by the identity in
-- context, whose session is live, unexpired, unrevoked and MFA-verified.
-- Claiming another identity's user or session id no longer suffices, because
-- the claim must correspond to rows that actually exist.
CREATE OR REPLACE FUNCTION public.app_identity_is_reviewer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM auth.staff_assignments assignment
    JOIN auth.sessions session
      ON session.user_id = assignment.user_id
    WHERE assignment.user_id = public.app_identity_user_id()
      AND assignment.status = 'ACTIVE'
      AND assignment.revoked_at IS NULL
      AND assignment.suspended_at IS NULL
      AND assignment.valid_from <= now()
      AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
      -- Drawn from the vocabulary auth_staff_assignments_role_check already
      -- enforces, so a label this predicate would admit but the table would
      -- reject cannot exist. BREAK_GLASS_ADMIN and DEVELOPER are deliberately
      -- absent: neither reviews admissions, and neither should read identity
      -- across tenants as a matter of course.
      AND assignment.role IN (
        'PLATFORM_OWNER',
        'PLATFORM_ADMIN',
        'SUPPORT_L1',
        'SUPPORT_L2',
        'OPERATIONS_AGENT',
        'OPERATIONS_SUPERVISOR',
        'COMPLIANCE_STAFF'
      )
      AND session.id = public.app_identity_session_id()
      AND session.status = 'ACTIVE'
      AND session.revoked_at IS NULL
      AND session.expires_at > now()
      AND session.mfa_verified_at IS NOT NULL
  );
$function$;

ALTER FUNCTION public.app_identity_is_reviewer() OWNER TO pc_identity_bootstrap;

-- 4. The pre-authentication surface ------------------------------------------
--
-- One function, one row, no tenant data. It returns the credential material a
-- login needs to verify a password and decide whether to continue, and nothing
-- that would disclose which organizations exist or who belongs to them.

CREATE OR REPLACE FUNCTION auth.resolve_login_identity(p_email text)
RETURNS TABLE (
  "id" text,
  "email" text,
  "passwordHash" text,
  "fullName" text,
  "status" text,
  "mfaEnabled" boolean,
  "mfaSecret" text,
  "mfaBackup" text,
  "deletedAt" timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT
    candidate."id",
    candidate."email",
    candidate."passwordHash",
    candidate."fullName",
    candidate."status",
    candidate."mfaEnabled",
    candidate."mfaSecret",
    candidate."mfaBackup",
    candidate."deletedAt"
  FROM public."users" candidate
  WHERE candidate."email" = lower(btrim(p_email))
  LIMIT 1;
$function$;

ALTER FUNCTION auth.resolve_login_identity(text) OWNER TO pc_identity_bootstrap;

-- Resolving an identity by its identifier, for the step between a verified
-- password and a chosen membership. Same shape, same absence of tenant data.
CREATE OR REPLACE FUNCTION auth.resolve_login_identity_by_id(p_user_id text)
RETURNS TABLE (
  "id" text,
  "email" text,
  "passwordHash" text,
  "fullName" text,
  "status" text,
  "mfaEnabled" boolean,
  "mfaSecret" text,
  "mfaBackup" text,
  "deletedAt" timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT
    candidate."id",
    candidate."email",
    candidate."passwordHash",
    candidate."fullName",
    candidate."status",
    candidate."mfaEnabled",
    candidate."mfaSecret",
    candidate."mfaBackup",
    candidate."deletedAt"
  FROM public."users" candidate
  WHERE candidate."id" = p_user_id
  LIMIT 1;
$function$;

ALTER FUNCTION auth.resolve_login_identity_by_id(text) OWNER TO pc_identity_bootstrap;

-- The memberships a verified identity may choose between. Returns only the
-- caller's own memberships, so multi-membership selection never discloses
-- another identity's organizations.
CREATE OR REPLACE FUNCTION auth.resolve_login_memberships(p_user_id text)
RETURNS TABLE (
  "id" text,
  "userId" text,
  "organizationId" text,
  "role" text,
  "isDefault" boolean,
  "organizationName" text,
  "organizationStatus" text,
  "tenantId" text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT
    membership."id",
    membership."userId",
    membership."organizationId",
    membership."role",
    membership."isDefault",
    organization."name",
    organization."status",
    organization."tenantId"
  FROM public."user_orgs" membership
  JOIN public."organizations" organization
    ON organization."id" = membership."organizationId"
  WHERE membership."userId" = p_user_id;
$function$;

ALTER FUNCTION auth.resolve_login_memberships(text) OWNER TO pc_identity_bootstrap;

-- 5. Policies ----------------------------------------------------------------
--
-- The bootstrap role is admitted to exactly the reads the three functions
-- above perform. It cannot log in and holds no other privilege, so this is not
-- a second way into the data — it is the only way the pre-auth path has.

DROP POLICY IF EXISTS users_bootstrap_login ON public."users";
CREATE POLICY users_bootstrap_login ON public."users"
  FOR SELECT TO pc_identity_bootstrap USING (true);

DROP POLICY IF EXISTS user_orgs_bootstrap_login ON public."user_orgs";
CREATE POLICY user_orgs_bootstrap_login ON public."user_orgs"
  FOR SELECT TO pc_identity_bootstrap USING (true);

DROP POLICY IF EXISTS organizations_bootstrap_login ON public."organizations";
CREATE POLICY organizations_bootstrap_login ON public."organizations"
  FOR SELECT TO pc_identity_bootstrap USING (true);

-- users: an identity reads itself, and an organization administrator reads the
-- members of the organization in context. There is no cross-tenant branch:
-- staff read across organizations through the bounded functions in
-- 20260806103000, under a principal the tenant runtime cannot become.
DROP POLICY IF EXISTS users_self_select ON public."users";
CREATE POLICY users_self_select ON public."users"
  FOR SELECT USING (
    public.app_identity_user_id() IS NOT NULL
    AND (
      "id" = public.app_identity_user_id()
      OR (
        public.app_identity_is_org_admin()
        AND EXISTS (
          SELECT 1
          FROM public."user_orgs" membership
          WHERE membership."userId" = public."users"."id"
            AND membership."organizationId" = public.app_identity_org_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS users_self_update ON public."users";
CREATE POLICY users_self_update ON public."users"
  FOR UPDATE USING (
    public.app_identity_user_id() IS NOT NULL
    AND "id" = public.app_identity_user_id()
  )
  WITH CHECK (
    public.app_identity_user_id() IS NOT NULL
    AND "id" = public.app_identity_user_id()
  );

-- user_orgs: an identity reads its own memberships; an administrator reads and
-- administers the memberships of the organization in context.
DROP POLICY IF EXISTS user_orgs_self_select ON public."user_orgs";
CREATE POLICY user_orgs_self_select ON public."user_orgs"
  FOR SELECT USING (
    public.app_identity_user_id() IS NOT NULL
    AND (
      "userId" = public.app_identity_user_id()
      OR (
        "organizationId" = public.app_identity_org_id()
        AND public.app_identity_is_org_admin()
      )
    )
  );

DROP POLICY IF EXISTS user_orgs_admin_insert ON public."user_orgs";
CREATE POLICY user_orgs_admin_insert ON public."user_orgs"
  FOR INSERT WITH CHECK (
    "organizationId" = public.app_identity_org_id()
    AND public.app_identity_is_org_admin()
  );

DROP POLICY IF EXISTS user_orgs_admin_update ON public."user_orgs";
CREATE POLICY user_orgs_admin_update ON public."user_orgs"
  FOR UPDATE USING (
    "organizationId" = public.app_identity_org_id()
    AND public.app_identity_is_org_admin()
  )
  WITH CHECK (
    "organizationId" = public.app_identity_org_id()
    AND public.app_identity_is_org_admin()
  );

DROP POLICY IF EXISTS user_orgs_admin_delete ON public."user_orgs";
CREATE POLICY user_orgs_admin_delete ON public."user_orgs"
  FOR DELETE USING (
    "organizationId" = public.app_identity_org_id()
    AND public.app_identity_is_org_admin()
  );

-- organizations: the organizations the identity belongs to, and no others.
--
-- An earlier revision also admitted the organization named in context when the
-- claimed tenant matched — "id = current org AND tenantId = current tenant" —
-- on the reasoning that a guessed identifier from another tenant would fail the
-- second half. The isolation gate showed that reasoning to be wrong: the pair
-- is not a secret, and a runtime that states another organization's identifier
-- together with its real tenant identifier satisfied both halves and read the
-- row. Membership is the only test that cannot be satisfied by restating
-- somebody else's identifiers, so it is now the whole test. Multi-membership
-- still works, including across tenants, because it is the memberships that are
-- consulted rather than the single organization in context.
DROP POLICY IF EXISTS organizations_context_select ON public."organizations";
CREATE POLICY organizations_context_select ON public."organizations"
  FOR SELECT USING (
    public.app_identity_user_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public."user_orgs" membership
      WHERE membership."organizationId" = public."organizations"."id"
        AND membership."userId" = public.app_identity_user_id()
    )
  );

DROP POLICY IF EXISTS organizations_admin_update ON public."organizations";
CREATE POLICY organizations_admin_update ON public."organizations"
  FOR UPDATE USING (
    "id" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    AND public.app_identity_is_org_admin()
  )
  WITH CHECK (
    "id" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    AND public.app_identity_is_org_admin()
  );

-- Registration creates an organization before the identity has any context, so
-- admission is written through the same bootstrap principal rather than by
-- relaxing the policy for everyone.
DROP POLICY IF EXISTS organizations_bootstrap_insert ON public."organizations";
CREATE POLICY organizations_bootstrap_insert ON public."organizations"
  FOR INSERT TO pc_identity_bootstrap WITH CHECK (true);

DROP POLICY IF EXISTS users_bootstrap_insert ON public."users";
CREATE POLICY users_bootstrap_insert ON public."users"
  FOR INSERT TO pc_identity_bootstrap WITH CHECK (true);

DROP POLICY IF EXISTS user_orgs_bootstrap_insert ON public."user_orgs";
CREATE POLICY user_orgs_bootstrap_insert ON public."user_orgs"
  FOR INSERT TO pc_identity_bootstrap WITH CHECK (true);

-- 6. Execution privileges ----------------------------------------------------
--
-- A SECURITY DEFINER function is executable by PUBLIC unless said otherwise,
-- which would make every one of these a way around the boundary for any role
-- that can reach the database at all. Each is revoked from PUBLIC and granted
-- back only where it is needed.

REVOKE ALL ON FUNCTION auth.resolve_login_identity(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.resolve_login_identity_by_id(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.resolve_login_memberships(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_identity_is_org_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_identity_is_reviewer() FROM PUBLIC;

-- The authority functions read beneath the policy layer, so the bootstrap
-- owner needs the reads its bodies perform and nothing wider. Schema public is
-- named explicitly rather than left to the default PUBLIC grant: a deployment
-- that recreates the schema, as the isolation gate does, drops that default and
-- the whole login path fails on "permission denied for schema public".
GRANT USAGE ON SCHEMA auth, public TO pc_identity_bootstrap;
GRANT SELECT ON auth.staff_assignments, auth.sessions TO pc_identity_bootstrap;

-- The policies call the two authority functions on behalf of whichever
-- principal is running the statement, so execution must be available to them;
-- the bodies are fixed by this migration and return a single boolean.
GRANT EXECUTE ON FUNCTION public.app_identity_is_org_admin() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_identity_is_reviewer() TO PUBLIC;

-- The pre-auth surface goes to the authentication principal by name, and to
-- nothing else. Revoking from PUBLIC without granting it anywhere leaves login
-- unable to read an identity at all: the isolation gate measured
-- "permission denied for function resolve_login_identity" as the auth runtime,
-- which is the whole login path failing closed rather than a boundary holding.
DO $bootstrap_execute_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles WHERE rolname = 'pc_auth_runtime'
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_login_identity(text) TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_login_identity_by_id(text) TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_login_memberships(text) TO %I', runtime_role);
  END LOOP;

  -- The deal runtime authenticates nobody, so it must not reach the pre-auth
  -- surface even if a later ops script grants broadly.
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_deal_runtime', 'pc_staff_runtime', 'pc_storage_runtime')
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_identity(text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_identity_by_id(text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_memberships(text) FROM %I', runtime_role);
  END LOOP;
END;
$bootstrap_execute_grants$;

-- 7. Privileged columns ------------------------------------------------------
--
-- users_self_update lets an identity maintain its own row, which must not mean
-- promoting itself, resurrecting a deleted account or replacing its own
-- credential material. Row-level security cannot express that: a policy admits
-- or refuses a row, not a column. The privileged columns are therefore withheld
-- at the grant level, so an UPDATE that touches them is refused before any
-- policy is consulted.
REVOKE UPDATE ON public."users" FROM PUBLIC;

DO $privileged_columns$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'pc_deal_runtime')
  LOOP
    EXECUTE format(
      'REVOKE UPDATE ON public."users" FROM %I',
      runtime_role
    );
    EXECUTE format(
      'GRANT UPDATE ("email", "phone", "fullName", "updatedAt") ON public."users" TO %I',
      runtime_role
    );
  END LOOP;
END;
$privileged_columns$;
