-- Validate the seller/buyer identity projection for Deal creation without
-- exposing identity rows to the deal runtime.
--
-- FORCE RLS correctly prevents a seller-scoped deal transaction from reading
-- the buyer's user, membership and organization rows directly. Deal creation
-- still needs to prove that both participants are active and belong to the
-- server-confirmed organizations. This SECURITY DEFINER function returns only
-- a bounded status code and is executable only by the deal runtime.

CREATE OR REPLACE FUNCTION auth.validate_deal_creation_actors(
  p_tenant_id text,
  p_seller_user_id text,
  p_seller_org_id text,
  p_buyer_user_id text,
  p_buyer_org_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $function$
DECLARE
  organization_count integer;
  user_count integer;
  membership_count integer;
BEGIN
  IF NULLIF(BTRIM(p_tenant_id), '') IS NULL
     OR NULLIF(BTRIM(p_seller_user_id), '') IS NULL
     OR NULLIF(BTRIM(p_seller_org_id), '') IS NULL
     OR NULLIF(BTRIM(p_buyer_user_id), '') IS NULL
     OR NULLIF(BTRIM(p_buyer_org_id), '') IS NULL
  THEN
    RETURN 'CONTEXT_INVALID';
  END IF;

  -- Bind the authority call to the transaction context established by
  -- RlsTransactionService. A caller cannot use this surface to validate an
  -- unrelated seller or tenant.
  IF current_setting('app.current_user_id', true) IS DISTINCT FROM p_seller_user_id
     OR current_setting('app.current_org_id', true) IS DISTINCT FROM p_seller_org_id
     OR current_setting('app.current_tenant_id', true) IS DISTINCT FROM p_tenant_id
     OR current_setting('app.current_role', true) IS DISTINCT FROM 'FARMER'
  THEN
    RETURN 'CONTEXT_INVALID';
  END IF;

  SELECT count(*)
  INTO organization_count
  FROM public."organizations" organization
  WHERE organization."id" IN (p_seller_org_id, p_buyer_org_id)
    AND organization."tenantId" = p_tenant_id
    AND organization."status" IN ('VERIFIED', 'ACTIVE')
    AND organization."kycStatus" = 'APPROVED';

  IF organization_count <> 2 THEN
    RETURN 'ORGANIZATION_INVALID';
  END IF;

  SELECT count(*)
  INTO user_count
  FROM public."users" actor
  WHERE actor."id" IN (p_seller_user_id, p_buyer_user_id)
    AND actor."status" = 'ACTIVE'
    AND actor."deletedAt" IS NULL;

  IF user_count <> 2 THEN
    RETURN 'USER_INVALID';
  END IF;

  SELECT count(*)
  INTO membership_count
  FROM public."user_orgs" membership
  WHERE (
      membership."userId" = p_seller_user_id
      AND membership."organizationId" = p_seller_org_id
      AND membership."role" = 'FARMER'
    ) OR (
      membership."userId" = p_buyer_user_id
      AND membership."organizationId" = p_buyer_org_id
      AND membership."role" = 'BUYER'
    );

  IF membership_count <> 2 THEN
    RETURN 'MEMBERSHIP_INVALID';
  END IF;

  RETURN 'OK';
END;
$function$;

ALTER FUNCTION auth.validate_deal_creation_actors(text, text, text, text, text)
  OWNER TO pc_identity_bootstrap;
REVOKE ALL ON FUNCTION auth.validate_deal_creation_actors(text, text, text, text, text)
  FROM PUBLIC;

DO $bounded_deal_actor_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_deal_runtime', 'one_deal_app', 'app_deal', 'app_runtime')
  LOOP
    -- EXECUTE on a function in a non-public schema is unusable without schema
    -- USAGE. Grant both parts of the same bounded surface here so roles that
    -- exist before migration deployment (for example app_deal in CI) receive
    -- a complete authority contract rather than a latent permission failure.
    EXECUTE format('GRANT USAGE ON SCHEMA auth TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.validate_deal_creation_actors(text,text,text,text,text) TO %I',
      runtime_role
    );
  END LOOP;

  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_auth_runtime', 'pc_staff_runtime', 'pc_storage_runtime',
      'one_deal_auth', 'one_deal_storage',
      'app_auth', 'app_storage', 'app_outbox'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.validate_deal_creation_actors(text,text,text,text,text) FROM %I',
      runtime_role
    );
  END LOOP;
END;
$bounded_deal_actor_grants$;
