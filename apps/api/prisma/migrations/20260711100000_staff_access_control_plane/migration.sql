-- Durable staff access control plane.
-- Forward-only migration. Production execution remains a separate change-control gate.
-- Business memberships in public.user_orgs are intentionally not reused as staff authority.

CREATE TABLE auth.staff_assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ELIGIBLE',
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  granted_by_user_id TEXT,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_staff_assignments_user_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_assignments_granted_by_fkey
    FOREIGN KEY (granted_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_assignments_role_check CHECK (role IN (
    'PLATFORM_OWNER',
    'PLATFORM_ADMIN',
    'SUPPORT_L1',
    'SUPPORT_L2',
    'OPERATIONS_AGENT',
    'OPERATIONS_SUPERVISOR',
    'FINANCE_OPS',
    'COMPLIANCE_STAFF',
    'DEVELOPER',
    'SRE_ONCALL',
    'SECURITY_AUDITOR',
    'BREAK_GLASS_ADMIN'
  )),
  CONSTRAINT auth_staff_assignments_status_check CHECK (status IN (
    'ELIGIBLE', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED'
  )),
  CONSTRAINT auth_staff_assignments_validity_check CHECK (
    valid_until IS NULL OR valid_until > valid_from
  )
);

CREATE UNIQUE INDEX auth_staff_assignments_active_role_idx
  ON auth.staff_assignments(user_id, role)
  WHERE status IN ('ELIGIBLE', 'ACTIVE');
CREATE INDEX auth_staff_assignments_user_status_idx
  ON auth.staff_assignments(user_id, status);
CREATE INDEX auth_staff_assignments_validity_idx
  ON auth.staff_assignments(status, valid_until);

