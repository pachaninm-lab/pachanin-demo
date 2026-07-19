BEGIN;

CREATE TABLE IF NOT EXISTS tai_official_source_observations (
    observation_sha256 TEXT PRIMARY KEY
        CHECK (observation_sha256 ~ '^[0-9a-f]{64}$'),
    source_id TEXT NOT NULL
        CHECK (source_id ~ '^[a-z0-9][a-z0-9._-]{2,127}$'),
    observed_at TIMESTAMPTZ NOT NULL,
    latest_publication_at TIMESTAMPTZ NOT NULL,
    last_success_at TIMESTAMPTZ NOT NULL,
    document_count INTEGER NOT NULL CHECK (document_count > 0),
    consecutive_failures INTEGER NOT NULL CHECK (consecutive_failures >= 0),
    observed_topics JSONB NOT NULL
        CHECK (jsonb_typeof(observed_topics) = 'array'),
    content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS tai_official_source_observations_latest_idx
    ON tai_official_source_observations (
        source_id,
        observed_at DESC,
        observation_sha256 DESC
    );

CREATE TABLE IF NOT EXISTS tai_official_source_coverage_assessments (
    assessment_sha256 TEXT PRIMARY KEY
        CHECK (assessment_sha256 ~ '^[0-9a-f]{64}$'),
    generated_at TIMESTAMPTZ NOT NULL,
    coverage_basis_points INTEGER NOT NULL
        CHECK (coverage_basis_points BETWEEN 0 AND 10000),
    critical_coverage_basis_points INTEGER NOT NULL
        CHECK (critical_coverage_basis_points BETWEEN 0 AND 10000),
    all_critical_covered BOOLEAN NOT NULL,
    topics JSONB NOT NULL CHECK (jsonb_typeof(topics) = 'array'),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS tai_official_source_coverage_latest_idx
    ON tai_official_source_coverage_assessments (
        generated_at DESC,
        assessment_sha256 DESC
    );

CREATE OR REPLACE VIEW tai_latest_official_source_observations_v1 AS
SELECT DISTINCT ON (observation.source_id)
    observation.source_id,
    observation.observation_sha256,
    observation.observed_at,
    observation.latest_publication_at,
    observation.last_success_at,
    observation.document_count,
    observation.consecutive_failures,
    observation.observed_topics,
    observation.content_sha256
FROM tai_official_source_observations AS observation
ORDER BY
    observation.source_id,
    observation.observed_at DESC,
    observation.observation_sha256 DESC;

CREATE OR REPLACE VIEW tai_current_official_source_coverage_v1 AS
SELECT
    assessment.assessment_sha256,
    assessment.generated_at,
    assessment.coverage_basis_points,
    assessment.critical_coverage_basis_points,
    assessment.all_critical_covered,
    assessment.topics
FROM tai_official_source_coverage_assessments AS assessment
ORDER BY assessment.generated_at DESC, assessment.assessment_sha256 DESC
LIMIT 1;

COMMIT;
