-- IR-10.3 Labs PostgreSQL Authority.
-- Additive only. No production integration or external laboratory activation.

CREATE SCHEMA IF NOT EXISTS labs;

CREATE TABLE IF NOT EXISTS labs.laboratories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT laboratories_status_check CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
  CONSTRAINT laboratories_tenant_org_key UNIQUE (tenant_id, organization_id)
);

CREATE TABLE IF NOT EXISTS labs.accreditations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  laboratory_id TEXT NOT NULL REFERENCES labs.laboratories(id) ON DELETE RESTRICT,
  reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  valid_from TIMESTAMP(3) NOT NULL,
  valid_until TIMESTAMP(3),
  evidence_file_id TEXT REFERENCES public.deal_documents(id) ON DELETE RESTRICT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT accreditations_status_check CHECK (status IN ('ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED')),
  CONSTRAINT accreditations_validity_check CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT accreditations_tenant_reference_key UNIQUE (tenant_id, reference)
);

CREATE TABLE IF NOT EXISTS labs.personnel (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  laboratory_id TEXT NOT NULL REFERENCES labs.laboratories(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  authorized_from TIMESTAMP(3) NOT NULL,
  authorized_until TIMESTAMP(3),
  evidence_file_id TEXT REFERENCES public.deal_documents(id) ON DELETE RESTRICT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT personnel_status_check CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
  CONSTRAINT personnel_validity_check CHECK (authorized_until IS NULL OR authorized_until > authorized_from),
  CONSTRAINT personnel_tenant_user_key UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS labs.methods (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  laboratory_id TEXT NOT NULL REFERENCES labs.laboratories(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  parameter TEXT NOT NULL,
  standard_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT methods_status_check CHECK (status IN ('ACTIVE', 'SUSPENDED', 'RETIRED')),
  CONSTRAINT methods_tenant_lab_code_key UNIQUE (tenant_id, laboratory_id, code)
);

CREATE TABLE IF NOT EXISTS labs.equipment (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  laboratory_id TEXT NOT NULL REFERENCES labs.laboratories(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  calibration_valid_until TIMESTAMP(3),
  evidence_file_id TEXT REFERENCES public.deal_documents(id) ON DELETE RESTRICT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT equipment_status_check CHECK (status IN ('ACTIVE', 'SUSPENDED', 'RETIRED')),
  CONSTRAINT equipment_tenant_lab_code_key UNIQUE (tenant_id, laboratory_id, code)
);

CREATE TABLE IF NOT EXISTS labs.sample_authorities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
  sample_id TEXT NOT NULL REFERENCES public.lab_samples(id) ON DELETE RESTRICT,
  laboratory_id TEXT NOT NULL REFERENCES labs.laboratories(id) ON DELETE RESTRICT,
  assigned_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_by_command_id TEXT NOT NULL,
  consumed_by_command_id TEXT,
  consumed_at TIMESTAMP(3),
  version BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT sample_authorities_status_check CHECK (status IN ('ACTIVE', 'FINALIZED', 'REVOKED')),
  CONSTRAINT sample_authorities_sample_key UNIQUE (sample_id)
);

CREATE TABLE IF NOT EXISTS labs.custody_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
  sample_id TEXT NOT NULL REFERENCES public.lab_samples(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  actor_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  actor_org_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  evidence_file_id TEXT REFERENCES public.evidence_files(id) ON DELETE RESTRICT,
  seal_code TEXT,
  occurred_at TIMESTAMP(3) NOT NULL,
  command_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  correlation_id TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT custody_event_type_check CHECK (event_type IN ('COLLECTED', 'SEALED', 'TRANSFERRED', 'RECEIVED', 'OPENED', 'FINALIZED', 'CORRECTED')),
  CONSTRAINT custody_events_idempotency_key UNIQUE (idempotency_key)
);

CREATE TABLE IF NOT EXISTS labs.test_facts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
  sample_id TEXT NOT NULL REFERENCES public.lab_samples(id) ON DELETE RESTRICT,
  public_test_id TEXT NOT NULL REFERENCES public.lab_tests(id) ON DELETE RESTRICT,
  method_id TEXT NOT NULL REFERENCES labs.methods(id) ON DELETE RESTRICT,
  equipment_id TEXT NOT NULL REFERENCES labs.equipment(id) ON DELETE RESTRICT,
  actor_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  parameter TEXT NOT NULL,
  value NUMERIC(24, 9) NOT NULL,
  unit TEXT,
  norm_min NUMERIC(24, 9),
  norm_max NUMERIC(24, 9),
  result TEXT NOT NULL,
  occurred_at TIMESTAMP(3) NOT NULL,
  command_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  correlation_id TEXT,
  note TEXT,
  supersedes_fact_id TEXT REFERENCES labs.test_facts(id) ON DELETE RESTRICT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT test_facts_result_check CHECK (result IN ('PASSED', 'FAILED')),
  CONSTRAINT test_facts_norm_check CHECK (norm_min IS NOT NULL OR norm_max IS NOT NULL),
  CONSTRAINT test_facts_public_test_key UNIQUE (public_test_id),
  CONSTRAINT test_facts_idempotency_key UNIQUE (idempotency_key)
);

CREATE TABLE IF NOT EXISTS labs.protocols (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
  sample_id TEXT NOT NULL REFERENCES public.lab_samples(id) ON DELETE RESTRICT,
  laboratory_org_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  protocol_number TEXT NOT NULL,
  applicable_standard TEXT NOT NULL,
  accreditation_ref TEXT NOT NULL,
  evidence_file_id TEXT NOT NULL REFERENCES public.evidence_files(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'FINALIZED',
  finalized_by_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  finalized_at TIMESTAMP(3) NOT NULL,
  supersedes_protocol_id TEXT REFERENCES labs.protocols(id) ON DELETE RESTRICT,
  version BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT protocols_status_check CHECK (status IN ('FINALIZED', 'SUPERSEDED', 'REVOKED')),
  CONSTRAINT protocols_tenant_number_key UNIQUE (tenant_id, protocol_number)
);

CREATE INDEX IF NOT EXISTS laboratories_tenant_status_idx
  ON labs.laboratories (tenant_id, status);
CREATE INDEX IF NOT EXISTS accreditations_lab_status_idx
  ON labs.accreditations (laboratory_id, status, valid_until);
CREATE INDEX IF NOT EXISTS personnel_lab_status_idx
  ON labs.personnel (laboratory_id, status, authorized_until);
CREATE INDEX IF NOT EXISTS methods_lab_parameter_idx
  ON labs.methods (laboratory_id, parameter, status);
CREATE INDEX IF NOT EXISTS equipment_lab_status_idx
  ON labs.equipment (laboratory_id, status, calibration_valid_until);
CREATE INDEX IF NOT EXISTS sample_authorities_deal_status_idx
  ON labs.sample_authorities (deal_id, status);
CREATE INDEX IF NOT EXISTS custody_events_sample_time_idx
  ON labs.custody_events (sample_id, occurred_at, id);
CREATE INDEX IF NOT EXISTS test_facts_sample_time_idx
  ON labs.test_facts (sample_id, occurred_at, id);
CREATE INDEX IF NOT EXISTS protocols_sample_time_idx
  ON labs.protocols (sample_id, finalized_at, id);

CREATE OR REPLACE FUNCTION public.app_rls_lab_sample_visible(target_sample_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, labs
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.lab_samples sample
    JOIN public.deals deal ON deal.id = sample."dealId"
    WHERE sample.id = target_sample_id
      AND deal."tenantId" = current_setting('app.current_tenant_id', true)
      AND (
        public.app_rls_deal_visible(deal.id)
        OR EXISTS (
          SELECT 1
          FROM labs.sample_authorities authority
          JOIN labs.laboratories laboratory ON laboratory.id = authority.laboratory_id
          WHERE authority.sample_id = sample.id
            AND authority.tenant_id = current_setting('app.current_tenant_id', true)
            AND authority.status IN ('ACTIVE', 'FINALIZED')
            AND (
              authority.assigned_user_id = current_setting('app.current_user_id', true)
              OR laboratory.organization_id = current_setting('app.current_org_id', true)
            )
        )
        OR current_setting('app.current_role', true) IN ('SUPPORT_MANAGER', 'ADMIN')
      )
  );
$function$;

REVOKE ALL ON FUNCTION public.app_rls_lab_sample_visible(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_rls_lab_sample_visible(TEXT) TO PUBLIC;

CREATE OR REPLACE FUNCTION labs.guard_finalized_sample()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, labs
AS $function$
BEGIN
  IF OLD.status IN ('FINALIZED', 'DONE') THEN
    IF NEW.status = 'DONE'
       AND OLD.status = 'FINALIZED'
       AND NEW.protocol IS NOT DISTINCT FROM OLD.protocol
       AND NEW.gost IS NOT DISTINCT FROM OLD.gost
       AND NEW."certificateDocId" IS NOT DISTINCT FROM OLD."certificateDocId"
       AND NEW."labId" IS NOT DISTINCT FROM OLD."labId" THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'finalized laboratory sample is immutable; create an explicit superseding protocol'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS lab_samples_finalized_guard ON public.lab_samples;
CREATE TRIGGER lab_samples_finalized_guard
BEFORE UPDATE ON public.lab_samples
FOR EACH ROW EXECUTE FUNCTION labs.guard_finalized_sample();

CREATE OR REPLACE FUNCTION labs.guard_append_only_fact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, labs
AS $function$
BEGIN
  RAISE EXCEPTION 'laboratory fact is append-only; create an explicit superseding record'
    USING ERRCODE = '23514';
END
$function$;

DROP TRIGGER IF EXISTS custody_events_append_only ON labs.custody_events;
CREATE TRIGGER custody_events_append_only
BEFORE UPDATE OR DELETE ON labs.custody_events
FOR EACH ROW EXECUTE FUNCTION labs.guard_append_only_fact();

DROP TRIGGER IF EXISTS test_facts_append_only ON labs.test_facts;
CREATE TRIGGER test_facts_append_only
BEFORE UPDATE OR DELETE ON labs.test_facts
FOR EACH ROW EXECUTE FUNCTION labs.guard_append_only_fact();

DROP TRIGGER IF EXISTS protocols_append_only ON labs.protocols;
CREATE TRIGGER protocols_append_only
BEFORE UPDATE OR DELETE ON labs.protocols
FOR EACH ROW EXECUTE FUNCTION labs.guard_append_only_fact();

ALTER TABLE public.lab_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_samples FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_tests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lab_samples_select ON public.lab_samples;
CREATE POLICY lab_samples_select ON public.lab_samples
FOR SELECT USING (
  public.app_rls_context_ready()
  AND public.app_rls_lab_sample_visible(id)
);

DROP POLICY IF EXISTS lab_samples_insert ON public.lab_samples;
CREATE POLICY lab_samples_insert ON public.lab_samples
FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND public.app_rls_deal_visible("dealId")
  AND current_setting('app.current_role', true) IN ('LAB', 'SUPPORT_MANAGER', 'ADMIN')
  AND (
    "labId" = current_setting('app.current_org_id', true)
    OR current_setting('app.current_role', true) IN ('SUPPORT_MANAGER', 'ADMIN')
  )
);

DROP POLICY IF EXISTS lab_samples_update ON public.lab_samples;
CREATE POLICY lab_samples_update ON public.lab_samples
FOR UPDATE USING (
  public.app_rls_context_ready()
  AND public.app_rls_lab_sample_visible(id)
  AND current_setting('app.current_role', true) IN ('LAB', 'SUPPORT_MANAGER', 'ADMIN')
) WITH CHECK (
  public.app_rls_context_ready()
  AND public.app_rls_lab_sample_visible(id)
  AND current_setting('app.current_role', true) IN ('LAB', 'SUPPORT_MANAGER', 'ADMIN')
);

DROP POLICY IF EXISTS lab_samples_delete ON public.lab_samples;
CREATE POLICY lab_samples_delete ON public.lab_samples FOR DELETE USING (false);

DROP POLICY IF EXISTS lab_tests_select ON public.lab_tests;
CREATE POLICY lab_tests_select ON public.lab_tests
FOR SELECT USING (
  public.app_rls_context_ready()
  AND public.app_rls_lab_sample_visible("sampleId")
);

DROP POLICY IF EXISTS lab_tests_insert ON public.lab_tests;
CREATE POLICY lab_tests_insert ON public.lab_tests
FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND public.app_rls_lab_sample_visible("sampleId")
  AND current_setting('app.current_role', true) IN ('LAB', 'SUPPORT_MANAGER', 'ADMIN')
);

DROP POLICY IF EXISTS lab_tests_update ON public.lab_tests;
DROP POLICY IF EXISTS lab_tests_delete ON public.lab_tests;

DO $grant$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'laboratories', 'accreditations', 'personnel', 'methods', 'equipment',
    'sample_authorities', 'custody_events', 'test_facts', 'protocols'
  ] LOOP
    EXECUTE format('ALTER TABLE labs.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE labs.%I FORCE ROW LEVEL SECURITY', table_name);
  END LOOP;
END
$grant$;

CREATE OR REPLACE FUNCTION labs.current_tenant_matches(row_tenant TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $function$
  SELECT public.app_rls_context_ready()
    AND row_tenant = current_setting('app.current_tenant_id', true);
$function$;

REVOKE ALL ON FUNCTION labs.current_tenant_matches(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION labs.current_tenant_matches(TEXT) TO PUBLIC;

DROP POLICY IF EXISTS labs_laboratories_select ON labs.laboratories;
CREATE POLICY labs_laboratories_select ON labs.laboratories
FOR SELECT USING (
  labs.current_tenant_matches(tenant_id)
  AND (
    organization_id = current_setting('app.current_org_id', true)
    OR current_setting('app.current_role', true) IN ('SUPPORT_MANAGER', 'ADMIN')
  )
);

DROP POLICY IF EXISTS labs_accreditations_select ON labs.accreditations;
CREATE POLICY labs_accreditations_select ON labs.accreditations
FOR SELECT USING (
  labs.current_tenant_matches(tenant_id)
  AND EXISTS (
    SELECT 1 FROM labs.laboratories laboratory
    WHERE laboratory.id = laboratory_id
      AND (
        laboratory.organization_id = current_setting('app.current_org_id', true)
        OR current_setting('app.current_role', true) IN ('SUPPORT_MANAGER', 'ADMIN')
      )
  )
);

DROP POLICY IF EXISTS labs_personnel_select ON labs.personnel;
CREATE POLICY labs_personnel_select ON labs.personnel
FOR SELECT USING (
  labs.current_tenant_matches(tenant_id)
  AND (
    user_id = current_setting('app.current_user_id', true)
    OR current_setting('app.current_role', true) IN ('SUPPORT_MANAGER', 'ADMIN')
  )
);

DROP POLICY IF EXISTS labs_methods_select ON labs.methods;
CREATE POLICY labs_methods_select ON labs.methods
FOR SELECT USING (labs.current_tenant_matches(tenant_id));
DROP POLICY IF EXISTS labs_equipment_select ON labs.equipment;
CREATE POLICY labs_equipment_select ON labs.equipment
FOR SELECT USING (labs.current_tenant_matches(tenant_id));

DROP POLICY IF EXISTS labs_sample_authorities_select ON labs.sample_authorities;
CREATE POLICY labs_sample_authorities_select ON labs.sample_authorities
FOR SELECT USING (
  labs.current_tenant_matches(tenant_id)
  AND public.app_rls_lab_sample_visible(sample_id)
);
DROP POLICY IF EXISTS labs_sample_authorities_insert ON labs.sample_authorities;
CREATE POLICY labs_sample_authorities_insert ON labs.sample_authorities
FOR INSERT WITH CHECK (
  labs.current_tenant_matches(tenant_id)
  AND assigned_user_id = current_setting('app.current_user_id', true)
  AND current_setting('app.current_role', true) IN ('LAB', 'SUPPORT_MANAGER', 'ADMIN')
  AND public.app_rls_deal_visible(deal_id)
);
DROP POLICY IF EXISTS labs_sample_authorities_update ON labs.sample_authorities;
CREATE POLICY labs_sample_authorities_update ON labs.sample_authorities
FOR UPDATE USING (
  labs.current_tenant_matches(tenant_id)
  AND public.app_rls_lab_sample_visible(sample_id)
  AND current_setting('app.current_role', true) IN ('LAB', 'SUPPORT_MANAGER', 'ADMIN')
) WITH CHECK (
  labs.current_tenant_matches(tenant_id)
  AND public.app_rls_lab_sample_visible(sample_id)
);
DROP POLICY IF EXISTS labs_sample_authorities_delete ON labs.sample_authorities;
CREATE POLICY labs_sample_authorities_delete ON labs.sample_authorities FOR DELETE USING (false);

DROP POLICY IF EXISTS labs_custody_select ON labs.custody_events;
CREATE POLICY labs_custody_select ON labs.custody_events
FOR SELECT USING (
  labs.current_tenant_matches(tenant_id)
  AND public.app_rls_lab_sample_visible(sample_id)
);
DROP POLICY IF EXISTS labs_custody_insert ON labs.custody_events;
CREATE POLICY labs_custody_insert ON labs.custody_events
FOR INSERT WITH CHECK (
  labs.current_tenant_matches(tenant_id)
  AND actor_user_id = current_setting('app.current_user_id', true)
  AND actor_org_id = current_setting('app.current_org_id', true)
  AND current_setting('app.current_role', true) IN ('LAB', 'SUPPORT_MANAGER', 'ADMIN')
  AND public.app_rls_lab_sample_visible(sample_id)
);

DROP POLICY IF EXISTS labs_test_facts_select ON labs.test_facts;
CREATE POLICY labs_test_facts_select ON labs.test_facts
FOR SELECT USING (
  labs.current_tenant_matches(tenant_id)
  AND public.app_rls_lab_sample_visible(sample_id)
);
DROP POLICY IF EXISTS labs_test_facts_insert ON labs.test_facts;
CREATE POLICY labs_test_facts_insert ON labs.test_facts
FOR INSERT WITH CHECK (
  labs.current_tenant_matches(tenant_id)
  AND actor_user_id = current_setting('app.current_user_id', true)
  AND current_setting('app.current_role', true) IN ('LAB', 'SUPPORT_MANAGER', 'ADMIN')
  AND public.app_rls_lab_sample_visible(sample_id)
);

DROP POLICY IF EXISTS labs_protocols_select ON labs.protocols;
CREATE POLICY labs_protocols_select ON labs.protocols
FOR SELECT USING (
  labs.current_tenant_matches(tenant_id)
  AND public.app_rls_lab_sample_visible(sample_id)
);
DROP POLICY IF EXISTS labs_protocols_insert ON labs.protocols;
CREATE POLICY labs_protocols_insert ON labs.protocols
FOR INSERT WITH CHECK (
  labs.current_tenant_matches(tenant_id)
  AND finalized_by_user_id = current_setting('app.current_user_id', true)
  AND laboratory_org_id = current_setting('app.current_org_id', true)
  AND current_setting('app.current_role', true) IN ('LAB', 'SUPPORT_MANAGER', 'ADMIN')
  AND public.app_rls_lab_sample_visible(sample_id)
);

COMMENT ON SCHEMA labs IS 'Normalized PostgreSQL authority for laboratory admission, custody, methods, equipment, tests and protocols.';
COMMENT ON TABLE labs.protocols IS 'Append-only finalized laboratory protocols. Corrections create explicit superseding records.';
