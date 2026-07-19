-- Runtime privilege grants for the three canonical principals.
--
-- This mirrors the CI-proven one-deal E2E provisioning
-- (scripts/platform-v7-one-deal-e2e.sh), which drives the full canonical deal
-- to CLOSED under these exact least-privilege grants. Applied AFTER the RLS
-- overlays so FORCE RLS and the overlay role-conditional grants are already in
-- place. Idempotent: re-running only re-asserts the same grants.
\set ON_ERROR_STOP on

-- =========================================================================
-- Deal runtime (app_deal_api): CRUD under FORCE RLS; execution-scoped access
-- to logistics (read), labs and settlement.
-- =========================================================================
GRANT USAGE ON SCHEMA public, security, logistics, labs, settlement TO app_deal_api;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public   TO app_deal_api;

-- The security schema is EXECUTE-only: rate-limit tables are reachable solely
-- through the SECURITY DEFINER consume() function. The runtime rate-limit
-- boundary REQUIRES the deal principal to hold no direct table privilege here,
-- so revoke any (e.g. from an earlier broad grant) and never grant table access.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA security FROM app_deal_api;

GRANT SELECT ON ALL TABLES IN SCHEMA logistics TO app_deal_api;
GRANT SELECT ON
  logistics.carriers,
  logistics.drivers,
  logistics.vehicles,
  logistics.driver_vehicle_links,
  logistics.facilities,
  logistics.deal_admissions,
  logistics.shipment_bindings
TO app_deal_api;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA logistics FROM app_deal_api;

GRANT SELECT, INSERT, UPDATE ON
  labs.laboratories,
  labs.authorized_actors,
  labs.methods,
  labs.equipment,
  labs.sample_admissions
TO app_deal_api;
GRANT SELECT, INSERT ON labs.sample_custody_events TO app_deal_api;
GRANT SELECT ON labs.protocols TO app_deal_api;
REVOKE DELETE ON ALL TABLES IN SCHEMA labs FROM app_deal_api;

GRANT SELECT, INSERT ON
  settlement.payment_terms,
  settlement.beneficiaries,
  settlement.bank_callbacks,
  settlement.ledger_entries,
  settlement.reconciliation_facts
TO app_deal_api;
GRANT SELECT, INSERT, UPDATE ON
  settlement.payments,
  settlement.holds,
  settlement.bank_operations
TO app_deal_api;
REVOKE DELETE ON ALL TABLES IN SCHEMA settlement FROM app_deal_api;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_deal_api;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public     TO app_deal_api;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA settlement TO app_deal_api;
-- Distributed rate-limit consume() lives in the security schema; the runtime
-- rate-limit boundary requires EXECUTE on it before the port opens.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA security   TO app_deal_api;

ALTER DEFAULT PRIVILEGES IN SCHEMA public    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_deal_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA logistics GRANT SELECT ON TABLES TO app_deal_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public    GRANT USAGE, SELECT ON SEQUENCES TO app_deal_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public    GRANT EXECUTE ON FUNCTIONS TO app_deal_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA security  GRANT EXECUTE ON FUNCTIONS TO app_deal_api;

-- =========================================================================
-- Storage runtime (app_storage): evidence finalization only.
-- =========================================================================
GRANT USAGE ON SCHEMA public TO app_storage;
GRANT SELECT ON public.deals, public.deal_participants TO app_storage;
GRANT SELECT, UPDATE ON public.deal_documents TO app_storage;
REVOKE INSERT, DELETE ON public.deal_documents FROM app_storage;

-- =========================================================================
-- Auth runtime (app_service): identity and staff-access state. BYPASSRLS.
-- =========================================================================
GRANT USAGE ON SCHEMA public, auth TO app_service;
GRANT SELECT, INSERT, UPDATE ON public.users, public.user_orgs, public.organizations TO app_service;
GRANT SELECT, INSERT, UPDATE ON
  auth.login_throttles,
  auth.credential_states,
  auth.sessions,
  auth.refresh_tokens,
  auth.mfa_challenges,
  auth.staff_assignments,
  auth.staff_access_requests,
  auth.staff_access_approvals,
  auth.staff_access_grants,
  auth.staff_access_sessions,
  auth.staff_critical_action_requests,
  auth.staff_critical_action_approvals,
  auth.break_glass_activations
TO app_service;
GRANT SELECT, INSERT ON auth.audit_events, auth.staff_access_events TO app_service;
REVOKE UPDATE, DELETE ON auth.staff_access_events FROM app_service;
GRANT EXECUTE ON FUNCTION auth.lock_staff_access_event_chain(TEXT) TO app_service;
GRANT EXECUTE ON FUNCTION auth.staff_organization_directory(TEXT) TO app_service;
GRANT EXECUTE ON FUNCTION auth.staff_organization_users(TEXT, TEXT) TO app_service;
GRANT EXECUTE ON FUNCTION auth.staff_cabinet_deals(TEXT, TEXT, TEXT, TEXT) TO app_service;
GRANT EXECUTE ON FUNCTION auth.staff_resolve_deal_scope(TEXT, TEXT) TO app_service;

-- Hard guard: the auth principal must never hold any privilege on public.deals.
REVOKE ALL ON public.deals FROM app_service;
