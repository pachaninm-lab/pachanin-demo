-- IR-10.3 final physical-actor and custody-chain enforcement.
-- Privileged platform roles may provision authority and inspect records, but they
-- cannot impersonate the laboratory person who collected, transported, analysed
-- or signed a sample.

CREATE OR REPLACE FUNCTION public.app_labs_deal_authorized(
  p_deal_id TEXT,
  p_laboratory_org_id TEXT DEFAULT NULL,
  p_write BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, labs
AS $function$
  SELECT public.app_rls_context_ready()
    AND (
      public.app_rls_privileged()
      OR EXISTS (
        SELECT 1
        FROM public."deal_participants" participant
        WHERE participant."dealId" = p_deal_id
          AND participant."tenantId" = current_setting('app.current_tenant_id', true)
          AND participant."organizationId" = current_setting('app.current_org_id', true)
          AND participant."userId" = current_setting('app.current_user_id', true)
          AND participant."role" = current_setting('app.current_role', true)
          AND participant."status" = 'ACTIVE'
          AND participant."accessLevel" IN (
            CASE WHEN p_write THEN 'WORK' ELSE 'READ' END,
            CASE WHEN p_write THEN 'APPROVE' ELSE 'WORK' END,
            'APPROVE'
          )
      )
      OR (
        p_laboratory_org_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM labs.authorized_actors actor
          WHERE actor.tenant_id = current_setting('app.current_tenant_id', true)
            AND actor.laboratory_org_id = p_laboratory_org_id
            AND actor.user_id = current_setting('app.current_user_id', true)
            AND actor.status = 'ACTIVE'
            AND actor.valid_from <= now()
            AND (actor.valid_until IS NULL OR actor.valid_until > now())
        )
      )
    )
$function$;

CREATE OR REPLACE FUNCTION public.app_labs_test_physical_actor_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, labs
AS $function$
DECLARE
  sample_record public."lab_samples"%ROWTYPE;
  current_user_id TEXT := current_setting('app.current_user_id', true);
BEGIN
  SELECT * INTO sample_record
  FROM public."lab_samples"
  WHERE "id" = NEW."sampleId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'laboratory sample does not exist' USING ERRCODE = '23503';
  END IF;
  IF current_user_id IS NULL OR current_user_id = ''
     OR NEW."actorUserId" IS DISTINCT FROM current_user_id
     OR NOT public.app_labs_actor_valid(
       sample_record."tenantId", sample_record."labId", current_user_id,
       'ANALYST', NEW."recordedAt"
     )
  THEN
    RAISE EXCEPTION 'authorized ANALYST must record the laboratory test' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS labs_test_physical_actor_guard ON public."lab_tests";
CREATE TRIGGER labs_test_physical_actor_guard
BEFORE INSERT ON public."lab_tests"
FOR EACH ROW EXECUTE FUNCTION public.app_labs_test_physical_actor_guard();

