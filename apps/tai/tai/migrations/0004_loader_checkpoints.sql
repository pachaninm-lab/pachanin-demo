BEGIN;

CREATE TABLE IF NOT EXISTS tai_loader_checkpoints (
    source_id TEXT PRIMARY KEY REFERENCES tai_loader_state(source_id),
    cursor_value TEXT NOT NULL CHECK (length(btrim(cursor_value)) > 0),
    observed_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE tai_loader_checkpoints IS
    'Durable CAS watermarks for incremental AP-04 loader recovery after restart';
COMMENT ON COLUMN tai_loader_checkpoints.version IS
    'Monotonic fencing version; stale checkpoint writers must fail closed';

COMMIT;
