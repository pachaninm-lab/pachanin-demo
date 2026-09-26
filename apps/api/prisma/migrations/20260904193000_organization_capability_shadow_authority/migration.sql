-- PC-CROP post-registration W1-A: Organization Capability Authority (shadow only).
-- Additive only. No registration table, Role Eligibility verdict, Deal or Settlement state is mutated.
-- Deliberately NO backfill: an organization receives no capability until an authenticated command creates it.

CREATE SCHEMA IF NOT EXISTS capability;
REVOKE ALL ON SCHEMA capability FROM PUBLIC;

CREATE TABLE capability.organization_assignments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  capability_code TEXT NOT NULL CHECK (capability_code IN (
    'SELL_CROP',
    'BUY_CROP',
    'OWN_TRANSPORT',
    'PROVIDE_LOGISTICS',
    'PROVIDE_EXPEDITION',
    'STORE_CROP',
    'PROVIDE_ELEVATOR_SERVICES',
    'PROVIDE_LAB_TESTING',
    'PROVIDE_SURVEYING',
    'PROVIDE_FINANCING',
    'PROVIDE_INSURANCE',
    'ACCOUNTING_INTEGRATION',
    'API_INTEGRATION'
  )),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'DISABLED')),
  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN (
    'DECLARATION_ONLY', 'ROLE_ELIGIBILITY', 'SERVER_EVIDENCE_REQUIRED'
  )),
  evidence_ref TEXT,
  version BIGINT NOT NULL CHECK (version >= 1),
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT organization_assignments_org_tenant_fk
    FOREIGN KEY (organization_id, tenant_id)
    REFERENCES public.organizations(id, "tenantId")
    ON DELETE CASCADE,
  CONSTRAINT organization_assignments_identity_key
    UNIQUE (tenant_id, organization_id, capability_code),
  CONSTRAINT organization_assignments_evidence_shape_chk CHECK (
    (evidence_kind = 'DECLARATION_ONLY' AND evidence_ref IS NULL)
    OR (evidence_kind <> 'DECLARATION_ONLY')
  )
);

CREATE INDEX organization_assignments_org_status_idx
  ON capability.organization_assignments(tenant_id, organization_id, status, capability_code);

CREATE TABLE capability.command_receipts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  capability_code TEXT NOT NULL CHECK (capability_code IN (
    'SELL_CROP',
    'BUY_CROP',
    'OWN_TRANSPORT',
    'PROVIDE_LOGISTICS',
    'PROVIDE_EXPEDITION',
    'STORE_CROP',
    'PROVIDE_ELEVATOR_SERVICES',
    'PROVIDE_LAB_TESTING',
    'PROVIDE_SURVEYING',
    'PROVIDE_FINANCING',
    'PROVIDE_INSURANCE',
    'ACCOUNTING_INTEGRATION',
    'API_INTEGRATION'
  )),
  idempotency_key TEXT NOT NULL,
  request_fingerprint CHAR(64) NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  result_payload JSONB NOT NULL,
  audit_id TEXT NOT NULL,
  outbox_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT command_receipts_org_tenant_fk
    FOREIGN KEY (organization_id, tenant_id)
    REFERENCES public.organizations(id, "tenantId")
    ON DELETE CASCADE,
  CONSTRAINT command_receipts_idempotency_key
    UNIQUE (tenant_id, organization_id, idempotency_key)
);

CREATE INDEX command_receipts_org_created_idx
  ON capability.command_receipts(tenant_id, organization_id, created_at DESC, id);

CREATE OR REPLACE FUNCTION capability.reject_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, capability
AS $function$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME
    USING ERRCODE = '55000';
END
$function$;

DROP TRIGGER IF EXISTS capability_command_receipts_append_only
  ON capability.command_receipts;
CREATE TRIGGER capability_command_receipts_append_only
BEFORE UPDATE OR DELETE ON capability.command_receipts
FOR EACH ROW EXECUTE FUNCTION capability.reject_append_only_mutation();

