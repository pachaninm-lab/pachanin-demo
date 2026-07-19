BEGIN;

CREATE TABLE IF NOT EXISTS tai_model_artifact_evidence (
    model_id TEXT NOT NULL,
    revision TEXT NOT NULL,
    artifact_sha256 TEXT NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
    artifact_locator TEXT NOT NULL CHECK (
        artifact_locator ~ '^file://'
        OR artifact_locator ~ '^oci://.+@sha256:[0-9a-f]{64}$'
    ),
    source_uri TEXT NOT NULL CHECK (source_uri ~ '^https://'),
    source_revision TEXT NOT NULL CHECK (source_revision ~ '^[0-9a-f]{40,64}$'),
    license_spdx TEXT NOT NULL CHECK (length(license_spdx) BETWEEN 1 AND 160),
    license_text_sha256 TEXT NOT NULL CHECK (license_text_sha256 ~ '^[0-9a-f]{64}$'),
    tokenizer_sha256 TEXT NOT NULL CHECK (tokenizer_sha256 ~ '^[0-9a-f]{64}$'),
    quantization TEXT NOT NULL CHECK (length(quantization) BETWEEN 1 AND 160),
    runtime_class TEXT NOT NULL CHECK (
        runtime_class IN ('CPU', 'GPU_SHARED', 'GPU_DEDICATED')
    ),
    artifact_size_bytes BIGINT NOT NULL CHECK (artifact_size_bytes > 0),
    artifact_created_at TIMESTAMPTZ NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (model_id, revision, artifact_sha256)
);

CREATE TABLE IF NOT EXISTS tai_model_license_reviews (
    review_sha256 TEXT PRIMARY KEY CHECK (review_sha256 ~ '^[0-9a-f]{64}$'),
    model_id TEXT NOT NULL,
    revision TEXT NOT NULL,
    artifact_sha256 TEXT NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
    license_spdx TEXT NOT NULL CHECK (length(license_spdx) BETWEEN 1 AND 160),
    license_text_sha256 TEXT NOT NULL CHECK (license_text_sha256 ~ '^[0-9a-f]{64}$'),
    decision TEXT NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
    reviewed_by TEXT NOT NULL CHECK (length(reviewed_by) BETWEEN 1 AND 160),
    reviewed_at TIMESTAMPTZ NOT NULL,
    evidence_locator TEXT NOT NULL CHECK (
        evidence_locator ~ '^file://'
        OR evidence_locator ~ '^oci://.+@sha256:[0-9a-f]{64}$'
    ),
    evidence_sha256 TEXT NOT NULL CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
    restrictions JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (
        jsonb_typeof(restrictions) = 'array'
    ),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    FOREIGN KEY (model_id, revision, artifact_sha256)
        REFERENCES tai_model_artifact_evidence (model_id, revision, artifact_sha256)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS tai_model_license_reviews_identity_idx
    ON tai_model_license_reviews (model_id, revision, artifact_sha256, reviewed_at DESC);

CREATE TABLE IF NOT EXISTS tai_model_benchmark_evidence (
    benchmark_id TEXT PRIMARY KEY CHECK (length(benchmark_id) BETWEEN 1 AND 128),
    model_id TEXT NOT NULL,
    revision TEXT NOT NULL,
    artifact_sha256 TEXT NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
    runtime_class TEXT NOT NULL CHECK (
        runtime_class IN ('CPU', 'GPU_SHARED', 'GPU_DEDICATED')
    ),
    hardware_profile TEXT NOT NULL CHECK (length(hardware_profile) BETWEEN 1 AND 500),
    quantization TEXT NOT NULL CHECK (length(quantization) BETWEEN 1 AND 160),
    sample_count INTEGER NOT NULL CHECK (sample_count > 0),
    platform_accuracy_basis_points INTEGER NOT NULL CHECK (
        platform_accuracy_basis_points BETWEEN 0 AND 10000
    ),
    agro_accuracy_basis_points INTEGER NOT NULL CHECK (
        agro_accuracy_basis_points BETWEEN 0 AND 10000
    ),
    prompt_tokens_per_second_milli BIGINT NOT NULL CHECK (
        prompt_tokens_per_second_milli > 0
    ),
    generation_tokens_per_second_milli BIGINT NOT NULL CHECK (
        generation_tokens_per_second_milli > 0
    ),
    p95_latency_ms INTEGER NOT NULL CHECK (p95_latency_ms > 0),
    peak_memory_mb INTEGER NOT NULL CHECK (peak_memory_mb > 0),
    estimated_cost_rub_per_million_tokens_milli BIGINT NOT NULL CHECK (
        estimated_cost_rub_per_million_tokens_milli >= 0
    ),
    measured_at TIMESTAMPTZ NOT NULL,
    evidence_locator TEXT NOT NULL CHECK (
        evidence_locator ~ '^file://'
        OR evidence_locator ~ '^oci://.+@sha256:[0-9a-f]{64}$'
    ),
    evidence_sha256 TEXT NOT NULL UNIQUE CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    FOREIGN KEY (model_id, revision, artifact_sha256)
        REFERENCES tai_model_artifact_evidence (model_id, revision, artifact_sha256)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS tai_model_benchmark_identity_idx
    ON tai_model_benchmark_evidence (
        model_id,
        revision,
        artifact_sha256,
        runtime_class,
        measured_at DESC
    );

CREATE TABLE IF NOT EXISTS tai_model_admission_decisions (
    decision_sha256 TEXT PRIMARY KEY CHECK (decision_sha256 ~ '^[0-9a-f]{64}$'),
    model_id TEXT NOT NULL,
    revision TEXT NOT NULL,
    artifact_sha256 TEXT NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
    status TEXT NOT NULL CHECK (status IN ('ACCEPTED', 'REJECTED')),
    accepted BOOLEAN GENERATED ALWAYS AS (status = 'ACCEPTED') STORED,
    reasons JSONB NOT NULL CHECK (jsonb_typeof(reasons) = 'array'),
    fallback_identities JSONB NOT NULL CHECK (jsonb_typeof(fallback_identities) = 'array'),
    license_review_sha256 TEXT NOT NULL CHECK (license_review_sha256 ~ '^[0-9a-f]{64}$'),
    benchmark_evidence_sha256s JSONB NOT NULL CHECK (
        jsonb_typeof(benchmark_evidence_sha256s) = 'array'
    ),
    decided_at TIMESTAMPTZ NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    FOREIGN KEY (model_id, revision, artifact_sha256)
        REFERENCES tai_model_artifact_evidence (model_id, revision, artifact_sha256)
        ON DELETE RESTRICT,
    FOREIGN KEY (license_review_sha256)
        REFERENCES tai_model_license_reviews (review_sha256)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS tai_model_admission_identity_idx
    ON tai_model_admission_decisions (
        model_id,
        revision,
        decided_at DESC,
        decision_sha256 DESC
    );

CREATE OR REPLACE VIEW tai_current_model_admission_v1 AS
SELECT DISTINCT ON (decision.model_id, decision.revision)
    decision.model_id,
    decision.revision,
    decision.artifact_sha256,
    decision.accepted,
    decision.status,
    decision.reasons,
    decision.fallback_identities,
    decision.decided_at,
    decision.decision_sha256
FROM tai_model_admission_decisions AS decision
ORDER BY
    decision.model_id,
    decision.revision,
    decision.decided_at DESC,
    decision.decision_sha256 DESC;

COMMIT;
