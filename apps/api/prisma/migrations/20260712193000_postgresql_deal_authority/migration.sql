-- PostgreSQL-authoritative deal creation boundary.
--
-- A confirmed auction basis exists before its Deal row, so the ordinary
-- integration_events policy (dealId must already be visible) cannot expose it.
-- The policy below reveals only the exact seller-scoped, tenant-scoped basis.
-- A SECURITY DEFINER predicate then permits that seller to create exactly the
-- seller and buyer participant rows encoded in that immutable basis. No other
-- integration event or participant write is widened.

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

REVOKE ALL ON FUNCTION public.app_deal_basis_participant_allowed(text, text, text, text, text) FROM PUBLIC;

-- The seller may read only the one confirmed pre-deal basis that identifies the
-- current tenant, organization and user. Existing deal-bound integration event
-- visibility is unchanged.
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

-- Preserve privileged participant administration and add one narrowly verified
-- creation path for the seller encoded in the confirmed auction basis.
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

DO $grant_deal_basis_predicate$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'app_deal_api', 'one_deal_app']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.app_deal_basis_participant_allowed(text, text, text, text, text) TO %I',
        role_name
      );
    END IF;
  END LOOP;
END
$grant_deal_basis_predicate$;

COMMENT ON FUNCTION public.app_deal_basis_participant_allowed(text, text, text, text, text) IS
  'Allows only seller/buyer participant rows encoded by the confirmed tenant-scoped auction basis for a newly created deal.';
