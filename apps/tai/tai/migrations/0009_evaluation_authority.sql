BEGIN;

CREATE TABLE IF NOT EXISTS tai_evaluation_runs (
    run_id TEXT PRIMARY KEY CHECK (run_id ~ '^[0-9a-f]{64}$'),
    suite_id TEXT NOT NULL,
    suite_version TEXT NOT NULL,
    suite_sha256 TEXT NOT NULL CHECK (suite_sha256 ~ '^[0-9a-f]{64}$'),
    exact_head_sha TEXT NOT NULL CHECK (exact_head_sha ~ '^[0-9a-f]{64}$'),
    model_route TEXT NOT NULL,
    knowledge_version TEXT NOT NULL,
    policy_version TEXT NOT NULL,
    baseline_run_id TEXT REFERENCES tai_evaluation_runs (run_id) ON DELETE RESTRICT,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL CHECK (completed_at >= started_at),
    accepted BOOLEAN NOT NULL,
    rejection_reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    summary JSONB NOT NULL CHECK (jsonb_typeof(summary) = 'object'),
    report_sha256 TEXT NOT NULL UNIQUE CHECK (report_sha256 ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS tai_evaluation_runs_release_idx
    ON tai_evaluation_runs (exact_head_sha, accepted, completed_at DESC);

CREATE TABLE IF NOT EXISTS tai_evaluation_case_results (
    run_id TEXT NOT NULL REFERENCES tai_evaluation_runs (run_id) ON DELETE RESTRICT,
    case_id TEXT NOT NULL,
    category TEXT NOT NULL CHECK (
        category IN (
            'GROUNDED_QA',
            'ABSTENTION',
            'CITATION',
            'TENANT_ISOLATION',
            'TOOL_POLICY',
            'PROMPT_INJECTION',
            'ADVERSARIAL_INPUT'
        )
    ),
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    outcome TEXT NOT NULL CHECK (outcome IN ('PASS', 'FAIL', 'ERROR')),
    violations TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    observation_sha256 TEXT NOT NULL CHECK (observation_sha256 ~ '^[0-9a-f]{64}$'),
    result_sha256 TEXT NOT NULL CHECK (result_sha256 ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (run_id, case_id),
    UNIQUE (run_id, result_sha256)
);

CREATE INDEX IF NOT EXISTS tai_evaluation_case_results_failure_idx
    ON tai_evaluation_case_results (run_id, outcome, severity, category);

COMMIT;
