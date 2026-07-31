-- P0 first-customer access authority.
-- This extends the existing identity tables; it does not create a parallel user or role system.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS kpp TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.user_orgs
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS requested_workspace TEXT,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_org_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.user_orgs
  DROP CONSTRAINT IF EXISTS user_orgs_status_check;
ALTER TABLE public.user_orgs
  ADD CONSTRAINT user_orgs_status_check
  CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED'));

CREATE TABLE auth.registration_applications (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  requested_workspace TEXT NOT NULL,
  requested_role TEXT NOT NULL,
  status TEXT NOT NULL,
  correlation_id TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  legal_name TEXT NOT NULL,
  inn TEXT NOT NULL,
  kpp TEXT,
  ogrn TEXT,
  region TEXT NOT NULL,
  applicant_position TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  terms_accepted_at TIMESTAMPTZ NOT NULL,
  privacy_accepted_at TIMESTAMPTZ NOT NULL,
  consent_ip_hash TEXT,
  consent_user_agent_hash TEXT,
  status_token_hash TEXT NOT NULL UNIQUE,
  email_verified_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,
  decision_actor_user_id TEXT,
  version BIGINT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT registration_application_kind_check
    CHECK (kind IN ('NEW_ORGANIZATION', 'JOIN_EXISTING_ORGANIZATION')),
  CONSTRAINT registration_application_status_check
    CHECK (status IN (
      'DRAFT',
      'SUBMITTED',
      'EMAIL_VERIFICATION_REQUIRED',
      'PHONE_VERIFICATION_REQUIRED',
      'ORGANIZATION_VERIFICATION_PENDING',
      'ADDITIONAL_INFORMATION_REQUIRED',
      'APPROVED',
      'REJECTED',
      'SUSPENDED',
      'ACTIVATED',
      'EXPIRED',
      'CANCELLED'
    )),
  CONSTRAINT registration_application_user_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT registration_application_org_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT,
  CONSTRAINT registration_application_membership_fkey
    FOREIGN KEY (membership_id) REFERENCES public.user_orgs(id) ON DELETE RESTRICT,
  CONSTRAINT registration_application_decision_actor_fkey
    FOREIGN KEY (decision_actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT
);

CREATE INDEX registration_applications_user_created_idx
  ON auth.registration_applications(user_id, created_at DESC);
CREATE INDEX registration_applications_org_status_idx
  ON auth.registration_applications(organization_id, status, created_at);
CREATE INDEX registration_applications_status_submitted_idx
  ON auth.registration_applications(status, submitted_at);
CREATE INDEX registration_applications_inn_idx
  ON auth.registration_applications(inn);

CREATE TABLE auth.registration_email_challenges (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT registration_email_application_fkey
    FOREIGN KEY (application_id) REFERENCES auth.registration_applications(id) ON DELETE RESTRICT,
  CONSTRAINT registration_email_user_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT registration_email_status_check
    CHECK (status IN ('PENDING', 'CONSUMED', 'REVOKED', 'EXPIRED'))
);

CREATE INDEX registration_email_application_status_idx
  ON auth.registration_email_challenges(application_id, status, created_at DESC);
CREATE INDEX registration_email_expires_idx
  ON auth.registration_email_challenges(expires_at);

CREATE TABLE auth.registration_application_events (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  actor_user_id TEXT,
  actor_kind TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  application_version BIGINT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT registration_event_application_fkey
    FOREIGN KEY (application_id) REFERENCES auth.registration_applications(id) ON DELETE RESTRICT,
  CONSTRAINT registration_event_actor_fkey
    FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT registration_event_actor_kind_check
    CHECK (actor_kind IN ('APPLICANT', 'ORGANIZATION_ADMIN', 'PLATFORM_REVIEWER', 'SYSTEM'))
);

CREATE INDEX registration_events_application_created_idx
  ON auth.registration_application_events(application_id, created_at, id);

REVOKE ALL ON auth.registration_applications FROM PUBLIC;
REVOKE ALL ON auth.registration_email_challenges FROM PUBLIC;
REVOKE ALL ON auth.registration_application_events FROM PUBLIC;

DO $grant_registration$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'auth_service', 'app_auth']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON auth.registration_applications TO %I', role_name);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON auth.registration_email_challenges TO %I', role_name);
      EXECUTE format('GRANT SELECT, INSERT ON auth.registration_application_events TO %I', role_name);
    END IF;
  END LOOP;
END
$grant_registration$;
