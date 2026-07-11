CREATE SCHEMA IF NOT EXISTS support;

CREATE TABLE IF NOT EXISTS support.cases (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES public.organizations(id),
  user_id TEXT REFERENCES auth.users(id),
  deal_id TEXT REFERENCES public.deals(id),
  subject TEXT NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 300),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 10 AND 10000),
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW','NORMAL','HIGH','CRITICAL')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','WAITING_CUSTOMER','ESCALATED','RESOLVED','CLOSED')),
  source TEXT NOT NULL DEFAULT 'STAFF' CHECK (source IN ('CUSTOMER','STAFF','SYSTEM','SECURITY')),
  created_by_user_id TEXT NOT NULL REFERENCES auth.users(id),
  assigned_staff_user_id TEXT REFERENCES auth.users(id),
  idempotency_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  CONSTRAINT support_cases_tenant_idempotency_uq UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS support_cases_status_priority_idx
  ON support.cases(status, priority DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_cases_tenant_updated_idx
  ON support.cases(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_cases_org_updated_idx
  ON support.cases(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_cases_deal_idx
  ON support.cases(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS support_cases_assignee_idx
  ON support.cases(assigned_staff_user_id, status, updated_at DESC)
  WHERE assigned_staff_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS support.case_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES support.cases(id),
  actor_user_id TEXT NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_case_events_case_idx
  ON support.case_events(case_id, created_at, id);
CREATE INDEX IF NOT EXISTS support_case_events_actor_idx
  ON support.case_events(actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS support.access_recovery_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES public.organizations(id),
  user_id TEXT NOT NULL REFERENCES auth.users(id),
  requested_by_user_id TEXT NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 2000),
  ticket_id TEXT NOT NULL CHECK (char_length(ticket_id) BETWEEN 3 AND 128),
  status TEXT NOT NULL DEFAULT 'PENDING_DELIVERY' CHECK (status IN ('PENDING_DELIVERY','DELIVERED','COMPLETED','REJECTED','EXPIRED')),
  correlation_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS support_access_recovery_user_idx
  ON support.access_recovery_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_access_recovery_pending_idx
  ON support.access_recovery_requests(status, created_at)
  WHERE status = 'PENDING_DELIVERY';

CREATE OR REPLACE FUNCTION support.reject_case_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'support.case_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS support_case_events_no_update ON support.case_events;
CREATE TRIGGER support_case_events_no_update
BEFORE UPDATE OR DELETE ON support.case_events
FOR EACH ROW EXECUTE FUNCTION support.reject_case_event_mutation();

REVOKE ALL ON SCHEMA support FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA support FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA support FROM PUBLIC;
