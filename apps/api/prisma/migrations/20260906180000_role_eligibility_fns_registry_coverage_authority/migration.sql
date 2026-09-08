-- #5064: domain-scoped registry authority and fail-closed corpus coverage/finality substrate.
-- Forward-only. Existing generations remain readable; legacy coverage/finality is conservative.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $authority_role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='pc_role_eligibility_authority') THEN
    CREATE ROLE pc_role_eligibility_authority NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  ALTER ROLE pc_role_eligibility_authority WITH
    NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
END
$authority_role$;

CREATE OR REPLACE FUNCTION eligibility.derive_registry_domain(p_source TEXT, p_schema_version TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, eligibility
AS $function$
  SELECT CASE
    WHEN p_source = 'FNS' AND COALESCE(p_schema_version, '') LIKE 'EGRUL\_%' ESCAPE '\' THEN 'EGRUL'
    WHEN p_source = 'FNS' AND COALESCE(p_schema_version, '') LIKE 'EGRIP\_%' ESCAPE '\' THEN 'EGRIP'
    WHEN p_source = 'FNS' THEN 'UNKNOWN'
    WHEN p_source = 'CBR' THEN 'CBR'
    WHEN p_source = 'FGIS_GRAIN' THEN 'FGIS_GRAIN'
    WHEN p_source = 'ROSACCREDITATION' THEN 'ROSACCREDITATION'
    ELSE 'UNKNOWN'
  END
$function$;

ALTER TABLE eligibility.registry_generations ADD COLUMN IF NOT EXISTS registry_domain TEXT;
UPDATE eligibility.registry_generations
SET registry_domain = eligibility.derive_registry_domain(source, schema_version)
WHERE registry_domain IS NULL;
DO $registry_generations_domain_not_null$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM eligibility.registry_generations
    WHERE registry_domain IS NULL
  ) THEN
    RAISE EXCEPTION 'registry_generations.registry_domain backfill incomplete';
  END IF;
END
$registry_generations_domain_not_null$;

ALTER TABLE eligibility.registry_generations
  ALTER COLUMN registry_domain SET NOT NULL,
  DROP CONSTRAINT IF EXISTS registry_generations_status_check,
  ADD CONSTRAINT registry_generations_status_check
    CHECK (status IN ('STAGING','VALIDATED','ACTIVE','SUPERSEDED','REJECTED')),
  ADD CONSTRAINT registry_generations_registry_domain_check
    CHECK (registry_domain IN ('EGRUL','EGRIP','CBR','FGIS_GRAIN','ROSACCREDITATION','UNKNOWN')),
  ADD CONSTRAINT registry_generations_source_domain_check
    CHECK (registry_domain = eligibility.derive_registry_domain(source, schema_version));

CREATE OR REPLACE FUNCTION eligibility.enforce_registry_generation_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, eligibility
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.registry_domain IS NULL OR btrim(NEW.registry_domain) = '' THEN
      NEW.registry_domain := eligibility.derive_registry_domain(NEW.source, NEW.schema_version);
    END IF;
    IF NEW.registry_domain <> eligibility.derive_registry_domain(NEW.source, NEW.schema_version) THEN
      RAISE EXCEPTION 'registry generation source/domain/schema mismatch';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.source IS DISTINCT FROM OLD.source
     OR NEW.registry_domain IS DISTINCT FROM OLD.registry_domain
     OR NEW.generation IS DISTINCT FROM OLD.generation
     OR NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256
     OR NEW.parser_version IS DISTINCT FROM OLD.parser_version
     OR NEW.schema_version IS DISTINCT FROM OLD.schema_version THEN
    RAISE EXCEPTION 'registry generation immutable identity mutation forbidden';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS registry_generations_identity_guard ON eligibility.registry_generations;
CREATE TRIGGER registry_generations_identity_guard
BEFORE INSERT OR UPDATE ON eligibility.registry_generations
FOR EACH ROW EXECUTE FUNCTION eligibility.enforce_registry_generation_identity();

ALTER TABLE eligibility.registry_generations
  DROP CONSTRAINT IF EXISTS registry_generations_source_generation_key;
ALTER TABLE eligibility.registry_generations
  ADD CONSTRAINT registry_generations_source_domain_generation_key UNIQUE (source, registry_domain, generation),
  ADD CONSTRAINT registry_generations_id_source_domain_key UNIQUE (id, source, registry_domain);
DROP INDEX IF EXISTS eligibility.registry_generations_one_active_per_source_idx;
CREATE UNIQUE INDEX registry_generations_one_active_per_source_domain_idx
  ON eligibility.registry_generations(source, registry_domain) WHERE status = 'ACTIVE';

ALTER TABLE eligibility.source_health ADD COLUMN IF NOT EXISTS registry_domain TEXT;
UPDATE eligibility.source_health
SET registry_domain = eligibility.derive_registry_domain(source, schema_version)
WHERE registry_domain IS NULL;
DO $source_health_domain_not_null$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM eligibility.source_health
    WHERE registry_domain IS NULL
  ) THEN
    RAISE EXCEPTION 'source_health.registry_domain backfill incomplete';
  END IF;
END
$source_health_domain_not_null$;
ALTER TABLE eligibility.source_health
  ALTER COLUMN registry_domain SET NOT NULL,
  ADD CONSTRAINT source_health_registry_domain_check
    CHECK (registry_domain IN ('EGRUL','EGRIP','CBR','FGIS_GRAIN','ROSACCREDITATION','UNKNOWN')),
  ADD CONSTRAINT source_health_source_domain_check CHECK (
    (source = 'FNS' AND registry_domain IN ('EGRUL','EGRIP','UNKNOWN')) OR
    (source = 'CBR' AND registry_domain = 'CBR') OR
    (source = 'FGIS_GRAIN' AND registry_domain = 'FGIS_GRAIN') OR
    (source = 'ROSACCREDITATION' AND registry_domain = 'ROSACCREDITATION')
  );
ALTER TABLE eligibility.source_health DROP CONSTRAINT IF EXISTS source_health_pkey;
ALTER TABLE eligibility.source_health ADD PRIMARY KEY (source, registry_domain);

CREATE OR REPLACE FUNCTION eligibility.enforce_source_health_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, eligibility
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.source IS DISTINCT FROM OLD.source OR NEW.registry_domain IS DISTINCT FROM OLD.registry_domain
  ) THEN
    RAISE EXCEPTION 'source health identity mutation forbidden';
  END IF;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS source_health_identity_guard ON eligibility.source_health;
CREATE TRIGGER source_health_identity_guard
BEFORE UPDATE ON eligibility.source_health
FOR EACH ROW EXECUTE FUNCTION eligibility.enforce_source_health_identity();

