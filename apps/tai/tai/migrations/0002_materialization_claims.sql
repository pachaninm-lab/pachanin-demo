CREATE TABLE IF NOT EXISTS tai_materialization_claims (
    source_id TEXT NOT NULL,
    checksum_sha256 TEXT NOT NULL,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (source_id, checksum_sha256),
    CONSTRAINT tai_materialization_checksum_format
        CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS tai_materialization_claims_claimed_at_idx
    ON tai_materialization_claims (claimed_at);
