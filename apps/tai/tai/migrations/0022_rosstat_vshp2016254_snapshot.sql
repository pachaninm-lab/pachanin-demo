BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tai_rosstat_vshp2016254_writer') THEN
        CREATE ROLE tai_rosstat_vshp2016254_writer NOLOGIN;
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS tai_rosstat_vshp2016254_records (
    snapshot_id BIGINT NOT NULL
        REFERENCES tai_public_corpus_snapshots (snapshot_id) ON DELETE RESTRICT,
    artifact_sha256 TEXT NOT NULL
        REFERENCES tai_public_corpus_artifacts (artifact_sha256) ON DELETE RESTRICT
        CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    source_xpath TEXT NOT NULL CHECK (
        source_xpath LIKE '/%'
        AND length(source_xpath) BETWEEN 2 AND 2048
    ),
    value_text TEXT NOT NULL CHECK (length(btrim(value_text)) BETWEEN 1 AND 100000),
    value_sha256 TEXT NOT NULL CHECK (value_sha256 ~ '^[0-9a-f]{64}$'),
    fragment_sha256 TEXT NOT NULL CHECK (fragment_sha256 ~ '^[0-9a-f]{64}$'),
    source_data_sha256 TEXT NOT NULL CHECK (
        source_data_sha256 = 'fa9a5313d783acd6ba5075f2d673492db720f10968c2b18edb54cd95293e60cd'
    ),
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (snapshot_id, ordinal),
    UNIQUE (snapshot_id, fragment_sha256),
    UNIQUE (snapshot_id, source_xpath, value_sha256)
);

CREATE OR REPLACE FUNCTION tai_rosstat_vshp2016254_immutable_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'TAI_ROSSTAT_VSHP2016254_IMMUTABLE' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS tai_rosstat_vshp2016254_records_immutable
    ON tai_rosstat_vshp2016254_records;
CREATE TRIGGER tai_rosstat_vshp2016254_records_immutable
BEFORE UPDATE OR DELETE ON tai_rosstat_vshp2016254_records
FOR EACH ROW
EXECUTE FUNCTION tai_rosstat_vshp2016254_immutable_guard();