ALTER TABLE capability.organization_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE capability.organization_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE capability.command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE capability.command_receipts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_assignments_select ON capability.organization_assignments;
DROP POLICY IF EXISTS organization_assignments_insert ON capability.organization_assignments;
DROP POLICY IF EXISTS organization_assignments_update ON capability.organization_assignments;

CREATE POLICY organization_assignments_select
ON capability.organization_assignments
FOR SELECT
USING (
  public.app_rls_context_ready()
  AND tenant_id = current_setting('app.current_tenant_id', true)
  AND organization_id = current_setting('app.current_org_id', true)
);

CREATE POLICY organization_assignments_insert
ON capability.organization_assignments
FOR INSERT
WITH CHECK (
  public.app_rls_context_ready()
  AND tenant_id = current_setting('app.current_tenant_id', true)
  AND organization_id = current_setting('app.current_org_id', true)
  AND created_by_user_id = current_setting('app.current_user_id', true)
  AND updated_by_user_id = current_setting('app.current_user_id', true)
);

CREATE POLICY organization_assignments_update
ON capability.organization_assignments
FOR UPDATE
USING (
  public.app_rls_context_ready()
  AND tenant_id = current_setting('app.current_tenant_id', true)
  AND organization_id = current_setting('app.current_org_id', true)
)
WITH CHECK (
  public.app_rls_context_ready()
  AND tenant_id = current_setting('app.current_tenant_id', true)
  AND organization_id = current_setting('app.current_org_id', true)
  AND updated_by_user_id = current_setting('app.current_user_id', true)
);
-- No DELETE policy: capability lifecycle is status/version managed.

DROP POLICY IF EXISTS command_receipts_select ON capability.command_receipts;
DROP POLICY IF EXISTS command_receipts_insert ON capability.command_receipts;

CREATE POLICY command_receipts_select
ON capability.command_receipts
FOR SELECT
USING (
  public.app_rls_context_ready()
  AND tenant_id = current_setting('app.current_tenant_id', true)
  AND organization_id = current_setting('app.current_org_id', true)
);

CREATE POLICY command_receipts_insert
ON capability.command_receipts
FOR INSERT
WITH CHECK (
  public.app_rls_context_ready()
  AND tenant_id = current_setting('app.current_tenant_id', true)
  AND organization_id = current_setting('app.current_org_id', true)
  AND created_by_user_id = current_setting('app.current_user_id', true)
);
-- No UPDATE/DELETE policy; the trigger makes receipts append-only even for a future wider grant.

-- The existing canonical outbox is extended with one narrowly bounded non-deal event.
-- This keeps W1-A on the platform outbox instead of creating a second delivery authority.
DROP POLICY IF EXISTS outbox_entries_organization_capability_insert ON public."outbox_entries";
CREATE POLICY outbox_entries_organization_capability_insert
ON public."outbox_entries"
FOR INSERT
WITH CHECK (
  public.app_rls_context_ready()
  AND "dealId" IS NULL
  AND "type" = 'organization.capability.changed.v1'
  AND "triggeredByUserId" = current_setting('app.current_user_id', true)
  AND payload ->> 'tenantId' = current_setting('app.current_tenant_id', true)
  AND payload ->> 'organizationId' = current_setting('app.current_org_id', true)
);

-- Read-only bridge to the already-existing Role Eligibility authority. It is
-- intentionally bounded to the current transaction tenant/organization and to
-- the fixed capability->registration-role mapping below. It does not update
-- Role Eligibility, registration or enforcement state.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_org_capability_authority') THEN
    CREATE ROLE pc_org_capability_authority;
  END IF;
  ALTER ROLE pc_org_capability_authority WITH
    NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
END
$roles$;

