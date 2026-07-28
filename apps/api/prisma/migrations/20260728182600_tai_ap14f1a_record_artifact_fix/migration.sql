BEGIN;

CREATE OR REPLACE FUNCTION tai_knowledge.record_artifact(
  p_id text,
  p_source_version_id text,
  p_content_sha256 text,
  p_media_type text,
  p_size_bytes bigint,
  p_storage_reference text,
  p_official_url text,
  p_host_pin text,
  p_publication_date date,
  p_effective_date date,
  p_observed_at timestamptz,
  p_source_locator_kind text,
  p_source_locator_value text,
  p_audit_event_reference text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_source tai_public_source_admissions%ROWTYPE;
  v_source_version tai_public_source_versions%ROWTYPE;
  v_existing tai_public_source_artifacts%ROWTYPE;
BEGIN
  SELECT sv.*
  INTO v_source_version
  FROM public.tai_public_source_versions sv
  WHERE sv.id = p_source_version_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'source version does not exist';
  END IF;

  SELECT * INTO v_source
  FROM public.tai_public_source_admissions
  WHERE id = v_source_version.source_admission_id
  FOR UPDATE;

  IF v_source.status <> 'ADMITTED'
    OR v_source_version.status <> 'ADMITTED'
    OR v_source.rights_status <> 'ALLOWED_SHARED_RAG'
    OR v_source.rights_review_due_at < current_date
    OR v_source.official_url <> p_official_url
    OR v_source.host_pin <> p_host_pin
  THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'source version is not eligible or provenance host does not match';
  END IF;

  SELECT * INTO v_existing
  FROM public.tai_public_source_artifacts
  WHERE source_version_id = p_source_version_id
    AND content_sha256 = p_content_sha256
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.id = p_id
      AND v_existing.media_type = p_media_type
      AND v_existing.size_bytes = p_size_bytes
      AND v_existing.storage_reference = p_storage_reference
      AND v_existing.official_url = p_official_url
      AND v_existing.host_pin = p_host_pin
      AND v_existing.publication_date IS NOT DISTINCT FROM p_publication_date
      AND v_existing.effective_date IS NOT DISTINCT FROM p_effective_date
      AND v_existing.observed_at = p_observed_at
      AND v_existing.source_locator_kind = p_source_locator_kind
      AND v_existing.source_locator_value = p_source_locator_value
      AND v_existing.audit_event_reference = p_audit_event_reference
    THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'conflicting artifact registration';
  END IF;

  INSERT INTO public.tai_public_source_artifacts (
    id, source_version_id, data_plane, content_sha256, media_type, size_bytes,
    storage_reference, official_url, host_pin, publication_date, effective_date,
    observed_at, source_locator_kind, source_locator_value, rights_decision_id,
    state, provenance_complete, malware_checked, content_type_checked,
    prompt_injection_checked, shared_index_eligible, model_weights_allowed,
    audit_event_reference
  ) VALUES (
    p_id, p_source_version_id, 'PUBLIC_OFFICIAL', p_content_sha256, p_media_type, p_size_bytes,
    p_storage_reference, p_official_url, p_host_pin, p_publication_date, p_effective_date,
    p_observed_at, p_source_locator_kind, p_source_locator_value, v_source.rights_decision_id,
    'QUARANTINED', false, false, false, false, false, false,
    p_audit_event_reference
  );

  RETURN p_id;
END
$function$;

REVOKE ALL ON FUNCTION tai_knowledge.record_artifact(text, text, text, text, bigint, text, text, text, date, date, timestamptz, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tai_knowledge.record_artifact(text, text, text, text, bigint, text, text, text, date, date, timestamptz, text, text, text) TO tai_knowledge_ingestor;

COMMIT;
