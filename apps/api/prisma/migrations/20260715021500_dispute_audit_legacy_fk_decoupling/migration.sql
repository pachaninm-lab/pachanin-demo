-- Canonical disputes live in dispute.cases. public.audit_events."disputeId"
-- still references the legacy public.disputes table, so it cannot be populated
-- without creating a second dispute authority. Keep the canonical identifier in
-- objectType/objectId and the hash material; leave the legacy FK column NULL.

CREATE OR REPLACE FUNCTION dispute.append_audit(
  p_action text,
  p_dispute_id text,
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
  audit_id text := 'dispute-audit-' || gen_random_uuid()::text;
  previous_hash text;
  material jsonb;
  audit_hash text;
BEGIN
  SELECT event."hash" INTO previous_hash
  FROM public."audit_events" event
  WHERE event."tenantId" = current_setting('app.current_tenant_id', true)
    AND event."objectType" = 'dispute'
    AND event."objectId" = p_dispute_id
  ORDER BY event."createdAt" DESC, event."id" DESC
  LIMIT 1;

  material := jsonb_build_object(
    'id', audit_id,
    'action', p_action,
    'actorUserId', current_setting('app.current_user_id', true),
    'actorRole', current_setting('app.current_role', true),
    'tenantId', current_setting('app.current_tenant_id', true),
    'orgId', current_setting('app.current_org_id', true),
    'dealId', p_deal_id,
    'disputeId', p_dispute_id,
    'objectType', 'dispute',
    'objectId', p_dispute_id,
    'beforeState', COALESCE(p_before, '{}'::jsonb),
    'afterState', COALESCE(p_after, '{}'::jsonb),
    'metadata', COALESCE(p_metadata, '{}'::jsonb),
    'correlationId', p_command_id,
    'prevHash', previous_hash
  );
  audit_hash := encode(digest(convert_to(material::text, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public."audit_events" (
    "id", "action", "actorUserId", "actorRole", "tenantId", "orgId",
    "dealId", "disputeId", "objectType", "objectId", "beforeState",
    "afterState", "outcome", "metadata", "correlationId", "hash",
    "prevHash", "createdAt"
  ) VALUES (
    audit_id, p_action, current_setting('app.current_user_id', true),
    current_setting('app.current_role', true), current_setting('app.current_tenant_id', true),
    current_setting('app.current_org_id', true), p_deal_id, NULL,
    'dispute', p_dispute_id, p_before, p_after, 'SUCCESS',
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('canonicalDisputeId', p_dispute_id),
    p_command_id, audit_hash, previous_hash, transaction_timestamp()
  );
  RETURN audit_id;
END
$function$;

REVOKE ALL ON FUNCTION dispute.append_audit(text, text, text, jsonb, jsonb, jsonb, text) FROM PUBLIC;
