BEGIN;

CREATE TABLE IF NOT EXISTS tai_official_source_run_evidence (
    run_sha256 TEXT PRIMARY KEY CHECK (run_sha256 ~ '^[0-9a-f]{64}$'),
    source_id TEXT NOT NULL CHECK (source_id ~ '^[a-z0-9][a-z0-9._-]{2,127}$'),
    worker_id TEXT NOT NULL CHECK (length(btrim(worker_id)) > 0),
    lease_token UUID NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (
        status IN (
            'FETCHED',
            'NOT_MODIFIED',
            'RETRYABLE_FAILURE',
            'PERMANENT_FAILURE'
        )
    ),
    reasons JSONB NOT NULL CHECK (
        jsonb_typeof(reasons) = 'array'
        AND jsonb_array_length(reasons) > 0
    ),
    observation_sha256 TEXT REFERENCES tai_official_source_observations (
        observation_sha256
    ),
    content_sha256 TEXT CHECK (
        content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'
    ),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CHECK (completed_at >= started_at),
    CHECK (
        observation_sha256 IS NULL
        OR observation_sha256 ~ '^[0-9a-f]{64}$'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS tai_official_source_run_lease_idx
    ON tai_official_source_run_evidence (source_id, lease_token);

CREATE INDEX IF NOT EXISTS tai_official_source_run_latest_idx
    ON tai_official_source_run_evidence (source_id, completed_at DESC, run_sha256 DESC);

CREATE OR REPLACE VIEW tai_latest_official_source_run_evidence_v1 AS
SELECT DISTINCT ON (evidence.source_id)
    evidence.run_sha256,
    evidence.source_id,
    evidence.worker_id,
    evidence.lease_token,
    evidence.started_at,
    evidence.completed_at,
    evidence.status,
    evidence.reasons,
    evidence.observation_sha256,
    evidence.content_sha256
FROM tai_official_source_run_evidence AS evidence
ORDER BY evidence.source_id, evidence.completed_at DESC, evidence.run_sha256 DESC;

COMMENT ON TABLE tai_official_source_run_evidence IS
    'Immutable AP-14B evidence for fenced official-source observation runs';
COMMENT ON COLUMN tai_official_source_run_evidence.lease_token IS
    'Loader fencing token bound to exactly one immutable source run';

COMMIT;
