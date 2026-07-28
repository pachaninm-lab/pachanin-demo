BEGIN;

CREATE TABLE IF NOT EXISTS tai_public_corpus_source_admissions (
    source_id TEXT PRIMARY KEY CHECK (source_id ~ '^[a-z0-9][a-z0-9._-]{4,160}$'),
    data_plane TEXT NOT NULL CHECK (data_plane = 'PUBLIC_OFFICIAL'),
    source_class TEXT NOT NULL CHECK (
        source_class IN ('OFFICIAL_MANUAL', 'OFFICIAL_REGULATION', 'OPEN_DATASET', 'PUBLIC_REGISTRY')
    ),
    rights_decision_id TEXT NOT NULL CHECK (rights_decision_id ~ '^AP14F0-[A-Z0-9_-]{5,96}$'),
    official_uri TEXT NOT NULL CHECK (official_uri ~ '^https://'),
    host_pin TEXT NOT NULL CHECK (host_pin ~ '^[a-z0-9.-]{4,253}$'),
    rights_review_due_at TIMESTAMPTZ NOT NULL,
    admitted_at TIMESTAMPTZ NOT NULL,
    trust_score NUMERIC(4,3) NOT NULL CHECK (trust_score BETWEEN 0.500 AND 1.000),
    status TEXT NOT NULL CHECK (status IN ('ADMITTED', 'WITHDRAWN')),
    withdrawn_at TIMESTAMPTZ,
    withdrawal_reason TEXT,
    CHECK (rights_review_due_at > admitted_at),
    CHECK (
        (status = 'ADMITTED' AND withdrawn_at IS NULL AND withdrawal_reason IS NULL)
        OR
        (status = 'WITHDRAWN' AND withdrawn_at IS NOT NULL AND length(btrim(withdrawal_reason)) > 0)
    )
);

CREATE TABLE IF NOT EXISTS tai_public_corpus_artifacts (
    artifact_sha256 TEXT PRIMARY KEY CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
    record_id TEXT NOT NULL UNIQUE CHECK (record_id ~ '^prov_[a-z0-9]{16,64}$'),
    source_id TEXT NOT NULL REFERENCES tai_public_corpus_source_admissions (source_id),
    source_class TEXT NOT NULL CHECK (
        source_class IN ('OFFICIAL_MANUAL', 'OFFICIAL_REGULATION', 'OPEN_DATASET', 'PUBLIC_REGISTRY')
    ),
    rights_decision_id TEXT NOT NULL CHECK (rights_decision_id ~ '^AP14F0-[A-Z0-9_-]{5,96}$'),
    official_uri TEXT NOT NULL CHECK (official_uri ~ '^https://'),
    host_pin TEXT NOT NULL CHECK (host_pin ~ '^[a-z0-9.-]{4,253}$'),
    media_type TEXT NOT NULL CHECK (
        media_type IN ('text/html', 'text/plain', 'application/json', 'application/xml', 'text/xml')
    ),
    size_bytes BIGINT NOT NULL CHECK (size_bytes BETWEEN 1 AND 20000000),
    publication_date DATE,
    effective_date DATE,
    observed_at TIMESTAMPTZ NOT NULL,
    locator_kind TEXT NOT NULL CHECK (
        locator_kind IN ('PAGE', 'ROW', 'SECTION', 'RECORD_ID', 'JSON_POINTER', 'XML_XPATH', 'API_FIELD')
    ),
    locator_value TEXT NOT NULL CHECK (length(btrim(locator_value)) BETWEEN 1 AND 1024),
    freshness_due_at TIMESTAMPTZ NOT NULL,
    unit TEXT CHECK (unit IS NULL OR length(btrim(unit)) > 0),
    period_start DATE,
    period_end DATE,
    status TEXT NOT NULL CHECK (status IN ('ADMITTED', 'QUARANTINED', 'WITHDRAWN')),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CHECK (freshness_due_at > observed_at),
    CHECK ((period_start IS NULL AND period_end IS NULL) OR (period_start IS NOT NULL AND period_end >= period_start))
);

CREATE INDEX IF NOT EXISTS tai_public_corpus_artifact_source_idx
    ON tai_public_corpus_artifacts (source_id, status, freshness_due_at);

