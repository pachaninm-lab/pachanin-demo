-- IR-10.3 finalization custody evidence correction.
-- The final custody fact is generated inside the authoritative sample-finalization
-- trigger and reuses the exact signed PROTOCOL evidence already validated against
-- sample + shipment + acceptance + laboratory + protocol number by the state guard.

CREATE OR REPLACE FUNCTION public.app_labs_validate_custody_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, labs
AS $function$
DECLARE
  sample_record public."lab_samples"%ROWTYPE;
  required_actor_type TEXT;
  required_purpose TEXT;
  evidence_sample_id TEXT;
BEGIN
  SELECT * INTO sample_record
  FROM public."lab_samples"
  WHERE "id" = NEW.sample_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'laboratory custody sample does not exist' USING ERRCODE = '23503';
  END IF;
  IF NEW.tenant_id <> sample_record."tenantId"
     OR NEW.laboratory_org_id <> sample_record."labId"
     OR NEW.actor_user_id <> current_setting('app.current_user_id', true)
  THEN
    RAISE EXCEPTION 'laboratory custody authority mismatch' USING ERRCODE = '42501';
  END IF;

  required_actor_type := CASE NEW.event_type
    WHEN 'CREATED' THEN 'SAMPLER'
    WHEN 'COLLECTED' THEN 'SAMPLER'
    WHEN 'SEALED' THEN 'COURIER'
    WHEN 'HANDOFF' THEN 'COURIER'
    WHEN 'RECEIVED' THEN 'RECEIVER'
    WHEN 'OPENED' THEN 'ANALYST'
    WHEN 'FINALIZED' THEN 'SIGNATORY'
    ELSE NULL
  END;
  required_purpose := CASE NEW.event_type
    WHEN 'CREATED' THEN 'ADMISSION'
    WHEN 'COLLECTED' THEN 'COLLECTION'
    WHEN 'FINALIZED' THEN 'PROTOCOL'
    ELSE NEW.event_type
  END;
  evidence_sample_id := CASE WHEN NEW.event_type = 'CREATED' THEN NULL ELSE NEW.sample_id END;

  IF required_actor_type IS NULL THEN
    RAISE EXCEPTION 'unsupported custody event type' USING ERRCODE = '23514';
  END IF;
  IF NOT public.app_labs_actor_valid(
       NEW.tenant_id, NEW.laboratory_org_id, NEW.actor_user_id,
       required_actor_type, NEW.occurred_at
     )
  THEN
    RAISE EXCEPTION 'custody actor type is not authorized for operation' USING ERRCODE = '42501';
  END IF;
  IF NOT public.app_labs_evidence_purpose_valid(
       NEW.evidence_file_id, NEW.tenant_id, sample_record."dealId", required_purpose,
       evidence_sample_id, sample_record."shipmentId", sample_record."acceptanceId",
       NEW.laboratory_org_id,
       CASE WHEN NEW.event_type = 'FINALIZED' THEN sample_record."protocol" ELSE NULL END
     )
  THEN
    RAISE EXCEPTION 'custody evidence is not purpose-bound to the exact operation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;