CREATE OR REPLACE FUNCTION tai_admit_rosstat_vshp2016254_snapshot(
    p_acquisition_run_id TEXT,
    p_artifact_sha256 TEXT,
    p_artifact_size_bytes BIGINT,
    p_artifact_text TEXT,
    p_observed_at TIMESTAMPTZ,
    p_snapshot_sha256 TEXT,
    p_records JSONB,
    p_chunks JSONB,
    p_actor_id TEXT
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    c_source_id CONSTANT TEXT := 'official.rosstat.opendata.7708234640-vshp2016254';
    c_rights_decision CONSTANT TEXT := 'AP14F0-ROSSTAT-OPEN-DATA-7708234640-VSHP2016254';
    c_data_uri CONSTANT TEXT := 'https://rosstat.gov.ru/opendata/7708234640-VSHP2016254/data-20181211T0212-structure-20181211T0212.xml';
    c_host CONSTANT TEXT := 'rosstat.gov.ru';
    c_passport_sha CONSTANT TEXT := 'f3aa83bc421d56e5951e0c499686fc919d0fa73efcdc3d98a1012b3c827fb89e';
    c_structure_sha CONSTANT TEXT := 'c969338269a3dcf2b2e4949685e7e75d86e8ef587289df95fedd9a1054ddc2bc';
    c_data_sha CONSTANT TEXT := 'fa9a5313d783acd6ba5075f2d673492db720f10968c2b18edb54cd95293e60cd';
    c_rights_semantic_sha CONSTANT TEXT := '01f432c3c32a878db89329878c2d679f84302ca0006ea192f78e4ea1bce21ad7';
    c_dataset_semantic_sha CONSTANT TEXT := 'dd9ecb1f3921fb387d2d87ae9dfd26cddbe037510365d501d82e08c20b62b055';
    c_rights_due CONSTANT TIMESTAMPTZ := '2026-10-29T00:00:00Z';
    c_freshness_due CONSTANT TIMESTAMPTZ := '2031-01-01T00:00:00Z';
    c_historical_label CONSTANT TEXT := 'Исторические данные Всероссийской сельскохозяйственной переписи 2016 года; не являются текущими рыночными или хозяйственными данными.';
    c_attribution CONSTANT TEXT := 'Источник: Росстат, набор 7708234640-VSHP2016254, опубликован 11.12.2018.';
    acquisition_evidence_sha TEXT;
    snapshot_identity BIGINT;
    existing_snapshot_status TEXT;
    records_count BIGINT;
    records_min INTEGER;
    records_max INTEGER;
    records_distinct BIGINT;
    chunks_count BIGINT;
    chunks_min INTEGER;
    chunks_max INTEGER;
    chunks_distinct BIGINT;
    reconstructed_artifact TEXT;
    invalid_count BIGINT;
    event_payload TEXT;
BEGIN
    IF p_observed_at IS NULL OR p_observed_at >= c_rights_due THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_RIGHTS_EXPIRED' USING ERRCODE = '22023';
    END IF;
    IF p_observed_at < '2018-12-11T00:00:00Z'::TIMESTAMPTZ THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_OBSERVED_BEFORE_PUBLICATION' USING ERRCODE = '22023';
    END IF;
    IF length(btrim(p_actor_id)) NOT BETWEEN 1 AND 160 THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_ACTOR_REQUIRED' USING ERRCODE = '22023';
    END IF;
    IF p_artifact_sha256 !~ '^[0-9a-f]{64}$'
       OR p_snapshot_sha256 !~ '^[0-9a-f]{64}$'
       OR p_artifact_size_bytes NOT BETWEEN 1 AND 20000000 THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_DIGEST_OR_SIZE_INVALID' USING ERRCODE = '22023';
    END IF;
    IF octet_length(p_artifact_text) <> p_artifact_size_bytes
       OR encode(digest(convert_to(p_artifact_text, 'UTF8'), 'sha256'), 'hex') <> p_artifact_sha256 THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_ARTIFACT_DIGEST_MISMATCH' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(p_records) <> 'array'
       OR jsonb_array_length(p_records) < 1
       OR jsonb_array_length(p_records) > 100000
       OR jsonb_typeof(p_chunks) <> 'array'
       OR jsonb_array_length(p_chunks) < 1
       OR jsonb_array_length(p_chunks) > 20000 THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_RECORD_OR_CHUNK_MANIFEST_INVALID' USING ERRCODE = '22023';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('tai.rosstat.vshp2016254.snapshot.v1', 0));

    SELECT evidence.evidence_sha256
    INTO acquisition_evidence_sha
    FROM tai_public_acquisition_runs AS run
    JOIN tai_public_acquisition_raw_evidence AS evidence
      ON evidence.run_id = run.run_id AND evidence.source_id = run.source_id
    JOIN tai_public_acquisition_terminals AS terminal
      ON terminal.run_id = run.run_id
    WHERE run.run_id = p_acquisition_run_id
      AND run.source_id = c_source_id
      AND evidence.requested_uri = c_data_uri
      AND evidence.final_uri = c_data_uri
      AND evidence.wire_sha256 = c_data_sha
      AND evidence.decoded_sha256 = c_data_sha
      AND evidence.wire_size_bytes = 266607
      AND evidence.decoded_size_bytes = 266607
      AND evidence.media_type IN ('application/xml', 'text/xml')
      AND evidence.tls_server_name = c_host
      AND terminal.outcome = 'MATERIALIZED'
      AND terminal.manifest_sha256 = evidence.evidence_sha256
      AND terminal.completed_at >= evidence.received_at;

    IF acquisition_evidence_sha IS NULL THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_ACQUISITION_EVIDENCE_REQUIRED' USING ERRCODE = '42501';
    END IF;

    SELECT count(*), min(input.ordinal), max(input.ordinal), count(DISTINCT input.ordinal)
    INTO records_count, records_min, records_max, records_distinct
    FROM jsonb_to_recordset(p_records) AS input(
        ordinal INTEGER,
        xpath TEXT,
        value TEXT,
        "valueSha256" TEXT,
        "fragmentSha256" TEXT
    );

    IF records_min <> 0
       OR records_max <> records_count - 1
       OR records_distinct <> records_count THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_RECORD_ORDINALS_INVALID' USING ERRCODE = '22023';
    END IF;

    SELECT count(*)
    INTO invalid_count
    FROM jsonb_to_recordset(p_records) AS input(
        ordinal INTEGER,
        xpath TEXT,
        value TEXT,
        "valueSha256" TEXT,
        "fragmentSha256" TEXT
    )
    WHERE input.xpath IS NULL
       OR input.xpath NOT LIKE '/%'
       OR length(input.xpath) NOT BETWEEN 2 AND 2048
       OR length(btrim(input.value)) NOT BETWEEN 1 AND 100000
       OR input."valueSha256" !~ '^[0-9a-f]{64}$'
       OR input."fragmentSha256" !~ '^[0-9a-f]{64}$'
       OR input."valueSha256" <> encode(digest(convert_to(input.value, 'UTF8'), 'sha256'), 'hex')
       OR input."fragmentSha256" <> encode(
            digest(
                convert_to(
                    'XML_XPATH' || E'\n' || input.xpath || E'\n' || input.ordinal::TEXT || E'\n' || input.value,
                    'UTF8'
                ),
                'sha256'
            ),
            'hex'
       );
    IF invalid_count > 0 THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_RECORD_PROVENANCE_INVALID' USING ERRCODE = '22023';
    END IF;

    SELECT count(*)
    INTO invalid_count
    FROM jsonb_to_recordset(p_records) AS input(
        ordinal INTEGER,
        xpath TEXT,
        value TEXT,
        "valueSha256" TEXT,
        "fragmentSha256" TEXT
    )
    LEFT JOIN tai_public_acquisition_fragments AS fragment
      ON fragment.run_id = p_acquisition_run_id
     AND fragment.ordinal = input.ordinal
     AND fragment.locator_kind = 'XML_XPATH'
     AND fragment.locator_value = input.xpath
     AND fragment.fragment_sha256 = input."fragmentSha256"
     AND fragment.text_size_bytes = octet_length(input.value)
    WHERE fragment.run_id IS NULL;
    IF invalid_count > 0 THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_ACQUISITION_FRAGMENT_MISMATCH' USING ERRCODE = '42501';
    END IF;

    SELECT
        c_historical_label || E'\n\n' ||
        c_attribution || E'\n\n' ||
        'Официальный URI: ' || c_data_uri || E'\n\n' ||
        'SHA-256 исходного XML: ' || c_data_sha || E'\n\n' ||
        string_agg(
            'XPath: ' || input.xpath || E'\nЗначение: ' || input.value,
            E'\n\n' ORDER BY input.ordinal
        )
    INTO reconstructed_artifact
    FROM jsonb_to_recordset(p_records) AS input(ordinal INTEGER, xpath TEXT, value TEXT);

    IF reconstructed_artifact IS DISTINCT FROM p_artifact_text THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_ARTIFACT_RECONSTRUCTION_MISMATCH' USING ERRCODE = '22023';
    END IF;

    SELECT count(*), min(input.ordinal), max(input.ordinal), count(DISTINCT input.ordinal)
    INTO chunks_count, chunks_min, chunks_max, chunks_distinct
    FROM jsonb_to_recordset(p_chunks) AS input(
        ordinal INTEGER,
        "chunkId" TEXT,
        text TEXT,
        "tokenEstimate" INTEGER,
        "artifactSha256" TEXT,
        "sourceId" TEXT,
        "validUntil" TIMESTAMPTZ
    );

    IF chunks_min <> 0
       OR chunks_max <> chunks_count - 1
       OR chunks_distinct <> chunks_count THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_CHUNK_ORDINALS_INVALID' USING ERRCODE = '22023';
    END IF;

    SELECT count(*)
    INTO invalid_count
    FROM jsonb_to_recordset(p_chunks) AS input(
        ordinal INTEGER,
        "chunkId" TEXT,
        text TEXT,
        "tokenEstimate" INTEGER,
        "artifactSha256" TEXT,
        "sourceId" TEXT,
        "validUntil" TIMESTAMPTZ
    )
    WHERE input."chunkId" !~ '^[0-9a-f]{64}$'
       OR input."artifactSha256" <> p_artifact_sha256
       OR input."sourceId" <> c_source_id
       OR length(btrim(input.text)) = 0
       OR input."tokenEstimate" <> GREATEST(1, (char_length(input.text) + 3) / 4)
       OR input."validUntil" <> c_rights_due
       OR input."chunkId" <> encode(
            digest(
                convert_to(
                    c_source_id || E'\n' || p_artifact_sha256 || E'\n' ||
                    input.ordinal::TEXT || E'\n' || input.text,
                    'UTF8'
                ),
                'sha256'
            ),
            'hex'
       );
    IF invalid_count > 0 THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_CHUNK_MANIFEST_INVALID' USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM jsonb_to_recordset(p_chunks) AS input(text TEXT)
        WHERE input.text LIKE '%' || c_historical_label || '%'
    ) OR NOT EXISTS (
        SELECT 1
        FROM jsonb_to_recordset(p_chunks) AS input(text TEXT)
        WHERE input.text LIKE '%' || c_attribution || '%'
    ) THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_HISTORICAL_LABEL_OR_ATTRIBUTION_MISSING' USING ERRCODE = '22023';
    END IF;

    INSERT INTO tai_public_corpus_source_admissions(
        source_id,
        data_plane,
        source_class,
        rights_decision_id,
        official_uri,
        host_pin,
        rights_review_due_at,
        admitted_at,
        trust_score,
        status
    ) VALUES (
        c_source_id,
        'PUBLIC_OFFICIAL',
        'OPEN_DATASET',
        c_rights_decision,
        c_data_uri,
        c_host,
        c_rights_due,
        p_observed_at,
        0.970,
        'ADMITTED'
    ) ON CONFLICT (source_id) DO NOTHING;

    IF NOT EXISTS (
        SELECT 1
        FROM tai_public_corpus_source_admissions
        WHERE source_id = c_source_id
          AND data_plane = 'PUBLIC_OFFICIAL'
          AND source_class = 'OPEN_DATASET'
          AND rights_decision_id = c_rights_decision
          AND official_uri = c_data_uri
          AND host_pin = c_host
          AND rights_review_due_at = c_rights_due
          AND admitted_at = p_observed_at
          AND trust_score = 0.970
          AND status = 'ADMITTED'
    ) THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_SOURCE_ADMISSION_CONFLICT' USING ERRCODE = '23505';
    END IF;

    INSERT INTO tai_public_corpus_artifacts(
        artifact_sha256,
        record_id,
        source_id,
        source_class,
        rights_decision_id,
        official_uri,
        host_pin,
        media_type,
        size_bytes,
        publication_date,
        effective_date,
        observed_at,
        locator_kind,
        locator_value,
        freshness_due_at,
        status
    ) VALUES (
        p_artifact_sha256,
        'prov_' || substr(p_artifact_sha256, 1, 32),
        c_source_id,
        'OPEN_DATASET',
        c_rights_decision,
        c_data_uri,
        c_host,
        'text/plain',
        p_artifact_size_bytes,
        DATE '2018-12-11',
        DATE '2018-12-11',
        p_observed_at,
        'XML_XPATH',
        '/',
        c_freshness_due,
        'ADMITTED'
    ) ON CONFLICT (artifact_sha256) DO NOTHING;

    IF NOT EXISTS (
        SELECT 1
        FROM tai_public_corpus_artifacts
        WHERE artifact_sha256 = p_artifact_sha256
          AND record_id = 'prov_' || substr(p_artifact_sha256, 1, 32)
          AND source_id = c_source_id
          AND source_class = 'OPEN_DATASET'
          AND rights_decision_id = c_rights_decision
          AND official_uri = c_data_uri
          AND host_pin = c_host
          AND media_type = 'text/plain'
          AND size_bytes = p_artifact_size_bytes
          AND publication_date = DATE '2018-12-11'
          AND effective_date = DATE '2018-12-11'
          AND observed_at = p_observed_at
          AND locator_kind = 'XML_XPATH'
          AND locator_value = '/'
          AND freshness_due_at = c_freshness_due
          AND status = 'ADMITTED'
    ) THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_ARTIFACT_ADMISSION_CONFLICT' USING ERRCODE = '23505';
    END IF;

    INSERT INTO tai_public_corpus_snapshots(
        snapshot_sha256,
        status,
        created_at,
        source_ids,
        artifact_sha256s
    ) VALUES (
        p_snapshot_sha256,
        'BUILDING',
        p_observed_at,
        jsonb_build_array(c_source_id),
        jsonb_build_array(p_artifact_sha256)
    ) ON CONFLICT (snapshot_sha256) DO NOTHING
    RETURNING snapshot_id INTO snapshot_identity;

    IF snapshot_identity IS NULL THEN
        SELECT snapshot_id, status
        INTO snapshot_identity, existing_snapshot_status
        FROM tai_public_corpus_snapshots
        WHERE snapshot_sha256 = p_snapshot_sha256
          AND created_at = p_observed_at
          AND source_ids = jsonb_build_array(c_source_id)
          AND artifact_sha256s = jsonb_build_array(p_artifact_sha256);
        IF snapshot_identity IS NULL OR existing_snapshot_status NOT IN ('BUILDING', 'ACTIVE') THEN
            RAISE EXCEPTION 'TAI_ROSSTAT_SNAPSHOT_CONFLICT' USING ERRCODE = '23505';
        END IF;
    END IF;

    INSERT INTO tai_rosstat_vshp2016254_records(
        snapshot_id,
        artifact_sha256,
        ordinal,
        source_xpath,
        value_text,
        value_sha256,
        fragment_sha256,
        source_data_sha256,
        created_at
    )
    SELECT
        snapshot_identity,
        p_artifact_sha256,
        input.ordinal,
        input.xpath,
        input.value,
        input."valueSha256",
        input."fragmentSha256",
        c_data_sha,
        p_observed_at
    FROM jsonb_to_recordset(p_records) AS input(
        ordinal INTEGER,
        xpath TEXT,
        value TEXT,
        "valueSha256" TEXT,
        "fragmentSha256" TEXT
    )
    ORDER BY input.ordinal
    ON CONFLICT (snapshot_id, ordinal) DO NOTHING;

    IF (
        SELECT count(*)
        FROM tai_rosstat_vshp2016254_records
        WHERE snapshot_id = snapshot_identity
    ) <> records_count THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_PERSISTED_RECORD_COUNT_MISMATCH' USING ERRCODE = '23505';
    END IF;

    INSERT INTO tai_public_corpus_chunks(
        snapshot_id,
        chunk_id,
        artifact_sha256,
        source_id,
        ordinal,
        chunk_text,
        token_estimate,
        trust_score,
        valid_until
    )
    SELECT
        snapshot_identity,
        input."chunkId",
        p_artifact_sha256,
        c_source_id,
        input.ordinal,
        input.text,
        input."tokenEstimate",
        0.970,
        c_rights_due
    FROM jsonb_to_recordset(p_chunks) AS input(
        ordinal INTEGER,
        "chunkId" TEXT,
        text TEXT,
        "tokenEstimate" INTEGER
    )
    ORDER BY input.ordinal
    ON CONFLICT (snapshot_id, chunk_id) DO NOTHING;

    IF (
        SELECT count(*)
        FROM tai_public_corpus_chunks
        WHERE snapshot_id = snapshot_identity
    ) <> chunks_count THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_PERSISTED_CHUNK_COUNT_MISMATCH' USING ERRCODE = '23505';
    END IF;

    event_payload := c_source_id || E'\n' || c_rights_decision || E'\n' ||
        c_passport_sha || E'\n' || c_structure_sha || E'\n' || c_data_sha || E'\n' ||
        c_rights_semantic_sha || E'\n' || c_dataset_semantic_sha || E'\n' ||
        acquisition_evidence_sha;
    INSERT INTO tai_public_corpus_audit(
        event_sha256, event_type, source_id, actor_id, reason_code, payload_sha256, created_at
    ) VALUES (
        encode(digest(convert_to('SOURCE_ADMITTED' || E'\n' || event_payload, 'UTF8'), 'sha256'), 'hex'),
        'SOURCE_ADMITTED', c_source_id, p_actor_id, 'ROSSTAT_OPEN_DATA_RIGHTS_ACCEPTED',
        encode(digest(convert_to(event_payload, 'UTF8'), 'sha256'), 'hex'), p_observed_at
    ) ON CONFLICT (event_sha256) DO NOTHING;

    INSERT INTO tai_public_corpus_audit(
        event_sha256, event_type, source_id, artifact_sha256,
        actor_id, reason_code, payload_sha256, created_at
    ) VALUES (
        encode(digest(convert_to('ARTIFACT_ADMITTED' || E'\n' || p_artifact_sha256, 'UTF8'), 'sha256'), 'hex'),
        'ARTIFACT_ADMITTED', c_source_id, p_artifact_sha256,
        p_actor_id, 'ROSSTAT_SDMX_MATERIALIZED',
        encode(digest(convert_to(p_artifact_text, 'UTF8'), 'sha256'), 'hex'), p_observed_at
    ) ON CONFLICT (event_sha256) DO NOTHING;

    INSERT INTO tai_public_corpus_audit(
        event_sha256, event_type, source_id, artifact_sha256, snapshot_id,
        actor_id, reason_code, payload_sha256, created_at
    ) VALUES (
        encode(digest(convert_to('SNAPSHOT_CREATED' || E'\n' || p_snapshot_sha256, 'UTF8'), 'sha256'), 'hex'),
        'SNAPSHOT_CREATED', c_source_id, p_artifact_sha256, snapshot_identity,
        p_actor_id, 'ROSSTAT_SNAPSHOT_BUILT', p_snapshot_sha256, p_observed_at
    ) ON CONFLICT (event_sha256) DO NOTHING;

    SELECT status INTO existing_snapshot_status
    FROM tai_public_corpus_snapshots
    WHERE snapshot_id = snapshot_identity;
    IF existing_snapshot_status = 'BUILDING' THEN
        PERFORM tai_activate_public_corpus_snapshot(snapshot_identity);
    ELSIF existing_snapshot_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_SNAPSHOT_NOT_ACTIVATABLE' USING ERRCODE = '55000';
    END IF;

    INSERT INTO tai_public_corpus_audit(
        event_sha256, event_type, source_id, artifact_sha256, snapshot_id,
        actor_id, reason_code, payload_sha256, created_at
    ) VALUES (
        encode(digest(convert_to('SNAPSHOT_ACTIVATED' || E'\n' || p_snapshot_sha256, 'UTF8'), 'sha256'), 'hex'),
        'SNAPSHOT_ACTIVATED', c_source_id, p_artifact_sha256, snapshot_identity,
        p_actor_id, 'ROSSTAT_SHARED_RAG_ACTIVATED', p_snapshot_sha256, p_observed_at
    ) ON CONFLICT (event_sha256) DO NOTHING;

    RETURN snapshot_identity;
