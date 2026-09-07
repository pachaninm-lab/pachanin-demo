-- #5064: domain-scoped registry authority and fail-closed corpus coverage/finality substrate.
-- Forward-only. Existing generations remain readable; legacy coverage/finality is conservative.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
  CONSTRAINT registry_generation_authority_sha_check CHECK (
    authority_token ~ '^[0-9a-f]{64}$' AND
    (update_package_sha256 IS NULL OR update_package_sha256 ~ '^[0-9a-f]{64}$') AND
    (continuity_policy_hash IS NULL OR continuity_policy_hash ~ '^[0-9a-f]{64}$') AND
    (finality_policy_hash IS NULL OR finality_policy_hash ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT registry_generation_authority_finality_check CHECK (
    NOT source_finality OR (
      acquisition_complete AND local_import_integrity AND baseline_coverage AND update_continuity AND
      coverage_kind IN ('COMPLETE_NATIONAL_CORPUS','COMPLETE_EFFECTIVE_CORPUS') AND
      generation_mode IN ('FULL_BASELINE','DAILY_EFFECTIVE') AND effective_cutoff IS NOT NULL AND
      continuity_policy_version IS NOT NULL AND continuity_policy_hash IS NOT NULL AND
      finality_policy_version IS NOT NULL AND finality_policy_hash IS NOT NULL
    )
  ),
  CONSTRAINT registry_generation_authority_daily_lineage_check CHECK (
    generation_mode <> 'DAILY_EFFECTIVE' OR (
      baseline_generation_id IS NOT NULL AND predecessor_generation_id IS NOT NULL AND
      update_package_id IS NOT NULL AND update_package_sha256 IS NOT NULL
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

CREATE OR REPLACE FUNCTION eligibility.bind_registry_authority_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, eligibility
AS $function$
BEGIN
  NEW.authority_token := eligibility.compute_registry_authority_token(
    NEW.generation_id,NEW.source,NEW.registry_domain,NEW.coverage_kind,NEW.generation_mode,
    NEW.acquisition_complete,NEW.local_import_integrity,NEW.baseline_coverage,NEW.update_continuity,NEW.source_finality,
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
    IF FOUND AND (
      physical.predecessor_generation_id IS DISTINCT FROM NEW.predecessor_generation_id
      OR physical.update_package_id IS DISTINCT FROM NEW.update_package_id
      OR physical.update_package_sha256 IS DISTINCT FROM NEW.update_package_sha256
      OR physical.effective_cutoff IS DISTINCT FROM NEW.effective_cutoff
    ) THEN
      RAISE EXCEPTION 'authority lineage contradicts persisted composition lineage';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;
CREATE TRIGGER registry_generation_authority_lineage_guard
BEFORE INSERT ON eligibility.registry_generation_authority
FOR EACH ROW EXECUTE FUNCTION eligibility.validate_registry_authority_lineage();
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
  -- FNS keeps an explicit retired lifecycle state for domain-lineage clarity.
  -- Existing non-FNS consumers retain the established ACTIVE -> VALIDATED switch.
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

-- Compatibility wrapper resolves the target domain from the exact generation and fails on ambiguity.
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

REVOKE ALL ON FUNCTION eligibility.record_fns_egrul_predecessor(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION eligibility.activate_registry_generation(TEXT, TEXT, TEXT) FROM PUBLIC;

REVOKE ALL ON TABLE eligibility.registry_generation_lineage FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON TABLE eligibility.registry_generation_lineage FROM pc_role_eligibility_runtime;
GRANT SELECT ON TABLE eligibility.registry_generation_lineage TO pc_role_eligibility_runtime;
GRANT EXECUTE ON FUNCTION eligibility.record_fns_egrul_predecessor(TEXT, TEXT) TO pc_role_eligibility_runtime;

REVOKE ALL ON TABLE eligibility.registry_generation_authority FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON TABLE eligibility.registry_generation_authority FROM pc_role_eligibility_runtime;
GRANT SELECT ON TABLE eligibility.registry_generation_authority TO pc_role_eligibility_runtime;
GRANT EXECUTE ON FUNCTION eligibility.activate_registry_generation(TEXT, TEXT, TEXT) TO pc_role_eligibility_runtime;

DO $bounded_domain_grants$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['pc_deal_runtime','app_runtime','one_deal_app','app_deal','app_service'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON eligibility.registry_generation_lineage FROM %I', role_name);
      EXECUTE format('GRANT SELECT ON eligibility.registry_generation_lineage TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION eligibility.record_fns_egrul_predecessor(TEXT, TEXT) TO %I', role_name);
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON eligibility.registry_generation_authority FROM %I', role_name);
      EXECUTE format('GRANT SELECT ON eligibility.registry_generation_authority TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION eligibility.activate_registry_generation(TEXT, TEXT, TEXT) TO %I', role_name);
    END IF;
  END LOOP;
END
$bounded_domain_grants$;