CREATE TABLE auth.staff_access_requests (
  id TEXT PRIMARY KEY,
  requester_user_id TEXT NOT NULL,
  assignment_id TEXT NOT NULL,
  access_mode TEXT NOT NULL,
  target_tenant_id TEXT,
  target_organization_id TEXT,
  target_user_id TEXT,
  target_role TEXT,
  target_deal_id TEXT,
  requested_permissions JSONB NOT NULL,
  reason TEXT NOT NULL,
  ticket_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  max_duration_seconds INTEGER NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  decided_by_user_id TEXT,
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_staff_access_requests_requester_fkey
    FOREIGN KEY (requester_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_requests_assignment_fkey
    FOREIGN KEY (assignment_id) REFERENCES auth.staff_assignments(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_requests_target_org_fkey
    FOREIGN KEY (target_organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_requests_target_user_fkey
    FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_requests_decider_fkey
    FOREIGN KEY (decided_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_requests_mode_check CHECK (access_mode IN (
    'CONTROL_PLANE', 'VIEW_AS', 'ASSISTED', 'OPERATIONS', 'JIT_PRIVILEGED', 'BREAK_GLASS'
  )),
  CONSTRAINT auth_staff_access_requests_status_check CHECK (status IN (
    'PENDING', 'APPROVED', 'DENIED', 'CANCELLED', 'EXPIRED', 'GRANTED'
  )),
  CONSTRAINT auth_staff_access_requests_duration_check CHECK (
    max_duration_seconds BETWEEN 60 AND 3600
  ),
  CONSTRAINT auth_staff_access_requests_expiry_check CHECK (expires_at > requested_at),
  CONSTRAINT auth_staff_access_requests_permissions_array_check CHECK (
    jsonb_typeof(requested_permissions) = 'array'
  ),
  CONSTRAINT auth_staff_access_requests_reason_check CHECK (length(trim(reason)) >= 10),
  CONSTRAINT auth_staff_access_requests_ticket_check CHECK (length(trim(ticket_id)) >= 3)
);

CREATE INDEX auth_staff_access_requests_requester_status_idx
  ON auth.staff_access_requests(requester_user_id, status, requested_at DESC);
CREATE INDEX auth_staff_access_requests_status_expiry_idx
  ON auth.staff_access_requests(status, expires_at);
CREATE INDEX auth_staff_access_requests_target_scope_idx
  ON auth.staff_access_requests(target_tenant_id, target_organization_id, status);

CREATE TABLE auth.staff_access_approvals (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  approver_user_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_staff_access_approvals_request_fkey
    FOREIGN KEY (request_id) REFERENCES auth.staff_access_requests(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_approvals_approver_fkey
    FOREIGN KEY (approver_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_approvals_decision_check CHECK (decision IN ('APPROVE', 'DENY')),
  CONSTRAINT auth_staff_access_approvals_reason_check CHECK (length(trim(reason)) >= 5),
  CONSTRAINT auth_staff_access_approvals_unique_actor UNIQUE (request_id, approver_user_id)
);
CREATE INDEX auth_staff_access_approvals_request_idx
  ON auth.staff_access_approvals(request_id, created_at);

CREATE TABLE auth.staff_access_grants (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  grantee_user_id TEXT NOT NULL,
  assignment_id TEXT NOT NULL,
  access_mode TEXT NOT NULL,
  target_tenant_id TEXT,
  target_organization_id TEXT,
  target_user_id TEXT,
  target_role TEXT,
  target_deal_id TEXT,
  permissions JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by_user_id TEXT,
  revocation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_staff_access_grants_request_fkey
    FOREIGN KEY (request_id) REFERENCES auth.staff_access_requests(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_grants_grantee_fkey
    FOREIGN KEY (grantee_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_grants_assignment_fkey
    FOREIGN KEY (assignment_id) REFERENCES auth.staff_assignments(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_grants_target_org_fkey
    FOREIGN KEY (target_organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_grants_target_user_fkey
    FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_grants_revoker_fkey
    FOREIGN KEY (revoked_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_grants_mode_check CHECK (access_mode IN (
    'CONTROL_PLANE', 'VIEW_AS', 'ASSISTED', 'OPERATIONS', 'JIT_PRIVILEGED', 'BREAK_GLASS'
  )),
  CONSTRAINT auth_staff_access_grants_status_check CHECK (status IN (
    'ACTIVE', 'REVOKED', 'EXPIRED', 'CONSUMED'
  )),
  CONSTRAINT auth_staff_access_grants_time_check CHECK (expires_at > starts_at),
  CONSTRAINT auth_staff_access_grants_permissions_array_check CHECK (jsonb_typeof(permissions) = 'array')
);
CREATE INDEX auth_staff_access_grants_grantee_status_idx
  ON auth.staff_access_grants(grantee_user_id, status, expires_at);
CREATE INDEX auth_staff_access_grants_target_scope_idx
  ON auth.staff_access_grants(target_tenant_id, target_organization_id, status);

CREATE TABLE auth.staff_access_sessions (
  id TEXT PRIMARY KEY,
  grant_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  effective_tenant_id TEXT,
  effective_organization_id TEXT,
  effective_user_id TEXT,
  effective_role TEXT,
  access_mode TEXT NOT NULL,
  permissions JSONB NOT NULL,
  reason TEXT NOT NULL,
  ticket_id TEXT NOT NULL,
  mfa_level TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  end_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_staff_access_sessions_grant_fkey
    FOREIGN KEY (grant_id) REFERENCES auth.staff_access_grants(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_sessions_actor_fkey
    FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_sessions_effective_org_fkey
    FOREIGN KEY (effective_organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_sessions_effective_user_fkey
    FOREIGN KEY (effective_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_sessions_status_check CHECK (status IN ('ACTIVE', 'ENDED', 'EXPIRED', 'REVOKED')),
  CONSTRAINT auth_staff_access_sessions_mode_check CHECK (access_mode IN (
    'CONTROL_PLANE', 'VIEW_AS', 'ASSISTED', 'OPERATIONS', 'JIT_PRIVILEGED', 'BREAK_GLASS'
  )),
  CONSTRAINT auth_staff_access_sessions_mfa_check CHECK (mfa_level IN ('TOTP', 'BACKUP', 'WEBAUTHN')),
  CONSTRAINT auth_staff_access_sessions_time_check CHECK (expires_at > started_at),
  CONSTRAINT auth_staff_access_sessions_permissions_array_check CHECK (jsonb_typeof(permissions) = 'array')
);
CREATE INDEX auth_staff_access_sessions_actor_status_idx
  ON auth.staff_access_sessions(actor_user_id, status, expires_at);
CREATE INDEX auth_staff_access_sessions_grant_status_idx
  ON auth.staff_access_sessions(grant_id, status);
CREATE INDEX auth_staff_access_sessions_expiry_idx
  ON auth.staff_access_sessions(status, expires_at);

CREATE TABLE auth.staff_critical_action_requests (
  id TEXT PRIMARY KEY,
  requester_user_id TEXT NOT NULL,
  access_session_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  target_tenant_id TEXT,
  target_organization_id TEXT,
  payload_hash TEXT NOT NULL,
  required_approvals INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_staff_critical_requester_fkey
    FOREIGN KEY (requester_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_critical_session_fkey
    FOREIGN KEY (access_session_id) REFERENCES auth.staff_access_sessions(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_critical_target_org_fkey
    FOREIGN KEY (target_organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_critical_status_check CHECK (status IN ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'CONSUMED')),
  CONSTRAINT auth_staff_critical_approvals_check CHECK (required_approvals BETWEEN 1 AND 3),
  CONSTRAINT auth_staff_critical_expiry_check CHECK (expires_at > created_at)
);
CREATE INDEX auth_staff_critical_status_expiry_idx
  ON auth.staff_critical_action_requests(status, expires_at);
CREATE INDEX auth_staff_critical_requester_idx
  ON auth.staff_critical_action_requests(requester_user_id, created_at DESC);

CREATE TABLE auth.staff_critical_action_approvals (
  id TEXT PRIMARY KEY,
  critical_request_id TEXT NOT NULL,
  approver_user_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_staff_critical_approval_request_fkey
    FOREIGN KEY (critical_request_id) REFERENCES auth.staff_critical_action_requests(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_critical_approval_actor_fkey
    FOREIGN KEY (approver_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_critical_approval_decision_check CHECK (decision IN ('APPROVE', 'DENY')),
  CONSTRAINT auth_staff_critical_approval_unique_actor UNIQUE (critical_request_id, approver_user_id)
);
CREATE INDEX auth_staff_critical_approvals_request_idx
  ON auth.staff_critical_action_approvals(critical_request_id, created_at);

CREATE TABLE auth.break_glass_activations (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  assignment_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  ticket_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  end_reason TEXT,
  notification_correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_break_glass_actor_fkey
    FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_break_glass_assignment_fkey
    FOREIGN KEY (assignment_id) REFERENCES auth.staff_assignments(id) ON DELETE RESTRICT,
  CONSTRAINT auth_break_glass_status_check CHECK (status IN ('ACTIVE', 'ENDED', 'EXPIRED', 'REVOKED')),
  CONSTRAINT auth_break_glass_duration_check CHECK (
    expires_at > started_at AND expires_at <= started_at + INTERVAL '15 minutes'
  ),
  CONSTRAINT auth_break_glass_reason_check CHECK (length(trim(reason)) >= 20),
  CONSTRAINT auth_break_glass_ticket_check CHECK (length(trim(ticket_id)) >= 3)
);
CREATE INDEX auth_break_glass_actor_status_idx
  ON auth.break_glass_activations(actor_user_id, status, expires_at);

CREATE TABLE auth.staff_access_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  staff_role TEXT NOT NULL,
  access_session_id TEXT,
  grant_id TEXT,
  effective_tenant_id TEXT,
  effective_organization_id TEXT,
  effective_user_id TEXT,
  effective_role TEXT,
  access_mode TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  outcome TEXT NOT NULL,
  reason TEXT,
  ticket_id TEXT,
  correlation_id TEXT NOT NULL,
  metadata JSONB,
  prev_hash TEXT,
  hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_staff_access_events_actor_fkey
    FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_events_session_fkey
    FOREIGN KEY (access_session_id) REFERENCES auth.staff_access_sessions(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_events_grant_fkey
    FOREIGN KEY (grant_id) REFERENCES auth.staff_access_grants(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_events_effective_org_fkey
    FOREIGN KEY (effective_organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_events_effective_user_fkey
    FOREIGN KEY (effective_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_staff_access_events_outcome_check CHECK (outcome IN ('SUCCESS', 'FAILURE', 'DENIED'))
);
CREATE INDEX auth_staff_access_events_actor_created_idx
  ON auth.staff_access_events(actor_user_id, created_at DESC);
CREATE INDEX auth_staff_access_events_session_created_idx
  ON auth.staff_access_events(access_session_id, created_at DESC);
CREATE INDEX auth_staff_access_events_target_created_idx
  ON auth.staff_access_events(effective_tenant_id, effective_organization_id, created_at DESC);
CREATE INDEX auth_staff_access_events_correlation_idx
  ON auth.staff_access_events(correlation_id);

CREATE OR REPLACE FUNCTION auth.reject_staff_access_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'auth.staff_access_events is append-only';
END;
$$;

CREATE TRIGGER auth_staff_access_events_append_only
BEFORE UPDATE OR DELETE ON auth.staff_access_events
FOR EACH ROW EXECUTE FUNCTION auth.reject_staff_access_event_mutation();

CREATE OR REPLACE FUNCTION auth.lock_staff_access_event_chain(p_actor_user_id TEXT)
RETURNS VOID
LANGUAGE sql
SET search_path = pg_catalog
AS $$
  SELECT pg_advisory_xact_lock(hashtextextended(p_actor_user_id, 0));
$$;

CREATE OR REPLACE FUNCTION auth.revoke_staff_access_for_assignment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.status NOT IN ('ELIGIBLE', 'ACTIVE') OR NEW.role IS DISTINCT FROM OLD.role THEN
    UPDATE auth.staff_access_grants
    SET status = 'REVOKED',
        revoked_at = NOW(),
        revocation_reason = 'STAFF_ASSIGNMENT_CHANGED',
        updated_at = NOW()
    WHERE assignment_id = NEW.id
      AND status = 'ACTIVE';

    UPDATE auth.staff_access_sessions s
    SET status = 'REVOKED',
        ended_at = NOW(),
        end_reason = 'STAFF_ASSIGNMENT_CHANGED',
        updated_at = NOW()
    FROM auth.staff_access_grants g
    WHERE g.id = s.grant_id
      AND g.assignment_id = NEW.id
      AND s.status = 'ACTIVE';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auth_revoke_staff_access_on_assignment_change
AFTER UPDATE OF role, status, valid_until ON auth.staff_assignments
FOR EACH ROW EXECUTE FUNCTION auth.revoke_staff_access_for_assignment_change();

REVOKE ALL ON
  auth.staff_assignments,
  auth.staff_access_requests,
  auth.staff_access_approvals,
  auth.staff_access_grants,
  auth.staff_access_sessions,
  auth.staff_critical_action_requests,
  auth.staff_critical_action_approvals,
  auth.break_glass_activations,
  auth.staff_access_events
FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.reject_staff_access_event_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.lock_staff_access_event_chain(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.revoke_staff_access_for_assignment_change() FROM PUBLIC;

DO $grant_staff_access$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    GRANT USAGE ON SCHEMA auth TO app_service;
    GRANT SELECT, INSERT, UPDATE ON
      auth.staff_assignments,
      auth.staff_access_requests,
      auth.staff_access_approvals,
      auth.staff_access_grants,
      auth.staff_access_sessions,
      auth.staff_critical_action_requests,
      auth.staff_critical_action_approvals,
      auth.break_glass_activations
    TO app_service;
    GRANT SELECT, INSERT ON auth.staff_access_events TO app_service;
    GRANT EXECUTE ON FUNCTION auth.lock_staff_access_event_chain(TEXT) TO app_service;
    REVOKE UPDATE, DELETE ON auth.staff_access_events FROM app_service;
  END IF;
END
$grant_staff_access$;