GRANT USAGE ON SCHEMA eligibility TO pc_org_capability_authority;
GRANT SELECT ON eligibility.verdicts TO pc_org_capability_authority;
GRANT USAGE, CREATE ON SCHEMA capability TO pc_org_capability_authority;

CREATE OR REPLACE FUNCTION capability.resolve_server_evidence(
  p_capability_code TEXT
)
RETURNS TABLE (
  evidence_ref TEXT,
  verdict_id TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, eligibility, capability
AS $function$
DECLARE
  v_tenant_id TEXT := NULLIF(current_setting('app.current_tenant_id', true), '');
  v_organization_id TEXT := NULLIF(current_setting('app.current_org_id', true), '');
  v_requested_role TEXT;
BEGIN
  IF v_tenant_id IS NULL OR v_organization_id IS NULL THEN
    RAISE EXCEPTION 'trusted organization capability context is incomplete'
      USING ERRCODE = '42501';
  END IF;

  v_requested_role := CASE p_capability_code
    WHEN 'SELL_CROP' THEN 'FARMER'
    WHEN 'BUY_CROP' THEN 'BUYER'
    WHEN 'PROVIDE_LOGISTICS' THEN 'LOGISTICIAN'
    WHEN 'PROVIDE_EXPEDITION' THEN 'LOGISTICIAN'
    WHEN 'PROVIDE_ELEVATOR_SERVICES' THEN 'ELEVATOR'
    WHEN 'PROVIDE_LAB_TESTING' THEN 'LAB'
    WHEN 'PROVIDE_SURVEYING' THEN 'SURVEYOR'
    WHEN 'PROVIDE_FINANCING' THEN 'ACCOUNTING'
    WHEN 'PROVIDE_INSURANCE' THEN NULL
    ELSE NULL
  END;

  IF v_requested_role IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    'ROLE_ELIGIBILITY_VERDICT:' || verdict.id,
    verdict.id
  FROM eligibility.verdicts AS verdict
  WHERE verdict.tenant_id = v_tenant_id
    AND verdict.organization_id = v_organization_id
    AND verdict.requested_role = v_requested_role
    AND verdict.is_current
    AND verdict.verdict = 'ELIGIBLE'
  ORDER BY verdict.created_at DESC, verdict.id DESC
  LIMIT 1;
END
$function$;

REVOKE ALL ON FUNCTION capability.resolve_server_evidence(TEXT) FROM PUBLIC;
ALTER FUNCTION capability.resolve_server_evidence(TEXT) OWNER TO pc_org_capability_authority;
REVOKE CREATE ON SCHEMA capability FROM pc_org_capability_authority;

-- Runtime receives only RLS-confined business-table access and the bounded
-- evidence function. No principal gets DELETE on the capability authority.
DO $runtime_grants$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_runtime', 'app_service', 'auth_service', 'app_auth']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA capability TO %I', role_name);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON capability.organization_assignments TO %I', role_name);
      EXECUTE format('GRANT SELECT, INSERT ON capability.command_receipts TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION capability.resolve_server_evidence(TEXT) TO %I', role_name);
      EXECUTE format('REVOKE DELETE ON capability.organization_assignments FROM %I', role_name);
      EXECUTE format('REVOKE UPDATE, DELETE ON capability.command_receipts FROM %I', role_name);
    END IF;
  END LOOP;
END
$runtime_grants$;

COMMENT ON SCHEMA capability IS
  'PC-CROP post-registration Organization Capability shadow authority. No registration enforcement.';
COMMENT ON TABLE capability.organization_assignments IS
  'Tenant-scoped versioned organization capability state. No implicit/backfilled grants.';
COMMENT ON TABLE capability.command_receipts IS
  'Append-only payload-bound idempotency receipts for Organization Capability commands.';
COMMENT ON FUNCTION capability.resolve_server_evidence(TEXT) IS
  'Read-only bounded lookup of current ELIGIBLE Role Eligibility evidence for evidence-required capabilities.';
