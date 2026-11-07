-- PC-CROP Role Eligibility enforcement state authority.
-- This contour is independent from registration and defaults fail-closed/off.
-- It creates no registration mutation path and does not enable enforcement.

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_role_eligibility_control') THEN
    CREATE ROLE pc_role_eligibility_control;
  END IF;
  ALTER ROLE pc_role_eligibility_control WITH
    NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
END
$roles$;

CREATE TABLE eligibility.enforcement_policies (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  policy_hash CHAR(64) NOT NULL,
  document JSONB NOT NULL,
  registered_sha CHAR(40) NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (policy_hash ~ '^[0-9a-f]{64}$'),
  CHECK (registered_sha ~ '^[0-9a-f]{40}$'),
  CHECK (jsonb_typeof(document) = 'object'),
  CHECK (length(version) BETWEEN 1 AND 64),
  CHECK (length(created_by) BETWEEN 1 AND 120),
  UNIQUE (version, policy_hash)
);

CREATE TABLE eligibility.enforcement_state (
  singleton SMALLINT PRIMARY KEY DEFAULT 1 CHECK (singleton = 1),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  generation BIGINT NOT NULL DEFAULT 0 CHECK (generation >= 0),
  exact_sha CHAR(40),
  policy_id TEXT REFERENCES eligibility.enforcement_policies(id) ON DELETE RESTRICT,
  updated_by TEXT NOT NULL DEFAULT 'migration',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (exact_sha IS NULL OR exact_sha ~ '^[0-9a-f]{40}$'),
  CHECK (NOT enabled OR (exact_sha IS NOT NULL AND policy_id IS NOT NULL))
);

INSERT INTO eligibility.enforcement_state(singleton, enabled, generation, exact_sha, policy_id, updated_by)
VALUES (1, FALSE, 0, NULL, NULL, 'migration')
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE eligibility.enforcement_state_history (
  idempotency_key CHAR(64) PRIMARY KEY,
  expected_generation BIGINT NOT NULL CHECK (expected_generation >= 0),
  generation BIGINT NOT NULL CHECK (generation >= 1),
  previous_enabled BOOLEAN NOT NULL,
  new_enabled BOOLEAN NOT NULL,
  exact_sha CHAR(40) NOT NULL,
  policy_id TEXT REFERENCES eligibility.enforcement_policies(id) ON DELETE RESTRICT,
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (idempotency_key ~ '^[0-9a-f]{64}$'),
  CHECK (exact_sha ~ '^[0-9a-f]{40}$'),
  CHECK (length(actor) BETWEEN 1 AND 120),
  CHECK (length(reason) BETWEEN 1 AND 240)
);

CREATE INDEX enforcement_state_history_generation_idx
  ON eligibility.enforcement_state_history(generation, created_at, idempotency_key);

CREATE TABLE eligibility.enforcement_audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'ROLE_ELIGIBILITY_ENFORCEMENT_ENABLED',
    'ROLE_ELIGIBILITY_ENFORCEMENT_DISABLED'
  )),
  generation BIGINT NOT NULL CHECK (generation >= 1),
  exact_sha CHAR(40) NOT NULL,
  policy_id TEXT REFERENCES eligibility.enforcement_policies(id) ON DELETE RESTRICT,
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  idempotency_key CHAR(64) NOT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (exact_sha ~ '^[0-9a-f]{40}$'),
  CHECK (idempotency_key ~ '^[0-9a-f]{64}$'),
  CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX enforcement_audit_events_generation_idx
  ON eligibility.enforcement_audit_events(generation, created_at, id);

CREATE TRIGGER enforcement_policies_append_only
BEFORE UPDATE OR DELETE ON eligibility.enforcement_policies
FOR EACH ROW EXECUTE FUNCTION eligibility.reject_append_only_mutation();

CREATE TRIGGER enforcement_state_history_append_only
BEFORE UPDATE OR DELETE ON eligibility.enforcement_state_history
FOR EACH ROW EXECUTE FUNCTION eligibility.reject_append_only_mutation();

