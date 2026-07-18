BEGIN;

CREATE TABLE IF NOT EXISTS tai_application_release_attestations (
    release_id TEXT PRIMARY KEY CHECK (release_id ~ '^[0-9a-f]{64}$'),
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
    previous_attestation_sha256 TEXT CHECK (
        previous_attestation_sha256 IS NULL
        OR previous_attestation_sha256 ~ '^[0-9a-f]{64}$'
    ),
    created_at TIMESTAMPTZ NOT NULL,
    production_operational_status TEXT NOT NULL CHECK (
        production_operational_status IN ('NOT_ATTESTED', 'ACCEPTED', 'REJECTED')
    ),
    attestation_sha256 TEXT NOT NULL UNIQUE CHECK (
        attestation_sha256 ~ '^[0-9a-f]{64}$'
    ),
    persisted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS tai_application_release_exact_main_idx
    ON tai_application_release_attestations (exact_main_sha, accepted, created_at DESC);

CREATE TABLE IF NOT EXISTS tai_production_release_attestations (
    release_id TEXT PRIMARY KEY REFERENCES tai_application_release_attestations (release_id)
        ON DELETE RESTRICT,
    exact_main_sha TEXT NOT NULL CHECK (exact_main_sha ~ '^[0-9a-f]{64}$'),
    application_attestation_sha256 TEXT NOT NULL CHECK (
        application_attestation_sha256 ~ '^[0-9a-f]{64}$'
    ),
    evaluation_report_sha256 TEXT NOT NULL CHECK (
        evaluation_report_sha256 ~ '^[0-9a-f]{64}$'
    ),
    operational_decision_sha256 TEXT NOT NULL CHECK (
        operational_decision_sha256 ~ '^[0-9a-f]{64}$'
    ),
    status TEXT NOT NULL CHECK (status IN ('NOT_ATTESTED', 'ACCEPTED', 'REJECTED')),
    reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    attested_at TIMESTAMPTZ NOT NULL,
    attestation_sha256 TEXT NOT NULL UNIQUE CHECK (
        attestation_sha256 ~ '^[0-9a-f]{64}$'
    ),
    persisted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS tai_production_release_status_idx
    ON tai_production_release_attestations (exact_main_sha, status, attested_at DESC);

COMMIT;
