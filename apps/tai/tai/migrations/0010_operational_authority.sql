BEGIN;

CREATE TABLE IF NOT EXISTS tai_slo_observations (
    observation_id TEXT PRIMARY KEY,
    slo_id TEXT NOT NULL,
    indicator TEXT NOT NULL CHECK (
        indicator IN (
            'AVAILABILITY',
            'LATENCY_P95',
            'ERROR_RATE',
            'QUEUE_LAG',
            'RETRIEVAL_FRESHNESS',
            'MODEL_CAPACITY',
            'AUDIT_DURABILITY'
        )
    ),
    value DOUBLE PRECISION NOT NULL CHECK (isfinite(value)),
    sample_count BIGINT NOT NULL CHECK (sample_count >= 0),
    window_started_at TIMESTAMPTZ NOT NULL,
    window_ended_at TIMESTAMPTZ NOT NULL CHECK (window_ended_at >= window_started_at),
    observed_at TIMESTAMPTZ NOT NULL CHECK (observed_at >= window_ended_at),
    source_sha256 TEXT NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
    exact_head_sha TEXT NOT NULL CHECK (exact_head_sha ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS tai_slo_observations_latest_idx
    ON tai_slo_observations (slo_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS tai_operational_evidence (
    evidence_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (
        kind IN (
            'EVALUATION',
            'SECURITY',
            'BACKUP_RESTORE',
            'ROLLBACK',
            'CAPACITY',
            'OBSERVABILITY',
            'DATA_RETENTION'
        )
    ),
    exact_head_sha TEXT NOT NULL CHECK (exact_head_sha ~ '^[0-9a-f]{64}$'),
    artifact_sha256 TEXT NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
    accepted BOOLEAN NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL CHECK (valid_until > observed_at),
    authority TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metadata) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (kind, exact_head_sha, artifact_sha256)
);

CREATE INDEX IF NOT EXISTS tai_operational_evidence_release_idx
    ON tai_operational_evidence (exact_head_sha, kind, accepted, valid_until DESC);

CREATE TABLE IF NOT EXISTS tai_operational_readiness_decisions (
    release_id TEXT PRIMARY KEY,
    exact_head_sha TEXT NOT NULL CHECK (exact_head_sha ~ '^[0-9a-f]{64}$'),
    accepted BOOLEAN NOT NULL,
    reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    evidence_ids TEXT[] NOT NULL,
    assessment_sha256s TEXT[] NOT NULL,
    decided_at TIMESTAMPTZ NOT NULL,
    decision_sha256 TEXT NOT NULL UNIQUE CHECK (decision_sha256 ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS tai_operational_readiness_head_idx
    ON tai_operational_readiness_decisions (exact_head_sha, accepted, decided_at DESC);

CREATE TABLE IF NOT EXISTS tai_incident_events (
    incident_id UUID NOT NULL,
    sequence BIGINT NOT NULL CHECK (sequence > 0),
    kind TEXT NOT NULL CHECK (
        kind IN (
            'OPENED',
            'ACKNOWLEDGED',
            'MITIGATION_STARTED',
            'MITIGATION_VERIFIED',
            'RESOLVED',
            'POSTMORTEM_ATTACHED',
            'CLOSED'
        )
    ),
    severity TEXT NOT NULL CHECK (severity IN ('SEV1', 'SEV2', 'SEV3', 'SEV4')),
    actor_id TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    evidence_sha256 TEXT NOT NULL CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
    previous_event_sha256 TEXT CHECK (
        previous_event_sha256 IS NULL OR previous_event_sha256 ~ '^[0-9a-f]{64}$'
    ),
    event_sha256 TEXT NOT NULL UNIQUE CHECK (event_sha256 ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (incident_id, sequence),
    CHECK (
        (sequence = 1 AND previous_event_sha256 IS NULL)
        OR (sequence > 1 AND previous_event_sha256 IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS tai_incident_events_timeline_idx
    ON tai_incident_events (incident_id, occurred_at, sequence);

CREATE TABLE IF NOT EXISTS tai_retention_holds (
    record_id TEXT NOT NULL,
    retention_class TEXT NOT NULL CHECK (
        retention_class IN (
            'REQUEST_TRACE',
            'TOOL_AUDIT',
            'EVALUATION',
            'INCIDENT',
            'SECURITY_EVIDENCE'
        )
    ),
    legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    hold_reason TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    PRIMARY KEY (retention_class, record_id),
    CHECK (legal_hold OR hold_reason IS NULL)
);

COMMIT;
