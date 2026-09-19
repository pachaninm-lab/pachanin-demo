BEGIN;

CREATE TABLE IF NOT EXISTS tai_application_release_attestations (
    attestation_sha256 TEXT PRIMARY KEY CHECK (
        attestation_sha256 ~ '^[0-9a-f]{64}$'
    ),
    release_id TEXT NOT NULL CHECK (release_id ~ '^[0-9a-f]{64}$'),
    repository TEXT NOT NULL,
    exact_main_sha TEXT NOT NULL CHECK (exact_main_sha ~ '^[0-9a-f]{64}$'),
    accepted BOOLEAN NOT NULL,
    reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    source_tree_sha256 TEXT NOT NULL CHECK (source_tree_sha256 ~ '^[0-9a-f]{64}$'),
    migration_inventory_sha256 TEXT NOT NULL CHECK (
        migration_inventory_sha256 ~ '^[0-9a-f]{64}$'
    ),
    workflow_evidence_sha256s TEXT[] NOT NULL CHECK (
        cardinality(workflow_evidence_sha256s) > 0
    ),
    previous_attestation_sha256 TEXT REFERENCES tai_application_release_attestations (
        attestation_sha256
    ) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL,
    production_operational_status TEXT NOT NULL CHECK (
        production_operational_status IN ('NOT_ATTESTED', 'ACCEPTED', 'REJECTED')
    ),
    persisted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS tai_application_release_id_idx
    ON tai_application_release_attestations (release_id, created_at DESC);

CREATE INDEX IF NOT EXISTS tai_application_release_exact_main_idx
    ON tai_application_release_attestations (exact_main_sha, accepted, created_at DESC);

CREATE TABLE IF NOT EXISTS tai_production_release_attestations (
    attestation_sha256 TEXT PRIMARY KEY CHECK (
        attestation_sha256 ~ '^[0-9a-f]{64}$'
    ),
    release_id TEXT NOT NULL CHECK (release_id ~ '^[0-9a-f]{64}$'),
    exact_main_sha TEXT NOT NULL CHECK (exact_main_sha ~ '^[0-9a-f]{64}$'),
    application_attestation_sha256 TEXT NOT NULL REFERENCES
        tai_application_release_attestations (attestation_sha256) ON DELETE RESTRICT,
    evaluation_report_sha256 TEXT NOT NULL CHECK (
        evaluation_report_sha256 ~ '^[0-9a-f]{64}$'
    ),
    operational_decision_sha256 TEXT NOT NULL CHECK (
        operational_decision_sha256 ~ '^[0-9a-f]{64}$'
    ),
    status TEXT NOT NULL CHECK (status IN ('ACCEPTED', 'REJECTED')),
    reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    attested_at TIMESTAMPTZ NOT NULL,
    persisted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS tai_production_release_status_idx
    ON tai_production_release_attestations (
        exact_main_sha,
        release_id,
        status,
        attested_at DESC
    );

COMMIT;