CREATE TABLE IF NOT EXISTS tai_public_corpus_quarantine (
    quarantine_id UUID PRIMARY KEY,
    source_id TEXT NOT NULL,
    artifact_sha256 TEXT,
    reason_code TEXT NOT NULL CHECK (
        reason_code IN (
            'RIGHTS_UNRESOLVED', 'RIGHTS_EXPIRED', 'PROVENANCE_INCOMPLETE', 'HOST_MISMATCH',
            'DIGEST_MISMATCH', 'FRESHNESS_EXPIRED', 'PRIVACY_OR_SECRET',
            'TENANT_OR_CONTRACT_DATA', 'MIME_OR_SIZE_POLICY', 'CONTENT_SAFETY',
            'PARSER_FAILURE', 'WITHDRAWN_SOURCE'
        )
    ),
    detail_code TEXT NOT NULL CHECK (detail_code ~ '^[A-Z0-9_]{3,96}$'),
    created_at TIMESTAMPTZ NOT NULL,
    released_at TIMESTAMPTZ,
    release_actor_id TEXT,
    release_audit_sha256 TEXT CHECK (
        release_audit_sha256 IS NULL OR release_audit_sha256 ~ '^[0-9a-f]{64}$'
    ),
    CHECK (
        (released_at IS NULL AND release_actor_id IS NULL AND release_audit_sha256 IS NULL)
        OR
        (released_at IS NOT NULL AND length(btrim(release_actor_id)) > 0 AND release_audit_sha256 IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS tai_public_corpus_snapshots (
    snapshot_id BIGSERIAL PRIMARY KEY,
    snapshot_sha256 TEXT NOT NULL UNIQUE CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
    status TEXT NOT NULL CHECK (status IN ('BUILDING', 'ACTIVE', 'RETIRED', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL,
    activated_at TIMESTAMPTZ,
    source_ids JSONB NOT NULL CHECK (jsonb_typeof(source_ids) = 'array' AND jsonb_array_length(source_ids) > 0),
    artifact_sha256s JSONB NOT NULL CHECK (
        jsonb_typeof(artifact_sha256s) = 'array' AND jsonb_array_length(artifact_sha256s) > 0
    ),
    CHECK ((status = 'ACTIVE' AND activated_at IS NOT NULL) OR status <> 'ACTIVE')
);

CREATE UNIQUE INDEX IF NOT EXISTS tai_public_corpus_one_active_snapshot_idx
    ON tai_public_corpus_snapshots ((status))
    WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS tai_public_corpus_chunks (
    snapshot_id BIGINT NOT NULL REFERENCES tai_public_corpus_snapshots (snapshot_id) ON DELETE RESTRICT,
    chunk_id TEXT NOT NULL CHECK (chunk_id ~ '^[0-9a-f]{64}$'),
    artifact_sha256 TEXT NOT NULL REFERENCES tai_public_corpus_artifacts (artifact_sha256) ON DELETE RESTRICT,
    source_id TEXT NOT NULL REFERENCES tai_public_corpus_source_admissions (source_id) ON DELETE RESTRICT,
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    chunk_text TEXT NOT NULL CHECK (length(btrim(chunk_text)) > 0),
    token_estimate INTEGER NOT NULL CHECK (token_estimate > 0),
    trust_score NUMERIC(4,3) NOT NULL CHECK (trust_score BETWEEN 0.500 AND 1.000),
    valid_until TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (snapshot_id, chunk_id),
    UNIQUE (snapshot_id, artifact_sha256, ordinal)
);

CREATE INDEX IF NOT EXISTS tai_public_corpus_chunk_source_idx
    ON tai_public_corpus_chunks (source_id, snapshot_id, chunk_id);

CREATE TABLE IF NOT EXISTS tai_public_corpus_audit (
    event_sha256 TEXT PRIMARY KEY CHECK (event_sha256 ~ '^[0-9a-f]{64}$'),
    event_type TEXT NOT NULL CHECK (
        event_type IN ('SOURCE_ADMITTED', 'ARTIFACT_ADMITTED', 'SNAPSHOT_ACTIVATED', 'SOURCE_WITHDRAWN', 'QUARANTINE_RELEASED')
    ),
    source_id TEXT,
    artifact_sha256 TEXT,
    snapshot_id BIGINT,
    actor_id TEXT NOT NULL CHECK (length(btrim(actor_id)) > 0),
    reason_code TEXT NOT NULL CHECK (length(btrim(reason_code)) > 0),
    payload_sha256 TEXT NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL
);

CREATE OR REPLACE FUNCTION tai_activate_public_corpus_snapshot(target_snapshot BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    target_status TEXT;
    invalid_count BIGINT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('tai.public-corpus.activation.v1', 0));

    SELECT status INTO target_status
    FROM tai_public_corpus_snapshots
    WHERE snapshot_id = target_snapshot
    FOR UPDATE;

    IF target_status IS DISTINCT FROM 'BUILDING' THEN
        RAISE EXCEPTION 'public corpus snapshot must be BUILDING';
    END IF;

    SELECT count(*) INTO invalid_count
    FROM tai_public_corpus_chunks AS chunk
    JOIN tai_public_corpus_artifacts AS artifact ON artifact.artifact_sha256 = chunk.artifact_sha256
    JOIN tai_public_corpus_source_admissions AS admission ON admission.source_id = chunk.source_id
    WHERE chunk.snapshot_id = target_snapshot
      AND (
          artifact.status <> 'ADMITTED'
          OR admission.status <> 'ADMITTED'
          OR artifact.source_id <> admission.source_id
          OR artifact.source_class <> admission.source_class
          OR artifact.rights_decision_id <> admission.rights_decision_id
          OR artifact.official_uri <> admission.official_uri
          OR artifact.host_pin <> admission.host_pin
          OR artifact.freshness_due_at <= clock_timestamp()
          OR admission.rights_review_due_at <= clock_timestamp()
          OR chunk.valid_until <= clock_timestamp()
      );

    IF invalid_count > 0 THEN
        RAISE EXCEPTION 'public corpus snapshot contains ineligible material';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM tai_public_corpus_chunks WHERE snapshot_id = target_snapshot
    ) THEN
        RAISE EXCEPTION 'public corpus snapshot contains no chunks';
    END IF;

    UPDATE tai_public_corpus_snapshots
    SET status = 'RETIRED'
    WHERE status = 'ACTIVE';

    UPDATE tai_public_corpus_snapshots
    SET status = 'ACTIVE', activated_at = clock_timestamp()
    WHERE snapshot_id = target_snapshot;
END;
$$;

CREATE OR REPLACE FUNCTION tai_withdraw_public_corpus_source(
    target_source TEXT,
    actor_id TEXT,
    reason TEXT,
    withdrawn_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF length(btrim(actor_id)) = 0 OR length(btrim(reason)) = 0 THEN
        RAISE EXCEPTION 'withdrawal actor and reason are required';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('tai.public-corpus.withdrawal.v1:' || target_source, 0));

    UPDATE tai_public_corpus_source_admissions
    SET status = 'WITHDRAWN', withdrawn_at = tai_withdraw_public_corpus_source.withdrawn_at,
        withdrawal_reason = reason
    WHERE source_id = target_source AND status = 'ADMITTED';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'admitted public corpus source not found';
    END IF;

    UPDATE tai_public_corpus_artifacts
    SET status = 'WITHDRAWN'
    WHERE source_id = target_source AND status = 'ADMITTED';

    UPDATE tai_public_corpus_snapshots AS snapshot
    SET status = 'RETIRED'
    WHERE snapshot.status = 'ACTIVE'
      AND EXISTS (
          SELECT 1 FROM tai_public_corpus_chunks AS chunk
          WHERE chunk.snapshot_id = snapshot.snapshot_id
            AND chunk.source_id = target_source
      );
END;
$$;

CREATE OR REPLACE VIEW tai_active_public_corpus_chunks_v1 AS
SELECT
    chunk.snapshot_id,
    chunk.chunk_id,
    chunk.artifact_sha256,
    chunk.source_id,
    chunk.ordinal,
    chunk.chunk_text,
    chunk.token_estimate,
    chunk.trust_score,
    chunk.valid_until
FROM tai_public_corpus_chunks AS chunk
JOIN tai_public_corpus_snapshots AS snapshot
  ON snapshot.snapshot_id = chunk.snapshot_id AND snapshot.status = 'ACTIVE'
JOIN tai_public_corpus_artifacts AS artifact
  ON artifact.artifact_sha256 = chunk.artifact_sha256 AND artifact.status = 'ADMITTED'
JOIN tai_public_corpus_source_admissions AS admission
  ON admission.source_id = chunk.source_id AND admission.status = 'ADMITTED';

COMMENT ON TABLE tai_public_corpus_source_admissions IS
    'AP-14F1A authority for explicitly admitted PUBLIC_OFFICIAL shared-RAG sources';
COMMENT ON TABLE tai_public_corpus_artifacts IS
    'Immutable public official artifact provenance; raw corpus bytes are not stored in Git';
COMMENT ON TABLE tai_public_corpus_chunks IS
    'Deterministic AP-05 chunks bound to one immutable AP-14F1A corpus snapshot';
COMMENT ON VIEW tai_active_public_corpus_chunks_v1 IS
    'Fail-closed shared retrieval view exposing only one active, admitted public corpus snapshot';

COMMIT;
