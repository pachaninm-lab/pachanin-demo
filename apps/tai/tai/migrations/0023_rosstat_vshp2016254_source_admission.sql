BEGIN;

CREATE OR REPLACE FUNCTION tai_admit_rosstat_vshp2016254_source(
    p_observed_at TIMESTAMPTZ,
    p_rights_semantic_sha256 TEXT,
    p_dataset_semantic_sha256 TEXT,
    p_actor_id TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    c_source_id CONSTANT TEXT := 'official.rosstat.opendata.7708234640-vshp2016254';
    c_rights_decision CONSTANT TEXT := 'AP14F0-ROSSTAT-OPEN-DATA-7708234640-VSHP2016254';
    c_data_uri CONSTANT TEXT := 'https://rosstat.gov.ru/opendata/7708234640-VSHP2016254/data-20181211T0212-structure-20181211T0212.xml';
    c_host CONSTANT TEXT := 'rosstat.gov.ru';
    c_rights_sha CONSTANT TEXT := '01f432c3c32a878db89329878c2d679f84302ca0006ea192f78e4ea1bce21ad7';
    c_dataset_sha CONSTANT TEXT := 'dd9ecb1f3921fb387d2d87ae9dfd26cddbe037510365d501d82e08c20b62b055';
    c_rights_due CONSTANT TIMESTAMPTZ := '2026-10-29T00:00:00Z';
    payload TEXT;
BEGIN
    IF p_observed_at IS NULL
       OR p_observed_at < '2018-12-11T00:00:00Z'::TIMESTAMPTZ
       OR p_observed_at >= c_rights_due THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_SOURCE_RIGHTS_TIME_INVALID' USING ERRCODE = '22023';
    END IF;
    IF p_rights_semantic_sha256 <> c_rights_sha
       OR p_dataset_semantic_sha256 <> c_dataset_sha THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_SOURCE_SEMANTIC_EVIDENCE_MISMATCH' USING ERRCODE = '22023';
    END IF;
    IF length(btrim(p_actor_id)) NOT BETWEEN 1 AND 160 THEN
        RAISE EXCEPTION 'TAI_ROSSTAT_SOURCE_ACTOR_REQUIRED' USING ERRCODE = '22023';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('tai.rosstat.vshp2016254.source.v1', 0));

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

    payload := c_source_id || E'\n' || c_rights_decision || E'\n' || c_data_uri || E'\n' ||
        c_rights_sha || E'\n' || c_dataset_sha;
    INSERT INTO tai_public_corpus_audit(
        event_sha256,
        event_type,
        source_id,
        actor_id,
        reason_code,
        payload_sha256,
        created_at
    ) VALUES (
        encode(
            digest(convert_to('SOURCE_ADMITTED' || E'\n' || payload || E'\nRIGHTS_ONLY', 'UTF8'), 'sha256'),
            'hex'
        ),
        'SOURCE_ADMITTED',
        c_source_id,
        p_actor_id,
        'ROSSTAT_SOURCE_RIGHTS_ACCEPTED',
        encode(digest(convert_to(payload, 'UTF8'), 'sha256'), 'hex'),
        p_observed_at
    ) ON CONFLICT (event_sha256) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION tai_admit_rosstat_vshp2016254_source(
    TIMESTAMPTZ, TEXT, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tai_admit_rosstat_vshp2016254_source(
    TIMESTAMPTZ, TEXT, TEXT, TEXT
) TO tai_rosstat_vshp2016254_writer;

COMMENT ON FUNCTION tai_admit_rosstat_vshp2016254_source(
    TIMESTAMPTZ, TEXT, TEXT, TEXT
) IS
    'Source-specific AP-14F1C rights admission prerequisite; accepts only exact Rosstat semantic evidence pins';

COMMIT;
