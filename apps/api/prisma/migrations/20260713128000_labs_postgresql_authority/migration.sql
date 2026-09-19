-- IR-10.3: laboratory analysis facts are valid only after the persisted
-- custody chain reached OPENED at or before the test occurrence time.
-- This remains PostgreSQL-authoritative even if an application preflight is raced.

CREATE OR REPLACE FUNCTION public.app_labs_require_opened_before_test()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, labs
AS $function$
DECLARE
  sample_record public."lab_samples"%ROWTYPE;
BEGIN
  SELECT * INTO sample_record
  FROM public."lab_samples"
  WHERE "id" = NEW."sampleId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'laboratory sample does not exist' USING ERRCODE = '23503';
  END IF;

  IF sample_record."custodyStatus" NOT IN ('OPENED', 'ANALYSIS_IN_PROGRESS')
     OR NOT EXISTS (
       SELECT 1
       FROM labs.sample_custody_events event
       WHERE event.sample_id = NEW."sampleId"
         AND event.tenant_id = sample_record."tenantId"
         AND event.event_type = 'OPENED'
         AND event.occurred_at <= NEW."recordedAt"
     )
  THEN
    RAISE EXCEPTION 'laboratory custody must be opened before test recording' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS lab_tests_require_opened_before_insert ON public."lab_tests";
CREATE TRIGGER lab_tests_require_opened_before_insert
BEFORE INSERT ON public."lab_tests"
FOR EACH ROW EXECUTE FUNCTION public.app_labs_require_opened_before_test();

DO $labs_opened_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT EXECUTE ON FUNCTION public.app_labs_require_opened_before_test() TO app_deal;
  END IF;
END
$labs_opened_grants$;
