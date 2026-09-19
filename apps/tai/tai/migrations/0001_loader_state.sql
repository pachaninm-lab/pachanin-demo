BEGIN;

CREATE TABLE IF NOT EXISTS tai_loader_state (
    source_id TEXT PRIMARY KEY,
    source_uri TEXT NOT NULL,
    status TEXT NOT NULL CHECK (
        status IN (
            'SCHEDULED',
            'RUNNING',
            'SUCCEEDED',
            'NOT_MODIFIED',
            'RETRYABLE_FAILURE',
            'PERMANENT_FAILURE',
            'REVOKED'
        )
    ),
    next_run_at TIMESTAMPTZ,
    etag TEXT,
    last_modified TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
    lease_token UUID,
    lease_owner TEXT,
    lease_expires_at TIMESTAMPTZ,
    heartbeat_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CHECK (
        (lease_token IS NULL AND lease_owner IS NULL AND lease_expires_at IS NULL)
        OR
        (lease_token IS NOT NULL AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS tai_loader_state_due_idx
    ON tai_loader_state (next_run_at, source_id)
    WHERE next_run_at IS NOT NULL
      AND status NOT IN ('PERMANENT_FAILURE', 'REVOKED');

CREATE INDEX IF NOT EXISTS tai_loader_state_lease_expiry_idx
    ON tai_loader_state (lease_expires_at)
    WHERE lease_token IS NOT NULL;

COMMENT ON TABLE tai_loader_state IS
    'PostgreSQL authority for AP-04 managed loader scheduling and fenced leases';
COMMENT ON COLUMN tai_loader_state.lease_token IS
    'Per-acquisition fencing token; stale workers must never mutate state';
COMMENT ON COLUMN tai_loader_state.version IS
    'Monotonic compare-and-swap version incremented on every state transition';

COMMIT;