-- Physical EGRUL composition lineage is separate from legal coverage/finality.
-- The runtime may record only a DB-derived predecessor/package edge; it cannot
-- claim COMPLETE coverage or SOURCE_FINALITY through this path.
CREATE TABLE eligibility.registry_generation_lineage (
  generation_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  registry_domain TEXT NOT NULL,
  predecessor_generation_id TEXT NOT NULL REFERENCES eligibility.registry_generations(id) ON DELETE RESTRICT,
  update_package_id TEXT NOT NULL,
  update_package_sha256 CHAR(64) NOT NULL,
  source_published_at TIMESTAMPTZ NOT NULL,
  effective_cutoff TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT registry_generation_lineage_generation_fk
    FOREIGN KEY (generation_id, source, registry_domain)
    REFERENCES eligibility.registry_generations(id, source, registry_domain) ON DELETE RESTRICT,
  CONSTRAINT registry_generation_lineage_domain_check
    CHECK (source='FNS' AND registry_domain='EGRUL'),
  CONSTRAINT registry_generation_lineage_sha_check
    CHECK (update_package_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT registry_generation_lineage_no_self_check
    CHECK (generation_id <> predecessor_generation_id)
);
CREATE INDEX registry_generation_lineage_predecessor_idx
  ON eligibility.registry_generation_lineage(source, registry_domain, predecessor_generation_id, generation_id);
CREATE TRIGGER registry_generation_lineage_append_only
BEFORE UPDATE OR DELETE ON eligibility.registry_generation_lineage
FOR EACH ROW EXECUTE FUNCTION eligibility.reject_append_only_mutation();

CREATE OR REPLACE FUNCTION eligibility.record_fns_egrul_predecessor(
  p_generation_id TEXT,
  p_predecessor_generation_id TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, eligibility
AS $function$
DECLARE
  target RECORD;
  predecessor RECORD;
  existing RECORD;
BEGIN
  SELECT id,source,registry_domain,generation,published_at,content_sha256,status
  INTO target
  FROM eligibility.registry_generations
  WHERE id=p_generation_id
  FOR SHARE;
  IF NOT FOUND
     OR target.source <> 'FNS'
     OR target.registry_domain <> 'EGRUL'
     OR target.status NOT IN ('STAGING','VALIDATED') THEN
    RAISE EXCEPTION 'invalid EGRUL lineage target';
  END IF;
  IF to_regclass('eligibility.registry_generation_authority') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM eligibility.registry_generation_authority WHERE generation_id=target.id
     ) THEN
    RAISE EXCEPTION 'EGRUL lineage cannot change after authority materialization';
  END IF;

  SELECT id,source,registry_domain,published_at,status
  INTO predecessor
  FROM eligibility.registry_generations
  WHERE id=p_predecessor_generation_id
  FOR SHARE;
  IF NOT FOUND
     OR predecessor.source <> 'FNS'
     OR predecessor.registry_domain <> 'EGRUL'
     OR predecessor.status <> 'ACTIVE'
     OR predecessor.published_at >= target.published_at THEN
    RAISE EXCEPTION 'invalid EGRUL lineage predecessor';
  END IF;

  INSERT INTO eligibility.registry_generation_lineage(
    generation_id,source,registry_domain,predecessor_generation_id,
    update_package_id,update_package_sha256,source_published_at,effective_cutoff,created_at
  ) VALUES (
    target.id,'FNS','EGRUL',predecessor.id,
    target.generation,target.content_sha256,target.published_at,target.published_at,clock_timestamp()
  ) ON CONFLICT (generation_id) DO NOTHING;

  SELECT * INTO existing
  FROM eligibility.registry_generation_lineage
  WHERE generation_id=target.id;
  IF NOT FOUND
     OR existing.source <> 'FNS'
     OR existing.registry_domain <> 'EGRUL'
     OR existing.predecessor_generation_id <> predecessor.id
     OR existing.update_package_id <> target.generation
     OR existing.update_package_sha256 <> target.content_sha256
     OR existing.source_published_at IS DISTINCT FROM target.published_at
     OR existing.effective_cutoff IS DISTINCT FROM target.published_at THEN
    RAISE EXCEPTION 'conflicting EGRUL lineage replay';
  END IF;
  RETURN target.id;
END
$function$;

-- Accepted policy identities are data, not caller-selected strings. Future policy
-- changes require an explicit forward migration that adds a reviewed catalog row.
CREATE TABLE eligibility.registry_authority_policy_catalog (
  source TEXT NOT NULL,
  registry_domain TEXT NOT NULL,
  policy_kind TEXT NOT NULL CHECK (policy_kind IN ('CONTINUITY','FINALITY')),
  policy_version TEXT NOT NULL,
  policy_hash CHAR(64) NOT NULL CHECK (policy_hash ~ '^[0-9a-f]{64}$'),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (source,registry_domain,policy_kind,policy_version,policy_hash)
);
CREATE TRIGGER registry_authority_policy_catalog_append_only
BEFORE UPDATE OR DELETE ON eligibility.registry_authority_policy_catalog
FOR EACH ROW EXECUTE FUNCTION eligibility.reject_append_only_mutation();

INSERT INTO eligibility.registry_authority_policy_catalog(
  source,registry_domain,policy_kind,policy_version,policy_hash
) VALUES
  (
    'FNS','EGRUL','CONTINUITY','fns-egrul-continuity-v1',
    encode(public.digest(convert_to('role-eligibility/fns/egrul/continuity/v1','UTF8'),'sha256'),'hex')
  ),
  (
    'FNS','EGRUL','FINALITY','fns-egrul-finality-v1',
    encode(public.digest(convert_to('role-eligibility/fns/egrul/finality/v1','UTF8'),'sha256'),'hex')
  );

-- Immutable generation-level evidence. External facts are content-addressed
-- attestations written only through the authority role; DB-derivable facts are
-- materialized by the verifier from registry rows/lineage and cannot be asserted.
CREATE TABLE eligibility.registry_generation_authority_evidence (
  id CHAR(64) PRIMARY KEY CHECK (id ~ '^[0-9a-f]{64}$'),
  generation_id TEXT NOT NULL,
  source TEXT NOT NULL,
  registry_domain TEXT NOT NULL,
  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN (
    'ACQUISITION_COMPLETE','LOCAL_IMPORT_INTEGRITY','BASELINE_COVERAGE',
    'UPDATE_CONTINUITY','SOURCE_FINALITY'
  )),
  evidence_reference TEXT NOT NULL CHECK (
    length(evidence_reference) BETWEEN 1 AND 512
    AND evidence_reference !~ E'[\\r\\n]'
  ),
  evidence_sha256 CHAR(64) NOT NULL CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  generation_content_sha256 CHAR(64) NOT NULL CHECK (generation_content_sha256 ~ '^[0-9a-f]{64}$'),
  observed_record_count BIGINT NOT NULL CHECK (observed_record_count >= 0),
  effective_cutoff TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT registry_generation_authority_evidence_generation_fk
    FOREIGN KEY (generation_id,source,registry_domain)
    REFERENCES eligibility.registry_generations(id,source,registry_domain) ON DELETE RESTRICT,
  UNIQUE (generation_id,evidence_kind)
);
CREATE INDEX registry_generation_authority_evidence_domain_idx
  ON eligibility.registry_generation_authority_evidence(source,registry_domain,generation_id,evidence_kind);
CREATE TRIGGER registry_generation_authority_evidence_append_only
BEFORE UPDATE OR DELETE ON eligibility.registry_generation_authority_evidence
FOR EACH ROW EXECUTE FUNCTION eligibility.reject_append_only_mutation();

CREATE OR REPLACE FUNCTION eligibility.persist_registry_authority_evidence(
  p_generation_id TEXT,
  p_source TEXT,
  p_registry_domain TEXT,
  p_evidence_kind TEXT,
  p_evidence_reference TEXT,
  p_evidence_sha256 CHAR(64),
  p_generation_content_sha256 CHAR(64),
  p_observed_record_count BIGINT,
  p_effective_cutoff TIMESTAMPTZ
)
RETURNS CHAR(64)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, eligibility
AS $function$
DECLARE
  evidence_id CHAR(64);
  existing RECORD;
