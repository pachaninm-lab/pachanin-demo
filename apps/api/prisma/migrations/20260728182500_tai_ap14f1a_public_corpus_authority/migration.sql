BEGIN;

CREATE SCHEMA IF NOT EXISTS tai_knowledge;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tai_knowledge_ingestor') THEN
    EXECUTE 'CREATE ROLE tai_knowledge_ingestor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tai_knowledge_reader') THEN
    EXECUTE 'CREATE ROLE tai_knowledge_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS';
  END IF;
END
$roles$;

REVOKE ALL ON SCHEMA tai_knowledge FROM PUBLIC;
GRANT USAGE ON SCHEMA tai_knowledge TO tai_knowledge_ingestor, tai_knowledge_reader;

CREATE TABLE tai_public_source_admissions (
  id                       text PRIMARY KEY,
  source_code              text NOT NULL UNIQUE,
  source_class             text NOT NULL,
  data_plane               text NOT NULL DEFAULT 'PUBLIC_OFFICIAL',
  official_url             text NOT NULL,
  host_pin                 text NOT NULL,
  rights_decision_id       text NOT NULL,
  rights_status            text NOT NULL,
  rights_reviewed_at       date NOT NULL,
  rights_review_due_at     date NOT NULL,
  status                   text NOT NULL DEFAULT 'REVIEW_REQUIRED',
  shared_index_allowed     boolean NOT NULL DEFAULT false,
  model_weights_allowed    boolean NOT NULL DEFAULT false,
  audit_event_reference    text NOT NULL,
  version                  bigint NOT NULL DEFAULT 0,
  created_at               timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  updated_at               timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tai_public_source_id_ck CHECK (id ~ '^src_[a-z0-9]{12,80}$'),
  CONSTRAINT tai_public_source_code_ck CHECK (source_code ~ '^[a-z0-9][a-z0-9._-]{4,160}$'),
  CONSTRAINT tai_public_source_class_ck CHECK (source_class IN ('OFFICIAL_MANUAL', 'OFFICIAL_REGULATION', 'OPEN_DATASET', 'PUBLIC_REGISTRY')),
  CONSTRAINT tai_public_source_plane_ck CHECK (data_plane = 'PUBLIC_OFFICIAL'),
  CONSTRAINT tai_public_source_url_ck CHECK (official_url ~ '^https://[a-z0-9.-]+(?:/|$)'),
  CONSTRAINT tai_public_source_host_ck CHECK (host_pin ~ '^[a-z0-9](?:[a-z0-9.-]{2,251}[a-z0-9])?$' AND host_pin = lower(host_pin)),
  CONSTRAINT tai_public_source_url_host_ck CHECK (official_url = ('https://' || host_pin) OR official_url LIKE ('https://' || host_pin || '/%')),
  CONSTRAINT tai_public_source_rights_id_ck CHECK (rights_decision_id ~ '^AP14F0-[A-Z0-9_-]{5,100}$'),
  CONSTRAINT tai_public_source_rights_status_ck CHECK (rights_status IN ('REVIEW_REQUIRED', 'METADATA_ONLY', 'ALLOWED_SHARED_RAG', 'FORBIDDEN')),
  CONSTRAINT tai_public_source_review_window_ck CHECK (rights_review_due_at > rights_reviewed_at),
  CONSTRAINT tai_public_source_status_ck CHECK (status IN ('REVIEW_REQUIRED', 'ADMITTED', 'QUARANTINED', 'WITHDRAWN')),
  CONSTRAINT tai_public_source_shared_ck CHECK (
    shared_index_allowed = false
    OR (status = 'ADMITTED' AND rights_status = 'ALLOWED_SHARED_RAG')
  ),
  CONSTRAINT tai_public_source_model_weights_ck CHECK (model_weights_allowed = false),
  CONSTRAINT tai_public_source_audit_ck CHECK (audit_event_reference ~ '^audit_[a-z0-9]{12,100}$'),
  CONSTRAINT tai_public_source_version_ck CHECK (version >= 0)
);

CREATE INDEX tai_public_source_status_idx
  ON tai_public_source_admissions (status, rights_review_due_at, source_code);
CREATE INDEX tai_public_source_rights_idx
  ON tai_public_source_admissions (rights_status, rights_review_due_at);