END;
$$;

CREATE OR REPLACE VIEW tai_active_rosstat_vshp2016254_records_v1 AS
SELECT
    record.snapshot_id,
    record.artifact_sha256,
    record.ordinal,
    record.source_xpath,
    record.value_text,
    record.value_sha256,
    record.fragment_sha256,
    record.source_data_sha256,
    record.created_at
FROM tai_rosstat_vshp2016254_records AS record
JOIN tai_public_corpus_snapshots AS snapshot
  ON snapshot.snapshot_id = record.snapshot_id
 AND snapshot.status = 'ACTIVE'
JOIN tai_public_corpus_artifacts AS artifact
  ON artifact.artifact_sha256 = record.artifact_sha256
 AND artifact.status = 'ADMITTED'
JOIN tai_public_corpus_source_admissions AS source
  ON source.source_id = artifact.source_id
 AND source.status = 'ADMITTED'
WHERE source.source_id = 'official.rosstat.opendata.7708234640-vshp2016254'
  AND source.rights_review_due_at > clock_timestamp()
  AND artifact.freshness_due_at > clock_timestamp()
  AND NOT EXISTS (
      SELECT 1
      FROM tai_public_corpus_quarantine AS quarantine
      WHERE quarantine.released_at IS NULL
        AND (
            quarantine.source_id = source.source_id
            OR quarantine.artifact_sha256 = artifact.artifact_sha256
        )
  );