BEGIN
  evidence_id := encode(
    public.digest(
      convert_to(
        jsonb_build_object(
          'schemaVersion','role-eligibility.registry-authority-evidence.v1',
          'generationId',p_generation_id,
          'source',p_source,
          'registryDomain',p_registry_domain,
          'evidenceKind',p_evidence_kind,
          'evidenceReference',p_evidence_reference,
          'evidenceSha256',p_evidence_sha256,
          'generationContentSha256',p_generation_content_sha256,
          'observedRecordCount',p_observed_record_count,
          'effectiveCutoffEpoch',CASE WHEN p_effective_cutoff IS NULL THEN NULL ELSE extract(epoch FROM p_effective_cutoff) END
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )::CHAR(64);

  INSERT INTO eligibility.registry_generation_authority_evidence(
    id,generation_id,source,registry_domain,evidence_kind,evidence_reference,evidence_sha256,
    generation_content_sha256,observed_record_count,effective_cutoff,created_at
  ) VALUES (
    evidence_id,p_generation_id,p_source,p_registry_domain,p_evidence_kind,p_evidence_reference,p_evidence_sha256,
    p_generation_content_sha256,p_observed_record_count,p_effective_cutoff,clock_timestamp()
  ) ON CONFLICT (generation_id,evidence_kind) DO NOTHING;

  SELECT * INTO existing
  FROM eligibility.registry_generation_authority_evidence
  WHERE generation_id=p_generation_id AND evidence_kind=p_evidence_kind;
  IF NOT FOUND
     OR existing.id IS DISTINCT FROM evidence_id
     OR existing.source IS DISTINCT FROM p_source
     OR existing.registry_domain IS DISTINCT FROM p_registry_domain
     OR existing.evidence_reference IS DISTINCT FROM p_evidence_reference
     OR existing.evidence_sha256 IS DISTINCT FROM p_evidence_sha256
     OR existing.generation_content_sha256 IS DISTINCT FROM p_generation_content_sha256
     OR existing.observed_record_count IS DISTINCT FROM p_observed_record_count
     OR existing.effective_cutoff IS DISTINCT FROM p_effective_cutoff THEN
    RAISE EXCEPTION 'conflicting registry authority evidence replay';
  END IF;
  RETURN evidence_id;
END
$function$;
REVOKE ALL ON FUNCTION eligibility.persist_registry_authority_evidence(TEXT,TEXT,TEXT,TEXT,TEXT,CHAR(64),CHAR(64),BIGINT,TIMESTAMPTZ) FROM PUBLIC;

-- Only content-addressed external attestations enter through this writer. It
-- accepts no coverage/finality booleans and no policy identity.
CREATE OR REPLACE FUNCTION eligibility.record_fns_egrul_authority_evidence(
  p_generation_id TEXT,
  p_evidence_kind TEXT,
  p_evidence_reference TEXT,
  p_evidence_sha256 CHAR(64),
  p_effective_cutoff TIMESTAMPTZ DEFAULT NULL
)
RETURNS CHAR(64)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, eligibility
AS $function$
DECLARE
  target RECORD;
BEGIN
  IF p_evidence_kind NOT IN ('ACQUISITION_COMPLETE','BASELINE_COVERAGE','SOURCE_FINALITY') THEN
    RAISE EXCEPTION 'external evidence kind is not authority-writable';
  END IF;
  IF p_evidence_sha256 IS NULL OR p_evidence_sha256 !~ '^[0-9a-f]{64}$'
     OR p_evidence_reference IS DISTINCT FROM ('sha256:' || p_evidence_sha256::text) THEN
    RAISE EXCEPTION 'external authority evidence must be content-addressed';
  END IF;

  SELECT id,source,registry_domain,status,published_at,fresh_until,content_sha256,record_count,
         parser_version,schema_version
  INTO target
  FROM eligibility.registry_generations
  WHERE id=p_generation_id
  FOR SHARE;
  IF NOT FOUND
     OR target.source <> 'FNS'
     OR target.registry_domain <> 'EGRUL'
     OR target.status NOT IN ('VALIDATED','ACTIVE')
     OR target.parser_version <> 'fns-egrul-v1'
     OR target.schema_version NOT IN ('EGRUL_408','EGRUL_407')
     OR target.record_count <= 0 THEN
    RAISE EXCEPTION 'external authority evidence target is not accepted EGRUL generation';
  END IF;

  IF p_evidence_kind='ACQUISITION_COMPLETE' THEN
    IF p_effective_cutoff IS NOT NULL THEN
      RAISE EXCEPTION 'acquisition evidence cannot set effective cutoff';
    END IF;
  ELSE
    IF p_effective_cutoff IS NULL OR NOT isfinite(p_effective_cutoff)
       OR p_effective_cutoff < target.published_at
       OR p_effective_cutoff >= target.fresh_until THEN
      RAISE EXCEPTION 'coverage/finality evidence cutoff is outside generation authority window';
    END IF;
  END IF;

  RETURN eligibility.persist_registry_authority_evidence(
    target.id,target.source,target.registry_domain,p_evidence_kind,p_evidence_reference,p_evidence_sha256,
    target.content_sha256,target.record_count,p_effective_cutoff
  );
END
$function$;
REVOKE ALL ON FUNCTION eligibility.record_fns_egrul_authority_evidence(TEXT,TEXT,TEXT,CHAR(64),TIMESTAMPTZ) FROM PUBLIC;

CREATE TABLE eligibility.registry_generation_authority (
  generation_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  registry_domain TEXT NOT NULL,
  coverage_kind TEXT NOT NULL DEFAULT 'UNKNOWN'
    CHECK (coverage_kind IN ('UNKNOWN','PARTIAL_CORPUS','COMPLETE_NATIONAL_CORPUS','COMPLETE_EFFECTIVE_CORPUS','POINT_EVIDENCE')),
  generation_mode TEXT NOT NULL DEFAULT 'UNKNOWN'
    CHECK (generation_mode IN ('UNKNOWN','FULL_BASELINE','DAILY_EFFECTIVE','POINT_EVIDENCE')),
  acquisition_complete BOOLEAN NOT NULL DEFAULT FALSE,
  local_import_integrity BOOLEAN NOT NULL DEFAULT FALSE,
  baseline_coverage BOOLEAN NOT NULL DEFAULT FALSE,
  update_continuity BOOLEAN NOT NULL DEFAULT FALSE,
  source_finality BOOLEAN NOT NULL DEFAULT FALSE,
  acquisition_evidence_id CHAR(64),
  local_import_evidence_id CHAR(64),
  baseline_coverage_evidence_id CHAR(64),
  update_continuity_evidence_id CHAR(64),
  source_finality_evidence_id CHAR(64),
  baseline_generation_id TEXT,
  predecessor_generation_id TEXT,
  update_package_id TEXT,
  update_package_sha256 CHAR(64),
  continuity_policy_version TEXT,
  continuity_policy_hash CHAR(64),
  finality_policy_version TEXT,
  finality_policy_hash CHAR(64),
  effective_cutoff TIMESTAMPTZ,
  authority_token CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT registry_generation_authority_generation_fk
    FOREIGN KEY (generation_id, source, registry_domain)
    REFERENCES eligibility.registry_generations(id, source, registry_domain) ON DELETE RESTRICT,
  CONSTRAINT registry_generation_authority_baseline_fk
    FOREIGN KEY (baseline_generation_id) REFERENCES eligibility.registry_generations(id) ON DELETE RESTRICT,
  CONSTRAINT registry_generation_authority_predecessor_fk
    FOREIGN KEY (predecessor_generation_id) REFERENCES eligibility.registry_generations(id) ON DELETE RESTRICT,
  CONSTRAINT registry_generation_authority_acquisition_evidence_fk
    FOREIGN KEY (acquisition_evidence_id) REFERENCES eligibility.registry_generation_authority_evidence(id) ON DELETE RESTRICT,
  CONSTRAINT registry_generation_authority_local_import_evidence_fk
    FOREIGN KEY (local_import_evidence_id) REFERENCES eligibility.registry_generation_authority_evidence(id) ON DELETE RESTRICT,
  CONSTRAINT registry_generation_authority_baseline_coverage_evidence_fk
    FOREIGN KEY (baseline_coverage_evidence_id) REFERENCES eligibility.registry_generation_authority_evidence(id) ON DELETE RESTRICT,
  CONSTRAINT registry_generation_authority_update_continuity_evidence_fk
    FOREIGN KEY (update_continuity_evidence_id) REFERENCES eligibility.registry_generation_authority_evidence(id) ON DELETE RESTRICT,
  CONSTRAINT registry_generation_authority_source_finality_evidence_fk
    FOREIGN KEY (source_finality_evidence_id) REFERENCES eligibility.registry_generation_authority_evidence(id) ON DELETE RESTRICT,
  CONSTRAINT registry_generation_authority_sha_check CHECK (
    authority_token ~ '^[0-9a-f]{64}$' AND
    (update_package_sha256 IS NULL OR update_package_sha256 ~ '^[0-9a-f]{64}$') AND
    (continuity_policy_hash IS NULL OR continuity_policy_hash ~ '^[0-9a-f]{64}$') AND
    (finality_policy_hash IS NULL OR finality_policy_hash ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT registry_generation_authority_evidence_boolean_check CHECK (
    acquisition_complete = (acquisition_evidence_id IS NOT NULL) AND
    local_import_integrity = (local_import_evidence_id IS NOT NULL) AND
    baseline_coverage = (baseline_coverage_evidence_id IS NOT NULL) AND
    update_continuity = (update_continuity_evidence_id IS NOT NULL) AND
    source_finality = (source_finality_evidence_id IS NOT NULL)
  ),
  CONSTRAINT registry_generation_authority_finality_check CHECK (
    NOT source_finality OR (
      acquisition_complete AND local_import_integrity AND baseline_coverage AND update_continuity AND
      acquisition_evidence_id IS NOT NULL AND local_import_evidence_id IS NOT NULL AND
      baseline_coverage_evidence_id IS NOT NULL AND update_continuity_evidence_id IS NOT NULL AND
      source_finality_evidence_id IS NOT NULL AND
      coverage_kind IN ('COMPLETE_NATIONAL_CORPUS','COMPLETE_EFFECTIVE_CORPUS') AND
      generation_mode IN ('FULL_BASELINE','DAILY_EFFECTIVE') AND effective_cutoff IS NOT NULL AND
      continuity_policy_version IS NOT NULL AND continuity_policy_hash IS NOT NULL AND
      finality_policy_version IS NOT NULL AND finality_policy_hash IS NOT NULL
    )
  ),
  CONSTRAINT registry_generation_authority_daily_lineage_check CHECK (
    generation_mode <> 'DAILY_EFFECTIVE' OR (
      baseline_generation_id IS NOT NULL AND predecessor_generation_id IS NOT NULL AND
      update_package_id IS NOT NULL AND update_package_sha256 IS NOT NULL AND
      update_continuity_evidence_id IS NOT NULL
    )
  ),
  CONSTRAINT registry_generation_authority_baseline_root_check CHECK (
    generation_mode <> 'FULL_BASELINE' OR (
      baseline_generation_id = generation_id AND predecessor_generation_id IS NULL AND
      update_package_id IS NULL AND update_package_sha256 IS NULL
    )
  )
);
CREATE INDEX registry_generation_authority_domain_idx
  ON eligibility.registry_generation_authority(source, registry_domain, effective_cutoff DESC, generation_id);

-- The authority token is not operator-selected. It is a canonical SHA-256 over
-- every authority-bearing fact, excluding created_at. Identical facts therefore
-- reproduce one stable token; any semantic change creates a different token.
CREATE OR REPLACE FUNCTION eligibility.compute_registry_authority_token(
  p_generation_id TEXT,
  p_source TEXT,
  p_registry_domain TEXT,
  p_coverage_kind TEXT,
  p_generation_mode TEXT,
  p_acquisition_complete BOOLEAN,
  p_local_import_integrity BOOLEAN,
  p_baseline_coverage BOOLEAN,
  p_update_continuity BOOLEAN,
  p_source_finality BOOLEAN,
  p_acquisition_evidence_id CHAR(64),
  p_local_import_evidence_id CHAR(64),
  p_baseline_coverage_evidence_id CHAR(64),
  p_update_continuity_evidence_id CHAR(64),
  p_source_finality_evidence_id CHAR(64),
  p_baseline_generation_id TEXT,
  p_predecessor_generation_id TEXT,
  p_update_package_id TEXT,
  p_update_package_sha256 CHAR(64),
  p_continuity_policy_version TEXT,
  p_continuity_policy_hash CHAR(64),
  p_finality_policy_version TEXT,
  p_finality_policy_hash CHAR(64),
  p_effective_cutoff TIMESTAMPTZ
)
RETURNS CHAR(64)
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, eligibility
AS $function$
  SELECT encode(
    public.digest(
      convert_to(
        jsonb_build_object(
          'schemaVersion','role-eligibility.registry-authority-token.v1',
          'generationId',p_generation_id,
          'source',p_source,
          'registryDomain',p_registry_domain,
          'coverageKind',p_coverage_kind,
          'generationMode',p_generation_mode,
          'acquisitionComplete',p_acquisition_complete,
          'localImportIntegrity',p_local_import_integrity,
          'baselineCoverage',p_baseline_coverage,
          'updateContinuity',p_update_continuity,
          'sourceFinality',p_source_finality,
          'acquisitionEvidenceId',p_acquisition_evidence_id,
          'localImportEvidenceId',p_local_import_evidence_id,
          'baselineCoverageEvidenceId',p_baseline_coverage_evidence_id,
          'updateContinuityEvidenceId',p_update_continuity_evidence_id,
          'sourceFinalityEvidenceId',p_source_finality_evidence_id,
          'baselineGenerationId',p_baseline_generation_id,
          'predecessorGenerationId',p_predecessor_generation_id,
          'updatePackageId',p_update_package_id,
          'updatePackageSha256',p_update_package_sha256,
          'continuityPolicyVersion',p_continuity_policy_version,
          'continuityPolicyHash',p_continuity_policy_hash,
          'finalityPolicyVersion',p_finality_policy_version,
          'finalityPolicyHash',p_finality_policy_hash,
          'effectiveCutoffEpoch',CASE WHEN p_effective_cutoff IS NULL THEN NULL ELSE extract(epoch FROM p_effective_cutoff) END
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )::CHAR(64)
$function$;

CREATE OR REPLACE FUNCTION eligibility.validate_registry_authority_evidence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, eligibility
AS $function$
DECLARE
  target RECORD;
  evidence RECORD;
  baseline_cutoff TIMESTAMPTZ;
  continuity_cutoff TIMESTAMPTZ;
  finality_cutoff TIMESTAMPTZ;
BEGIN
  SELECT content_sha256,record_count INTO target
  FROM eligibility.registry_generations
  WHERE id=NEW.generation_id AND source=NEW.source AND registry_domain=NEW.registry_domain;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'registry authority generation is missing';
  END IF;

  NEW.acquisition_complete := FALSE;
  NEW.local_import_integrity := FALSE;
  NEW.baseline_coverage := FALSE;
  NEW.update_continuity := FALSE;
  NEW.source_finality := FALSE;

  IF NEW.acquisition_evidence_id IS NOT NULL THEN
    SELECT * INTO evidence FROM eligibility.registry_generation_authority_evidence WHERE id=NEW.acquisition_evidence_id;
    IF NOT FOUND OR evidence.generation_id IS DISTINCT FROM NEW.generation_id
       OR evidence.source IS DISTINCT FROM NEW.source OR evidence.registry_domain IS DISTINCT FROM NEW.registry_domain
       OR evidence.evidence_kind <> 'ACQUISITION_COMPLETE'
       OR evidence.generation_content_sha256 IS DISTINCT FROM target.content_sha256
       OR evidence.observed_record_count IS DISTINCT FROM target.record_count
       OR evidence.effective_cutoff IS NOT NULL THEN
      RAISE EXCEPTION 'acquisition evidence does not bind exact generation facts';
    END IF;
    NEW.acquisition_complete := TRUE;
  END IF;

  IF NEW.local_import_evidence_id IS NOT NULL THEN
    SELECT * INTO evidence FROM eligibility.registry_generation_authority_evidence WHERE id=NEW.local_import_evidence_id;
    IF NOT FOUND OR evidence.generation_id IS DISTINCT FROM NEW.generation_id
       OR evidence.source IS DISTINCT FROM NEW.source OR evidence.registry_domain IS DISTINCT FROM NEW.registry_domain
       OR evidence.evidence_kind <> 'LOCAL_IMPORT_INTEGRITY'
       OR evidence.generation_content_sha256 IS DISTINCT FROM target.content_sha256
       OR evidence.observed_record_count IS DISTINCT FROM target.record_count
       OR evidence.effective_cutoff IS NOT NULL THEN
      RAISE EXCEPTION 'local-import evidence does not bind exact generation facts';
    END IF;
    NEW.local_import_integrity := TRUE;
  END IF;

  IF NEW.baseline_coverage_evidence_id IS NOT NULL THEN
    SELECT * INTO evidence FROM eligibility.registry_generation_authority_evidence WHERE id=NEW.baseline_coverage_evidence_id;
    IF NOT FOUND OR evidence.generation_id IS DISTINCT FROM NEW.generation_id
       OR evidence.source IS DISTINCT FROM NEW.source OR evidence.registry_domain IS DISTINCT FROM NEW.registry_domain
       OR evidence.evidence_kind <> 'BASELINE_COVERAGE'
       OR evidence.generation_content_sha256 IS DISTINCT FROM target.content_sha256
       OR evidence.observed_record_count IS DISTINCT FROM target.record_count
       OR evidence.effective_cutoff IS NULL OR NOT isfinite(evidence.effective_cutoff) THEN
      RAISE EXCEPTION 'baseline-coverage evidence does not bind exact generation facts';
    END IF;
    NEW.baseline_coverage := TRUE;
    baseline_cutoff := evidence.effective_cutoff;
  END IF;

  IF NEW.update_continuity_evidence_id IS NOT NULL THEN
    SELECT * INTO evidence FROM eligibility.registry_generation_authority_evidence WHERE id=NEW.update_continuity_evidence_id;
    IF NOT FOUND OR evidence.generation_id IS DISTINCT FROM NEW.generation_id
       OR evidence.source IS DISTINCT FROM NEW.source OR evidence.registry_domain IS DISTINCT FROM NEW.registry_domain
       OR evidence.evidence_kind <> 'UPDATE_CONTINUITY'
       OR evidence.generation_content_sha256 IS DISTINCT FROM target.content_sha256
       OR evidence.observed_record_count IS DISTINCT FROM target.record_count
       OR evidence.effective_cutoff IS NULL OR NOT isfinite(evidence.effective_cutoff) THEN
      RAISE EXCEPTION 'continuity evidence does not bind exact generation facts';
    END IF;
    NEW.update_continuity := TRUE;
    continuity_cutoff := evidence.effective_cutoff;
  END IF;

  IF NEW.source_finality_evidence_id IS NOT NULL THEN
    SELECT * INTO evidence FROM eligibility.registry_generation_authority_evidence WHERE id=NEW.source_finality_evidence_id;
    IF NOT FOUND OR evidence.generation_id IS DISTINCT FROM NEW.generation_id
       OR evidence.source IS DISTINCT FROM NEW.source OR evidence.registry_domain IS DISTINCT FROM NEW.registry_domain
       OR evidence.evidence_kind <> 'SOURCE_FINALITY'
       OR evidence.generation_content_sha256 IS DISTINCT FROM target.content_sha256
       OR evidence.observed_record_count IS DISTINCT FROM target.record_count
       OR evidence.effective_cutoff IS NULL OR NOT isfinite(evidence.effective_cutoff) THEN
      RAISE EXCEPTION 'source-finality evidence does not bind exact generation facts';
    END IF;
    NEW.source_finality := TRUE;
    finality_cutoff := evidence.effective_cutoff;
  END IF;

  IF NEW.generation_mode IN ('FULL_BASELINE','DAILY_EFFECTIVE') THEN
    IF baseline_cutoff IS NULL OR continuity_cutoff IS NULL OR baseline_cutoff IS DISTINCT FROM continuity_cutoff THEN
      RAISE EXCEPTION 'complete corpus authority requires one evidence-bound effective cutoff';
    END IF;
    NEW.effective_cutoff := continuity_cutoff;
  ELSE
    IF NEW.acquisition_evidence_id IS NOT NULL OR NEW.local_import_evidence_id IS NOT NULL
       OR NEW.baseline_coverage_evidence_id IS NOT NULL OR NEW.update_continuity_evidence_id IS NOT NULL
       OR NEW.source_finality_evidence_id IS NOT NULL THEN
      RAISE EXCEPTION 'non-corpus authority cannot carry corpus evidence';
    END IF;
    NEW.effective_cutoff := NULL;
  END IF;

  IF NEW.source_finality AND finality_cutoff IS DISTINCT FROM NEW.effective_cutoff THEN
    RAISE EXCEPTION 'source-finality evidence cutoff does not match proven corpus cutoff';
  END IF;
  RETURN NEW;
END
$function$;
CREATE TRIGGER registry_generation_authority_evidence_guard
BEFORE INSERT ON eligibility.registry_generation_authority
FOR EACH ROW EXECUTE FUNCTION eligibility.validate_registry_authority_evidence();

CREATE OR REPLACE FUNCTION eligibility.validate_registry_authority_policy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, eligibility
AS $function$
BEGIN
  IF NEW.coverage_kind IN ('COMPLETE_NATIONAL_CORPUS','COMPLETE_EFFECTIVE_CORPUS') THEN
    IF NEW.continuity_policy_version IS NULL OR NEW.continuity_policy_hash IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM eligibility.registry_authority_policy_catalog AS p
         WHERE p.source=NEW.source AND p.registry_domain=NEW.registry_domain
           AND p.policy_kind='CONTINUITY'
           AND p.policy_version=NEW.continuity_policy_version
           AND p.policy_hash=NEW.continuity_policy_hash
       ) THEN
      RAISE EXCEPTION 'continuity policy identity is not accepted for registry authority';
    END IF;
  ELSIF NEW.continuity_policy_version IS NOT NULL OR NEW.continuity_policy_hash IS NOT NULL THEN
    RAISE EXCEPTION 'non-complete coverage cannot carry continuity policy authority';
  END IF;

  IF NEW.source_finality THEN
    IF NEW.finality_policy_version IS NULL OR NEW.finality_policy_hash IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM eligibility.registry_authority_policy_catalog AS p
         WHERE p.source=NEW.source AND p.registry_domain=NEW.registry_domain
           AND p.policy_kind='FINALITY'
           AND p.policy_version=NEW.finality_policy_version
           AND p.policy_hash=NEW.finality_policy_hash
       ) THEN
      RAISE EXCEPTION 'finality policy identity is not accepted for registry authority';
    END IF;
  ELSIF NEW.finality_policy_version IS NOT NULL OR NEW.finality_policy_hash IS NOT NULL THEN
    RAISE EXCEPTION 'non-final authority cannot carry finality policy identity';
  END IF;
  RETURN NEW;
END
$function$;
CREATE TRIGGER registry_generation_authority_policy_guard
BEFORE INSERT ON eligibility.registry_generation_authority
FOR EACH ROW EXECUTE FUNCTION eligibility.validate_registry_authority_policy();

CREATE OR REPLACE FUNCTION eligibility.bind_registry_authority_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, eligibility
AS $function$
BEGIN
  NEW.authority_token := eligibility.compute_registry_authority_token(
    NEW.generation_id,NEW.source,NEW.registry_domain,NEW.coverage_kind,NEW.generation_mode,
    NEW.acquisition_complete,NEW.local_import_integrity,NEW.baseline_coverage,NEW.update_continuity,NEW.source_finality,
    NEW.acquisition_evidence_id,NEW.local_import_evidence_id,NEW.baseline_coverage_evidence_id,
    NEW.update_continuity_evidence_id,NEW.source_finality_evidence_id,
    NEW.baseline_generation_id,NEW.predecessor_generation_id,NEW.update_package_id,NEW.update_package_sha256,
    NEW.continuity_policy_version,NEW.continuity_policy_hash,NEW.finality_policy_version,NEW.finality_policy_hash,
    NEW.effective_cutoff
  );
  RETURN NEW;
END
$function$;
CREATE TRIGGER registry_generation_authority_token_guard
BEFORE INSERT ON eligibility.registry_generation_authority
FOR EACH ROW EXECUTE FUNCTION eligibility.bind_registry_authority_token();

CREATE OR REPLACE FUNCTION eligibility.validate_registry_authority_lineage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, eligibility
AS $function$
DECLARE
  ref_source TEXT;
  ref_domain TEXT;
  physical RECORD;
BEGIN
  IF NEW.predecessor_generation_id = NEW.generation_id THEN
    RAISE EXCEPTION 'predecessor generation cannot self-reference';
  END IF;
  IF NEW.baseline_generation_id IS NOT NULL THEN
    SELECT source, registry_domain INTO ref_source, ref_domain
    FROM eligibility.registry_generations WHERE id = NEW.baseline_generation_id;
    IF ref_source IS DISTINCT FROM NEW.source OR ref_domain IS DISTINCT FROM NEW.registry_domain THEN
      RAISE EXCEPTION 'baseline generation crosses registry authority domain';
    END IF;
  END IF;
  IF NEW.predecessor_generation_id IS NOT NULL THEN
    SELECT source, registry_domain INTO ref_source, ref_domain
    FROM eligibility.registry_generations WHERE id = NEW.predecessor_generation_id;
    IF ref_source IS DISTINCT FROM NEW.source OR ref_domain IS DISTINCT FROM NEW.registry_domain THEN
      RAISE EXCEPTION 'predecessor generation crosses registry authority domain';
    END IF;
  END IF;
  IF NEW.generation_mode = 'DAILY_EFFECTIVE' THEN
    SELECT * INTO physical
    FROM eligibility.registry_generation_lineage
    WHERE generation_id=NEW.generation_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'daily EGRUL authority requires persisted composition lineage';
    ELSIF physical.predecessor_generation_id IS DISTINCT FROM NEW.predecessor_generation_id
      OR physical.update_package_id IS DISTINCT FROM NEW.update_package_id
      OR physical.update_package_sha256 IS DISTINCT FROM NEW.update_package_sha256
      OR physical.effective_cutoff IS DISTINCT FROM NEW.effective_cutoff THEN
      RAISE EXCEPTION 'authority lineage contradicts persisted composition lineage';
    END IF;
  ELSIF NEW.generation_mode = 'FULL_BASELINE' AND EXISTS (
    SELECT 1 FROM eligibility.registry_generation_lineage WHERE generation_id=NEW.generation_id
  ) THEN
    RAISE EXCEPTION 'full baseline authority cannot hide persisted update lineage';
  END IF;
  RETURN NEW;
END
$function$;
CREATE TRIGGER registry_generation_authority_lineage_guard
BEFORE INSERT ON eligibility.registry_generation_authority
FOR EACH ROW EXECUTE FUNCTION eligibility.validate_registry_authority_lineage();

-- The bounded verifier is the only grantable path that materializes complete
-- EGRUL authority. Callers cannot supply booleans, policy hashes, lineage or the
-- authority token; all are derived from immutable evidence and persisted state.
CREATE OR REPLACE FUNCTION eligibility.materialize_fns_egrul_registry_authority(
  p_generation_id TEXT
)
RETURNS CHAR(64)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, eligibility
AS $function$
DECLARE
  target RECORD;
  counts RECORD;
  physical RECORD;
  existing RECORD;
  acquisition RECORD;
  baseline_evidence RECORD;
  finality_evidence_id CHAR(64);
  finality_evidence_cutoff TIMESTAMPTZ;
  local_evidence_id CHAR(64);
  continuity_evidence_id CHAR(64);
  baseline_generation_id TEXT;
  predecessor_generation_id TEXT;
  update_package_id TEXT;
  update_package_sha256 CHAR(64);
  generation_mode TEXT;
  coverage_kind TEXT;
  continuity_cutoff TIMESTAMPTZ;
  continuity_evidence_sha CHAR(64);
  local_evidence_sha CHAR(64);
  continuity_policy_version TEXT;
  continuity_policy_hash CHAR(64);
  finality_policy_version TEXT;
  finality_policy_hash CHAR(64);
BEGIN
  SELECT id,source,registry_domain,status,published_at,fresh_until,content_sha256,record_count,
         parser_version,schema_version
  INTO target
  FROM eligibility.registry_generations
  WHERE id=p_generation_id
  FOR SHARE;
  IF NOT FOUND
     OR target.source <> 'FNS'
     OR target.registry_domain <> 'EGRUL'
     OR target.status NOT IN ('VALIDATED','ACTIVE')
     OR target.parser_version <> 'fns-egrul-v1'
     OR target.schema_version NOT IN ('EGRUL_408','EGRUL_407')
     OR target.record_count <= 0 THEN
    RAISE EXCEPTION 'registry authority target is not an accepted EGRUL generation';
  END IF;

  SELECT COUNT(*)::bigint AS actual_count,
         (COUNT(*) - COUNT(DISTINCT source_record_id || E'\\x1f' || record_type || E'\\x1f' || payload_sha256))::bigint AS duplicates
  INTO counts
  FROM eligibility.registry_records
  WHERE generation_id=target.id AND source='FNS';
  IF counts.actual_count IS DISTINCT FROM target.record_count OR counts.duplicates IS DISTINCT FROM 0::bigint THEN
    RAISE EXCEPTION 'registry authority local import integrity is not proven';
  END IF;

  local_evidence_sha := encode(
    public.digest(
      convert_to(
        jsonb_build_object(
          'schemaVersion','role-eligibility.local-import-integrity.v1',
          'generationId',target.id,
          'contentSha256',target.content_sha256,
          'recordCount',target.record_count,
          'duplicateRecords',counts.duplicates
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )::CHAR(64);
  local_evidence_id := eligibility.persist_registry_authority_evidence(
    target.id,'FNS','EGRUL','LOCAL_IMPORT_INTEGRITY',
    'db://eligibility/registry_records/' || target.id,local_evidence_sha,
    target.content_sha256,target.record_count,NULL
  );

  SELECT * INTO physical
  FROM eligibility.registry_generation_lineage
  WHERE generation_id=target.id;
  IF FOUND THEN
    IF physical.source <> 'FNS' OR physical.registry_domain <> 'EGRUL'
       OR physical.update_package_sha256 IS DISTINCT FROM target.content_sha256
       OR physical.source_published_at IS DISTINCT FROM target.published_at
       OR physical.effective_cutoff IS DISTINCT FROM target.published_at THEN
      RAISE EXCEPTION 'persisted EGRUL lineage is not bound to exact generation';
    END IF;
    generation_mode := 'DAILY_EFFECTIVE';
    coverage_kind := 'COMPLETE_EFFECTIVE_CORPUS';
    predecessor_generation_id := physical.predecessor_generation_id;
    update_package_id := physical.update_package_id;
    update_package_sha256 := physical.update_package_sha256;
    continuity_cutoff := physical.effective_cutoff;

    WITH RECURSIVE chain AS (
      SELECT l.generation_id,l.predecessor_generation_id,1 AS depth
      FROM eligibility.registry_generation_lineage AS l
      WHERE l.generation_id=target.id
      UNION ALL
      SELECT l.generation_id,l.predecessor_generation_id,c.depth+1
      FROM eligibility.registry_generation_lineage AS l
      JOIN chain AS c ON l.generation_id=c.predecessor_generation_id
      WHERE c.depth < 1024
    )
    SELECT predecessor_generation_id INTO baseline_generation_id
    FROM chain ORDER BY depth DESC LIMIT 1;
    IF baseline_generation_id IS NULL THEN
      RAISE EXCEPTION 'daily EGRUL authority baseline root is missing';
    END IF;

    continuity_evidence_sha := encode(
      public.digest(
        convert_to(
          jsonb_build_object(
            'schemaVersion','role-eligibility.update-continuity.v1',
            'generationId',target.id,
            'baselineGenerationId',baseline_generation_id,
            'predecessorGenerationId',physical.predecessor_generation_id,
            'updatePackageId',physical.update_package_id,
            'updatePackageSha256',physical.update_package_sha256,
            'effectiveCutoffEpoch',extract(epoch FROM physical.effective_cutoff)
          )::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    )::CHAR(64);
    continuity_evidence_id := eligibility.persist_registry_authority_evidence(
      target.id,'FNS','EGRUL','UPDATE_CONTINUITY',
      'db://eligibility/registry_generation_lineage/' || target.id,continuity_evidence_sha,
      target.content_sha256,target.record_count,continuity_cutoff
    );
  ELSE
    generation_mode := 'FULL_BASELINE';
    coverage_kind := 'COMPLETE_NATIONAL_CORPUS';
    baseline_generation_id := target.id;
    predecessor_generation_id := NULL;
    update_package_id := NULL;
    update_package_sha256 := NULL;
    continuity_cutoff := target.published_at;

    continuity_evidence_sha := encode(
      public.digest(
        convert_to(
          jsonb_build_object(
            'schemaVersion','role-eligibility.baseline-root-continuity.v1',
            'generationId',target.id,
            'contentSha256',target.content_sha256,
            'recordCount',target.record_count,
            'effectiveCutoffEpoch',extract(epoch FROM target.published_at)
          )::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    )::CHAR(64);
    continuity_evidence_id := eligibility.persist_registry_authority_evidence(
      target.id,'FNS','EGRUL','UPDATE_CONTINUITY',
      'db://eligibility/registry_generation_lineage/baseline-root/' || target.id,continuity_evidence_sha,
      target.content_sha256,target.record_count,continuity_cutoff
    );
  END IF;

  SELECT * INTO acquisition
  FROM eligibility.registry_generation_authority_evidence
  WHERE generation_id=target.id AND evidence_kind='ACQUISITION_COMPLETE';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'acquisition-complete evidence is required before authority materialization';
  END IF;

  SELECT * INTO baseline_evidence
  FROM eligibility.registry_generation_authority_evidence
  WHERE generation_id=target.id AND evidence_kind='BASELINE_COVERAGE';
  IF NOT FOUND OR baseline_evidence.effective_cutoff IS DISTINCT FROM continuity_cutoff THEN
    RAISE EXCEPTION 'baseline-coverage evidence does not match proven effective cutoff';
  END IF;

  SELECT id,effective_cutoff INTO finality_evidence_id,finality_evidence_cutoff
  FROM eligibility.registry_generation_authority_evidence
  WHERE generation_id=target.id AND evidence_kind='SOURCE_FINALITY';
  IF FOUND AND finality_evidence_cutoff IS DISTINCT FROM continuity_cutoff THEN
    RAISE EXCEPTION 'source-finality evidence does not match proven effective cutoff';
  END IF;

  SELECT policy_version,policy_hash INTO STRICT continuity_policy_version,continuity_policy_hash
  FROM eligibility.registry_authority_policy_catalog
  WHERE source='FNS' AND registry_domain='EGRUL' AND policy_kind='CONTINUITY'
    AND policy_version='fns-egrul-continuity-v1';

  IF finality_evidence_id IS NOT NULL THEN
    SELECT policy_version,policy_hash INTO STRICT finality_policy_version,finality_policy_hash
    FROM eligibility.registry_authority_policy_catalog
    WHERE source='FNS' AND registry_domain='EGRUL' AND policy_kind='FINALITY'
      AND policy_version='fns-egrul-finality-v1';
  END IF;

  INSERT INTO eligibility.registry_generation_authority(
    generation_id,source,registry_domain,coverage_kind,generation_mode,
    acquisition_evidence_id,local_import_evidence_id,baseline_coverage_evidence_id,
    update_continuity_evidence_id,source_finality_evidence_id,
    baseline_generation_id,predecessor_generation_id,update_package_id,update_package_sha256,
    continuity_policy_version,continuity_policy_hash,finality_policy_version,finality_policy_hash,
    authority_token,created_at
  ) VALUES (
    target.id,'FNS','EGRUL',coverage_kind,generation_mode,
    acquisition.id,local_evidence_id,baseline_evidence.id,
    continuity_evidence_id,finality_evidence_id,
    baseline_generation_id,predecessor_generation_id,update_package_id,update_package_sha256,
    continuity_policy_version,continuity_policy_hash,
    finality_policy_version,finality_policy_hash,
    repeat('0',64),clock_timestamp()
  ) ON CONFLICT (generation_id) DO NOTHING;

  SELECT * INTO existing
  FROM eligibility.registry_generation_authority
  WHERE generation_id=target.id;
  IF NOT FOUND
     OR existing.source <> 'FNS' OR existing.registry_domain <> 'EGRUL'
     OR existing.coverage_kind IS DISTINCT FROM coverage_kind
     OR existing.generation_mode IS DISTINCT FROM generation_mode
     OR existing.acquisition_evidence_id IS DISTINCT FROM acquisition.id
     OR existing.local_import_evidence_id IS DISTINCT FROM local_evidence_id
     OR existing.baseline_coverage_evidence_id IS DISTINCT FROM baseline_evidence.id
     OR existing.update_continuity_evidence_id IS DISTINCT FROM continuity_evidence_id
     OR existing.source_finality_evidence_id IS DISTINCT FROM finality_evidence_id
     OR existing.baseline_generation_id IS DISTINCT FROM baseline_generation_id
     OR existing.predecessor_generation_id IS DISTINCT FROM predecessor_generation_id
     OR existing.update_package_id IS DISTINCT FROM update_package_id
     OR existing.update_package_sha256 IS DISTINCT FROM update_package_sha256
     OR existing.continuity_policy_version IS DISTINCT FROM continuity_policy_version
     OR existing.continuity_policy_hash IS DISTINCT FROM continuity_policy_hash
     OR existing.finality_policy_version IS DISTINCT FROM finality_policy_version
     OR existing.finality_policy_hash IS DISTINCT FROM finality_policy_hash THEN
    RAISE EXCEPTION 'conflicting registry authority materialization replay';
  END IF;
  RETURN existing.authority_token;
END
$function$;
REVOKE ALL ON FUNCTION eligibility.materialize_fns_egrul_registry_authority(TEXT) FROM PUBLIC;
CREATE TRIGGER registry_generation_authority_append_only
BEFORE UPDATE OR DELETE ON eligibility.registry_generation_authority
FOR EACH ROW EXECUTE FUNCTION eligibility.reject_append_only_mutation();

-- Every pre-existing generation receives only conservative, immutable authority facts.
INSERT INTO eligibility.registry_generation_authority (
  generation_id, source, registry_domain, coverage_kind, generation_mode,
  acquisition_complete, local_import_integrity, baseline_coverage, update_continuity, source_finality,
  authority_token, created_at
)
SELECT id, source, registry_domain, 'UNKNOWN', 'UNKNOWN', FALSE, FALSE, FALSE, FALSE, FALSE, content_sha256, created_at
FROM eligibility.registry_generations
ON CONFLICT (generation_id) DO NOTHING;

CREATE OR REPLACE FUNCTION eligibility.activate_registry_generation(
  p_source TEXT, p_registry_domain TEXT, p_generation TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, eligibility
AS $function$
DECLARE
  target_id TEXT;
  target_status TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_source || ':' || p_registry_domain, 0));
  SELECT id, status INTO target_id, target_status
  FROM eligibility.registry_generations
  WHERE source = p_source AND registry_domain = p_registry_domain AND generation = p_generation
  FOR UPDATE;
  IF target_id IS NULL THEN RAISE EXCEPTION 'generation not found for source/domain'; END IF;
  IF target_status NOT IN ('VALIDATED','ACTIVE') THEN
    RAISE EXCEPTION 'generation must be validated before activation';
  END IF;
  UPDATE eligibility.registry_generations
  SET status = CASE
    WHEN p_source = 'FNS' AND p_registry_domain IN ('EGRUL','EGRIP') THEN 'SUPERSEDED'
    ELSE 'VALIDATED'
  END
  WHERE source = p_source AND registry_domain = p_registry_domain AND status = 'ACTIVE' AND id <> target_id;
  UPDATE eligibility.registry_generations
  SET status = 'ACTIVE', activated_at = COALESCE(activated_at, clock_timestamp())
  WHERE id = target_id;
  RETURN target_id;
END
$function$;

CREATE OR REPLACE FUNCTION eligibility.activate_registry_generation(p_source TEXT, p_generation TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, eligibility
AS $function$
DECLARE
  target_domain TEXT;
  target_count INTEGER;
BEGIN
  SELECT min(registry_domain), count(*)::INTEGER INTO target_domain, target_count
  FROM eligibility.registry_generations WHERE source = p_source AND generation = p_generation;
  IF target_count <> 1 THEN RAISE EXCEPTION 'generation domain is missing or ambiguous'; END IF;
  RETURN eligibility.activate_registry_generation(p_source, target_domain, p_generation);
END
$function$;

CREATE OR REPLACE FUNCTION eligibility.resolve_fns_egrul_inn(
  p_inn TEXT,
  p_decision_at TIMESTAMPTZ
)
RETURNS TABLE (
  state TEXT,
  generation_id TEXT,
  generation TEXT,
  authority_token TEXT,
  matched_records BIGINT,
  matched_ogrns BIGINT
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, eligibility
AS $function$
  WITH input_valid AS MATERIALIZED (
    SELECT CASE
      WHEN p_inn !~ '^[0-9]{10}$' THEN FALSE
      ELSE (
        (
          substring(p_inn,1,1)::integer * 2 +
          substring(p_inn,2,1)::integer * 4 +
          substring(p_inn,3,1)::integer * 10 +
          substring(p_inn,4,1)::integer * 3 +
          substring(p_inn,5,1)::integer * 5 +
          substring(p_inn,6,1)::integer * 9 +
          substring(p_inn,7,1)::integer * 4 +
          substring(p_inn,8,1)::integer * 6 +
          substring(p_inn,9,1)::integer * 8
        ) % 11 % 10
      ) = substring(p_inn,10,1)::integer
    END AS valid
  ),
  current_generation AS MATERIALIZED (
    SELECT g.id,g.generation,g.content_sha256,g.record_count,g.published_at,g.parser_version,g.schema_version,g.fresh_until
    FROM eligibility.registry_generations AS g
    WHERE g.source='FNS' AND g.registry_domain='EGRUL' AND g.status='ACTIVE'
    ORDER BY g.activated_at DESC NULLS LAST,g.published_at DESC,g.id DESC
    LIMIT 1
  ),
  bound_state AS MATERIALIZED (
    SELECT
      g.id AS generation_id,
      g.generation,
      g.content_sha256,
      g.record_count,
      g.published_at,
      g.parser_version,
      g.schema_version,
      g.fresh_until AS generation_fresh_until,
      h.status AS health_status,
      h.circuit_state,
      h.active_generation,
      h.parser_version AS health_parser_version,
      h.schema_version AS health_schema_version,
      h.fresh_until AS health_fresh_until,
      h.consecutive_failures,
      h.last_error_code,
      a.coverage_kind,
      a.generation_mode,
      a.acquisition_complete,
      a.local_import_integrity,
      a.baseline_coverage,
      a.update_continuity,
      a.source_finality,
      a.acquisition_evidence_id,
      a.local_import_evidence_id,
      a.baseline_coverage_evidence_id,
      a.update_continuity_evidence_id,
      a.source_finality_evidence_id,
      a.baseline_generation_id,
      a.predecessor_generation_id,
      a.update_package_id,
      a.update_package_sha256,
      a.continuity_policy_version,
      a.continuity_policy_hash,
      a.finality_policy_version,
      a.finality_policy_hash,
      a.effective_cutoff,
      a.authority_token,
      (a.acquisition_evidence_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM eligibility.registry_generation_authority_evidence AS e
        WHERE e.id=a.acquisition_evidence_id AND e.generation_id=g.id
          AND e.source='FNS' AND e.registry_domain='EGRUL'
          AND e.evidence_kind='ACQUISITION_COMPLETE'
          AND e.generation_content_sha256=g.content_sha256
          AND e.observed_record_count=g.record_count AND e.effective_cutoff IS NULL
      )) AS acquisition_evidence_valid,
      (a.local_import_evidence_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM eligibility.registry_generation_authority_evidence AS e
        WHERE e.id=a.local_import_evidence_id AND e.generation_id=g.id
          AND e.source='FNS' AND e.registry_domain='EGRUL'
          AND e.evidence_kind='LOCAL_IMPORT_INTEGRITY'
          AND e.generation_content_sha256=g.content_sha256
          AND e.observed_record_count=g.record_count AND e.effective_cutoff IS NULL
      )) AS local_import_evidence_valid,
      (a.baseline_coverage_evidence_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM eligibility.registry_generation_authority_evidence AS e
        WHERE e.id=a.baseline_coverage_evidence_id AND e.generation_id=g.id
          AND e.source='FNS' AND e.registry_domain='EGRUL'
          AND e.evidence_kind='BASELINE_COVERAGE'
          AND e.generation_content_sha256=g.content_sha256
          AND e.observed_record_count=g.record_count
          AND e.effective_cutoff IS NOT DISTINCT FROM a.effective_cutoff
      )) AS baseline_coverage_evidence_valid,
      (a.update_continuity_evidence_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM eligibility.registry_generation_authority_evidence AS e
        WHERE e.id=a.update_continuity_evidence_id AND e.generation_id=g.id
          AND e.source='FNS' AND e.registry_domain='EGRUL'
          AND e.evidence_kind='UPDATE_CONTINUITY'
          AND e.generation_content_sha256=g.content_sha256
          AND e.observed_record_count=g.record_count
          AND e.effective_cutoff IS NOT DISTINCT FROM a.effective_cutoff
      )) AS update_continuity_evidence_valid,
      (a.source_finality_evidence_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM eligibility.registry_generation_authority_evidence AS e
        WHERE e.id=a.source_finality_evidence_id AND e.generation_id=g.id
          AND e.source='FNS' AND e.registry_domain='EGRUL'
          AND e.evidence_kind='SOURCE_FINALITY'
          AND e.generation_content_sha256=g.content_sha256
          AND e.observed_record_count=g.record_count
          AND e.effective_cutoff IS NOT DISTINCT FROM a.effective_cutoff
      )) AS source_finality_evidence_valid,
      EXISTS (
        SELECT 1 FROM eligibility.registry_authority_policy_catalog AS p
        WHERE p.source='FNS' AND p.registry_domain='EGRUL' AND p.policy_kind='CONTINUITY'
          AND p.policy_version=a.continuity_policy_version AND p.policy_hash=a.continuity_policy_hash
      ) AS continuity_policy_accepted,
      EXISTS (
        SELECT 1 FROM eligibility.registry_authority_policy_catalog AS p
        WHERE p.source='FNS' AND p.registry_domain='EGRUL' AND p.policy_kind='FINALITY'
          AND p.policy_version=a.finality_policy_version AND p.policy_hash=a.finality_policy_hash
      ) AS finality_policy_accepted,
      CASE
        WHEN a.generation_mode='DAILY_EFFECTIVE' THEN EXISTS (
          SELECT 1 FROM eligibility.registry_generation_lineage AS l
          WHERE l.generation_id=g.id AND l.source='FNS' AND l.registry_domain='EGRUL'
            AND l.predecessor_generation_id=a.predecessor_generation_id
            AND l.update_package_id=a.update_package_id
            AND l.update_package_sha256=a.update_package_sha256
            AND l.effective_cutoff IS NOT DISTINCT FROM a.effective_cutoff
        )
        WHEN a.generation_mode='FULL_BASELINE' THEN
          a.baseline_generation_id=g.id AND a.predecessor_generation_id IS NULL
          AND a.update_package_id IS NULL AND a.update_package_sha256 IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM eligibility.registry_generation_lineage AS l WHERE l.generation_id=g.id
          )
        ELSE FALSE
      END AS lineage_valid,
      a.authority_token IS NOT DISTINCT FROM eligibility.compute_registry_authority_token(
        a.generation_id,a.source,a.registry_domain,a.coverage_kind,a.generation_mode,
        a.acquisition_complete,a.local_import_integrity,a.baseline_coverage,a.update_continuity,a.source_finality,
        a.acquisition_evidence_id,a.local_import_evidence_id,a.baseline_coverage_evidence_id,
        a.update_continuity_evidence_id,a.source_finality_evidence_id,
        a.baseline_generation_id,a.predecessor_generation_id,a.update_package_id,a.update_package_sha256,
        a.continuity_policy_version,a.continuity_policy_hash,a.finality_policy_version,a.finality_policy_hash,
        a.effective_cutoff
      ) AS authority_token_valid
    FROM current_generation AS g
    LEFT JOIN eligibility.source_health AS h
      ON h.source='FNS' AND h.registry_domain='EGRUL'
    LEFT JOIN eligibility.registry_generation_authority AS a
      ON a.generation_id=g.id AND a.source='FNS' AND a.registry_domain='EGRUL'
  ),
  matches AS MATERIALIZED (
    SELECT
      COUNT(r.id)::bigint AS matched_records,
      COUNT(DISTINCT r.subject_ogrn)::bigint AS matched_ogrns
    FROM current_generation AS g
    LEFT JOIN eligibility.registry_records AS r
      ON r.generation_id=g.id AND r.source='FNS' AND r.subject_inn=p_inn
  )
  SELECT
    CASE
      WHEN i.valid IS DISTINCT FROM TRUE THEN 'INVALID_IDENTIFIER'
      WHEN p_decision_at IS NULL OR NOT isfinite(p_decision_at) THEN 'SOURCE_UNAVAILABLE'
      WHEN s.generation_id IS NULL THEN 'SOURCE_UNAVAILABLE'
      WHEN s.parser_version IS DISTINCT FROM 'fns-egrul-v1'
        OR s.schema_version NOT IN ('EGRUL_408','EGRUL_407')
        OR s.health_status IS DISTINCT FROM 'HEALTHY'
        OR s.circuit_state IS DISTINCT FROM 'CLOSED'
        OR s.active_generation IS DISTINCT FROM s.generation
        OR s.health_parser_version IS DISTINCT FROM s.parser_version
        OR s.health_schema_version IS DISTINCT FROM s.schema_version
        OR s.consecutive_failures IS DISTINCT FROM 0
        OR s.last_error_code IS NOT NULL THEN 'SOURCE_UNAVAILABLE'
      WHEN s.generation_fresh_until <= p_decision_at
        OR s.health_fresh_until IS NULL
        OR s.health_fresh_until <= p_decision_at
        OR s.health_fresh_until IS DISTINCT FROM s.generation_fresh_until THEN 'STALE'
      WHEN COALESCE(m.matched_records,0) > 0 AND COALESCE(m.matched_ogrns,0) = 1 THEN 'FOUND'
      WHEN COALESCE(m.matched_records,0) > 0 THEN 'REVIEW_REQUIRED'
      WHEN s.authority_token IS NULL
        OR s.coverage_kind NOT IN ('COMPLETE_NATIONAL_CORPUS','COMPLETE_EFFECTIVE_CORPUS')
        OR s.acquisition_complete IS DISTINCT FROM TRUE
        OR s.local_import_integrity IS DISTINCT FROM TRUE
        OR s.baseline_coverage IS DISTINCT FROM TRUE
        OR s.update_continuity IS DISTINCT FROM TRUE
        OR s.acquisition_evidence_valid IS DISTINCT FROM TRUE
        OR s.local_import_evidence_valid IS DISTINCT FROM TRUE
        OR s.baseline_coverage_evidence_valid IS DISTINCT FROM TRUE
        OR s.update_continuity_evidence_valid IS DISTINCT FROM TRUE
        OR s.lineage_valid IS DISTINCT FROM TRUE
        OR s.authority_token_valid IS DISTINCT FROM TRUE
        OR s.effective_cutoff IS NULL
        OR s.effective_cutoff < p_decision_at
        OR s.continuity_policy_accepted IS DISTINCT FROM TRUE THEN 'COVERAGE_NOT_PROVEN'
      WHEN s.source_finality IS DISTINCT FROM TRUE
        OR s.source_finality_evidence_valid IS DISTINCT FROM TRUE
        OR s.finality_policy_accepted IS DISTINCT FROM TRUE THEN 'COVERAGE_NOT_FINAL'
      ELSE 'AUTHORITATIVE_NOT_FOUND'
    END::text AS state,
    s.generation_id,
    s.generation,
    s.authority_token::text,
    COALESCE(m.matched_records,0)::bigint AS matched_records,
    COALESCE(m.matched_ogrns,0)::bigint AS matched_ogrns
  FROM input_valid AS i
  LEFT JOIN bound_state AS s ON TRUE
  LEFT JOIN matches AS m ON TRUE
$function$;

REVOKE ALL ON FUNCTION eligibility.resolve_fns_egrul_inn(TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION eligibility.resolve_fns_egrul_inn(TEXT, TIMESTAMPTZ) TO pc_role_eligibility_runtime;

REVOKE ALL ON FUNCTION eligibility.record_fns_egrul_predecessor(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION eligibility.activate_registry_generation(TEXT, TEXT, TEXT) FROM PUBLIC;

REVOKE ALL ON TABLE eligibility.registry_generation_lineage FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON TABLE eligibility.registry_generation_lineage FROM pc_role_eligibility_runtime;
GRANT SELECT ON TABLE eligibility.registry_generation_lineage TO pc_role_eligibility_runtime;
GRANT EXECUTE ON FUNCTION eligibility.record_fns_egrul_predecessor(TEXT, TEXT) TO pc_role_eligibility_runtime;

REVOKE ALL ON TABLE eligibility.registry_authority_policy_catalog FROM PUBLIC;
REVOKE ALL ON TABLE eligibility.registry_generation_authority_evidence FROM PUBLIC;
REVOKE ALL ON TABLE eligibility.registry_generation_authority FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON TABLE eligibility.registry_authority_policy_catalog FROM pc_role_eligibility_runtime;
REVOKE INSERT, UPDATE, DELETE ON TABLE eligibility.registry_generation_authority_evidence FROM pc_role_eligibility_runtime;
REVOKE INSERT, UPDATE, DELETE ON TABLE eligibility.registry_generation_authority FROM pc_role_eligibility_runtime;
GRANT SELECT ON TABLE eligibility.registry_authority_policy_catalog TO pc_role_eligibility_runtime;
GRANT SELECT ON TABLE eligibility.registry_generation_authority_evidence TO pc_role_eligibility_runtime;
GRANT SELECT ON TABLE eligibility.registry_generation_authority TO pc_role_eligibility_runtime;
REVOKE EXECUTE ON FUNCTION eligibility.record_fns_egrul_authority_evidence(TEXT,TEXT,TEXT,CHAR(64),TIMESTAMPTZ) FROM pc_role_eligibility_runtime;
REVOKE EXECUTE ON FUNCTION eligibility.materialize_fns_egrul_registry_authority(TEXT) FROM pc_role_eligibility_runtime;
GRANT EXECUTE ON FUNCTION eligibility.activate_registry_generation(TEXT, TEXT, TEXT) TO pc_role_eligibility_runtime;

GRANT USAGE ON SCHEMA eligibility TO pc_role_eligibility_authority;
GRANT SELECT ON TABLE eligibility.registry_generations TO pc_role_eligibility_authority;
GRANT SELECT ON TABLE eligibility.registry_records TO pc_role_eligibility_authority;
GRANT SELECT ON TABLE eligibility.registry_generation_lineage TO pc_role_eligibility_authority;
GRANT SELECT ON TABLE eligibility.registry_authority_policy_catalog TO pc_role_eligibility_authority;
GRANT SELECT ON TABLE eligibility.registry_generation_authority_evidence TO pc_role_eligibility_authority;
GRANT SELECT ON TABLE eligibility.registry_generation_authority TO pc_role_eligibility_authority;
REVOKE INSERT, UPDATE, DELETE ON TABLE eligibility.registry_generation_lineage FROM pc_role_eligibility_authority;
REVOKE INSERT, UPDATE, DELETE ON TABLE eligibility.registry_authority_policy_catalog FROM pc_role_eligibility_authority;
REVOKE INSERT, UPDATE, DELETE ON TABLE eligibility.registry_generation_authority_evidence FROM pc_role_eligibility_authority;
REVOKE INSERT, UPDATE, DELETE ON TABLE eligibility.registry_generation_authority FROM pc_role_eligibility_authority;
GRANT EXECUTE ON FUNCTION eligibility.record_fns_egrul_authority_evidence(TEXT,TEXT,TEXT,CHAR(64),TIMESTAMPTZ) TO pc_role_eligibility_authority;
GRANT EXECUTE ON FUNCTION eligibility.materialize_fns_egrul_registry_authority(TEXT) TO pc_role_eligibility_authority;

DO $bounded_domain_grants$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['pc_deal_runtime','app_runtime','one_deal_app','app_deal','app_service'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON eligibility.registry_generation_lineage FROM %I', role_name);
      EXECUTE format('GRANT SELECT ON eligibility.registry_generation_lineage TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION eligibility.record_fns_egrul_predecessor(TEXT, TEXT) TO %I', role_name);
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON eligibility.registry_authority_policy_catalog FROM %I', role_name);
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON eligibility.registry_generation_authority_evidence FROM %I', role_name);
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON eligibility.registry_generation_authority FROM %I', role_name);
      EXECUTE format('GRANT SELECT ON eligibility.registry_authority_policy_catalog TO %I', role_name);
      EXECUTE format('GRANT SELECT ON eligibility.registry_generation_authority_evidence TO %I', role_name);
      EXECUTE format('GRANT SELECT ON eligibility.registry_generation_authority TO %I', role_name);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION eligibility.record_fns_egrul_authority_evidence(TEXT,TEXT,TEXT,CHAR(64),TIMESTAMPTZ) FROM %I', role_name);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION eligibility.materialize_fns_egrul_registry_authority(TEXT) FROM %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION eligibility.activate_registry_generation(TEXT, TEXT, TEXT) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION eligibility.resolve_fns_egrul_inn(TEXT, TIMESTAMPTZ) TO %I', role_name);
    END IF;
  END LOOP;
END
$bounded_domain_grants$;
