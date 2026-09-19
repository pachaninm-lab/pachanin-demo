BEGIN;

CREATE TABLE IF NOT EXISTS tai_local_model_profiles (
    model_id TEXT NOT NULL,
    revision TEXT NOT NULL,
    artifact_locator TEXT NOT NULL CHECK (
        artifact_locator ~ '^(file|oci)://'
    ),
    artifact_sha256 TEXT NOT NULL CHECK (
        artifact_sha256 ~ '^[0-9a-f]{64}$'
    ),
    license_ref TEXT NOT NULL,
    capabilities TEXT[] NOT NULL CHECK (
        cardinality(capabilities) > 0
        AND capabilities @> ARRAY['TEXT_GENERATION']::TEXT[]
    ),
    maximum_context_tokens INTEGER NOT NULL CHECK (maximum_context_tokens >= 512),
    maximum_output_tokens INTEGER NOT NULL CHECK (
        maximum_output_tokens >= 16
        AND maximum_output_tokens <= maximum_context_tokens
    ),
    runtime_class TEXT NOT NULL CHECK (
        runtime_class IN ('CPU', 'GPU_SHARED', 'GPU_DEDICATED')
    ),
    quantization TEXT NOT NULL,
    routing_priority INTEGER NOT NULL DEFAULT 100 CHECK (
        routing_priority BETWEEN 0 AND 1000
    ),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (
        status IN ('ACTIVE', 'DRAINING', 'DISABLED', 'QUARANTINED')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    PRIMARY KEY (model_id, revision)
);

CREATE INDEX IF NOT EXISTS tai_local_model_profiles_route_idx
    ON tai_local_model_profiles (status, routing_priority, runtime_class, model_id, revision);

CREATE TABLE IF NOT EXISTS tai_local_model_health (
    model_id TEXT NOT NULL,
    revision TEXT NOT NULL,
    status TEXT NOT NULL CHECK (
        status IN ('READY', 'DEGRADED', 'WARMING', 'UNAVAILABLE')
    ),
    available_slots INTEGER NOT NULL CHECK (available_slots >= 0),
    queue_depth INTEGER NOT NULL CHECK (queue_depth >= 0),
    p95_latency_ms INTEGER NOT NULL CHECK (p95_latency_ms >= 0),
    observed_at TIMESTAMPTZ NOT NULL,
    circuit_open_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (model_id, revision),
    FOREIGN KEY (model_id, revision)
        REFERENCES tai_local_model_profiles (model_id, revision)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS tai_local_model_health_route_idx
    ON tai_local_model_health (status, observed_at DESC, available_slots, queue_depth);

ALTER TABLE tai_rag_traces
    ADD COLUMN IF NOT EXISTS model_revision TEXT,
    ADD COLUMN IF NOT EXISTS model_route_id TEXT CHECK (
        model_route_id IS NULL OR model_route_id ~ '^[0-9a-f]{64}$'
    ),
    ADD COLUMN IF NOT EXISTS model_attempts JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (
        jsonb_typeof(model_attempts) = 'array'
    );

COMMIT;