REVOKE ALL ON tai_rosstat_vshp2016254_records
    FROM PUBLIC, tai_rosstat_vshp2016254_writer;
REVOKE ALL ON tai_public_corpus_source_admissions
    FROM tai_rosstat_vshp2016254_writer;
REVOKE ALL ON tai_public_corpus_artifacts
    FROM tai_rosstat_vshp2016254_writer;
REVOKE ALL ON tai_public_corpus_snapshots
    FROM tai_rosstat_vshp2016254_writer;
REVOKE ALL ON tai_public_corpus_chunks
    FROM tai_rosstat_vshp2016254_writer;
REVOKE ALL ON tai_public_corpus_audit
    FROM tai_rosstat_vshp2016254_writer;
REVOKE ALL ON FUNCTION tai_admit_rosstat_vshp2016254_snapshot(
    TEXT, TEXT, BIGINT, TEXT, TIMESTAMPTZ, TEXT, JSONB, JSONB, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tai_admit_rosstat_vshp2016254_snapshot(
    TEXT, TEXT, BIGINT, TEXT, TIMESTAMPTZ, TEXT, JSONB, JSONB, TEXT
) TO tai_rosstat_vshp2016254_writer;

COMMENT ON TABLE tai_rosstat_vshp2016254_records IS
    'AP-14F1C immutable Rosstat SDMX values with exact XPath provenance; no raw XML bytes';
COMMENT ON FUNCTION tai_admit_rosstat_vshp2016254_snapshot(
    TEXT, TEXT, BIGINT, TEXT, TIMESTAMPTZ, TEXT, JSONB, JSONB, TEXT
) IS
    'Dataset-specific atomic authority binding AP-14F1B2 acquisition evidence to AP-14F1A snapshot activation';
COMMENT ON VIEW tai_active_rosstat_vshp2016254_records_v1 IS
    'Current fail-closed Rosstat VSHP2016254 records visible only through an active, rights-current snapshot';

COMMIT;