CREATE TABLE tai_public_source_versions (
  id                       text PRIMARY KEY,
  source_admission_id      text NOT NULL,
  data_plane               text NOT NULL DEFAULT 'PUBLIC_OFFICIAL',
  version_label            text NOT NULL,
  publication_date         date,
  effective_date           date,
  observed_at              timestamptz(6) NOT NULL,
  source_locator_kind      text NOT NULL,
  source_locator_value     text NOT NULL,
  rights_decision_id       text NOT NULL,
  status                   text NOT NULL DEFAULT 'DRAFT',
  shared_index_allowed     boolean NOT NULL DEFAULT false,
  model_weights_allowed    boolean NOT NULL DEFAULT false,
  audit_event_reference    text NOT NULL,
  version                  bigint NOT NULL DEFAULT 0,
  created_at               timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  updated_at               timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tai_public_source_version_source_fk
    FOREIGN KEY (source_admission_id) REFERENCES tai_public_source_admissions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT tai_public_source_version_id_ck CHECK (id ~ '^srcver_[a-z0-9]{12,80}$'),
  CONSTRAINT tai_public_source_version_plane_ck CHECK (data_plane = 'PUBLIC_OFFICIAL'),
  CONSTRAINT tai_public_source_version_label_ck CHECK (version_label ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$'),
  CONSTRAINT tai_public_source_version_dates_ck CHECK (publication_date IS NOT NULL OR effective_date IS NOT NULL),
  CONSTRAINT tai_public_source_version_locator_kind_ck CHECK (source_locator_kind IN ('PAGE', 'ROW', 'SECTION', 'RECORD_ID', 'JSON_POINTER', 'XML_XPATH', 'API_FIELD')),
  CONSTRAINT tai_public_source_version_locator_value_ck CHECK (length(source_locator_value) BETWEEN 1 AND 500),
  CONSTRAINT tai_public_source_version_rights_id_ck CHECK (rights_decision_id ~ '^AP14F0-[A-Z0-9_-]{5,100}$'),
  CONSTRAINT tai_public_source_version_status_ck CHECK (status IN ('DRAFT', 'ADMITTED', 'QUARANTINED', 'WITHDRAWN')),
  CONSTRAINT tai_public_source_version_shared_ck CHECK (shared_index_allowed = false OR status = 'ADMITTED'),
  CONSTRAINT tai_public_source_version_model_weights_ck CHECK (model_weights_allowed = false),
  CONSTRAINT tai_public_source_version_audit_ck CHECK (audit_event_reference ~ '^audit_[a-z0-9]{12,100}$'),
  CONSTRAINT tai_public_source_version_counter_ck CHECK (version >= 0),
  CONSTRAINT tai_public_source_version_identity_key UNIQUE (source_admission_id, version_label)
);

CREATE INDEX tai_public_source_version_status_idx
  ON tai_public_source_versions (source_admission_id, status, observed_at DESC, id);

CREATE TABLE tai_public_source_artifacts (
  id                       text PRIMARY KEY,
  source_version_id        text NOT NULL,
  data_plane               text NOT NULL DEFAULT 'PUBLIC_OFFICIAL',
  content_sha256           char(64) NOT NULL,
  media_type               text NOT NULL,
  size_bytes               bigint NOT NULL,
  storage_reference        text NOT NULL UNIQUE,
  official_url             text NOT NULL,
  host_pin                 text NOT NULL,
  publication_date         date,
  effective_date           date,
  observed_at              timestamptz(6) NOT NULL,
  source_locator_kind      text NOT NULL,
  source_locator_value     text NOT NULL,
  rights_decision_id       text NOT NULL,
  state                    text NOT NULL DEFAULT 'QUARANTINED',
  provenance_complete      boolean NOT NULL DEFAULT false,
  malware_checked          boolean NOT NULL DEFAULT false,
  content_type_checked     boolean NOT NULL DEFAULT false,
  prompt_injection_checked boolean NOT NULL DEFAULT false,
  shared_index_eligible    boolean NOT NULL DEFAULT false,
  model_weights_allowed    boolean NOT NULL DEFAULT false,
  audit_event_reference    text NOT NULL,
  version                  bigint NOT NULL DEFAULT 0,
  created_at               timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  updated_at               timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tai_public_artifact_source_version_fk
    FOREIGN KEY (source_version_id) REFERENCES tai_public_source_versions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT tai_public_artifact_id_ck CHECK (id ~ '^artifact_[a-z0-9]{12,80}$'),
  CONSTRAINT tai_public_artifact_plane_ck CHECK (data_plane = 'PUBLIC_OFFICIAL'),
  CONSTRAINT tai_public_artifact_sha_ck CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT tai_public_artifact_media_type_ck CHECK (media_type ~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$'),
  CONSTRAINT tai_public_artifact_size_ck CHECK (size_bytes > 0 AND size_bytes <= 1073741824),
  CONSTRAINT tai_public_artifact_storage_ck CHECK (storage_reference ~ '^(artifact-ref|evidence-ref):[A-Za-z0-9._/-]{6,240}$'),
  CONSTRAINT tai_public_artifact_url_ck CHECK (official_url ~ '^https://[a-z0-9.-]+(?:/|$)'),
  CONSTRAINT tai_public_artifact_host_ck CHECK (host_pin ~ '^[a-z0-9](?:[a-z0-9.-]{2,251}[a-z0-9])?$' AND host_pin = lower(host_pin)),
  CONSTRAINT tai_public_artifact_url_host_ck CHECK (official_url = ('https://' || host_pin) OR official_url LIKE ('https://' || host_pin || '/%')),
  CONSTRAINT tai_public_artifact_dates_ck CHECK (publication_date IS NOT NULL OR effective_date IS NOT NULL),
  CONSTRAINT tai_public_artifact_locator_kind_ck CHECK (source_locator_kind IN ('PAGE', 'ROW', 'SECTION', 'RECORD_ID', 'JSON_POINTER', 'XML_XPATH', 'API_FIELD')),
  CONSTRAINT tai_public_artifact_locator_value_ck CHECK (length(source_locator_value) BETWEEN 1 AND 500),
  CONSTRAINT tai_public_artifact_rights_id_ck CHECK (rights_decision_id ~ '^AP14F0-[A-Z0-9_-]{5,100}$'),
  CONSTRAINT tai_public_artifact_state_ck CHECK (state IN ('QUARANTINED', 'ADMITTED', 'WITHDRAWN')),
  CONSTRAINT tai_public_artifact_shared_ck CHECK (
    shared_index_eligible = false
    OR (
      state = 'ADMITTED'
      AND provenance_complete
      AND malware_checked
      AND content_type_checked
      AND prompt_injection_checked
    )
  ),
  CONSTRAINT tai_public_artifact_model_weights_ck CHECK (model_weights_allowed = false),
  CONSTRAINT tai_public_artifact_audit_ck CHECK (audit_event_reference ~ '^audit_[a-z0-9]{12,100}$'),
  CONSTRAINT tai_public_artifact_counter_ck CHECK (version >= 0),
  CONSTRAINT tai_public_artifact_digest_key UNIQUE (source_version_id, content_sha256)
);

CREATE INDEX tai_public_artifact_state_idx
  ON tai_public_source_artifacts (source_version_id, state, observed_at DESC, id);
CREATE INDEX tai_public_artifact_sha_idx
  ON tai_public_source_artifacts (content_sha256);

CREATE TABLE tai_public_corpus_quarantine_events (
  id                              text PRIMARY KEY,
  artifact_id                     text NOT NULL,
  action                          text NOT NULL,
  reason_code                     text NOT NULL,
  details                         text NOT NULL,
  retryable                       boolean NOT NULL,
  mfa_verified                    boolean NOT NULL,
  decided_by_subject_hash         char(64) NOT NULL,
  evidence_reference              text NOT NULL,
  replacement_provenance_record_id text,
  audit_event_reference           text NOT NULL UNIQUE,
  created_at                      timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tai_public_quarantine_artifact_fk
    FOREIGN KEY (artifact_id) REFERENCES tai_public_source_artifacts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT tai_public_quarantine_id_ck CHECK (id ~ '^quarantine_[a-z0-9]{12,80}$'),
  CONSTRAINT tai_public_quarantine_action_ck CHECK (action IN ('QUARANTINE', 'HUMAN_RELEASED', 'HUMAN_REJECTED')),
  CONSTRAINT tai_public_quarantine_reason_ck CHECK (reason_code IN (
    'RIGHTS_UNRESOLVED',
    'REUSE_FORBIDDEN',
    'PROVENANCE_INCOMPLETE',
    'HOST_NOT_PINNED',
    'DIGEST_MISMATCH',
    'SOURCE_STALE',
    'AUTHORITY_REVIEW_OVERDUE',
    'PERSONAL_OR_SECRET_DATA',
    'CABINET_OR_CREDENTIAL_MATERIAL',
    'TENANT_BOUNDARY_MISSING',
    'CROSS_TENANT_RISK',
    'PROMPT_INJECTION_OR_UNTRUSTED_INSTRUCTIONS'
  )),
  CONSTRAINT tai_public_quarantine_details_ck CHECK (length(details) BETWEEN 12 AND 2000),
  CONSTRAINT tai_public_quarantine_mfa_ck CHECK (mfa_verified = true),
  CONSTRAINT tai_public_quarantine_actor_ck CHECK (decided_by_subject_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT tai_public_quarantine_evidence_ck CHECK (evidence_reference ~ '^evidence-ref:[A-Za-z0-9._/-]{6,240}$'),
  CONSTRAINT tai_public_quarantine_provenance_ck CHECK (
    replacement_provenance_record_id IS NULL
    OR replacement_provenance_record_id ~ '^prov_[a-z0-9]{16,64}$'
  ),
  CONSTRAINT tai_public_quarantine_audit_ck CHECK (audit_event_reference ~ '^audit_[a-z0-9]{12,100}$')
);

CREATE INDEX tai_public_quarantine_artifact_idx
  ON tai_public_corpus_quarantine_events (artifact_id, created_at DESC, id DESC);

CREATE TABLE tai_public_source_withdrawals (
  id                       text PRIMARY KEY,
  source_version_id        text NOT NULL,
  action                   text NOT NULL,
  reason                   text NOT NULL,
  mfa_verified             boolean NOT NULL,
  decided_by_subject_hash  char(64) NOT NULL,
  audit_event_reference    text NOT NULL UNIQUE,
  created_at               timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tai_public_withdrawal_source_version_fk
    FOREIGN KEY (source_version_id) REFERENCES tai_public_source_versions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT tai_public_withdrawal_id_ck CHECK (id ~ '^withdrawal_[a-z0-9]{12,80}$'),
  CONSTRAINT tai_public_withdrawal_action_ck CHECK (action IN ('WITHDRAW', 'RESTORE')),
  CONSTRAINT tai_public_withdrawal_reason_ck CHECK (length(reason) BETWEEN 20 AND 2000),
  CONSTRAINT tai_public_withdrawal_mfa_ck CHECK (mfa_verified = true),
  CONSTRAINT tai_public_withdrawal_actor_ck CHECK (decided_by_subject_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT tai_public_withdrawal_audit_ck CHECK (audit_event_reference ~ '^audit_[a-z0-9]{12,100}$')
);

CREATE INDEX tai_public_withdrawal_version_idx
  ON tai_public_source_withdrawals (source_version_id, created_at DESC, id DESC);

CREATE TABLE tai_public_corpus_snapshots (
  id                       text PRIMARY KEY,
  snapshot_code            text NOT NULL UNIQUE,
  data_plane               text NOT NULL DEFAULT 'PUBLIC_OFFICIAL',
  state                    text NOT NULL DEFAULT 'BUILDING',
  manifest_sha256          char(64),
  member_count             integer NOT NULL DEFAULT 0,
  audit_event_reference    text NOT NULL,
  version                  bigint NOT NULL DEFAULT 0,
  created_at               timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  sealed_at                timestamptz(6),
  withdrawn_at             timestamptz(6),
  updated_at               timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tai_public_snapshot_id_ck CHECK (id ~ '^snapshot_[a-z0-9]{12,80}$'),
  CONSTRAINT tai_public_snapshot_code_ck CHECK (snapshot_code ~ '^[a-z0-9][a-z0-9._-]{4,160}$'),
  CONSTRAINT tai_public_snapshot_plane_ck CHECK (data_plane = 'PUBLIC_OFFICIAL'),
  CONSTRAINT tai_public_snapshot_state_ck CHECK (state IN ('BUILDING', 'SEALED', 'WITHDRAWN')),
  CONSTRAINT tai_public_snapshot_manifest_ck CHECK (manifest_sha256 IS NULL OR manifest_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT tai_public_snapshot_member_count_ck CHECK (member_count >= 0),
  CONSTRAINT tai_public_snapshot_audit_ck CHECK (audit_event_reference ~ '^audit_[a-z0-9]{12,100}$'),
  CONSTRAINT tai_public_snapshot_counter_ck CHECK (version >= 0),
  CONSTRAINT tai_public_snapshot_lifecycle_ck CHECK (
    (state = 'BUILDING' AND sealed_at IS NULL AND withdrawn_at IS NULL)
    OR (state = 'SEALED' AND sealed_at IS NOT NULL AND withdrawn_at IS NULL AND manifest_sha256 IS NOT NULL AND member_count > 0)
    OR (state = 'WITHDRAWN' AND withdrawn_at IS NOT NULL)
  )
);

CREATE INDEX tai_public_snapshot_state_idx
  ON tai_public_corpus_snapshots (state, created_at DESC, id);

CREATE TABLE tai_public_corpus_snapshot_members (
  snapshot_id             text NOT NULL,
  artifact_id             text NOT NULL,
  artifact_sha256         char(64) NOT NULL,
  audit_event_reference   text NOT NULL UNIQUE,
  created_at              timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (snapshot_id, artifact_id),
  CONSTRAINT tai_public_snapshot_member_snapshot_fk
    FOREIGN KEY (snapshot_id) REFERENCES tai_public_corpus_snapshots(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT tai_public_snapshot_member_artifact_fk
    FOREIGN KEY (artifact_id) REFERENCES tai_public_source_artifacts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT tai_public_snapshot_member_sha_ck CHECK (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT tai_public_snapshot_member_audit_ck CHECK (audit_event_reference ~ '^audit_[a-z0-9]{12,100}$')
);

CREATE INDEX tai_public_snapshot_member_artifact_idx
  ON tai_public_corpus_snapshot_members (artifact_id, snapshot_id);

CREATE OR REPLACE FUNCTION tai_knowledge.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION tai_knowledge.deny_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = format('hard delete is forbidden for authority table %I.%I', TG_TABLE_SCHEMA, TG_TABLE_NAME);
END
$function$;

CREATE OR REPLACE FUNCTION tai_knowledge.deny_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = format('append-only authority table %I.%I cannot be updated or deleted', TG_TABLE_SCHEMA, TG_TABLE_NAME);
END
$function$;

CREATE TRIGGER tai_public_source_touch
BEFORE UPDATE ON tai_public_source_admissions
FOR EACH ROW EXECUTE FUNCTION tai_knowledge.touch_updated_at();
CREATE TRIGGER tai_public_source_no_delete
BEFORE DELETE ON tai_public_source_admissions
FOR EACH ROW EXECUTE FUNCTION tai_knowledge.deny_hard_delete();

CREATE TRIGGER tai_public_source_version_touch
BEFORE UPDATE ON tai_public_source_versions
FOR EACH ROW EXECUTE FUNCTION tai_knowledge.touch_updated_at();
CREATE TRIGGER tai_public_source_version_no_delete
BEFORE DELETE ON tai_public_source_versions
FOR EACH ROW EXECUTE FUNCTION tai_knowledge.deny_hard_delete();

CREATE TRIGGER tai_public_artifact_touch
BEFORE UPDATE ON tai_public_source_artifacts
FOR EACH ROW EXECUTE FUNCTION tai_knowledge.touch_updated_at();
CREATE TRIGGER tai_public_artifact_no_delete
BEFORE DELETE ON tai_public_source_artifacts
FOR EACH ROW EXECUTE FUNCTION tai_knowledge.deny_hard_delete();

CREATE TRIGGER tai_public_quarantine_append_only
BEFORE UPDATE OR DELETE ON tai_public_corpus_quarantine_events
FOR EACH ROW EXECUTE FUNCTION tai_knowledge.deny_append_only_mutation();

CREATE TRIGGER tai_public_withdrawal_append_only
BEFORE UPDATE OR DELETE ON tai_public_source_withdrawals
FOR EACH ROW EXECUTE FUNCTION tai_knowledge.deny_append_only_mutation();

CREATE TRIGGER tai_public_snapshot_touch
BEFORE UPDATE ON tai_public_corpus_snapshots
FOR EACH ROW EXECUTE FUNCTION tai_knowledge.touch_updated_at();
CREATE TRIGGER tai_public_snapshot_no_delete
BEFORE DELETE ON tai_public_corpus_snapshots
FOR EACH ROW EXECUTE FUNCTION tai_knowledge.deny_hard_delete();

CREATE TRIGGER tai_public_snapshot_member_append_only
BEFORE UPDATE OR DELETE ON tai_public_corpus_snapshot_members
FOR EACH ROW EXECUTE FUNCTION tai_knowledge.deny_append_only_mutation();

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

CREATE OR REPLACE FUNCTION tai_knowledge.register_source_version(
  p_id text,
  p_source_admission_id text,
  p_version_label text,
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
  v_existing tai_public_source_versions%ROWTYPE;
BEGIN
  SELECT * INTO v_source
  FROM public.tai_public_source_admissions
  WHERE id = p_source_admission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'source admission does not exist';
  END IF;
  IF v_source.data_plane <> 'PUBLIC_OFFICIAL'
    OR v_source.status <> 'ADMITTED'
    OR v_source.shared_index_allowed IS DISTINCT FROM true
    OR v_source.rights_status <> 'ALLOWED_SHARED_RAG'
    OR v_source.rights_review_due_at < current_date
  THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'source is not currently admitted for shared RAG';
  END IF;

  SELECT * INTO v_existing
  FROM public.tai_public_source_versions
  WHERE source_admission_id = p_source_admission_id
    AND version_label = p_version_label
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.id = p_id
      AND v_existing.publication_date IS NOT DISTINCT FROM p_publication_date
      AND v_existing.effective_date IS NOT DISTINCT FROM p_effective_date
      AND v_existing.observed_at = p_observed_at
      AND v_existing.source_locator_kind = p_source_locator_kind
      AND v_existing.source_locator_value = p_source_locator_value
      AND v_existing.audit_event_reference = p_audit_event_reference
    THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'conflicting source version registration';
  END IF;

  INSERT INTO public.tai_public_source_versions (
    id, source_admission_id, data_plane, version_label, publication_date, effective_date,
    observed_at, source_locator_kind, source_locator_value, rights_decision_id,
    status, shared_index_allowed, model_weights_allowed, audit_event_reference
  ) VALUES (
    p_id, p_source_admission_id, 'PUBLIC_OFFICIAL', p_version_label, p_publication_date, p_effective_date,
    p_observed_at, p_source_locator_kind, p_source_locator_value, v_source.rights_decision_id,
    'ADMITTED', true, false, p_audit_event_reference
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
  SELECT sv.*, s.id AS source_id
  INTO v_source_version
  FROM public.tai_public_source_versions sv
  JOIN public.tai_public_source_admissions s ON s.id = sv.source_admission_id
  WHERE sv.id = p_source_version_id
  FOR UPDATE OF sv;

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

CREATE OR REPLACE FUNCTION tai_knowledge.decide_artifact(
  p_event_id text,
  p_artifact_id text,
  p_decision text,
  p_reason_code text,
  p_details text,
  p_retryable boolean,
  p_provenance_complete boolean,
  p_malware_checked boolean,
  p_content_type_checked boolean,
  p_prompt_injection_checked boolean,
  p_mfa_verified boolean,
  p_decided_by_subject_hash text,
  p_evidence_reference text,
  p_replacement_provenance_record_id text,
  p_audit_event_reference text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_artifact tai_public_source_artifacts%ROWTYPE;
  v_source_version tai_public_source_versions%ROWTYPE;
  v_source tai_public_source_admissions%ROWTYPE;
  v_existing tai_public_corpus_quarantine_events%ROWTYPE;
  v_latest_withdrawal text;
BEGIN
  IF p_mfa_verified IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'MFA is required for artifact decisions';
  END IF;

  SELECT * INTO v_existing
  FROM public.tai_public_corpus_quarantine_events
  WHERE id = p_event_id;

  IF FOUND THEN
    IF v_existing.artifact_id = p_artifact_id
      AND v_existing.action = CASE WHEN p_decision = 'ADMIT' THEN 'HUMAN_RELEASED' WHEN p_decision = 'REJECT' THEN 'HUMAN_REJECTED' ELSE 'QUARANTINE' END
      AND v_existing.audit_event_reference = p_audit_event_reference
    THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'conflicting artifact decision event';
  END IF;

  SELECT * INTO v_artifact
  FROM public.tai_public_source_artifacts
  WHERE id = p_artifact_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'artifact does not exist';
  END IF;

  SELECT * INTO v_source_version
  FROM public.tai_public_source_versions
  WHERE id = v_artifact.source_version_id
  FOR UPDATE;

  SELECT * INTO v_source
  FROM public.tai_public_source_admissions
  WHERE id = v_source_version.source_admission_id
  FOR UPDATE;

  SELECT w.action INTO v_latest_withdrawal
  FROM public.tai_public_source_withdrawals w
  WHERE w.source_version_id = v_source_version.id
  ORDER BY w.created_at DESC, w.id DESC
  LIMIT 1;

  IF p_decision = 'ADMIT' THEN
    IF p_provenance_complete IS DISTINCT FROM true
      OR p_malware_checked IS DISTINCT FROM true
      OR p_content_type_checked IS DISTINCT FROM true
      OR p_prompt_injection_checked IS DISTINCT FROM true
    THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'all artifact safety and provenance checks are required';
    END IF;
    IF v_source.status <> 'ADMITTED'
      OR v_source_version.status <> 'ADMITTED'
      OR v_source.rights_status <> 'ALLOWED_SHARED_RAG'
      OR v_source.rights_review_due_at < current_date
      OR v_latest_withdrawal = 'WITHDRAW'
    THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'artifact source is not currently eligible';
    END IF;

    UPDATE public.tai_public_source_artifacts
    SET state = 'ADMITTED',
        provenance_complete = true,
        malware_checked = true,
        content_type_checked = true,
        prompt_injection_checked = true,
        shared_index_eligible = true,
        version = version + 1,
        audit_event_reference = p_audit_event_reference
    WHERE id = p_artifact_id;
  ELSIF p_decision IN ('QUARANTINE', 'REJECT') THEN
    UPDATE public.tai_public_source_artifacts
    SET state = 'QUARANTINED',
        provenance_complete = p_provenance_complete,
        malware_checked = p_malware_checked,
        content_type_checked = p_content_type_checked,
        prompt_injection_checked = p_prompt_injection_checked,
        shared_index_eligible = false,
        version = version + 1,
        audit_event_reference = p_audit_event_reference
    WHERE id = p_artifact_id;
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'unsupported artifact decision';
  END IF;

  INSERT INTO public.tai_public_corpus_quarantine_events (
    id, artifact_id, action, reason_code, details, retryable, mfa_verified,
    decided_by_subject_hash, evidence_reference, replacement_provenance_record_id,
    audit_event_reference
  ) VALUES (
    p_event_id,
    p_artifact_id,
    CASE WHEN p_decision = 'ADMIT' THEN 'HUMAN_RELEASED' WHEN p_decision = 'REJECT' THEN 'HUMAN_REJECTED' ELSE 'QUARANTINE' END,
    p_reason_code,
    p_details,
    p_retryable,
    true,
    p_decided_by_subject_hash,
    p_evidence_reference,
    p_replacement_provenance_record_id,
    p_audit_event_reference
  );

  RETURN p_event_id;
END
$function$;

CREATE OR REPLACE FUNCTION tai_knowledge.record_withdrawal(
  p_id text,
  p_source_version_id text,
  p_action text,
  p_reason text,
  p_mfa_verified boolean,
  p_decided_by_subject_hash text,
  p_audit_event_reference text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_source_version tai_public_source_versions%ROWTYPE;
  v_source tai_public_source_admissions%ROWTYPE;
  v_existing tai_public_source_withdrawals%ROWTYPE;
BEGIN
  IF p_mfa_verified IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'MFA is required for withdrawal decisions';
  END IF;

  SELECT * INTO v_existing
  FROM public.tai_public_source_withdrawals
  WHERE id = p_id;

  IF FOUND THEN
    IF v_existing.source_version_id = p_source_version_id
      AND v_existing.action = p_action
      AND v_existing.audit_event_reference = p_audit_event_reference
    THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'conflicting withdrawal event';
  END IF;

  SELECT * INTO v_source_version
  FROM public.tai_public_source_versions
  WHERE id = p_source_version_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'source version does not exist';
  END IF;

  SELECT * INTO v_source
  FROM public.tai_public_source_admissions
  WHERE id = v_source_version.source_admission_id
  FOR UPDATE;

  IF p_action = 'WITHDRAW' THEN
    UPDATE public.tai_public_source_versions
    SET status = 'WITHDRAWN', shared_index_allowed = false, version = version + 1,
        audit_event_reference = p_audit_event_reference
    WHERE id = p_source_version_id;

    UPDATE public.tai_public_source_artifacts
    SET state = 'WITHDRAWN', shared_index_eligible = false, version = version + 1,
        audit_event_reference = p_audit_event_reference
    WHERE source_version_id = p_source_version_id;
  ELSIF p_action = 'RESTORE' THEN
    IF v_source.status <> 'ADMITTED'
      OR v_source.rights_status <> 'ALLOWED_SHARED_RAG'
      OR v_source.rights_review_due_at < current_date
    THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'current source rights are required for restoration';
    END IF;

    UPDATE public.tai_public_source_versions
    SET status = 'ADMITTED', shared_index_allowed = true, version = version + 1,
        audit_event_reference = p_audit_event_reference
    WHERE id = p_source_version_id;

    UPDATE public.tai_public_source_artifacts
    SET state = CASE
          WHEN provenance_complete AND malware_checked AND content_type_checked AND prompt_injection_checked THEN 'ADMITTED'
          ELSE 'QUARANTINED'
        END,
        shared_index_eligible = provenance_complete AND malware_checked AND content_type_checked AND prompt_injection_checked,
        version = version + 1,
        audit_event_reference = p_audit_event_reference
    WHERE source_version_id = p_source_version_id
      AND state = 'WITHDRAWN';
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'unsupported withdrawal action';
  END IF;

  INSERT INTO public.tai_public_source_withdrawals (
    id, source_version_id, action, reason, mfa_verified,
    decided_by_subject_hash, audit_event_reference
  ) VALUES (
    p_id, p_source_version_id, p_action, p_reason, true,
    p_decided_by_subject_hash, p_audit_event_reference
  );

  RETURN p_id;
END
$function$;

CREATE OR REPLACE FUNCTION tai_knowledge.create_snapshot(
  p_id text,
  p_snapshot_code text,
  p_audit_event_reference text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_existing tai_public_corpus_snapshots%ROWTYPE;
BEGIN
  SELECT * INTO v_existing
  FROM public.tai_public_corpus_snapshots
  WHERE snapshot_code = p_snapshot_code
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.id = p_id AND v_existing.audit_event_reference = p_audit_event_reference THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'conflicting snapshot registration';
  END IF;

  INSERT INTO public.tai_public_corpus_snapshots (
    id, snapshot_code, data_plane, state, member_count, audit_event_reference
  ) VALUES (
    p_id, p_snapshot_code, 'PUBLIC_OFFICIAL', 'BUILDING', 0, p_audit_event_reference
  );

  RETURN p_id;
END
$function$;

CREATE OR REPLACE FUNCTION tai_knowledge.add_snapshot_member(
  p_snapshot_id text,
  p_artifact_id text,
  p_audit_event_reference text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_snapshot tai_public_corpus_snapshots%ROWTYPE;
  v_artifact tai_public_source_artifacts%ROWTYPE;
  v_source_version tai_public_source_versions%ROWTYPE;
  v_source tai_public_source_admissions%ROWTYPE;
  v_latest_withdrawal text;
  v_existing_sha char(64);
BEGIN
  SELECT * INTO v_snapshot
  FROM public.tai_public_corpus_snapshots
  WHERE id = p_snapshot_id
  FOR UPDATE;

  IF NOT FOUND OR v_snapshot.state <> 'BUILDING' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'snapshot must exist and be BUILDING';
  END IF;

  SELECT * INTO v_artifact
  FROM public.tai_public_source_artifacts
  WHERE id = p_artifact_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'artifact does not exist';
  END IF;

  SELECT * INTO v_source_version
  FROM public.tai_public_source_versions
  WHERE id = v_artifact.source_version_id
  FOR SHARE;

  SELECT * INTO v_source
  FROM public.tai_public_source_admissions
  WHERE id = v_source_version.source_admission_id
  FOR SHARE;

  SELECT w.action INTO v_latest_withdrawal
  FROM public.tai_public_source_withdrawals w
  WHERE w.source_version_id = v_source_version.id
  ORDER BY w.created_at DESC, w.id DESC
  LIMIT 1;

  IF v_artifact.state <> 'ADMITTED'
    OR v_artifact.shared_index_eligible IS DISTINCT FROM true
    OR v_source_version.status <> 'ADMITTED'
    OR v_source_version.shared_index_allowed IS DISTINCT FROM true
    OR v_source.status <> 'ADMITTED'
    OR v_source.rights_status <> 'ALLOWED_SHARED_RAG'
    OR v_source.rights_review_due_at < current_date
    OR v_latest_withdrawal = 'WITHDRAW'
  THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'artifact is not currently eligible for snapshot membership';
  END IF;

  SELECT artifact_sha256 INTO v_existing_sha
  FROM public.tai_public_corpus_snapshot_members
  WHERE snapshot_id = p_snapshot_id AND artifact_id = p_artifact_id;

  IF FOUND THEN
    IF v_existing_sha = v_artifact.content_sha256 THEN
      RETURN p_artifact_id;
    END IF;
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'conflicting snapshot member digest';
  END IF;

  INSERT INTO public.tai_public_corpus_snapshot_members (
    snapshot_id, artifact_id, artifact_sha256, audit_event_reference
  ) VALUES (
    p_snapshot_id, p_artifact_id, v_artifact.content_sha256, p_audit_event_reference
  );

  RETURN p_artifact_id;
END
$function$;

CREATE OR REPLACE FUNCTION tai_knowledge.seal_snapshot(
  p_snapshot_id text,
  p_manifest_sha256 text,
  p_audit_event_reference text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_snapshot tai_public_corpus_snapshots%ROWTYPE;
  v_member_count integer;
  v_invalid_count integer;
BEGIN
  SELECT * INTO v_snapshot
  FROM public.tai_public_corpus_snapshots
  WHERE id = p_snapshot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'snapshot does not exist';
  END IF;
  IF v_snapshot.state = 'SEALED' AND v_snapshot.manifest_sha256 = p_manifest_sha256 THEN
    RETURN p_snapshot_id;
  END IF;
  IF v_snapshot.state <> 'BUILDING' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'only a BUILDING snapshot can be sealed';
  END IF;

  SELECT count(*)::integer INTO v_member_count
  FROM public.tai_public_corpus_snapshot_members
  WHERE snapshot_id = p_snapshot_id;

  IF v_member_count < 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'snapshot must contain at least one member';
  END IF;

  SELECT count(*)::integer INTO v_invalid_count
  FROM public.tai_public_corpus_snapshot_members sm
  JOIN public.tai_public_source_artifacts a ON a.id = sm.artifact_id
  JOIN public.tai_public_source_versions sv ON sv.id = a.source_version_id
  JOIN public.tai_public_source_admissions s ON s.id = sv.source_admission_id
  LEFT JOIN LATERAL (
    SELECT w.action
    FROM public.tai_public_source_withdrawals w
    WHERE w.source_version_id = sv.id
    ORDER BY w.created_at DESC, w.id DESC
    LIMIT 1
  ) latest_withdrawal ON true
  WHERE sm.snapshot_id = p_snapshot_id
    AND (
      sm.artifact_sha256 <> a.content_sha256
      OR a.state <> 'ADMITTED'
      OR a.shared_index_eligible IS DISTINCT FROM true
      OR sv.status <> 'ADMITTED'
      OR sv.shared_index_allowed IS DISTINCT FROM true
      OR s.status <> 'ADMITTED'
      OR s.rights_status <> 'ALLOWED_SHARED_RAG'
      OR s.rights_review_due_at < current_date
      OR latest_withdrawal.action = 'WITHDRAW'
    );

  IF v_invalid_count <> 0 THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'snapshot contains ineligible members';
  END IF;

  UPDATE public.tai_public_corpus_snapshots
  SET state = 'SEALED',
      manifest_sha256 = p_manifest_sha256,
      member_count = v_member_count,
      sealed_at = clock_timestamp(),
      audit_event_reference = p_audit_event_reference,
      version = version + 1
  WHERE id = p_snapshot_id;

  RETURN p_snapshot_id;
END
$function$;

CREATE OR REPLACE FUNCTION tai_knowledge.withdraw_snapshot(
  p_snapshot_id text,
  p_reason text,
  p_mfa_verified boolean,
  p_audit_event_reference text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_snapshot tai_public_corpus_snapshots%ROWTYPE;
BEGIN
  IF p_mfa_verified IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'MFA is required to withdraw a snapshot';
  END IF;
  IF length(p_reason) < 20 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'snapshot withdrawal reason is too short';
  END IF;

  SELECT * INTO v_snapshot
  FROM public.tai_public_corpus_snapshots
  WHERE id = p_snapshot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'snapshot does not exist';
  END IF;
  IF v_snapshot.state = 'WITHDRAWN' THEN
    RETURN p_snapshot_id;
  END IF;
  IF v_snapshot.state <> 'SEALED' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'only a SEALED snapshot can be withdrawn';
  END IF;

  UPDATE public.tai_public_corpus_snapshots
  SET state = 'WITHDRAWN',
      withdrawn_at = clock_timestamp(),
      audit_event_reference = p_audit_event_reference,
      version = version + 1
  WHERE id = p_snapshot_id;

  RETURN p_snapshot_id;
END
$function$;

CREATE VIEW tai_public_corpus_retrieval_entries
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
FROM tai_public_corpus_snapshots snapshot
JOIN tai_public_corpus_snapshot_members member ON member.snapshot_id = snapshot.id
JOIN tai_public_source_artifacts artifact ON artifact.id = member.artifact_id
JOIN tai_public_source_versions source_version ON source_version.id = artifact.source_version_id
JOIN tai_public_source_admissions source ON source.id = source_version.source_admission_id
LEFT JOIN LATERAL (
  SELECT withdrawal.action
  FROM tai_public_source_withdrawals withdrawal
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

REVOKE ALL ON TABLE tai_public_source_admissions FROM PUBLIC, tai_knowledge_ingestor, tai_knowledge_reader;
REVOKE ALL ON TABLE tai_public_source_versions FROM PUBLIC, tai_knowledge_ingestor, tai_knowledge_reader;
REVOKE ALL ON TABLE tai_public_source_artifacts FROM PUBLIC, tai_knowledge_ingestor, tai_knowledge_reader;
REVOKE ALL ON TABLE tai_public_corpus_quarantine_events FROM PUBLIC, tai_knowledge_ingestor, tai_knowledge_reader;
REVOKE ALL ON TABLE tai_public_source_withdrawals FROM PUBLIC, tai_knowledge_ingestor, tai_knowledge_reader;
REVOKE ALL ON TABLE tai_public_corpus_snapshots FROM PUBLIC, tai_knowledge_ingestor, tai_knowledge_reader;
REVOKE ALL ON TABLE tai_public_corpus_snapshot_members FROM PUBLIC, tai_knowledge_ingestor, tai_knowledge_reader;
REVOKE ALL ON TABLE tai_public_corpus_retrieval_entries FROM PUBLIC;

GRANT SELECT ON TABLE tai_public_corpus_retrieval_entries TO tai_knowledge_ingestor, tai_knowledge_reader;

REVOKE ALL ON FUNCTION tai_knowledge.register_source(text, text, text, text, text, text, text, date, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION tai_knowledge.register_source_version(text, text, text, date, date, timestamptz, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION tai_knowledge.record_artifact(text, text, text, text, bigint, text, text, text, date, date, timestamptz, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION tai_knowledge.decide_artifact(text, text, text, text, text, boolean, boolean, boolean, boolean, boolean, boolean, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION tai_knowledge.record_withdrawal(text, text, text, text, boolean, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION tai_knowledge.create_snapshot(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION tai_knowledge.add_snapshot_member(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION tai_knowledge.seal_snapshot(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION tai_knowledge.withdraw_snapshot(text, text, boolean, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION tai_knowledge.register_source(text, text, text, text, text, text, text, date, date, text) TO tai_knowledge_ingestor;
GRANT EXECUTE ON FUNCTION tai_knowledge.register_source_version(text, text, text, date, date, timestamptz, text, text, text) TO tai_knowledge_ingestor;
GRANT EXECUTE ON FUNCTION tai_knowledge.record_artifact(text, text, text, text, bigint, text, text, text, date, date, timestamptz, text, text, text) TO tai_knowledge_ingestor;
GRANT EXECUTE ON FUNCTION tai_knowledge.decide_artifact(text, text, text, text, text, boolean, boolean, boolean, boolean, boolean, boolean, text, text, text, text) TO tai_knowledge_ingestor;
GRANT EXECUTE ON FUNCTION tai_knowledge.record_withdrawal(text, text, text, text, boolean, text, text) TO tai_knowledge_ingestor;
GRANT EXECUTE ON FUNCTION tai_knowledge.create_snapshot(text, text, text) TO tai_knowledge_ingestor;
GRANT EXECUTE ON FUNCTION tai_knowledge.add_snapshot_member(text, text, text) TO tai_knowledge_ingestor;
GRANT EXECUTE ON FUNCTION tai_knowledge.seal_snapshot(text, text, text) TO tai_knowledge_ingestor;
GRANT EXECUTE ON FUNCTION tai_knowledge.withdraw_snapshot(text, text, boolean, text) TO tai_knowledge_ingestor;

COMMENT ON SCHEMA tai_knowledge IS 'TAI AP-14F1A controlled public-official corpus authority; no source fetch or real-source admission in this slice.';
COMMENT ON VIEW tai_public_corpus_retrieval_entries IS 'Fail-closed retrieval surface: sealed snapshot, admitted artifact/version/source, current rights and no active withdrawal.';

COMMIT;
