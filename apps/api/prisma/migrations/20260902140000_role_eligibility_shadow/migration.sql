-- PC-CROP Role Eligibility shadow authority.
-- Independent from registration state transitions. No registration table is mutated here.

CREATE SCHEMA IF NOT EXISTS eligibility;
REVOKE ALL ON SCHEMA eligibility FROM PUBLIC;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_role_eligibility_observer') THEN
    CREATE ROLE pc_role_eligibility_observer;
  END IF;
  ALTER ROLE pc_role_eligibility_observer WITH
    NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_role_eligibility_runtime') THEN
    CREATE ROLE pc_role_eligibility_runtime;
  END IF;
  ALTER ROLE pc_role_eligibility_runtime WITH
    NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
END
$roles$;

CREATE OR REPLACE FUNCTION auth.read_role_eligibility_candidates(
  p_application_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  application_id TEXT,
  application_version BIGINT,
  application_status TEXT,
  organization_id TEXT,
  tenant_id TEXT,
  requested_workspace TEXT,
  requested_role TEXT,
  inn TEXT,
  ogrn TEXT,
  kpp TEXT,
  legal_name TEXT,
  submitted_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, auth, public
SET row_security = on
AS $function$
  SELECT
    a.id,
    a.version,
    a.status,
    a.organization_id,
    o."tenantId",
    a.requested_workspace,
    a.requested_role,
    a.inn,
    a.ogrn,
    a.kpp,
    a.legal_name,
    a.submitted_at
  FROM auth.registration_applications AS a
  INNER JOIN public.organizations AS o ON o.id = a.organization_id
  WHERE p_application_id IS NULL OR a.id = p_application_id
  ORDER BY a.submitted_at, a.id
$function$;

REVOKE ALL ON FUNCTION auth.read_role_eligibility_candidates(TEXT) FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO pc_role_eligibility_observer;
GRANT EXECUTE ON FUNCTION auth.read_role_eligibility_candidates(TEXT) TO pc_role_eligibility_observer;
REVOKE ALL ON TABLE auth.registration_applications FROM pc_role_eligibility_observer;

CREATE TABLE eligibility.registry_generations (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  generation TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  downloaded_at TIMESTAMPTZ NOT NULL,
  content_sha256 CHAR(64) NOT NULL,
  record_count BIGINT NOT NULL CHECK (record_count >= 0),
  parser_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('STAGING', 'VALIDATED', 'ACTIVE', 'REJECTED')),
  fresh_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  validated_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  UNIQUE (source, generation),
  CHECK (content_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX registry_generations_one_active_per_source_idx
  ON eligibility.registry_generations(source)
  WHERE status = 'ACTIVE';
CREATE INDEX registry_generations_source_created_idx
  ON eligibility.registry_generations(source, created_at DESC);

CREATE TABLE eligibility.registry_records (
  id TEXT PRIMARY KEY,
  generation_id TEXT NOT NULL REFERENCES eligibility.registry_generations(id) ON DELETE RESTRICT,
  source TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  subject_inn TEXT,
  subject_ogrn TEXT,
  record_type TEXT NOT NULL,
  normalized_payload JSONB NOT NULL,
  source_published_at TIMESTAMPTZ NOT NULL,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  payload_sha256 CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  CHECK (subject_inn IS NOT NULL OR subject_ogrn IS NOT NULL),
  UNIQUE (generation_id, source_record_id, record_type, payload_sha256)
);

CREATE INDEX registry_records_inn_source_generation_idx
  ON eligibility.registry_records(subject_inn, source, generation_id)
  WHERE subject_inn IS NOT NULL;
CREATE INDEX registry_records_ogrn_source_generation_idx
  ON eligibility.registry_records(subject_ogrn, source, generation_id)
  WHERE subject_ogrn IS NOT NULL;

CREATE TABLE eligibility.organization_checks (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  application_version BIGINT NOT NULL CHECK (application_version >= 0),
  application_status_at_start TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  inn TEXT NOT NULL,
  ogrn TEXT,
  kpp TEXT,
  requested_workspace TEXT NOT NULL,
  requested_role TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'PENDING', 'CHECKING', 'ELIGIBLE', 'REVIEW_REQUIRED', 'APPARENT_MISMATCH',
    'SOURCE_UNAVAILABLE', 'STALE', 'NOT_APPLICABLE', 'SUPERSEDED', 'ERROR'
  )),
  policy_version TEXT NOT NULL,
  policy_hash CHAR(64) NOT NULL,
  source_manifest_hash CHAR(64),
  request_key CHAR(64) NOT NULL UNIQUE,
  correlation_id TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_recheck_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (policy_hash ~ '^[0-9a-f]{64}$'),
  CHECK (source_manifest_hash IS NULL OR source_manifest_hash ~ '^[0-9a-f]{64}$'),
  CHECK (request_key ~ '^[0-9a-f]{64}$')
);

