BEGIN;

CREATE TABLE IF NOT EXISTS tai_public_fact_pack_definitions (
    pack_id TEXT PRIMARY KEY CHECK (pack_id ~ '^factpack\.[a-z0-9][a-z0-9._-]{8,180}$'),
    source_id TEXT NOT NULL REFERENCES tai_public_corpus_source_admissions (source_id),
    dataset_code TEXT NOT NULL CHECK (dataset_code ~ '^[A-Z0-9][A-Z0-9_-]{5,96}$'),
    schema_version TEXT NOT NULL CHECK (schema_version ~ '^tai\.[a-z0-9._-]{8,128}$'),
    measure_codes JSONB NOT NULL CHECK (
        jsonb_typeof(measure_codes) = 'array'
        AND jsonb_array_length(measure_codes) > 0
    ),
    supported_locales JSONB NOT NULL CHECK (
        jsonb_typeof(supported_locales) = 'array'
        AND jsonb_array_length(supported_locales) > 0
    ),
    status TEXT NOT NULL CHECK (status = 'ACTIVE'),
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS tai_public_fact_pack_versions (
    version_id BIGSERIAL PRIMARY KEY,
    pack_id TEXT NOT NULL REFERENCES tai_public_fact_pack_definitions (pack_id),
    manifest_sha256 TEXT NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
    source_snapshot_id BIGINT REFERENCES tai_public_corpus_snapshots (snapshot_id),
    source_snapshot_sha256 TEXT CHECK (
        source_snapshot_sha256 IS NULL OR source_snapshot_sha256 ~ '^[0-9a-f]{64}$'
    ),
    status TEXT NOT NULL CHECK (status IN ('BUILDING', 'ACTIVE', 'RETIRED')),
    fact_count BIGINT NOT NULL CHECK (fact_count >= 0),
    dimension_codes JSONB NOT NULL CHECK (jsonb_typeof(dimension_codes) = 'array'),
    created_at TIMESTAMPTZ NOT NULL,
    activated_at TIMESTAMPTZ,
    UNIQUE (pack_id, manifest_sha256),
    CHECK (
        (fact_count = 0 AND source_snapshot_id IS NULL AND source_snapshot_sha256 IS NULL)
        OR
        (fact_count > 0 AND source_snapshot_id IS NOT NULL AND source_snapshot_sha256 IS NOT NULL)
    ),
    CHECK (
        (status = 'ACTIVE' AND activated_at IS NOT NULL)
        OR status <> 'ACTIVE'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS tai_public_fact_pack_one_active_version_idx
    ON tai_public_fact_pack_versions (pack_id)
    WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS tai_public_fact_pack_facts (
    version_id BIGINT NOT NULL
        REFERENCES tai_public_fact_pack_versions (version_id) ON DELETE RESTRICT,
    fact_id TEXT NOT NULL CHECK (fact_id ~ '^[0-9a-f]{64}$'),
    source_id TEXT NOT NULL REFERENCES tai_public_corpus_source_admissions (source_id),
    source_snapshot_id BIGINT NOT NULL
        REFERENCES tai_public_corpus_snapshots (snapshot_id) ON DELETE RESTRICT,
    source_snapshot_sha256 TEXT NOT NULL CHECK (
        source_snapshot_sha256 ~ '^[0-9a-f]{64}$'
    ),
    artifact_sha256 TEXT NOT NULL
        REFERENCES tai_public_corpus_artifacts (artifact_sha256) ON DELETE RESTRICT,
    chunk_id TEXT NOT NULL CHECK (chunk_id ~ '^[0-9a-f]{64}$'),
    source_uri TEXT NOT NULL CHECK (source_uri ~ '^https://'),
    xpath TEXT NOT NULL CHECK (xpath ~ '^/' AND length(xpath) <= 1024),
    dimensions JSONB NOT NULL CHECK (
        jsonb_typeof(dimensions) = 'object'
        AND dimensions <> '{}'::jsonb
    ),
    measure_code TEXT NOT NULL CHECK (measure_code ~ '^[A-Z][A-Z0-9_]{0,63}$'),
    exact_value NUMERIC NOT NULL,
    exact_value_text TEXT NOT NULL CHECK (
        exact_value_text ~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?$'
        AND length(exact_value_text) <= 256
    ),
    unit_code TEXT CHECK (
        unit_code IS NULL OR (
            length(btrim(unit_code)) BETWEEN 1 AND 128
            AND unit_code !~ '[[:cntrl:]]'
        )
    ),
    publication_date DATE NOT NULL,
    effective_date DATE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    provenance_locators JSONB NOT NULL CHECK (
        jsonb_typeof(provenance_locators) = 'array'
        AND jsonb_array_length(provenance_locators) > 0
    ),
    provenance_sha256 TEXT NOT NULL CHECK (provenance_sha256 ~ '^[0-9a-f]{64}$'),
    PRIMARY KEY (version_id, fact_id),
    UNIQUE (
        version_id, source_snapshot_id, artifact_sha256, chunk_id, xpath,
        measure_code, provenance_sha256
    ),
    CHECK (effective_date >= publication_date),
    CHECK (period_end >= period_start),
    CHECK (exact_value::TEXT = exact_value_text)
);

CREATE INDEX IF NOT EXISTS tai_public_fact_pack_fact_dimensions_idx
    ON tai_public_fact_pack_facts USING GIN (dimensions jsonb_path_ops);

CREATE INDEX IF NOT EXISTS tai_public_fact_pack_fact_measure_idx
    ON tai_public_fact_pack_facts (version_id, measure_code, fact_id);

CREATE TABLE IF NOT EXISTS tai_public_fact_pack_audit (
    event_sha256 TEXT PRIMARY KEY CHECK (event_sha256 ~ '^[0-9a-f]{64}$'),
    event_type TEXT NOT NULL CHECK (
        event_type IN ('VERSION_ACTIVATED', 'VERSION_REPLAYED', 'SOURCE_WITHDRAWN')
    ),
    pack_id TEXT NOT NULL REFERENCES tai_public_fact_pack_definitions (pack_id),
    version_id BIGINT NOT NULL
        REFERENCES tai_public_fact_pack_versions (version_id) ON DELETE RESTRICT,
    manifest_sha256 TEXT NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
    actor_id TEXT NOT NULL CHECK (length(btrim(actor_id)) BETWEEN 1 AND 160),
    reason_code TEXT NOT NULL CHECK (reason_code ~ '^[A-Z][A-Z0-9_]{2,95}$'),
    payload_sha256 TEXT NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL
);

CREATE OR REPLACE FUNCTION tai_public_fact_pack_immutable_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'TAI_PUBLIC_FACT_PACK_IMMUTABLE:%:%', TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE OR REPLACE FUNCTION tai_public_fact_pack_version_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'TAI_PUBLIC_FACT_PACK_VERSION_IMMUTABLE:DELETE';
    END IF;
    IF current_setting('tai.fact_pack_activation', TRUE) IS DISTINCT FROM '1' THEN
        RAISE EXCEPTION 'TAI_PUBLIC_FACT_PACK_VERSION_MUTATION_FORBIDDEN';
    END IF;
    IF OLD.version_id <> NEW.version_id
       OR OLD.pack_id <> NEW.pack_id
       OR OLD.manifest_sha256 <> NEW.manifest_sha256
       OR OLD.source_snapshot_id IS DISTINCT FROM NEW.source_snapshot_id
       OR OLD.source_snapshot_sha256 IS DISTINCT FROM NEW.source_snapshot_sha256
       OR OLD.fact_count <> NEW.fact_count
       OR OLD.dimension_codes <> NEW.dimension_codes
       OR OLD.created_at <> NEW.created_at THEN
        RAISE EXCEPTION 'TAI_PUBLIC_FACT_PACK_VERSION_IDENTITY_MUTATION';
    END IF;
    IF NOT (
        (OLD.status = 'BUILDING' AND NEW.status = 'ACTIVE' AND NEW.activated_at IS NOT NULL)
        OR
        (OLD.status = 'ACTIVE' AND NEW.status = 'RETIRED'
         AND NEW.activated_at = OLD.activated_at)
    ) THEN
        RAISE EXCEPTION 'TAI_PUBLIC_FACT_PACK_VERSION_TRANSITION_FORBIDDEN:%:%',
            OLD.status, NEW.status;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tai_public_fact_pack_definition_immutable
    ON tai_public_fact_pack_definitions;
CREATE TRIGGER tai_public_fact_pack_definition_immutable
    BEFORE UPDATE OR DELETE ON tai_public_fact_pack_definitions
    FOR EACH ROW EXECUTE FUNCTION tai_public_fact_pack_immutable_guard();

DROP TRIGGER IF EXISTS tai_public_fact_pack_version_guard
    ON tai_public_fact_pack_versions;
CREATE TRIGGER tai_public_fact_pack_version_guard
    BEFORE UPDATE OR DELETE ON tai_public_fact_pack_versions
    FOR EACH ROW EXECUTE FUNCTION tai_public_fact_pack_version_guard();

DROP TRIGGER IF EXISTS tai_public_fact_pack_fact_immutable
    ON tai_public_fact_pack_facts;
CREATE TRIGGER tai_public_fact_pack_fact_immutable
    BEFORE UPDATE OR DELETE ON tai_public_fact_pack_facts
    FOR EACH ROW EXECUTE FUNCTION tai_public_fact_pack_immutable_guard();

DROP TRIGGER IF EXISTS tai_public_fact_pack_audit_immutable
    ON tai_public_fact_pack_audit;
CREATE TRIGGER tai_public_fact_pack_audit_immutable
    BEFORE UPDATE OR DELETE ON tai_public_fact_pack_audit
    FOR EACH ROW EXECUTE FUNCTION tai_public_fact_pack_immutable_guard();

CREATE OR REPLACE FUNCTION tai_activate_public_fact_pack_version(target_version BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    target_pack TEXT;
    target_status TEXT;
    declared_count BIGINT;
    actual_count BIGINT;
    source_snapshot BIGINT;
    source_snapshot_digest TEXT;
    invalid_count BIGINT;
BEGIN
    PERFORM pg_advisory_xact_lock(
        hashtextextended('tai.public-fact-pack.activation.v1', 0)
    );

    SELECT
        pack_id, status, fact_count, source_snapshot_id, source_snapshot_sha256
    INTO
        target_pack, target_status, declared_count, source_snapshot,
        source_snapshot_digest
    FROM tai_public_fact_pack_versions
    WHERE version_id = target_version
    FOR UPDATE;

    IF target_pack IS NULL OR target_status IS DISTINCT FROM 'BUILDING' THEN
        RAISE EXCEPTION 'fact-pack target must exist in BUILDING state';
    END IF;

    SELECT count(*) INTO actual_count
    FROM tai_public_fact_pack_facts
    WHERE version_id = target_version;

    IF actual_count <> declared_count THEN
        RAISE EXCEPTION 'fact-pack declared fact count mismatch';
    END IF;

    IF declared_count = 0 THEN
        IF source_snapshot IS NOT NULL OR source_snapshot_digest IS NOT NULL THEN
            RAISE EXCEPTION 'empty fact-pack version may not bind a source snapshot';
        END IF;
    ELSE
        IF NOT EXISTS (
            SELECT 1
            FROM tai_public_corpus_snapshots AS snapshot
            WHERE snapshot.snapshot_id = source_snapshot
              AND snapshot.snapshot_sha256 = source_snapshot_digest
              AND snapshot.status = 'ACTIVE'
        ) THEN
            RAISE EXCEPTION 'fact-pack source snapshot is not active';
        END IF;

        SELECT count(*) INTO invalid_count
        FROM tai_public_fact_pack_facts AS fact
        JOIN tai_public_fact_pack_definitions AS definition
          ON definition.pack_id = target_pack
        WHERE fact.version_id = target_version
          AND (
              fact.source_id <> definition.source_id
              OR fact.source_snapshot_id <> source_snapshot
              OR fact.source_snapshot_sha256 <> source_snapshot_digest
              OR NOT EXISTS (
                  SELECT 1
                  FROM tai_active_public_corpus_chunks_v1 AS chunk
                  JOIN tai_public_corpus_artifacts AS artifact
                    ON artifact.artifact_sha256 = chunk.artifact_sha256
                   AND artifact.source_id = chunk.source_id
                  WHERE chunk.snapshot_id = fact.source_snapshot_id
                    AND chunk.chunk_id = fact.chunk_id
                    AND chunk.artifact_sha256 = fact.artifact_sha256
                    AND chunk.source_id = fact.source_id
                    AND artifact.official_uri = fact.source_uri
              )
          );

        IF invalid_count > 0 THEN
            RAISE EXCEPTION 'fact-pack contains ineligible or contaminated facts';
        END IF;
    END IF;

    PERFORM set_config('tai.fact_pack_activation', '1', TRUE);

    UPDATE tai_public_fact_pack_versions
    SET status = 'RETIRED'
    WHERE pack_id = target_pack
      AND status = 'ACTIVE';

    UPDATE tai_public_fact_pack_versions
    SET status = 'ACTIVE',
        activated_at = clock_timestamp()
    WHERE version_id = target_version
      AND status = 'BUILDING';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'fact-pack activation target disappeared';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION tai_activate_public_fact_pack_version(BIGINT) FROM PUBLIC;

CREATE OR REPLACE VIEW tai_active_public_fact_pack_facts_v1 AS
SELECT
    version.pack_id,
    version.version_id,
    version.manifest_sha256,
    fact.fact_id,
    fact.source_id,
    fact.source_snapshot_id,
    fact.source_snapshot_sha256,
    fact.artifact_sha256,
    fact.chunk_id,
    fact.source_uri,
    fact.xpath,
    fact.dimensions,
    fact.measure_code,
    fact.exact_value,
    fact.exact_value_text,
    fact.unit_code,
    fact.publication_date,
    fact.effective_date,
    fact.period_start,
    fact.period_end,
    fact.observed_at,
    fact.provenance_locators,
    fact.provenance_sha256
FROM tai_public_fact_pack_versions AS version
JOIN tai_public_fact_pack_facts AS fact
  ON fact.version_id = version.version_id
WHERE version.status = 'ACTIVE';

COMMIT;
