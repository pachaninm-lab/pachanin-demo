-- Founder / CEO Control Center authority.
--
-- These are platform-owner company-management records, not customer-tenant
-- records. The tenant runtime therefore gets no table privilege and no generic
-- RLS branch. The dedicated staff principal can reach the data only through
-- fixed SECURITY DEFINER functions that re-check a durable PLATFORM_OWNER
-- assignment and the exact live MFA-verified auth session supplied by the API.

CREATE TABLE auth.founder_control_records (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  record_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  source TEXT NOT NULL DEFAULT 'MANUAL',
  version BIGINT NOT NULL DEFAULT 0,
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT founder_control_records_payload_object CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT founder_control_records_status_known CHECK (status IN ('ACTIVE','ARCHIVED')),
  CONSTRAINT founder_control_records_identity_nonblank CHECK (btrim(record_type) <> '' AND btrim(record_key) <> ''),
  CONSTRAINT founder_control_records_type_known CHECK (record_type IN (
    'CEO_INPUT','PIPELINE_OPPORTUNITY','CLIENT','CASH_WEEK','AR_INVOICE','FORECAST',
    'ACTUAL_PERIOD','RETENTION_MRR','EVIDENCE','ASSUMPTION_CHANGE','MONTHLY_CLOSE',
    'DECISION','RESOURCE_ACTUAL'
  )),
  CONSTRAINT founder_control_records_created_by_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT founder_control_records_updated_by_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX founder_control_records_key ON auth.founder_control_records(record_type, record_key);
CREATE INDEX founder_control_records_scope_idx ON auth.founder_control_records(record_type, status, updated_at DESC);

CREATE TABLE auth.founder_control_events (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  record_type TEXT NOT NULL,
  record_key TEXT NOT NULL,
  action TEXT NOT NULL,
  result_status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_fingerprint TEXT NOT NULL,
  reason TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB NOT NULL,
  prev_hash TEXT,
  hash TEXT NOT NULL,
  aggregate_version BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT founder_control_events_record_fkey FOREIGN KEY (record_id) REFERENCES auth.founder_control_records(id) ON DELETE RESTRICT,
  CONSTRAINT founder_control_events_actor_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT founder_control_events_state_objects CHECK ((before_state IS NULL OR jsonb_typeof(before_state) = 'object') AND jsonb_typeof(after_state) = 'object'),
  CONSTRAINT founder_control_events_identity_nonblank CHECK (btrim(record_type) <> '' AND btrim(record_key) <> '' AND btrim(idempotency_key) <> '' AND btrim(correlation_id) <> '' AND btrim(reason) <> ''),
  CONSTRAINT founder_control_events_result_known CHECK (result_status IN ('APPLIED','REPLAY'))
);

CREATE UNIQUE INDEX founder_control_events_version_key ON auth.founder_control_events(record_type, record_key, aggregate_version);
CREATE INDEX founder_control_events_stream_idx ON auth.founder_control_events(record_type, record_key, created_at DESC, id DESC);
CREATE INDEX founder_control_events_correlation_idx ON auth.founder_control_events(correlation_id);

ALTER TABLE auth.founder_control_records OWNER TO pc_staff_authority;
ALTER TABLE auth.founder_control_events OWNER TO pc_staff_authority;
REVOKE ALL ON auth.founder_control_records FROM PUBLIC;
REVOKE ALL ON auth.founder_control_events FROM PUBLIC;
REVOKE ALL ON auth.founder_control_records FROM pc_staff_runtime;
REVOKE ALL ON auth.founder_control_events FROM pc_staff_runtime;

CREATE OR REPLACE FUNCTION auth.founder_control_owner_authorized(
  p_actor_user_id TEXT,
  p_session_id TEXT
) RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = auth, public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM auth.staff_assignments assignment
    JOIN auth.sessions session ON session.user_id = assignment.user_id
    WHERE assignment.user_id = p_actor_user_id
      AND assignment.role = 'PLATFORM_OWNER'
      AND assignment.status = 'ACTIVE'
      AND assignment.revoked_at IS NULL
      AND assignment.suspended_at IS NULL
      AND assignment.valid_from <= NOW()
      AND (assignment.valid_until IS NULL OR assignment.valid_until > NOW())
      AND session.id = p_session_id
      AND session.user_id = p_actor_user_id
      AND session.status = 'ACTIVE'
      AND session.revoked_at IS NULL
      AND session.expires_at > NOW()
      AND session.mfa_verified_at IS NOT NULL
  );
