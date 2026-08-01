-- P0 organization invitations and membership revocation authority.
-- Forward-only. Rollback is application rollback first; retained invitation/event
-- rows are intentionally not dropped because they are security and audit evidence.

CREATE TABLE auth.organization_invitations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  invited_email TEXT NOT NULL,
  invited_email_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  token_hash TEXT NOT NULL UNIQUE,
  created_by_user_id TEXT NOT NULL,
  created_by_membership_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id TEXT,
  accepted_membership_id TEXT,
  revoked_at TIMESTAMPTZ,
  revoked_by_user_id TEXT,
  revoke_reason TEXT,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organization_invitations_org_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT,
  CONSTRAINT organization_invitations_creator_fkey
    FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT organization_invitations_creator_membership_fkey
    FOREIGN KEY (created_by_membership_id) REFERENCES public.user_orgs(id) ON DELETE RESTRICT,
  CONSTRAINT organization_invitations_accepted_user_fkey
    FOREIGN KEY (accepted_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT organization_invitations_accepted_membership_fkey
    FOREIGN KEY (accepted_membership_id) REFERENCES public.user_orgs(id) ON DELETE RESTRICT,
  CONSTRAINT organization_invitations_revoker_fkey
    FOREIGN KEY (revoked_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT organization_invitations_status_check
    CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
  CONSTRAINT organization_invitations_human_role_check
    CHECK (role IN ('FARMER', 'BUYER', 'LOGISTICIAN', 'DRIVER', 'ELEVATOR', 'LAB', 'SURVEYOR', 'ACCOUNTING', 'GUEST')),
  CONSTRAINT organization_invitations_expiry_check
    CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX organization_invitations_one_pending_email_idx
  ON auth.organization_invitations(organization_id, invited_email_hash)
  WHERE status = 'PENDING';
CREATE INDEX organization_invitations_org_status_idx
  ON auth.organization_invitations(organization_id, status, created_at DESC);
CREATE INDEX organization_invitations_expiry_idx
  ON auth.organization_invitations(status, expires_at);

CREATE TABLE auth.organization_invitation_events (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  actor_user_id TEXT,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  invitation_version BIGINT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organization_invitation_events_invitation_fkey
    FOREIGN KEY (invitation_id) REFERENCES auth.organization_invitations(id) ON DELETE RESTRICT,
  CONSTRAINT organization_invitation_events_actor_fkey
    FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT organization_invitation_events_type_check
    CHECK (event_type IN ('CREATED', 'RESENT', 'ACCEPTED', 'REVOKED', 'EXPIRED'))
);

CREATE INDEX organization_invitation_events_invitation_idx
  ON auth.organization_invitation_events(invitation_id, created_at, id);

CREATE TABLE auth.organization_membership_command_events (
  id TEXT PRIMARY KEY,
  membership_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  command TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  correlation_id TEXT NOT NULL,
  previous_version BIGINT NOT NULL,
  new_version BIGINT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organization_membership_command_membership_fkey
    FOREIGN KEY (membership_id) REFERENCES public.user_orgs(id) ON DELETE RESTRICT,
  CONSTRAINT organization_membership_command_org_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT,
  CONSTRAINT organization_membership_command_actor_fkey
    FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT organization_membership_command_type_check
    CHECK (command IN ('ROLE_CHANGE', 'REVOKE', 'MFA_RESET')),
  CONSTRAINT organization_membership_command_version_check
    CHECK (new_version = previous_version + 1)
);

CREATE INDEX organization_membership_command_membership_idx
  ON auth.organization_membership_command_events(membership_id, created_at DESC);

CREATE OR REPLACE FUNCTION auth.reject_invitation_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'auth.organization_invitation_events is append-only';
END;
$$;

CREATE TRIGGER organization_invitation_events_append_only
BEFORE UPDATE OR DELETE ON auth.organization_invitation_events
FOR EACH ROW EXECUTE FUNCTION auth.reject_invitation_event_mutation();

CREATE TRIGGER organization_invitation_events_no_truncate
BEFORE TRUNCATE ON auth.organization_invitation_events
FOR EACH STATEMENT EXECUTE FUNCTION auth.reject_invitation_event_mutation();

CREATE TRIGGER organization_membership_command_events_append_only
BEFORE UPDATE OR DELETE ON auth.organization_membership_command_events
FOR EACH ROW EXECUTE FUNCTION auth.reject_invitation_event_mutation();

CREATE TRIGGER organization_membership_command_events_no_truncate
BEFORE TRUNCATE ON auth.organization_membership_command_events
FOR EACH STATEMENT EXECUTE FUNCTION auth.reject_invitation_event_mutation();

-- Membership status and organization-admin authority changes revoke all live
-- sessions just like role and tenant membership changes.
DROP TRIGGER IF EXISTS auth_revoke_on_membership_change ON public.user_orgs;
CREATE TRIGGER auth_revoke_on_membership_change
AFTER UPDATE OF "userId", "organizationId", role, status, is_org_admin ON public.user_orgs
FOR EACH ROW
WHEN (
  OLD."userId" IS DISTINCT FROM NEW."userId"
  OR OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
  OR OLD.role IS DISTINCT FROM NEW.role
  OR OLD.status IS DISTINCT FROM NEW.status
  OR OLD.is_org_admin IS DISTINCT FROM NEW.is_org_admin
)
EXECUTE FUNCTION auth.revoke_sessions_for_membership_change();

REVOKE ALL ON auth.organization_invitations FROM PUBLIC;
REVOKE ALL ON auth.organization_invitation_events FROM PUBLIC;
REVOKE ALL ON auth.organization_membership_command_events FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.reject_invitation_event_mutation() FROM PUBLIC;

DO $grant_organization_invitations$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'auth_service', 'app_auth']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON auth.organization_invitations TO %I', role_name);
      EXECUTE format('GRANT SELECT, INSERT ON auth.organization_invitation_events TO %I', role_name);
      EXECUTE format('GRANT SELECT, INSERT ON auth.organization_membership_command_events TO %I', role_name);
    END IF;
  END LOOP;
END
$grant_organization_invitations$;