CREATE TRIGGER enforcement_audit_events_append_only
BEFORE UPDATE OR DELETE ON eligibility.enforcement_audit_events
FOR EACH ROW EXECUTE FUNCTION eligibility.reject_append_only_mutation();

CREATE OR REPLACE FUNCTION eligibility.set_enforcement_state(
  p_enabled BOOLEAN,
  p_exact_sha TEXT,
  p_policy_id TEXT,
  p_expected_generation BIGINT,
  p_actor TEXT,
  p_reason TEXT,
  p_idempotency_key CHAR(64)
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, eligibility
AS $function$
DECLARE
  v_state eligibility.enforcement_state%ROWTYPE;
  v_policy eligibility.enforcement_policies%ROWTYPE;
  v_existing eligibility.enforcement_state_history%ROWTYPE;
  v_generation BIGINT;
  v_event_type TEXT;
BEGIN
  IF p_exact_sha IS NULL OR p_exact_sha !~ '^[0-9a-f]{40}$' THEN
    RAISE EXCEPTION 'ROLE_ELIGIBILITY_EXACT_SHA_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_expected_generation IS NULL OR p_expected_generation < 0 THEN
    RAISE EXCEPTION 'ROLE_ELIGIBILITY_EXPECTED_GENERATION_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_actor IS NULL OR length(p_actor) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'ROLE_ELIGIBILITY_CONTROL_ACTOR_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR length(p_reason) NOT BETWEEN 1 AND 240 THEN
    RAISE EXCEPTION 'ROLE_ELIGIBILITY_CONTROL_REASON_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_idempotency_key IS NULL OR p_idempotency_key !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'ROLE_ELIGIBILITY_CONTROL_IDEMPOTENCY_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM eligibility.enforcement_state_history
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing.expected_generation <> p_expected_generation
       OR v_existing.new_enabled IS DISTINCT FROM p_enabled
       OR btrim(v_existing.exact_sha) <> p_exact_sha
       OR v_existing.policy_id IS DISTINCT FROM p_policy_id
       OR v_existing.actor <> p_actor
       OR v_existing.reason <> p_reason THEN
      RAISE EXCEPTION 'ROLE_ELIGIBILITY_CONTROL_IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
    END IF;
    RETURN v_existing.generation;
  END IF;

  SELECT * INTO STRICT v_state
  FROM eligibility.enforcement_state
  WHERE singleton = 1
  FOR UPDATE;

  IF v_state.generation <> p_expected_generation THEN
    RAISE EXCEPTION 'ROLE_ELIGIBILITY_ENFORCEMENT_GENERATION_CONFLICT' USING ERRCODE = '40001';
  END IF;

  IF p_enabled THEN
    IF p_policy_id IS NULL OR btrim(p_policy_id) = '' THEN
      RAISE EXCEPTION 'ROLE_ELIGIBILITY_ENFORCEMENT_POLICY_REQUIRED' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO v_policy
    FROM eligibility.enforcement_policies
    WHERE id = p_policy_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ROLE_ELIGIBILITY_ENFORCEMENT_POLICY_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF btrim(v_policy.registered_sha) <> p_exact_sha THEN
      RAISE EXCEPTION 'ROLE_ELIGIBILITY_POLICY_EXACT_SHA_MISMATCH' USING ERRCODE = '23514';
    END IF;
  ELSIF p_policy_id IS NOT NULL THEN
    PERFORM 1 FROM eligibility.enforcement_policies WHERE id = p_policy_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ROLE_ELIGIBILITY_ENFORCEMENT_POLICY_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  v_generation := v_state.generation + 1;
  v_event_type := CASE WHEN p_enabled
    THEN 'ROLE_ELIGIBILITY_ENFORCEMENT_ENABLED'
    ELSE 'ROLE_ELIGIBILITY_ENFORCEMENT_DISABLED'
  END;

  UPDATE eligibility.enforcement_state
  SET enabled = p_enabled,
      generation = v_generation,
      exact_sha = p_exact_sha,
      policy_id = COALESCE(p_policy_id, policy_id),
      updated_by = p_actor,
      updated_at = clock_timestamp()
  WHERE singleton = 1;

  INSERT INTO eligibility.enforcement_state_history(
    idempotency_key, expected_generation, generation, previous_enabled, new_enabled,
    exact_sha, policy_id, actor, reason
  ) VALUES (
    p_idempotency_key, p_expected_generation, v_generation, v_state.enabled, p_enabled,
    p_exact_sha, COALESCE(p_policy_id, v_state.policy_id), p_actor, p_reason
  );

  INSERT INTO eligibility.enforcement_audit_events(
    id, event_type, generation, exact_sha, policy_id, actor, reason, idempotency_key, payload
  ) VALUES (
    'rea-' || p_idempotency_key,
    v_event_type,
    v_generation,
    p_exact_sha,
    COALESCE(p_policy_id, v_state.policy_id),
    p_actor,
    p_reason,
    p_idempotency_key,
    jsonb_build_object(
      'previousEnabled', v_state.enabled,
      'enabled', p_enabled,
      'expectedGeneration', p_expected_generation,
      'generation', v_generation,
      'exactSha', p_exact_sha,
      'policyId', COALESCE(p_policy_id, v_state.policy_id)
    )
  );

  INSERT INTO eligibility.outbox(
    id, event_type, aggregate_id, payload, idempotency_key
  ) VALUES (
    'reo-' || p_idempotency_key,
    v_event_type,
    'role-eligibility-enforcement',
    jsonb_build_object(
      'enabled', p_enabled,
      'generation', v_generation,
      'exactSha', p_exact_sha,
      'policyId', COALESCE(p_policy_id, v_state.policy_id),
      'actor', p_actor,
      'reason', p_reason
    ),
    'role-eligibility:enforcement:' || p_idempotency_key
  );

  RETURN v_generation;
END
$function$;

REVOKE ALL ON TABLE eligibility.enforcement_policies FROM PUBLIC;
REVOKE ALL ON TABLE eligibility.enforcement_state FROM PUBLIC;
REVOKE ALL ON TABLE eligibility.enforcement_state_history FROM PUBLIC;
REVOKE ALL ON TABLE eligibility.enforcement_audit_events FROM PUBLIC;
REVOKE ALL ON FUNCTION eligibility.set_enforcement_state(BOOLEAN, TEXT, TEXT, BIGINT, TEXT, TEXT, CHAR(64)) FROM PUBLIC;

GRANT USAGE ON SCHEMA eligibility TO pc_role_eligibility_control;
GRANT EXECUTE ON FUNCTION eligibility.set_enforcement_state(BOOLEAN, TEXT, TEXT, BIGINT, TEXT, TEXT, CHAR(64)) TO pc_role_eligibility_control;
GRANT SELECT ON eligibility.enforcement_policies, eligibility.enforcement_state TO pc_role_eligibility_runtime;

DO $runtime_boundary$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'pc_deal_runtime', 'app_runtime', 'one_deal_app', 'app_deal', 'app_service',
    'pc_auth_runtime', 'app_auth', 'auth_service'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE pc_role_eligibility_control FROM %I', role_name);
      EXECUTE format('GRANT USAGE ON SCHEMA eligibility TO %I', role_name);
      EXECUTE format('GRANT SELECT ON eligibility.enforcement_policies TO %I', role_name);
      EXECUTE format('GRANT SELECT ON eligibility.enforcement_state TO %I', role_name);
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON eligibility.enforcement_policies FROM %I', role_name);
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON eligibility.enforcement_state FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON eligibility.enforcement_state_history FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON eligibility.enforcement_audit_events FROM %I', role_name);
      EXECUTE format(
        'REVOKE ALL ON FUNCTION eligibility.set_enforcement_state(BOOLEAN, TEXT, TEXT, BIGINT, TEXT, TEXT, CHAR(64)) FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END
$runtime_boundary$;
