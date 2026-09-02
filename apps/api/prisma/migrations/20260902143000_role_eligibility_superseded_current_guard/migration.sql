-- Role Eligibility race guard: SUPERSEDED is immutable terminal evidence but can never be current.
-- This migration is bounded to eligibility.* and does not change registration authority or behavior.

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
  v_is_current BOOLEAN := p_new_verdict <> 'SUPERSEDED';
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

  -- A stale/raced result is historical evidence only. It must never replace
  -- the current eligibility decision for the authoritative application input.
  IF v_is_current AND v_previous_id IS NOT NULL THEN
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
    COALESCE(p_reason_codes, '[]'::jsonb), p_idempotency_key, v_is_current, v_now
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
      'isCurrent', v_is_current,
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

REVOKE ALL ON FUNCTION eligibility.publish_verdict(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, CHAR(64), CHAR(64), JSONB, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION eligibility.publish_verdict(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, CHAR(64), CHAR(64), JSONB, TEXT
) TO pc_role_eligibility_runtime;
