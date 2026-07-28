BEGIN;

CREATE OR REPLACE FUNCTION tai_knowledge.register_source(
  p_id text,
  p_source_code text,
  p_source_class text,
  p_official_url text,
  p_host_pin text,
  p_rights_decision_id text,
  p_rights_status text,
  p_rights_reviewed_at date,
  p_rights_review_due_at date,
  p_audit_event_reference text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_existing tai_public_source_admissions%ROWTYPE;
  v_status text;
  v_shared boolean;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tai.ap14f1a.source:' || p_source_code, 0)
  );

  IF p_rights_review_due_at <= p_rights_reviewed_at THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'rights review due date must be later than reviewed date';
  END IF;

  IF p_rights_status = 'ALLOWED_SHARED_RAG' AND p_rights_review_due_at >= current_date THEN
    v_status := 'ADMITTED';
    v_shared := true;
  ELSIF p_rights_status = 'FORBIDDEN' THEN
    v_status := 'QUARANTINED';
    v_shared := false;
  ELSE
    v_status := 'REVIEW_REQUIRED';
    v_shared := false;
  END IF;

  SELECT * INTO v_existing
  FROM public.tai_public_source_admissions
  WHERE source_code = p_source_code
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.id = p_id
      AND v_existing.source_class = p_source_class
      AND v_existing.official_url = p_official_url
      AND v_existing.host_pin = p_host_pin
      AND v_existing.rights_decision_id = p_rights_decision_id
      AND v_existing.rights_status = p_rights_status
      AND v_existing.rights_reviewed_at = p_rights_reviewed_at
      AND v_existing.rights_review_due_at = p_rights_review_due_at
      AND v_existing.audit_event_reference = p_audit_event_reference
    THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'conflicting source registration';
  END IF;

  INSERT INTO public.tai_public_source_admissions (
    id, source_code, source_class, data_plane, official_url, host_pin,
    rights_decision_id, rights_status, rights_reviewed_at, rights_review_due_at,
    status, shared_index_allowed, model_weights_allowed, audit_event_reference
  ) VALUES (
    p_id, p_source_code, p_source_class, 'PUBLIC_OFFICIAL', p_official_url, p_host_pin,
    p_rights_decision_id, p_rights_status, p_rights_reviewed_at, p_rights_review_due_at,
    v_status, v_shared, false, p_audit_event_reference
  );

  RETURN p_id;
END
$function$;

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

