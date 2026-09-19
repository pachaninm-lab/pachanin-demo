BEGIN;

DROP POLICY IF EXISTS public_org_intake_evidence_audit_select ON public.audit_events;
CREATE POLICY public_org_intake_evidence_audit_select
ON public.audit_events FOR SELECT
USING (
  current_user = pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = 'public.audit_events'::regclass))
  AND action = 'public:organization-intake:create'
  AND outcome = 'SUCCESS'
  AND "actorUserId" = 'public:organization-intake'
  AND "actorRole" = 'PUBLIC'
  AND "objectType" = 'PublicOrganizationConnectionRequest'
);

DROP POLICY IF EXISTS public_org_intake_evidence_outbox_select ON public.outbox_entries;
CREATE POLICY public_org_intake_evidence_outbox_select
ON public.outbox_entries FOR SELECT
USING (
  current_user = pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = 'public.outbox_entries'::regclass))
  AND type = 'PUBLIC_ORGANIZATION_CONNECTION_REQUESTED'
  AND "triggeredByUserId" IS NULL
  AND NOT (payload ?| ARRAY['organizationName','inn','contactName','position','phone','email','payloadHash'])
);

CREATE OR REPLACE FUNCTION public.verify_public_organization_connection_request_evidence(
  p_request_number text,
  p_correlation_id text
)
RETURNS TABLE (
  verdict text,
  audit_id text,
  outbox_id text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $function$
  SELECT
    CASE
      WHEN count(*) = 1
        AND bool_and(a.action = 'public:organization-intake:create')
        AND bool_and(a.outcome = 'SUCCESS')
        AND bool_and(a."correlationId" = r."correlationId")
        AND bool_and(o.type = 'PUBLIC_ORGANIZATION_CONNECTION_REQUESTED')
        AND bool_and(o."correlationId" = r."correlationId")
        AND bool_and(o."auditId" = r."auditEventId")
        AND bool_and(NOT (o.payload ?| ARRAY['organizationName','inn','contactName','position','phone','email','payloadHash']))
      THEN 'PASS'
      ELSE 'FAIL'
    END::text AS verdict,
    min(r."auditEventId")::text AS audit_id,
    min(r."outboxEntryId")::text AS outbox_id
  FROM public.public_organization_connection_requests r
  JOIN public.audit_events a ON a.id = r."auditEventId"
  JOIN public.outbox_entries o ON o.id = r."outboxEntryId"
  WHERE p_request_number ~ '^PC-[0-9]{8}-[0-9A-F]{12}$'
    AND p_correlation_id ~ '^[A-Za-z0-9._:-]{8,128}$'
    AND r."requestNumber" = p_request_number
    AND r."correlationId" = p_correlation_id;
$function$;

REVOKE ALL ON FUNCTION public.verify_public_organization_connection_request_evidence(text, text) FROM PUBLIC;

DO $public_org_intake_evidence_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT EXECUTE ON FUNCTION public.verify_public_organization_connection_request_evidence(text, text) TO app_deal;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    GRANT EXECUTE ON FUNCTION public.verify_public_organization_connection_request_evidence(text, text) TO app_service;
  END IF;
END
$public_org_intake_evidence_grants$;

COMMENT ON FUNCTION public.verify_public_organization_connection_request_evidence(text, text) IS
  'Returns only non-PII release evidence identifiers for one exact public organization intake request.';

COMMIT;
