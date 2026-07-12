-- Apply after production-rls-policies.sql.
-- This overlay is duplicated in the forward-only migration because deployments
-- re-apply the canonical RLS artifact after migrations.

CREATE OR REPLACE FUNCTION public.app_deal_basis_deal_visible(p_deal jsonb)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
STABLE
AS $function$
  SELECT
    public.app_rls_context_ready()
    AND current_setting('app.current_role', true) = 'FARMER'
    AND p_deal ->> 'tenantId' = current_setting('app.current_tenant_id', true)
    AND p_deal ->> 'sellerOrgId' = current_setting('app.current_org_id', true)
    AND p_deal ->> 'status' = 'DRAFT'
    AND p_deal ->> 'version' = '0'
    AND p_deal ->> 'nextAction' = 'Подтвердить допуск участников'
    AND p_deal -> 'signedAt' = 'null'::jsonb
    AND p_deal -> 'closedAt' = 'null'::jsonb
    AND p_deal -> 'volumeTons' = 'null'::jsonb
    AND p_deal -> 'pricePerTon' = 'null'::jsonb
    AND p_deal -> 'totalRub' = 'null'::jsonb
    AND p_deal -> 'gost' = 'null'::jsonb
    AND p_deal -> 'fundingChoice' = 'null'::jsonb
    AND p_deal -> 'owner' = 'null'::jsonb
    AND p_deal -> 'slaAt' = 'null'::jsonb
    AND p_deal -> 'sagaStep' = 'null'::jsonb
    AND p_deal -> 'meta' = 'null'::jsonb
    AND jsonb_typeof(p_deal -> 'sagaState') = 'object'
    AND (
      SELECT count(*)
      FROM jsonb_object_keys(p_deal -> 'sagaState') AS saga_key(key)
    ) = 18
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_object_keys(p_deal -> 'sagaState') AS saga_key(key)
      WHERE saga_key.key NOT IN (
        'source', 'integrationEventId', 'sourceHash', 'lotId', 'winnerBidId',
        'sellerOrgId', 'buyerOrgId', 'sellerUserId', 'buyerUserId',
        'culture', 'cropClass', 'region', 'incoterms', 'volumeTons',
        'pricePerTon', 'totalKopecks', 'currency', 'paymentTerms'
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public."integration_events" ie
      CROSS JOIN LATERAL (
        SELECT COALESCE(ie."responsePayload", ie."requestPayload")::jsonb AS basis
      ) confirmed
      WHERE ie."dealId" IS NULL
        AND ie."adapterName" = 'auction'
        AND ie."eventType" = 'DEAL_BASIS_READY'
        AND ie."externalId" = (p_deal ->> 'lotId') || ':' || (p_deal ->> 'sourceLotId')
        AND ie."status" = 'CONFIRMED'
        AND COALESCE(ie."responsePayload", ie."requestPayload") IS NOT NULL
        AND confirmed.basis ->> 'tenantId' = p_deal ->> 'tenantId'
        AND confirmed.basis ->> 'dealNumber' = p_deal ->> 'dealNumber'
        AND confirmed.basis ->> 'sellerOrgId' = p_deal ->> 'sellerOrgId'
        AND confirmed.basis ->> 'buyerOrgId' = p_deal ->> 'buyerOrgId'
        AND confirmed.basis ->> 'sellerUserId' = current_setting('app.current_user_id', true)
        AND confirmed.basis ->> 'lotId' = p_deal ->> 'lotId'
        AND confirmed.basis ->> 'winnerBidId' = p_deal ->> 'sourceLotId'
        AND (confirmed.basis ->> 'volumeTons')::numeric = (p_deal ->> 'volumeTonsDec')::numeric
        AND (confirmed.basis ->> 'pricePerTon')::numeric = (p_deal ->> 'pricePerTonDec')::numeric
        AND (confirmed.basis ->> 'totalKopecks')::bigint = (p_deal ->> 'totalKopecks')::bigint
        AND confirmed.basis ->> 'currency' = p_deal ->> 'currency'
        AND confirmed.basis ->> 'culture' = p_deal ->> 'culture'
        AND NULLIF(confirmed.basis ->> 'cropClass', '') IS NOT DISTINCT FROM NULLIF(p_deal ->> 'cropClass', '')
        AND NULLIF(confirmed.basis ->> 'region', '') IS NOT DISTINCT FROM NULLIF(p_deal ->> 'region', '')
        AND NULLIF(confirmed.basis ->> 'incoterms', '') IS NOT DISTINCT FROM NULLIF(p_deal ->> 'incoterms', '')
        AND p_deal -> 'sagaState' ->> 'source' = 'POSTGRESQL_INTEGRATION_EVENT'
        AND p_deal -> 'sagaState' ->> 'integrationEventId' = ie."id"
        AND p_deal -> 'sagaState' ->> 'sourceHash' = confirmed.basis ->> 'sourceHash'
        AND p_deal -> 'sagaState' ->> 'lotId' = confirmed.basis ->> 'lotId'
        AND p_deal -> 'sagaState' ->> 'winnerBidId' = confirmed.basis ->> 'winnerBidId'
        AND p_deal -> 'sagaState' ->> 'sellerOrgId' = confirmed.basis ->> 'sellerOrgId'
        AND p_deal -> 'sagaState' ->> 'buyerOrgId' = confirmed.basis ->> 'buyerOrgId'
        AND p_deal -> 'sagaState' ->> 'sellerUserId' = confirmed.basis ->> 'sellerUserId'
        AND p_deal -> 'sagaState' ->> 'buyerUserId' = confirmed.basis ->> 'buyerUserId'
        AND p_deal -> 'sagaState' ->> 'culture' = confirmed.basis ->> 'culture'
        AND NULLIF(p_deal -> 'sagaState' ->> 'cropClass', '') IS NOT DISTINCT FROM NULLIF(confirmed.basis ->> 'cropClass', '')
        AND NULLIF(p_deal -> 'sagaState' ->> 'region', '') IS NOT DISTINCT FROM NULLIF(confirmed.basis ->> 'region', '')
        AND NULLIF(p_deal -> 'sagaState' ->> 'incoterms', '') IS NOT DISTINCT FROM NULLIF(confirmed.basis ->> 'incoterms', '')
        AND p_deal -> 'sagaState' ->> 'volumeTons' = confirmed.basis ->> 'volumeTons'
        AND p_deal -> 'sagaState' ->> 'pricePerTon' = confirmed.basis ->> 'pricePerTon'
        AND p_deal -> 'sagaState' ->> 'totalKopecks' = confirmed.basis ->> 'totalKopecks'
        AND p_deal -> 'sagaState' ->> 'currency' = confirmed.basis ->> 'currency'
        AND NULLIF(p_deal ->> 'id', '') IS NOT NULL
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

REVOKE ALL ON FUNCTION public.app_deal_basis_deal_visible(jsonb) FROM PUBLIC;
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
    OR public.app_deal_basis_deal_visible(to_jsonb("deals"))
  )
);

