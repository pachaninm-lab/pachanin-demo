-- PostgreSQL-authoritative deal creation boundary.
--
-- A confirmed auction basis exists before its Deal row, so ordinary participant
-- visibility cannot authorize Prisma INSERT ... RETURNING or the first seller /
-- buyer participant rows. The functions and policies below permit only the exact
-- tenant, seller, buyer, lot and winning bid encoded in one confirmed basis.

CREATE OR REPLACE FUNCTION public.app_deal_basis_deal_visible(
  p_deal_id text,
  p_tenant_id text,
  p_seller_org_id text,
  p_buyer_org_id text,
  p_lot_id text,
  p_winner_bid_id text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
STABLE
AS $function$
  SELECT
    public.app_rls_context_ready()
    AND current_setting('app.current_role', true) = 'FARMER'
    AND p_tenant_id = current_setting('app.current_tenant_id', true)
    AND p_seller_org_id = current_setting('app.current_org_id', true)
    AND EXISTS (
      SELECT 1
      FROM public."integration_events" ie
      CROSS JOIN LATERAL (
        SELECT COALESCE(ie."responsePayload", ie."requestPayload")::jsonb AS basis
      ) confirmed
      WHERE ie."dealId" IS NULL
        AND ie."adapterName" = 'auction'
        AND ie."eventType" = 'DEAL_BASIS_READY'
        AND ie."externalId" = p_lot_id || ':' || p_winner_bid_id
        AND ie."status" = 'CONFIRMED'
        AND COALESCE(ie."responsePayload", ie."requestPayload") IS NOT NULL
        AND confirmed.basis ->> 'tenantId' = p_tenant_id
        AND confirmed.basis ->> 'sellerOrgId' = p_seller_org_id
        AND confirmed.basis ->> 'buyerOrgId' = p_buyer_org_id
        AND confirmed.basis ->> 'sellerUserId' = current_setting('app.current_user_id', true)
        AND confirmed.basis ->> 'lotId' = p_lot_id
        AND confirmed.basis ->> 'winnerBidId' = p_winner_bid_id
        AND NULLIF(p_deal_id, '') IS NOT NULL
    )
$function$;

CREATE OR REPLACE FUNCTION public.app_deal_basis_participant_allowed(
  p_deal_id text,
  p_tenant_id text,
  p_organization_id text,
  p_user_id text,
  p_role text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
STABLE
AS $function$
  SELECT
    public.app_rls_context_ready()
    AND current_setting('app.current_role', true) = 'FARMER'
    AND EXISTS (
      SELECT 1
      FROM public."deals" d
      JOIN LATERAL (
        SELECT COALESCE(ie."responsePayload", ie."requestPayload")::jsonb AS basis
        FROM public."integration_events" ie
        WHERE ie."adapterName" = 'auction'
          AND ie."eventType" = 'DEAL_BASIS_READY'
          AND ie."externalId" = d."lotId" || ':' || d."sourceLotId"
          AND ie."status" = 'CONFIRMED'
          AND COALESCE(ie."responsePayload", ie."requestPayload") IS NOT NULL
        ORDER BY ie."createdAt" DESC, ie."id" DESC
        LIMIT 1
      ) confirmed ON true
      WHERE d."id" = p_deal_id
        AND d."tenantId" = p_tenant_id
        AND p_tenant_id = current_setting('app.current_tenant_id', true)
        AND d."sellerOrgId" = current_setting('app.current_org_id', true)
        AND confirmed.basis ->> 'tenantId' = current_setting('app.current_tenant_id', true)
        AND confirmed.basis ->> 'sellerOrgId' = current_setting('app.current_org_id', true)
        AND confirmed.basis ->> 'sellerUserId' = current_setting('app.current_user_id', true)
        AND confirmed.basis ->> 'sellerOrgId' = d."sellerOrgId"
        AND confirmed.basis ->> 'buyerOrgId' = d."buyerOrgId"
        AND confirmed.basis ->> 'lotId' = d."lotId"
        AND confirmed.basis ->> 'winnerBidId' = d."sourceLotId"
        AND (
          (
            p_organization_id = confirmed.basis ->> 'sellerOrgId'
            AND p_user_id = confirmed.basis ->> 'sellerUserId'
            AND p_role = 'FARMER'
          )
          OR (
            p_organization_id = confirmed.basis ->> 'buyerOrgId'
            AND p_user_id = confirmed.basis ->> 'buyerUserId'
            AND p_role = 'BUYER'
          )
        )
    )
$function$;

REVOKE ALL ON FUNCTION public.app_deal_basis_deal_visible(text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_deal_basis_participant_allowed(text, text, text, text, text) FROM PUBLIC;

DROP POLICY IF EXISTS deals_select ON public."deals";
CREATE POLICY deals_select ON public."deals" FOR SELECT USING (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (
    public.app_rls_privileged()
    OR (
      current_setting('app.current_role', true) = 'BANK_CALLBACK'
      AND "buyerOrgId" = current_setting('app.current_org_id', true)
    )
    OR EXISTS (
      SELECT 1
      FROM public."deal_participants" p
      WHERE p."dealId" = "deals"."id"
        AND p."tenantId" = current_setting('app.current_tenant_id', true)
        AND p."organizationId" = current_setting('app.current_org_id', true)
        AND p."userId" = current_setting('app.current_user_id', true)
        AND p."role" = current_setting('app.current_role', true)
        AND p."status" = 'ACTIVE'
        AND p."accessLevel" IN ('READ', 'WORK', 'APPROVE')
    )
    OR public.app_deal_basis_deal_visible(
      "id",
      "tenantId",
      "sellerOrgId",
      "buyerOrgId",
      "lotId",
      "sourceLotId"
    )
  )
);

DROP POLICY IF EXISTS deals_insert ON public."deals";
CREATE POLICY deals_insert ON public."deals" FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (
    public.app_rls_privileged()
    OR (
      current_setting('app.current_role', true) = 'FARMER'
      AND public.app_deal_basis_deal_visible(
        "id",
        "tenantId",
        "sellerOrgId",
        "buyerOrgId",
        "lotId",
        "sourceLotId"
      )
    )
  )
);

DROP POLICY IF EXISTS integration_events_select ON public."integration_events";
CREATE POLICY integration_events_select ON public."integration_events" FOR SELECT USING (
  public.app_rls_context_ready()
  AND (
    (
      "dealId" IS NOT NULL
      AND public.app_rls_deal_visible("dealId")
    )
    OR (
      "dealId" IS NULL
      AND current_setting('app.current_role', true) = 'FARMER'
      AND "adapterName" = 'auction'
      AND "eventType" = 'DEAL_BASIS_READY'
      AND "status" = 'CONFIRMED'
      AND COALESCE("responsePayload", "requestPayload") IS NOT NULL
      AND COALESCE("responsePayload", "requestPayload")::jsonb ->> 'tenantId'
        = current_setting('app.current_tenant_id', true)
      AND COALESCE("responsePayload", "requestPayload")::jsonb ->> 'sellerOrgId'
        = current_setting('app.current_org_id', true)
      AND COALESCE("responsePayload", "requestPayload")::jsonb ->> 'sellerUserId'
        = current_setting('app.current_user_id', true)
    )
  )
);

-- The seller may verify only the two organizations encoded in its confirmed
-- pre-deal basis. This does not expose the wider organization directory.
DROP POLICY IF EXISTS organizations_select ON public."organizations";
CREATE POLICY organizations_select ON public."organizations" FOR SELECT USING (
  public.app_rls_context_ready()
  AND (
    "id" = current_setting('app.current_org_id', true)
    OR public.app_rls_privileged()
    OR EXISTS (
      SELECT 1 FROM public."deal_participants" dp
      WHERE dp."organizationId" = "organizations"."id"
        AND dp."tenantId" = current_setting('app.current_tenant_id', true)
        AND dp."userId" = current_setting('app.current_user_id', true)
        AND dp."status" = 'ACTIVE'
    )
    OR EXISTS (
      SELECT 1
      FROM public."integration_events" ie
      CROSS JOIN LATERAL (
        SELECT COALESCE(ie."responsePayload", ie."requestPayload")::jsonb AS basis
      ) confirmed
      WHERE ie."dealId" IS NULL
        AND current_setting('app.current_role', true) = 'FARMER'
        AND ie."adapterName" = 'auction'
        AND ie."eventType" = 'DEAL_BASIS_READY'
        AND ie."status" = 'CONFIRMED'
        AND COALESCE(ie."responsePayload", ie."requestPayload") IS NOT NULL
        AND confirmed.basis ->> 'tenantId' = current_setting('app.current_tenant_id', true)
        AND confirmed.basis ->> 'sellerOrgId' = current_setting('app.current_org_id', true)
        AND confirmed.basis ->> 'sellerUserId' = current_setting('app.current_user_id', true)
        AND "organizations"."id" IN (
          confirmed.basis ->> 'sellerOrgId',
          confirmed.basis ->> 'buyerOrgId'
        )
    )
  )
);

DROP POLICY IF EXISTS deal_participants_insert ON public."deal_participants";
CREATE POLICY deal_participants_insert ON public."deal_participants" FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (
    public.app_rls_privileged()
    OR public.app_deal_basis_participant_allowed(
      "dealId",
      "tenantId",
      "organizationId",
      "userId",
      "role"
    )
  )
);

-- One auction basis may produce exactly one Deal. The transaction advisory lock
-- makes the invariant effective even for concurrent direct SQL attempts using
-- the restricted runtime principal; the trigger is invisible to Prisma schema
-- drift because Prisma does not model triggers.
CREATE OR REPLACE FUNCTION public.enforce_single_deal_per_basis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW."tenantId" IS NULL OR NEW."lotId" IS NULL OR NEW."sourceLotId" IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      NEW."tenantId" || chr(31) || NEW."lotId" || chr(31) || NEW."sourceLotId",
      84
    )
  );

  IF EXISTS (
    SELECT 1
    FROM public."deals" d
    WHERE d."tenantId" = NEW."tenantId"
      AND d."lotId" = NEW."lotId"
      AND d."sourceLotId" = NEW."sourceLotId"
      AND d."id" <> NEW."id"
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'confirmed auction basis has already been consumed by another deal',
      CONSTRAINT = 'deals_tenant_lot_winner_single_use';
  END IF;

  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.enforce_single_deal_per_basis() FROM PUBLIC;
DROP TRIGGER IF EXISTS deals_single_basis ON public."deals";
CREATE TRIGGER deals_single_basis
  BEFORE INSERT OR UPDATE OF "tenantId", "lotId", "sourceLotId"
  ON public."deals"
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_deal_per_basis();

DO $grant_deal_basis_predicates$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'app_deal_api', 'one_deal_app']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.app_deal_basis_deal_visible(text, text, text, text, text, text) TO %I',
        role_name
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.app_deal_basis_participant_allowed(text, text, text, text, text) TO %I',
        role_name
      );
    END IF;
  END LOOP;
END
$grant_deal_basis_predicates$;

COMMENT ON FUNCTION public.app_deal_basis_deal_visible(text, text, text, text, text, text) IS
  'Provides temporary seller visibility for one confirmed-basis Deal INSERT RETURNING before participant rows exist.';
COMMENT ON FUNCTION public.app_deal_basis_participant_allowed(text, text, text, text, text) IS
  'Allows only seller/buyer participant rows encoded by the confirmed tenant-scoped auction basis for a newly created deal.';
COMMENT ON FUNCTION public.enforce_single_deal_per_basis() IS
  'Serializes and rejects reuse of the same tenant/lot/winning-bid basis across Deal rows.';