CREATE INDEX organization_checks_application_created_idx
  ON eligibility.organization_checks(application_id, created_at DESC, id);
CREATE INDEX organization_checks_queue_idx
  ON eligibility.organization_checks(status, created_at, id)
  WHERE status IN ('PENDING', 'CHECKING');
CREATE INDEX organization_checks_tenant_application_idx
  ON eligibility.organization_checks(tenant_id, application_id, created_at DESC);

CREATE TABLE eligibility.evidence (
  id TEXT PRIMARY KEY,
  check_id TEXT NOT NULL REFERENCES eligibility.organization_checks(id) ON DELETE RESTRICT,
  source_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  registry_generation TEXT NOT NULL,
  subject_inn TEXT,
  subject_ogrn TEXT,
  evidence_type TEXT NOT NULL,
  normalized_payload JSONB NOT NULL,
  source_published_at TIMESTAMPTZ NOT NULL,
  source_checked_at TIMESTAMPTZ NOT NULL,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  fresh_until TIMESTAMPTZ NOT NULL,
  parser_version TEXT NOT NULL,
  payload_sha256 CHAR(64) NOT NULL,
  confidence_class TEXT NOT NULL CHECK (confidence_class IN ('HIGH', 'MEDIUM', 'LOW')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  CHECK (subject_inn IS NOT NULL OR subject_ogrn IS NOT NULL),
  UNIQUE (check_id, source_type, source_record_id, registry_generation, payload_sha256)
);

CREATE INDEX evidence_check_source_idx ON eligibility.evidence(check_id, source_type, id);
CREATE INDEX evidence_subject_inn_idx ON eligibility.evidence(subject_inn, source_type, created_at DESC)
  WHERE subject_inn IS NOT NULL;
CREATE INDEX evidence_subject_ogrn_idx ON eligibility.evidence(subject_ogrn, source_type, created_at DESC)
  WHERE subject_ogrn IS NOT NULL;

CREATE TABLE eligibility.verdicts (
  id TEXT PRIMARY KEY,
  check_id TEXT NOT NULL REFERENCES eligibility.organization_checks(id) ON DELETE RESTRICT,
  application_id TEXT NOT NULL,
  application_version BIGINT NOT NULL,
  organization_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  requested_role TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN (
    'ELIGIBLE', 'REVIEW_REQUIRED', 'APPARENT_MISMATCH', 'SOURCE_UNAVAILABLE',
    'STALE', 'NOT_APPLICABLE', 'SUPERSEDED', 'ERROR'
  )),
  policy_version TEXT NOT NULL,
  policy_hash CHAR(64) NOT NULL,
  source_manifest_hash CHAR(64) NOT NULL,
  reason_codes JSONB NOT NULL,
  idempotency_key CHAR(64) NOT NULL UNIQUE,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (policy_hash ~ '^[0-9a-f]{64}$'),
  CHECK (source_manifest_hash ~ '^[0-9a-f]{64}$'),
  CHECK (idempotency_key ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX verdicts_one_current_input_idx
  ON eligibility.verdicts(application_id, application_version, requested_role)
  WHERE is_current;
CREATE INDEX verdicts_tenant_application_idx
  ON eligibility.verdicts(tenant_id, application_id, created_at DESC);

CREATE TABLE eligibility.verdict_sources (
  verdict_id TEXT NOT NULL REFERENCES eligibility.verdicts(id) ON DELETE RESTRICT,
  source TEXT NOT NULL,
  generation TEXT NOT NULL,
  evidence_id TEXT NOT NULL REFERENCES eligibility.evidence(id) ON DELETE RESTRICT,
  evidence_hash CHAR(64) NOT NULL,
  source_published_at TIMESTAMPTZ NOT NULL,
  parser_version TEXT NOT NULL,
  PRIMARY KEY (verdict_id, source, evidence_id),
  CHECK (evidence_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE eligibility.verdict_history (
  id TEXT PRIMARY KEY,
  check_id TEXT NOT NULL REFERENCES eligibility.organization_checks(id) ON DELETE RESTRICT,
  previous_verdict TEXT,
  new_verdict TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  policy_hash CHAR(64) NOT NULL,
  source_manifest_hash CHAR(64) NOT NULL,
  reason_codes JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (policy_hash ~ '^[0-9a-f]{64}$'),
  CHECK (source_manifest_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX verdict_history_check_created_idx
  ON eligibility.verdict_history(check_id, created_at, id);

CREATE TABLE eligibility.audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'ROLE_ELIGIBILITY_STARTED',
    'ROLE_ELIGIBILITY_SOURCE_FETCH_STARTED',
    'ROLE_ELIGIBILITY_SOURCE_FETCH_SUCCEEDED',
    'ROLE_ELIGIBILITY_SOURCE_FETCH_FAILED',
    'ROLE_ELIGIBILITY_EVIDENCE_CREATED',
    'ROLE_ELIGIBILITY_ELIGIBLE',
    'ROLE_ELIGIBILITY_REVIEW_REQUIRED',
    'ROLE_ELIGIBILITY_APPARENT_MISMATCH',
    'ROLE_ELIGIBILITY_SOURCE_UNAVAILABLE',
    'ROLE_ELIGIBILITY_SUPERSEDED',
    'ROLE_ELIGIBILITY_RECHECK_STARTED',
    'ROLE_ELIGIBILITY_RECHECK_COMPLETED',
    'ROLE_ELIGIBILITY_POLICY_CHANGED'
  )),
  check_id TEXT,
  verdict_id TEXT,
  application_id TEXT,
  organization_id TEXT,
  tenant_id TEXT,
  correlation_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX audit_events_application_created_idx
  ON eligibility.audit_events(application_id, created_at, id)
  WHERE application_id IS NOT NULL;
CREATE INDEX audit_events_correlation_idx
  ON eligibility.audit_events(correlation_id, created_at, id);

CREATE TABLE eligibility.outbox (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  published_at TIMESTAMPTZ,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX eligibility_outbox_pending_idx
  ON eligibility.outbox(status, next_attempt_at, created_at, id)
  WHERE status = 'PENDING';

CREATE TABLE eligibility.source_health (
  source TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'STALE', 'SCHEMA_CHANGED')),
  circuit_state TEXT NOT NULL CHECK (circuit_state IN ('CLOSED', 'OPEN', 'HALF_OPEN')),
  active_generation TEXT,
  parser_version TEXT,
  schema_version TEXT,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  checked_at TIMESTAMPTZ NOT NULL,
  fresh_until TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  last_error_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE OR REPLACE FUNCTION eligibility.reject_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME
    USING ERRCODE = '55000';
END
$function$;

CREATE TRIGGER evidence_append_only
BEFORE UPDATE OR DELETE ON eligibility.evidence
FOR EACH ROW EXECUTE FUNCTION eligibility.reject_append_only_mutation();

CREATE TRIGGER verdict_sources_append_only
BEFORE UPDATE OR DELETE ON eligibility.verdict_sources
FOR EACH ROW EXECUTE FUNCTION eligibility.reject_append_only_mutation();

CREATE TRIGGER verdict_history_append_only
BEFORE UPDATE OR DELETE ON eligibility.verdict_history
FOR EACH ROW EXECUTE FUNCTION eligibility.reject_append_only_mutation();

CREATE TRIGGER audit_events_append_only
BEFORE UPDATE OR DELETE ON eligibility.audit_events
FOR EACH ROW EXECUTE FUNCTION eligibility.reject_append_only_mutation();

CREATE OR REPLACE FUNCTION eligibility.activate_registry_generation(
  p_source TEXT,
  p_generation TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, eligibility
AS $function$
DECLARE
  v_target_id TEXT;
BEGIN
  SELECT id INTO v_target_id
  FROM eligibility.registry_generations
  WHERE source = p_source AND generation = p_generation
  FOR UPDATE;

  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'registry generation not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM eligibility.registry_generations
    WHERE id = v_target_id AND status = 'VALIDATED'
  ) THEN
    RAISE EXCEPTION 'registry generation must be VALIDATED before activation' USING ERRCODE = '55000';
  END IF;

  UPDATE eligibility.registry_generations
  SET status = 'VALIDATED'
  WHERE source = p_source AND status = 'ACTIVE' AND id <> v_target_id;

  UPDATE eligibility.registry_generations
  SET status = 'ACTIVE', activated_at = clock_timestamp()
  WHERE id = v_target_id;

  RETURN v_target_id;
END
$function$;

CREATE OR REPLACE FUNCTION eligibility.publish_verdict(
  p_verdict_id TEXT,
  p_history_id TEXT,
  p_audit_id TEXT,
  p_outbox_id TEXT,
  p_check_id TEXT,
  p_new_verdict TEXT,
  p_reason_codes JSONB,
  p_source_manifest_hash CHAR(64),
  p_idempotency_key CHAR(64),
  p_sources JSONB,
  p_correlation_id TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, eligibility
AS $function$
DECLARE
  v_check eligibility.organization_checks%ROWTYPE;
  v_existing_id TEXT;
  v_previous_id TEXT;
  v_previous_verdict TEXT;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_event_type TEXT;
  v_source JSONB;
  v_evidence eligibility.evidence%ROWTYPE;
  v_evidence_refs JSONB := '[]'::jsonb;
BEGIN
  IF p_new_verdict NOT IN (
    'ELIGIBLE', 'REVIEW_REQUIRED', 'APPARENT_MISMATCH', 'SOURCE_UNAVAILABLE',
    'STALE', 'NOT_APPLICABLE', 'SUPERSEDED', 'ERROR'
  ) THEN
    RAISE EXCEPTION 'invalid terminal eligibility verdict' USING ERRCODE = '22023';
  END IF;
  IF p_source_manifest_hash IS NULL OR p_source_manifest_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid source manifest hash' USING ERRCODE = '22023';
  END IF;
  IF p_idempotency_key IS NULL OR p_idempotency_key !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid eligibility idempotency key' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_reason_codes, '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(COALESCE(p_sources, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'reason codes and sources must be arrays' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_check
  FROM eligibility.organization_checks
  WHERE id = p_check_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'eligibility check not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT id INTO v_existing_id
  FROM eligibility.verdicts
  WHERE idempotency_key = p_idempotency_key;
  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  IF p_new_verdict = 'ELIGIBLE' AND jsonb_array_length(COALESCE(p_sources, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'ELIGIBLE requires authoritative source provenance' USING ERRCODE = '23514';
  END IF;

  SELECT id, verdict INTO v_previous_id, v_previous_verdict
  FROM eligibility.verdicts
  WHERE application_id = v_check.application_id
    AND application_version = v_check.application_version
    AND requested_role = v_check.requested_role
    AND is_current
  FOR UPDATE;

  IF v_previous_id IS NOT NULL THEN
    UPDATE eligibility.verdicts SET is_current = FALSE WHERE id = v_previous_id;
  END IF;

  INSERT INTO eligibility.verdicts (
    id, check_id, application_id, application_version, organization_id, tenant_id,
    requested_role, verdict, policy_version, policy_hash, source_manifest_hash,
    reason_codes, idempotency_key, is_current, created_at
  ) VALUES (
    p_verdict_id, v_check.id, v_check.application_id, v_check.application_version,
    v_check.organization_id, v_check.tenant_id, v_check.requested_role, p_new_verdict,
    v_check.policy_version, v_check.policy_hash, p_source_manifest_hash,
    COALESCE(p_reason_codes, '[]'::jsonb), p_idempotency_key, TRUE, v_now
  );

  FOR v_source IN SELECT value FROM jsonb_array_elements(COALESCE(p_sources, '[]'::jsonb))
  LOOP
    SELECT * INTO v_evidence
    FROM eligibility.evidence
    WHERE id = v_source ->> 'evidenceId'
      AND check_id = v_check.id
      AND source_type = v_source ->> 'source'
      AND registry_generation = v_source ->> 'generation'
      AND payload_sha256 = v_source ->> 'evidenceHash'
      AND parser_version = v_source ->> 'parserVersion'
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'source manifest references unbound evidence' USING ERRCODE = '23514';
    END IF;

    INSERT INTO eligibility.verdict_sources (
      verdict_id, source, generation, evidence_id, evidence_hash, source_published_at, parser_version
    ) VALUES (
      p_verdict_id,
      v_source ->> 'source',
      v_source ->> 'generation',
      v_evidence.id,
      v_evidence.payload_sha256,
      v_evidence.source_published_at,
      v_evidence.parser_version
    );
    v_evidence_refs := v_evidence_refs || jsonb_build_array(v_evidence.id);
  END LOOP;

  UPDATE eligibility.organization_checks
  SET status = p_new_verdict,
      source_manifest_hash = p_source_manifest_hash,
      completed_at = v_now,
      updated_at = v_now
  WHERE id = v_check.id;

  INSERT INTO eligibility.verdict_history (
    id, check_id, previous_verdict, new_verdict, policy_version, policy_hash,
    source_manifest_hash, reason_codes, created_at
  ) VALUES (
    p_history_id, v_check.id, v_previous_verdict, p_new_verdict,
    v_check.policy_version, v_check.policy_hash, p_source_manifest_hash,
    COALESCE(p_reason_codes, '[]'::jsonb), v_now
  );

  v_event_type := CASE p_new_verdict
    WHEN 'ELIGIBLE' THEN 'ROLE_ELIGIBILITY_ELIGIBLE'
    WHEN 'REVIEW_REQUIRED' THEN 'ROLE_ELIGIBILITY_REVIEW_REQUIRED'
    WHEN 'APPARENT_MISMATCH' THEN 'ROLE_ELIGIBILITY_APPARENT_MISMATCH'
    WHEN 'SOURCE_UNAVAILABLE' THEN 'ROLE_ELIGIBILITY_SOURCE_UNAVAILABLE'
    WHEN 'SUPERSEDED' THEN 'ROLE_ELIGIBILITY_SUPERSEDED'
    ELSE 'ROLE_ELIGIBILITY_REVIEW_REQUIRED'
  END;

  INSERT INTO eligibility.audit_events (
    id, event_type, check_id, verdict_id, application_id, organization_id,
    tenant_id, correlation_id, payload, created_at
  ) VALUES (
    p_audit_id, v_event_type, v_check.id, p_verdict_id, v_check.application_id,
    v_check.organization_id, v_check.tenant_id, p_correlation_id,
    jsonb_build_object(
      'verdict', p_new_verdict,
      'policyVersion', v_check.policy_version,
      'policyHash', v_check.policy_hash,
      'sourceManifestHash', p_source_manifest_hash,
      'reasonCodes', COALESCE(p_reason_codes, '[]'::jsonb)
    ),
    v_now
  );

  INSERT INTO eligibility.outbox (
    id, event_type, aggregate_id, payload, idempotency_key,
    status, attempt_count, next_attempt_at, created_at, updated_at
  ) VALUES (
    p_outbox_id,
    'eligibility.organization.verdict.changed.v1',
    v_check.organization_id,
    jsonb_build_object(
      'applicationId', v_check.application_id,
      'applicationVersion', v_check.application_version,
      'organizationId', v_check.organization_id,
      'requestedRole', v_check.requested_role,
      'previousVerdict', v_previous_verdict,
      'newVerdict', p_new_verdict,
      'policyVersion', v_check.policy_version,
      'policyHash', v_check.policy_hash,
      'sourceManifestHash', p_source_manifest_hash,
      'evidenceRefs', v_evidence_refs,
      'correlationId', p_correlation_id,
      'occurredAt', v_now
    ),
    'eligibility:verdict:' || p_idempotency_key,
    'PENDING', 0, v_now, v_now, v_now
  );

  RETURN p_verdict_id;
END
$function$;

REVOKE ALL ON ALL TABLES IN SCHEMA eligibility FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA eligibility FROM PUBLIC;
GRANT USAGE ON SCHEMA eligibility TO pc_role_eligibility_runtime;
GRANT SELECT, INSERT, UPDATE ON eligibility.registry_generations TO pc_role_eligibility_runtime;
GRANT SELECT, INSERT ON eligibility.registry_records TO pc_role_eligibility_runtime;
GRANT SELECT, INSERT, UPDATE ON eligibility.organization_checks TO pc_role_eligibility_runtime;
GRANT SELECT, INSERT ON eligibility.evidence TO pc_role_eligibility_runtime;
GRANT SELECT ON eligibility.verdicts TO pc_role_eligibility_runtime;
GRANT SELECT ON eligibility.verdict_sources TO pc_role_eligibility_runtime;
GRANT SELECT ON eligibility.verdict_history TO pc_role_eligibility_runtime;
GRANT SELECT, INSERT ON eligibility.audit_events TO pc_role_eligibility_runtime;
GRANT SELECT, INSERT, UPDATE ON eligibility.outbox TO pc_role_eligibility_runtime;
GRANT SELECT, INSERT, UPDATE ON eligibility.source_health TO pc_role_eligibility_runtime;
GRANT EXECUTE ON FUNCTION eligibility.activate_registry_generation(TEXT, TEXT) TO pc_role_eligibility_runtime;
GRANT EXECUTE ON FUNCTION eligibility.publish_verdict(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, CHAR(64), CHAR(64), JSONB, TEXT) TO pc_role_eligibility_runtime;

DO $membership$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'auth_service', 'app_auth']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT pc_role_eligibility_observer TO %I', role_name);
      EXECUTE format('GRANT pc_role_eligibility_runtime TO %I', role_name);
    END IF;
  END LOOP;
END
$membership$;

COMMENT ON FUNCTION auth.read_role_eligibility_candidates(TEXT) IS
  'Bounded read-only authority for Role Eligibility. Returns only minimum registration candidate fields.';
COMMENT ON SCHEMA eligibility IS
  'Independent PostgreSQL authority for advisory/shadow organization Role Eligibility.';
