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

-- An organization-level administrator of the organization in context. Derived
-- from the membership table, not from the role label alone, so a client that
-- could influence the label still could not grant itself administration of an
-- organization it does not belong to.
CREATE OR REPLACE FUNCTION public.app_identity_is_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public."user_orgs" membership
    WHERE membership."userId" = public.app_identity_user_id()
      AND membership."organizationId" = public.app_identity_org_id()
      AND membership."role" IN ('ADMIN', 'EXECUTIVE')
  );
$function$;

-- The admission reviewer and platform staff contour. These principals read
-- across organizations by design, so the signal admitting them must not be one
-- an ordinary tenant can hold.
--
-- It deliberately does *not* read app.current_role. In this schema 'ADMIN' is
-- an organization membership role as well as a staff label, so keying the
-- cross-tenant branch on it would hand every organization administrator a read
-- of every other tenant — which is what the first run of the direct-SQL
-- isolation test showed. Platform authority travels in its own setting,
-- populated from RequestUser.staffRoles, which is resolved server-side and
-- never sourced from a JWT, a URL, a cookie or client storage.
CREATE OR REPLACE FUNCTION public.app_identity_staff_roles()
RETURNS text[]
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $function$
  SELECT CASE
    WHEN nullif(current_setting('app.current_staff_roles', true), '') IS NULL THEN ARRAY[]::text[]
    ELSE string_to_array(current_setting('app.current_staff_roles', true), ',')
  END;
$function$;

CREATE OR REPLACE FUNCTION public.app_identity_is_reviewer()
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $function$
  SELECT public.app_identity_staff_roles()
    && ARRAY['PLATFORM_ADMIN', 'SUPPORT_MANAGER', 'COMPLIANCE_OFFICER', 'REGISTRATION_REVIEWER'];
$function$;

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

-- users: an identity reads itself, an organization administrator reads the
-- members of the organization in context, and a reviewer reads across
-- organizations for the admission queue.
DROP POLICY IF EXISTS users_self_select ON public."users";
CREATE POLICY users_self_select ON public."users"
  FOR SELECT USING (
    public.app_identity_user_id() IS NOT NULL
    AND (
      "id" = public.app_identity_user_id()
      OR public.app_identity_is_reviewer()
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
      OR public.app_identity_is_reviewer()
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

-- organizations: the organization in context, by tenant as well as by
-- identifier, so a guessed identifier from another tenant matches nothing.
DROP POLICY IF EXISTS organizations_context_select ON public."organizations";
CREATE POLICY organizations_context_select ON public."organizations"
  FOR SELECT USING (
    public.app_identity_user_id() IS NOT NULL
    AND (
      public.app_identity_is_reviewer()
      OR (
        "id" = public.app_identity_org_id()
        AND "tenantId" = public.app_identity_tenant_id()
      )
      OR EXISTS (
        SELECT 1
        FROM public."user_orgs" membership
        WHERE membership."organizationId" = public."organizations"."id"
          AND membership."userId" = public.app_identity_user_id()
      )
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
