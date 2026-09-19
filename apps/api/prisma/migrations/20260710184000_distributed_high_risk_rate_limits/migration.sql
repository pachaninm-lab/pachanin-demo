-- Shared high-risk route rate limits.
-- The table lives outside the Prisma-managed public schema so ordinary request data
-- and authoritative deal/money state remain isolated from ephemeral abuse controls.

CREATE SCHEMA IF NOT EXISTS security;
REVOKE ALL ON SCHEMA security FROM PUBLIC;

CREATE TABLE IF NOT EXISTS security.api_rate_limit_buckets (
  route_name       TEXT        NOT NULL,
  key_hash         CHAR(64)    NOT NULL,
  window_start     TIMESTAMPTZ NOT NULL,
  window_seconds   INTEGER     NOT NULL,
  request_count    INTEGER     NOT NULL DEFAULT 1,
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (route_name, key_hash, window_start),
  CONSTRAINT api_rate_limit_route_name_check
    CHECK (length(route_name) BETWEEN 1 AND 128),
  CONSTRAINT api_rate_limit_key_hash_check
    CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT api_rate_limit_window_seconds_check
    CHECK (window_seconds BETWEEN 1 AND 86400),
  CONSTRAINT api_rate_limit_request_count_check
    CHECK (request_count >= 1),
  CONSTRAINT api_rate_limit_expiry_check
    CHECK (expires_at > window_start)
);

CREATE INDEX IF NOT EXISTS api_rate_limit_buckets_expiry_idx
  ON security.api_rate_limit_buckets (expires_at);
CREATE INDEX IF NOT EXISTS api_rate_limit_buckets_route_key_idx
  ON security.api_rate_limit_buckets (route_name, key_hash, window_start DESC);

REVOKE ALL ON TABLE security.api_rate_limit_buckets FROM PUBLIC;

-- Production roles may already exist before migration. Isolated CI roles are
-- created later by the one-deal harness and receive the same narrow grant there.
DO $rate_limit_grants$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'app_api'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA security TO %I', role_name);
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON security.api_rate_limit_buckets TO %I',
        role_name
      );
    END IF;
  END LOOP;
END
$rate_limit_grants$;