DROP POLICY IF EXISTS deals_insert ON public."deals";
CREATE POLICY deals_insert ON public."deals" FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND current_setting('app.current_role', true) = 'FARMER'
  AND public.app_deal_basis_deal_visible(to_jsonb("deals"))
);

DROP POLICY IF EXISTS integration_events_select ON public."integration_events";
CREATE POLICY integration_events_select ON public."integration_events" FOR SELECT USING (
  public.app_rls_context_ready()
  AND (
    ("dealId" IS NOT NULL AND public.app_rls_deal_visible("dealId"))
    OR (
      "dealId" IS NULL
      AND current_setting('app.current_role', true) = 'FARMER'
      AND "adapterName" = 'auction'
      AND "eventType" = 'DEAL_BASIS_READY'
      AND "status" = 'CONFIRMED'
      AND COALESCE("responsePayload", "requestPayload") IS NOT NULL
      AND COALESCE("responsePayload", "requestPayload")::jsonb ->> 'tenantId' = current_setting('app.current_tenant_id', true)
      AND COALESCE("responsePayload", "requestPayload")::jsonb ->> 'sellerOrgId' = current_setting('app.current_org_id', true)
      AND COALESCE("responsePayload", "requestPayload")::jsonb ->> 'sellerUserId' = current_setting('app.current_user_id', true)
    )
  )
);

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
        AND "organizations"."id" IN (confirmed.basis ->> 'sellerOrgId', confirmed.basis ->> 'buyerOrgId')
    )
  )
);

DROP POLICY IF EXISTS deal_participants_insert ON public."deal_participants";
CREATE POLICY deal_participants_insert ON public."deal_participants" FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (
    public.app_rls_privileged()
    OR public.app_deal_basis_participant_allowed("dealId", "tenantId", "organizationId", "userId", "role")
  )
);

DO $grant_deal_basis_predicates$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'app_deal_api', 'one_deal_app']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.app_deal_basis_deal_visible(jsonb) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.app_deal_basis_participant_allowed(text, text, text, text, text) TO %I', role_name);
    END IF;
  END LOOP;
END
$grant_deal_basis_predicates$;
