-- Forward correction for the canonical dispute schema introduced immediately
-- before this migration.
--
-- public.audit_events.disputeId still references the retired public.disputes
-- table. The canonical authority lives in dispute.cases, therefore the durable
-- audit relationship is expressed through objectType/objectId plus metadata;
-- the legacy FK column remains NULL until the public schema is retired in a
-- separate compatibility migration.

CREATE OR REPLACE FUNCTION dispute.append_audit(
  p_action text,
  p_case_id text,
  p_deal_id text,
  p_before jsonb,
  p_after jsonb,
  p_metadata jsonb,
  p_command_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE
  audit_id text := 'dispute-audit:' || gen_random_uuid()::text;
  previous_hash text;
  audit_material jsonb;
  audit_hash text;
  canonical_metadata jsonb;
BEGIN
  SELECT event.hash INTO previous_hash
  FROM public.audit_events event
  WHERE event."tenantId" = current_setting('app.current_tenant_id', true)
    AND event."objectType" = 'dispute_case'
    AND event."objectId" = p_case_id
  ORDER BY event."createdAt" DESC, event.id DESC
  LIMIT 1;

  canonical_metadata := COALESCE(p_metadata, '{}'::jsonb)
    || jsonb_build_object('canonicalDisputeId', p_case_id);

  audit_material := jsonb_build_object(
    'id', audit_id,
    'action', p_action,
    'actorUserId', current_setting('app.current_user_id', true),
    'actorRole', current_setting('app.current_role', true),
    'tenantId', current_setting('app.current_tenant_id', true),
    'orgId', current_setting('app.current_org_id', true),
    'dealId', p_deal_id,
    'canonicalDisputeId', p_case_id,
    'objectType', 'dispute_case',
    'objectId', p_case_id,
    'beforeState', p_before,
    'afterState', p_after,
    'outcome', 'SUCCESS',
    'metadata', canonical_metadata,
    'correlationId', p_command_id,
    'prevHash', previous_hash
  );
  audit_hash := encode(digest(convert_to(audit_material::text, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public.audit_events (
    id, action, "actorUserId", "actorRole", "tenantId", "orgId", "dealId", "disputeId",
    "objectType", "objectId", "beforeState", "afterState", outcome, metadata,
    "correlationId", hash, "prevHash", "createdAt"
  ) VALUES (
    audit_id,
    p_action,
    current_setting('app.current_user_id', true),
    current_setting('app.current_role', true),
    current_setting('app.current_tenant_id', true),
    current_setting('app.current_org_id', true),
    p_deal_id,
    NULL,
    'dispute_case',
    p_case_id,
    p_before,
    p_after,
    'SUCCESS',
    canonical_metadata,
    p_command_id,
    audit_hash,
    previous_hash,
    clock_timestamp()
  );
  RETURN audit_id;
END
$function$;

REVOKE ALL ON FUNCTION dispute.can_read_case(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dispute.can_read_case(text) TO app_deal;