CREATE OR REPLACE FUNCTION public.app_labs_custody_chain_valid(p_sample_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, labs
AS $function$
  WITH ordered AS (
    SELECT
      event.*,
      row_number() OVER (ORDER BY event.occurred_at, event.id) AS seq,
      lag(event.hash) OVER (ORDER BY event.occurred_at, event.id) AS prior_hash
    FROM labs.sample_custody_events event
    WHERE event.sample_id = p_sample_id
      AND event.event_type <> 'FINALIZED'
  ), summary AS (
    SELECT
      count(*) FILTER (WHERE event_type = 'CREATED') AS created_count,
      count(*) FILTER (WHERE event_type = 'COLLECTED') AS collected_count,
      count(*) FILTER (WHERE event_type = 'HANDOFF') AS handoff_count,
      count(*) FILTER (WHERE event_type = 'RECEIVED') AS received_count,
      count(*) FILTER (WHERE event_type = 'OPENED') AS opened_count,
      min(seq) FILTER (WHERE event_type = 'CREATED') AS created_seq,
      min(seq) FILTER (WHERE event_type = 'COLLECTED') AS collected_seq,
      min(seq) FILTER (WHERE event_type = 'HANDOFF') AS handoff_seq,
      min(seq) FILTER (WHERE event_type = 'RECEIVED') AS received_seq,
      min(seq) FILTER (WHERE event_type = 'OPENED') AS opened_seq,
      bool_and(
        hash IS NOT NULL AND hash <> ''
        AND prev_hash IS NOT DISTINCT FROM prior_hash
      ) AS hash_chain_continuous,
      bool_and(
        CASE event_type
          WHEN 'CREATED' THEN from_status = 'NONE' AND to_status = 'CREATED'
          WHEN 'COLLECTED' THEN from_status = 'CREATED' AND to_status = 'COLLECTED'
          WHEN 'HANDOFF' THEN from_status = 'COLLECTED' AND to_status = 'IN_TRANSIT'
          WHEN 'RECEIVED' THEN from_status = 'IN_TRANSIT' AND to_status = 'RECEIVED'
          WHEN 'OPENED' THEN from_status = 'RECEIVED' AND to_status = 'RECEIVED'
          WHEN 'SEALED' THEN from_status IN ('COLLECTED','IN_TRANSIT','RECEIVED')
          ELSE FALSE
        END
      ) AS transitions_valid
    FROM ordered
  )
  SELECT COALESCE(
    created_count = 1
    AND collected_count = 1
    AND handoff_count = 1
    AND received_count = 1
    AND opened_count = 1
    AND created_seq < collected_seq
    AND collected_seq < handoff_seq
    AND handoff_seq < received_seq
    AND received_seq < opened_seq
    AND hash_chain_continuous
    AND transitions_valid,
    FALSE
  )
  FROM summary
$function$;

CREATE OR REPLACE FUNCTION public.app_labs_sample_physical_actor_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, labs
AS $function$
DECLARE
  required_actor_type TEXT;
  current_user_id TEXT := current_setting('app.current_user_id', true);
BEGIN
  required_actor_type := CASE
    WHEN OLD."status" = 'CREATED' AND NEW."status" = 'COLLECTED' THEN 'SAMPLER'
    WHEN OLD."status" = 'COLLECTED' AND NEW."status" = 'IN_TRANSIT' THEN 'COURIER'
    WHEN OLD."status" = 'IN_TRANSIT' AND NEW."status" = 'RECEIVED' THEN 'RECEIVER'
    WHEN OLD."status" = 'RECEIVED' AND NEW."status" = 'ANALYSIS_IN_PROGRESS' THEN 'ANALYST'
    WHEN OLD."status" = 'ANALYSIS_IN_PROGRESS' AND NEW."status" = 'FINALIZED' THEN 'SIGNATORY'
    WHEN OLD."status" = NEW."status"
      AND NEW."custodyStatus" = 'SEALED'
      AND OLD."custodyStatus" <> 'SEALED' THEN 'COURIER'
    WHEN OLD."status" = NEW."status"
      AND NEW."custodyStatus" = 'OPENED'
      AND OLD."custodyStatus" <> 'OPENED' THEN 'ANALYST'
    ELSE NULL
  END;

  IF required_actor_type IS NOT NULL AND (
    current_user_id IS NULL OR current_user_id = ''
    OR NOT public.app_labs_actor_valid(
      OLD."tenantId", OLD."labId", current_user_id, required_actor_type, now()
    )
  ) THEN
    RAISE EXCEPTION 'physical laboratory actor type is not authorized for transition' USING ERRCODE = '42501';
  END IF;

  IF OLD."status" = 'ANALYSIS_IN_PROGRESS'
     AND NEW."status" = 'FINALIZED'
     AND NOT public.app_labs_custody_chain_valid(OLD."id")
  THEN
    RAISE EXCEPTION 'ordered continuous custody hash chain is required for finalization' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS labs_sample_physical_actor_guard ON public."lab_samples";
CREATE TRIGGER labs_sample_physical_actor_guard
BEFORE UPDATE ON public."lab_samples"
FOR EACH ROW EXECUTE FUNCTION public.app_labs_sample_physical_actor_guard();

DO $labs_physical_actor_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT EXECUTE ON FUNCTION public.app_labs_custody_chain_valid(TEXT) TO app_deal;
  END IF;
END
$labs_physical_actor_grants$;