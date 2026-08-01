-- P0 identity state integrity and tenant binding.
-- Forward-only: security/audit evidence is retained during application rollback.

-- Reconcile legacy rows before adding stricter checks. A corrupt/non-positive TTL
-- must not block deployment; it is collapsed to the smallest already-expired
-- interval and remains visible in the immutable application/audit history.
UPDATE auth.registration_applications
SET expires_at = created_at + INTERVAL '1 second', updated_at = NOW()
WHERE expires_at <= created_at;

UPDATE auth.registration_email_challenges
SET expires_at = created_at + INTERVAL '1 second', status = 'EXPIRED', updated_at = NOW()
WHERE expires_at <= created_at;

UPDATE auth.password_reset_challenges
SET expires_at = created_at + INTERVAL '1 second', status = 'EXPIRED', updated_at = NOW()
WHERE expires_at <= created_at;

ALTER TABLE auth.registration_applications
  ADD CONSTRAINT registration_application_expiry_check
  CHECK (expires_at > created_at);

ALTER TABLE auth.registration_email_challenges
  ADD CONSTRAINT registration_email_expiry_check
  CHECK (expires_at > created_at);

ALTER TABLE auth.password_reset_challenges
  ADD CONSTRAINT password_reset_expiry_check
  CHECK (expires_at > created_at);

-- Old deployments could hold more than one logical PENDING token. Retain every
-- row as evidence while making only the newest token usable before the partial
-- uniqueness constraints are installed.
UPDATE auth.registration_email_challenges challenge
SET status = 'EXPIRED', updated_at = NOW()
WHERE challenge.status = 'PENDING' AND challenge.expires_at <= NOW();

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY application_id ORDER BY created_at DESC, id DESC
  ) AS position
  FROM auth.registration_email_challenges
  WHERE status = 'PENDING'
)
UPDATE auth.registration_email_challenges challenge
SET status = 'REVOKED', updated_at = NOW()
FROM ranked
WHERE challenge.id = ranked.id AND ranked.position > 1;

UPDATE auth.password_reset_challenges challenge
SET status = 'EXPIRED', updated_at = NOW()
WHERE challenge.status = 'PENDING' AND challenge.expires_at <= NOW();

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY user_id ORDER BY created_at DESC, id DESC
  ) AS position
  FROM auth.password_reset_challenges
  WHERE status = 'PENDING'
)
UPDATE auth.password_reset_challenges challenge
SET status = 'EXPIRED', updated_at = NOW()
FROM ranked
WHERE challenge.id = ranked.id AND ranked.position > 1;

CREATE UNIQUE INDEX registration_email_one_pending_application_idx
  ON auth.registration_email_challenges(application_id)
  WHERE status = 'PENDING';

CREATE UNIQUE INDEX password_reset_one_pending_user_idx
  ON auth.password_reset_challenges(user_id)
  WHERE status = 'PENDING';

CREATE UNIQUE INDEX organizations_id_tenant_id_identity_idx
  ON public.organizations(id, "tenantId");

CREATE UNIQUE INDEX user_orgs_id_organization_identity_idx
  ON public.user_orgs(id, "organizationId");

ALTER TABLE auth.organization_invitations
  ADD CONSTRAINT organization_invitations_tenant_binding_fkey
  FOREIGN KEY (organization_id, tenant_id)
  REFERENCES public.organizations(id, "tenantId")
  ON DELETE RESTRICT,
  ADD CONSTRAINT organization_invitations_creator_org_binding_fkey
  FOREIGN KEY (created_by_membership_id, organization_id)
  REFERENCES public.user_orgs(id, "organizationId")
  ON DELETE RESTRICT,
  ADD CONSTRAINT organization_invitations_acceptance_org_binding_fkey
  FOREIGN KEY (accepted_membership_id, organization_id)
  REFERENCES public.user_orgs(id, "organizationId")
  ON DELETE RESTRICT;

ALTER TABLE auth.organization_membership_command_events
  ADD CONSTRAINT organization_membership_command_org_binding_fkey
  FOREIGN KEY (membership_id, organization_id)
  REFERENCES public.user_orgs(id, "organizationId")
  ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION auth.reject_registration_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  -- PostgreSQL includes empty referencing tables in `TRUNCATE ... CASCADE`.
  -- Allowing that no-op keeps isolated database acceptance suites composable,
  -- while any table that contains durable history remains non-truncatable.
  IF TG_OP = 'TRUNCATE'
     AND NOT EXISTS (SELECT 1 FROM auth.registration_application_events) THEN
    RETURN NULL;
  END IF;
  RAISE EXCEPTION 'auth.registration_application_events is append-only';
END;
$$;

CREATE TRIGGER registration_application_events_append_only
BEFORE UPDATE OR DELETE ON auth.registration_application_events
FOR EACH ROW EXECUTE FUNCTION auth.reject_registration_event_mutation();

CREATE TRIGGER registration_application_events_no_truncate
BEFORE TRUNCATE ON auth.registration_application_events
FOR EACH STATEMENT EXECUTE FUNCTION auth.reject_registration_event_mutation();

CREATE TRIGGER registration_public_attempts_no_truncate
BEFORE TRUNCATE ON auth.registration_public_attempts
FOR EACH STATEMENT EXECUTE FUNCTION auth.reject_registration_public_attempt_mutation();

REVOKE ALL ON FUNCTION auth.reject_registration_event_mutation() FROM PUBLIC;

-- Step-up challenges refresh MFA on an already active session. Keeping a
-- distinct type prevents login verification from activating the wrong state.
ALTER TABLE auth.mfa_challenges
  DROP CONSTRAINT auth_mfa_challenges_type_check;
ALTER TABLE auth.mfa_challenges
  ADD CONSTRAINT auth_mfa_challenges_type_check
  CHECK (type IN ('TOTP_ENROLL', 'TOTP_VERIFY', 'BACKUP_VERIFY', 'STEP_UP'));
