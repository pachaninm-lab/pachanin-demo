BEGIN;

CREATE TABLE IF NOT EXISTS tai_loader_recovery_events (
    event_id UUID PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES tai_loader_state(source_id),
    requested_by TEXT NOT NULL CHECK (length(btrim(requested_by)) > 0),
    reason TEXT NOT NULL CHECK (length(btrim(reason)) >= 10),
    recovered_at TIMESTAMPTZ NOT NULL,
    state_version BIGINT NOT NULL CHECK (state_version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS tai_loader_recovery_events_source_idx
    ON tai_loader_recovery_events (source_id, recovered_at DESC);

COMMENT ON TABLE tai_loader_recovery_events IS
    'Immutable audit trail for explicit recovery from PERMANENT_FAILURE';

REVOKE UPDATE, DELETE, TRUNCATE ON tai_loader_recovery_events FROM PUBLIC;

COMMIT;