$function$;
ALTER FUNCTION auth.founder_control_owner_authorized(TEXT,TEXT) OWNER TO pc_staff_authority;
REVOKE ALL ON FUNCTION auth.founder_control_owner_authorized(TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.founder_control_owner_authorized(TEXT,TEXT) FROM pc_staff_runtime;

CREATE OR REPLACE FUNCTION auth.founder_control_list(
  p_actor_user_id TEXT,
  p_session_id TEXT,
  p_record_type TEXT DEFAULT NULL
) RETURNS TABLE (
  id TEXT,
  record_type TEXT,
  record_key TEXT,
  payload JSONB,
  status TEXT,
  source TEXT,
  version BIGINT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = auth, public, pg_temp
AS $function$
BEGIN
  IF NOT auth.founder_control_owner_authorized(p_actor_user_id, p_session_id) THEN
    RAISE EXCEPTION 'Founder control requires active PLATFORM_OWNER + MFA session' USING ERRCODE = '42501';
  END IF;
  IF p_record_type IS NOT NULL AND p_record_type NOT IN (
    'CEO_INPUT','PIPELINE_OPPORTUNITY','CLIENT','CASH_WEEK','AR_INVOICE','FORECAST',
    'ACTUAL_PERIOD','RETENTION_MRR','EVIDENCE','ASSUMPTION_CHANGE','MONTHLY_CLOSE',
    'DECISION','RESOURCE_ACTUAL'
  ) THEN
    RAISE EXCEPTION 'Unknown founder control record type' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT r.id, r.record_type, r.record_key, r.payload, r.status, r.source, r.version, r.updated_at
  FROM auth.founder_control_records r
  WHERE p_record_type IS NULL OR r.record_type = p_record_type
  ORDER BY r.record_type, r.record_key;
END
$function$;
ALTER FUNCTION auth.founder_control_list(TEXT,TEXT,TEXT) OWNER TO pc_staff_authority;
REVOKE ALL ON FUNCTION auth.founder_control_list(TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.founder_control_list(TEXT,TEXT,TEXT) TO pc_staff_runtime;

CREATE OR REPLACE FUNCTION auth.founder_control_event_list(
  p_actor_user_id TEXT,
  p_session_id TEXT,
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  id TEXT,
  record_type TEXT,
  record_key TEXT,
  action TEXT,
  result_status TEXT,
  reason TEXT,
  actor_user_id TEXT,
  correlation_id TEXT,
  aggregate_version BIGINT,
  created_at TIMESTAMPTZ,
  hash TEXT,
  prev_hash TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = auth, public, pg_temp
AS $function$
BEGIN
  IF NOT auth.founder_control_owner_authorized(p_actor_user_id, p_session_id) THEN
    RAISE EXCEPTION 'Founder control requires active PLATFORM_OWNER + MFA session' USING ERRCODE = '42501';
  END IF;
  IF p_limit < 1 OR p_limit > 200 THEN
    RAISE EXCEPTION 'Founder control event limit must be 1..200' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT e.id, e.record_type, e.record_key, e.action, e.result_status, e.reason,
         e.actor_user_id, e.correlation_id, e.aggregate_version, e.created_at, e.hash, e.prev_hash
  FROM auth.founder_control_events e
  ORDER BY e.created_at DESC, e.id DESC
  LIMIT p_limit;
END
$function$;
ALTER FUNCTION auth.founder_control_event_list(TEXT,TEXT,INTEGER) OWNER TO pc_staff_authority;
REVOKE ALL ON FUNCTION auth.founder_control_event_list(TEXT,TEXT,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.founder_control_event_list(TEXT,TEXT,INTEGER) TO pc_staff_runtime;

CREATE OR REPLACE FUNCTION auth.founder_control_upsert(
  p_actor_user_id TEXT,
  p_session_id TEXT,
  p_record_type TEXT,
  p_record_key TEXT,
  p_payload JSONB,
  p_status TEXT,
  p_source TEXT,
  p_reason TEXT,
  p_expected_version BIGINT,
  p_idempotency_key TEXT,
  p_correlation_id TEXT
) RETURNS TABLE (
  mutation_kind TEXT,
  id TEXT,
  record_type TEXT,
  record_key TEXT,
  payload JSONB,
  status TEXT,
  source TEXT,
  version BIGINT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, pg_temp
AS $function$
DECLARE
  current_record auth.founder_control_records%ROWTYPE;
  replay_event auth.founder_control_events%ROWTYPE;
  previous_hash TEXT;
  next_version BIGINT;
  record_id TEXT;
  event_id TEXT;
  request_fingerprint TEXT;
  before_state JSONB;
  after_state JSONB;
  event_material JSONB;
BEGIN
  IF NOT auth.founder_control_owner_authorized(p_actor_user_id, p_session_id) THEN
    RAISE EXCEPTION 'Founder control requires active PLATFORM_OWNER + MFA session' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.sessions session
    WHERE session.id = p_session_id AND session.user_id = p_actor_user_id
      AND session.status = 'ACTIVE' AND session.revoked_at IS NULL AND session.expires_at > NOW()
      AND session.mfa_verified_at IS NOT NULL
      AND session.mfa_verified_at >= NOW() - INTERVAL '15 minutes'
  ) THEN
    RAISE EXCEPTION 'Founder control write requires recent MFA' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('founder-control:idempotency:' || p_idempotency_key, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('founder-control:record:' || p_record_type || ':' || p_record_key, 0));
  IF p_record_type NOT IN (
    'CEO_INPUT','PIPELINE_OPPORTUNITY','CLIENT','CASH_WEEK','AR_INVOICE','FORECAST',
    'ACTUAL_PERIOD','RETENTION_MRR','EVIDENCE','ASSUMPTION_CHANGE','MONTHLY_CLOSE',
    'DECISION','RESOURCE_ACTUAL'
  ) OR btrim(p_record_key) = '' OR p_status NOT IN ('ACTIVE','ARCHIVED')
    OR jsonb_typeof(p_payload) <> 'object' OR btrim(p_source) = ''
    OR btrim(p_reason) = '' OR btrim(p_idempotency_key) = '' OR btrim(p_correlation_id) = '' THEN
    RAISE EXCEPTION 'Invalid founder control command' USING ERRCODE = '22023';
  END IF;
  IF p_expected_version < 0 THEN
    RAISE EXCEPTION 'Expected version must be non-negative' USING ERRCODE = '22023';
  END IF;

  request_fingerprint := encode(digest(convert_to(jsonb_build_object(
    'recordType',p_record_type,'recordKey',p_record_key,'payload',p_payload,
    'status',p_status,'source',p_source,'reason',p_reason,'expectedVersion',p_expected_version
  )::text,'UTF8'),'sha256'),'hex');

  SELECT * INTO replay_event FROM auth.founder_control_events WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF replay_event.request_fingerprint <> request_fingerprint THEN
      RAISE EXCEPTION 'Founder control idempotency conflict' USING ERRCODE = '23505';
    END IF;
    RETURN QUERY
      SELECT 'REPLAY', r.id, r.record_type, r.record_key, r.payload, r.status, r.source, r.version, r.updated_at
      FROM auth.founder_control_records r WHERE r.id = replay_event.record_id;
    RETURN;
  END IF;

  SELECT * INTO current_record
  FROM auth.founder_control_records r
  WHERE r.record_type = p_record_type AND r.record_key = p_record_key
  FOR UPDATE;

  IF FOUND THEN
    IF current_record.version <> p_expected_version THEN
      RAISE EXCEPTION 'Founder control version conflict' USING ERRCODE = '40001';
    END IF;
    record_id := current_record.id;
    next_version := current_record.version + 1;
    before_state := jsonb_build_object(
      'recordType',current_record.record_type,'recordKey',current_record.record_key,
      'payload',current_record.payload,'status',current_record.status,'source',current_record.source,
      'version',current_record.version::text
    );
    UPDATE auth.founder_control_records
      SET payload=p_payload,status=p_status,source=p_source,version=next_version,
          updated_by_user_id=p_actor_user_id,updated_at=NOW()
      WHERE founder_control_records.id=record_id;
  ELSE
    IF p_expected_version <> 0 THEN
      RAISE EXCEPTION 'New founder control record requires expected version 0' USING ERRCODE = '40001';
    END IF;
    record_id := gen_random_uuid()::text;
    next_version := 1;
    before_state := NULL;
    INSERT INTO auth.founder_control_records(
      id,record_type,record_key,payload,status,source,version,
      created_by_user_id,updated_by_user_id
    ) VALUES (
      record_id,p_record_type,p_record_key,p_payload,p_status,p_source,next_version,
      p_actor_user_id,p_actor_user_id
    );
  END IF;

  after_state := jsonb_build_object(
    'recordType',p_record_type,'recordKey',p_record_key,'payload',p_payload,
    'status',p_status,'source',p_source,'version',next_version::text
  );
  SELECT e.hash INTO previous_hash
  FROM auth.founder_control_events e
  WHERE e.record_type=p_record_type AND e.record_key=p_record_key
  ORDER BY e.aggregate_version DESC, e.created_at DESC LIMIT 1;

  event_id := gen_random_uuid()::text;
  event_material := jsonb_build_object(
    'id',event_id,'recordId',record_id,'recordType',p_record_type,'recordKey',p_record_key,
    'action',CASE WHEN before_state IS NULL THEN 'CREATE' ELSE 'UPSERT' END,
    'requestFingerprint',request_fingerprint,'reason',p_reason,'actorUserId',p_actor_user_id,
    'correlationId',p_correlation_id,'beforeState',before_state,'afterState',after_state,
    'previousHash',previous_hash,'aggregateVersion',next_version::text
  );
  INSERT INTO auth.founder_control_events(
    id,record_id,record_type,record_key,action,result_status,idempotency_key,
    request_fingerprint,reason,actor_user_id,correlation_id,before_state,after_state,
    prev_hash,hash,aggregate_version
  ) VALUES (
    event_id,record_id,p_record_type,p_record_key,
    CASE WHEN before_state IS NULL THEN 'CREATE' ELSE 'UPSERT' END,
    'APPLIED',p_idempotency_key,request_fingerprint,p_reason,p_actor_user_id,
    p_correlation_id,before_state,after_state,previous_hash,
    encode(digest(convert_to(event_material::text,'UTF8'),'sha256'),'hex'),next_version
  );

  RETURN QUERY
    SELECT 'APPLIED', r.id, r.record_type, r.record_key, r.payload, r.status, r.source, r.version, r.updated_at
    FROM auth.founder_control_records r WHERE r.id = record_id;
END
$function$;
ALTER FUNCTION auth.founder_control_upsert(TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT,TEXT,BIGINT,TEXT,TEXT) OWNER TO pc_staff_authority;
REVOKE ALL ON FUNCTION auth.founder_control_upsert(TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT,TEXT,BIGINT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.founder_control_upsert(TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT,TEXT,BIGINT,TEXT,TEXT) TO pc_staff_runtime;

DO $founder_control_runtime_grants$
DECLARE
  runtime_role TEXT;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('app_staff', 'one_deal_staff')
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA auth TO %I', runtime_role);
    EXECUTE format('GRANT EXECUTE ON FUNCTION auth.founder_control_list(text,text,text) TO %I', runtime_role);
    EXECUTE format('GRANT EXECUTE ON FUNCTION auth.founder_control_event_list(text,text,integer) TO %I', runtime_role);
    EXECUTE format('GRANT EXECUTE ON FUNCTION auth.founder_control_upsert(text,text,text,text,jsonb,text,text,text,bigint,text,text) TO %I', runtime_role);
  END LOOP;

  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_auth_runtime', 'pc_deal_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
      'app_auth', 'app_runtime', 'app_storage', 'app_outbox',
      'one_deal_auth', 'one_deal_app', 'one_deal_storage'
    )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION auth.founder_control_list(text,text,text) FROM %I', runtime_role);
    EXECUTE format('REVOKE ALL ON FUNCTION auth.founder_control_event_list(text,text,integer) FROM %I', runtime_role);
    EXECUTE format('REVOKE ALL ON FUNCTION auth.founder_control_upsert(text,text,text,text,jsonb,text,text,text,bigint,text,text) FROM %I', runtime_role);
  END LOOP;
END;
$founder_control_runtime_grants$;

CREATE OR REPLACE FUNCTION auth.founder_control_event_append_only()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, pg_temp
AS $function$
BEGIN
  RAISE EXCEPTION 'Founder control events are append-only' USING ERRCODE = '23000';
END
$function$;
ALTER FUNCTION auth.founder_control_event_append_only() OWNER TO pc_staff_authority;
REVOKE ALL ON FUNCTION auth.founder_control_event_append_only() FROM PUBLIC;
CREATE TRIGGER founder_control_event_append_only
BEFORE UPDATE OR DELETE ON auth.founder_control_events
FOR EACH ROW EXECUTE FUNCTION auth.founder_control_event_append_only();
