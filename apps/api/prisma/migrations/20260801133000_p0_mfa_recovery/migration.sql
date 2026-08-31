-- Controlled MFA recovery. An organization administrator can only initiate a
-- recovery challenge; the subject must prove possession of the one-time email
-- link and the current password before MFA state is cleared.

-- Forward-only migration. Production execution and rollback-by-follow-up are
-- separate operational gates; no destructive down migration is implied.
CREATE TABLE auth.mfa_recovery_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_by_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mfa_recovery_user_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT mfa_recovery_membership_fkey
    FOREIGN KEY (membership_id) REFERENCES public.user_orgs(id) ON DELETE RESTRICT,
  CONSTRAINT mfa_recovery_membership_org_binding_fkey
    FOREIGN KEY (membership_id, organization_id)
    REFERENCES public.user_orgs(id, "organizationId") ON DELETE RESTRICT,
  CONSTRAINT mfa_recovery_org_tenant_binding_fkey
    FOREIGN KEY (organization_id, tenant_id)
    REFERENCES public.organizations(id, "tenantId") ON DELETE RESTRICT,
  CONSTRAINT mfa_recovery_creator_fkey
    FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT mfa_recovery_status_check
    CHECK (status IN ('PENDING', 'CONSUMED', 'REVOKED', 'EXPIRED')),
  CONSTRAINT mfa_recovery_expiry_check
    CHECK (expires_at > created_at),
  CONSTRAINT mfa_recovery_attempts_check
    CHECK (attempts >= 0 AND max_attempts BETWEEN 1 AND 10 AND attempts <= max_attempts)
);

CREATE UNIQUE INDEX mfa_recovery_one_pending_user_idx
  ON auth.mfa_recovery_challenges(user_id)
  WHERE status = 'PENDING';
CREATE INDEX mfa_recovery_org_status_idx
  ON auth.mfa_recovery_challenges(organization_id, status, created_at DESC);
CREATE INDEX mfa_recovery_expiry_idx
  ON auth.mfa_recovery_challenges(status, expires_at);

CREATE TABLE auth.mfa_recovery_events (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  actor_user_id TEXT,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  challenge_version BIGINT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mfa_recovery_event_challenge_fkey
    FOREIGN KEY (challenge_id) REFERENCES auth.mfa_recovery_challenges(id) ON DELETE RESTRICT,
  CONSTRAINT mfa_recovery_event_actor_fkey
    FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT mfa_recovery_event_type_check
    CHECK (event_type IN ('CREATED', 'REVOKED', 'EXPIRED', 'CONSUMED'))
);

CREATE INDEX mfa_recovery_event_challenge_idx
  ON auth.mfa_recovery_events(challenge_id, created_at, id);

CREATE OR REPLACE FUNCTION auth.reject_mfa_recovery_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  -- Keep unrelated `TRUNCATE ... CASCADE` test resets compatible only while
  -- there is no MFA recovery evidence to lose.
  IF TG_OP = 'TRUNCATE'
     AND NOT EXISTS (SELECT 1 FROM auth.mfa_recovery_events) THEN
    RETURN NULL;
  END IF;
  RAISE EXCEPTION 'auth.mfa_recovery_events is append-only';
END;
$$;

CREATE TRIGGER mfa_recovery_events_append_only
BEFORE UPDATE OR DELETE ON auth.mfa_recovery_events
FOR EACH ROW EXECUTE FUNCTION auth.reject_mfa_recovery_event_mutation();

CREATE TRIGGER mfa_recovery_events_no_truncate
BEFORE TRUNCATE ON auth.mfa_recovery_events
FOR EACH STATEMENT EXECUTE FUNCTION auth.reject_mfa_recovery_event_mutation();

REVOKE ALL ON auth.mfa_recovery_challenges FROM PUBLIC;
REVOKE ALL ON auth.mfa_recovery_events FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.reject_mfa_recovery_event_mutation() FROM PUBLIC;

DO $grant_mfa_recovery$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'auth_service', 'app_auth']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON auth.mfa_recovery_challenges TO %I', role_name);
      EXECUTE format('GRANT SELECT, INSERT ON auth.mfa_recovery_events TO %I', role_name);
    END IF;
  END LOOP;
END
$grant_mfa_recovery$;