REVOKE ALL ON FUNCTION tai_knowledge.register_source(text, text, text, text, text, text, text, date, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION tai_knowledge.record_artifact(text, text, text, text, bigint, text, text, text, date, date, timestamptz, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tai_knowledge.register_source(text, text, text, text, text, text, text, date, date, text) TO tai_knowledge_ingestor;
GRANT EXECUTE ON FUNCTION tai_knowledge.record_artifact(text, text, text, text, bigint, text, text, text, date, date, timestamptz, text, text, text) TO tai_knowledge_ingestor;

DROP VIEW public.tai_public_corpus_retrieval_entries;

ALTER TABLE public.tai_public_corpus_snapshot_members SET SCHEMA tai_knowledge;
ALTER TABLE public.tai_public_corpus_quarantine_events SET SCHEMA tai_knowledge;
ALTER TABLE public.tai_public_source_withdrawals SET SCHEMA tai_knowledge;
ALTER TABLE public.tai_public_source_artifacts SET SCHEMA tai_knowledge;
ALTER TABLE public.tai_public_source_versions SET SCHEMA tai_knowledge;
ALTER TABLE public.tai_public_source_admissions SET SCHEMA tai_knowledge;
ALTER TABLE public.tai_public_corpus_snapshots SET SCHEMA tai_knowledge;

CREATE VIEW public.tai_public_source_admissions AS
SELECT * FROM tai_knowledge.tai_public_source_admissions;

CREATE VIEW public.tai_public_source_versions AS
SELECT * FROM tai_knowledge.tai_public_source_versions;

CREATE VIEW public.tai_public_source_artifacts AS
SELECT * FROM tai_knowledge.tai_public_source_artifacts;

CREATE VIEW public.tai_public_corpus_quarantine_events AS
SELECT * FROM tai_knowledge.tai_public_corpus_quarantine_events;

CREATE VIEW public.tai_public_source_withdrawals AS
SELECT * FROM tai_knowledge.tai_public_source_withdrawals;

CREATE VIEW public.tai_public_corpus_snapshots AS
SELECT * FROM tai_knowledge.tai_public_corpus_snapshots;

CREATE VIEW public.tai_public_corpus_snapshot_members AS
SELECT * FROM tai_knowledge.tai_public_corpus_snapshot_members;

REVOKE ALL ON TABLE public.tai_public_source_admissions FROM PUBLIC, tai_knowledge_ingestor, tai_knowledge_reader;
REVOKE ALL ON TABLE public.tai_public_source_versions FROM PUBLIC, tai_knowledge_ingestor, tai_knowledge_reader;
REVOKE ALL ON TABLE public.tai_public_source_artifacts FROM PUBLIC, tai_knowledge_ingestor, tai_knowledge_reader;
REVOKE ALL ON TABLE public.tai_public_corpus_quarantine_events FROM PUBLIC, tai_knowledge_ingestor, tai_knowledge_reader;
REVOKE ALL ON TABLE public.tai_public_source_withdrawals FROM PUBLIC, tai_knowledge_ingestor, tai_knowledge_reader;
REVOKE ALL ON TABLE public.tai_public_corpus_snapshots FROM PUBLIC, tai_knowledge_ingestor, tai_knowledge_reader;
REVOKE ALL ON TABLE public.tai_public_corpus_snapshot_members FROM PUBLIC, tai_knowledge_ingestor, tai_knowledge_reader;

CREATE VIEW public.tai_public_corpus_retrieval_entries
WITH (security_barrier = true)
AS
SELECT
  snapshot.id AS snapshot_id,
  snapshot.snapshot_code,
  snapshot.manifest_sha256,
  artifact.id AS artifact_id,
  artifact.content_sha256,
  artifact.media_type,
  artifact.size_bytes,
  artifact.storage_reference,
  artifact.official_url,
  artifact.host_pin,
  artifact.publication_date,
  artifact.effective_date,
  artifact.observed_at,
  artifact.source_locator_kind,
  artifact.source_locator_value,
  source.id AS source_id,
  source.source_code,
  source.source_class,
  source.rights_decision_id,
  source.rights_review_due_at,
  source_version.id AS source_version_id,
  source_version.version_label
FROM public.tai_public_corpus_snapshots snapshot
JOIN public.tai_public_corpus_snapshot_members member ON member.snapshot_id = snapshot.id
JOIN public.tai_public_source_artifacts artifact ON artifact.id = member.artifact_id
JOIN public.tai_public_source_versions source_version ON source_version.id = artifact.source_version_id
JOIN public.tai_public_source_admissions source ON source.id = source_version.source_admission_id
LEFT JOIN LATERAL (
  SELECT withdrawal.action
  FROM public.tai_public_source_withdrawals withdrawal
  WHERE withdrawal.source_version_id = source_version.id
  ORDER BY withdrawal.created_at DESC, withdrawal.id DESC
  LIMIT 1
) latest_withdrawal ON true
WHERE snapshot.state = 'SEALED'
  AND artifact.state = 'ADMITTED'
  AND artifact.shared_index_eligible = true
  AND artifact.provenance_complete = true
  AND artifact.malware_checked = true
  AND artifact.content_type_checked = true
  AND artifact.prompt_injection_checked = true
  AND source_version.status = 'ADMITTED'
  AND source_version.shared_index_allowed = true
  AND source.status = 'ADMITTED'
  AND source.data_plane = 'PUBLIC_OFFICIAL'
  AND source.rights_status = 'ALLOWED_SHARED_RAG'
  AND source.rights_review_due_at >= current_date
  AND latest_withdrawal.action IS DISTINCT FROM 'WITHDRAW';

REVOKE ALL ON TABLE public.tai_public_corpus_retrieval_entries FROM PUBLIC;
GRANT SELECT ON TABLE public.tai_public_corpus_retrieval_entries TO tai_knowledge_ingestor, tai_knowledge_reader;

COMMENT ON SCHEMA tai_knowledge IS 'TAI AP-14F1A database-managed public-official corpus authority; excluded from Prisma Client authority and external source access.';
COMMENT ON VIEW public.tai_public_corpus_retrieval_entries IS 'Fail-closed retrieval surface over database-managed authority: sealed snapshot, admitted artifact/version/source, current rights and no active withdrawal.';

COMMIT;
