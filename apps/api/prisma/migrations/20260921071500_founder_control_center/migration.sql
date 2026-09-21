-- MASTER v2.1 R1.3 Founder/CEO Company Health + P0/P1 Decision Queue.
-- Read-only, PostgreSQL-authoritative and fail-closed. Runtime receives only
-- EXECUTE on fixed SECURITY DEFINER functions; no direct table grants.

DO $founder_control_authority_role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_founder_control_read_authority'
  ) THEN
    CREATE ROLE pc_founder_control_read_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;

  ALTER ROLE pc_founder_control_read_authority WITH
    NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    JOIN pg_catalog.pg_roles member ON member.oid = membership.member
    WHERE granted.rolname = 'pc_founder_control_read_authority'
       OR member.rolname = 'pc_founder_control_read_authority'
  ) THEN
    RAISE EXCEPTION 'pc_founder_control_read_authority must remain membership-isolated'
      USING ERRCODE = '42501';
  END IF;
END
$founder_control_authority_role$;

REVOKE CREATE ON SCHEMA public, auth, dispute FROM pc_founder_control_read_authority;
GRANT USAGE ON SCHEMA public, auth, dispute TO pc_founder_control_read_authority;

-- Authorization tuple only.
GRANT SELECT (id, user_id, status, credential_version, mfa_verified_at, expires_at, revoked_at)
  ON auth.sessions TO pc_founder_control_read_authority;
GRANT SELECT (user_id, credential_version)
  ON auth.credential_states TO pc_founder_control_read_authority;
GRANT SELECT (user_id, role, status, revoked_at, suspended_at, valid_from, valid_until)
  ON auth.staff_assignments TO pc_founder_control_read_authority;
GRANT SELECT ("id", "status", "deletedAt")
  ON public."users" TO pc_founder_control_read_authority;

-- Fixed read tuple for R1.3 metrics and drill-down. No payload/document/PII
-- columns are granted to this authority.
GRANT SELECT ("id", "tenantId", "status", "updatedAt")
  ON public."deals" TO pc_founder_control_read_authority;
GRANT SELECT ("id", "tenantId", "dealId", "status", "updatedAt")
  ON public."shipments" TO pc_founder_control_read_authority;
GRANT SELECT ("id", "matchStatus", "createdAt")
  ON public."bank_statement_entries" TO pc_founder_control_read_authority;
GRANT SELECT (
  "id", "type", "dealId", "status", "retryCount", "createdAt", "failedAt",
  "manualReviewAt", "deadLetterAt", "lastErrorCategory"
) ON public."outbox_entries" TO pc_founder_control_read_authority;
GRANT SELECT (
  id, tenant_id, deal_id, shipment_id, status, type, claim_amount_minor,
  currency, severity, owner_user_id, owner_org_id, sla_deadline, version, updated_at
) ON dispute.cases TO pc_founder_control_read_authority;

-- Keep policies only on relations whose existing RLS surface is already active.
-- Creating a policy on a non-RLS relation is rejected by the repository's inert-
-- policy gate. Non-RLS relations below remain bounded by column-level SELECT on
-- this isolated NOLOGIN definer; if RLS is enabled later, access fails closed
-- until an explicit policy is added.
DROP POLICY IF EXISTS users_founder_control_read_authority ON public."users";
CREATE POLICY users_founder_control_read_authority
  ON public."users" FOR SELECT TO pc_founder_control_read_authority USING (true);

DROP POLICY IF EXISTS deals_founder_control_read_authority ON public."deals";
CREATE POLICY deals_founder_control_read_authority
  ON public."deals" FOR SELECT TO pc_founder_control_read_authority USING (true);

DROP POLICY IF EXISTS shipments_founder_control_read_authority ON public."shipments";
CREATE POLICY shipments_founder_control_read_authority
  ON public."shipments" FOR SELECT TO pc_founder_control_read_authority USING (true);

DROP POLICY IF EXISTS outbox_entries_founder_control_read_authority ON public."outbox_entries";
CREATE POLICY outbox_entries_founder_control_read_authority
  ON public."outbox_entries" FOR SELECT TO pc_founder_control_read_authority USING (true);

DROP POLICY IF EXISTS dispute_cases_founder_control_read_authority ON dispute.cases;
CREATE POLICY dispute_cases_founder_control_read_authority
  ON dispute.cases FOR SELECT TO pc_founder_control_read_authority USING (true);

CREATE OR REPLACE FUNCTION auth.founder_control_actor_authorized(
  p_actor_user_id text,
  p_session_id text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, pg_catalog, pg_temp
SET row_security = on
AS $function$
  SELECT btrim(COALESCE(p_actor_user_id, '')) <> ''
    AND btrim(COALESCE(p_session_id, '')) <> ''
    AND EXISTS (
      SELECT 1
      FROM auth.sessions session
      JOIN auth.credential_states credential
        ON credential.user_id = session.user_id
       AND credential.credential_version = session.credential_version
      JOIN public."users" actor ON actor."id" = session.user_id
      JOIN auth.staff_assignments assignment ON assignment.user_id = actor."id"
      WHERE session.id = p_session_id
        AND session.user_id = p_actor_user_id
        AND session.status = 'ACTIVE'
        AND session.revoked_at IS NULL
        AND session.expires_at > now()
        AND session.mfa_verified_at IS NOT NULL
        AND session.mfa_verified_at >= now() - INTERVAL '15 minutes'
        AND session.mfa_verified_at <= now() + INTERVAL '30 seconds'
        AND actor."status" = 'ACTIVE'
        AND actor."deletedAt" IS NULL
        AND assignment.role = 'PLATFORM_OWNER'
        AND assignment.status = 'ACTIVE'
        AND assignment.revoked_at IS NULL
        AND assignment.suspended_at IS NULL
        AND assignment.valid_from <= now()
        AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
    );
$function$;

CREATE OR REPLACE FUNCTION auth.founder_company_health(
  p_actor_user_id text,
  p_session_id text
)
RETURNS TABLE (
  metric_id text,
  category text,
  value_count bigint,
  unit text,
  as_of timestamptz,
  source_relation text,
  freshness_state text,
  grain text,
  definition text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth, dispute, pg_catalog, pg_temp
SET row_security = on
AS $function$
DECLARE
  captured_at timestamptz := statement_timestamp();
BEGIN
  IF NOT auth.founder_control_actor_authorized(p_actor_user_id, p_session_id) THEN
    RAISE EXCEPTION 'Active PLATFORM_OWNER assignment and recent MFA are required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    'business.open_deals'::text,
    'BUSINESS'::text,
    count(*)::bigint,
    'COUNT'::text,
    captured_at,
    'public.deals'::text,
    'CURRENT'::text,
    'platform-wide canonical Deal rows at query time'::text,
    'Deals whose canonical status is not SETTLED, CLOSED, CANCELLATION or CANCELLED.'::text
  FROM public."deals" deal
  WHERE deal."status" NOT IN ('SETTLED', 'CLOSED', 'CANCELLATION', 'CANCELLED')

  UNION ALL

  SELECT
    'operations.active_shipments'::text,
    'OPERATIONS'::text,
    count(*)::bigint,
    'COUNT'::text,
    captured_at,
    'public.shipments'::text,
    'CURRENT'::text,
    'platform-wide canonical Shipment rows at query time'::text,
    'Shipments not in DELIVERED, COMPLETED, CANCELLED, CLOSED or FAILED terminal states.'::text
  FROM public."shipments" shipment
  WHERE shipment."status" NOT IN ('DELIVERED', 'COMPLETED', 'CANCELLED', 'CLOSED', 'FAILED')

  UNION ALL

  SELECT
    'finance.unmatched_statement_entries'::text,
    'FINANCE'::text,
    count(*)::bigint,
    'COUNT'::text,
    captured_at,
    'public.bank_statement_entries'::text,
    'CURRENT'::text,
    'platform-wide bank statement entries at query time'::text,
    'Bank statement entries whose reconciliation match state is UNMATCHED or MISMATCH.'::text
  FROM public."bank_statement_entries" statement
  WHERE statement."matchStatus" IN ('UNMATCHED', 'MISMATCH')

  UNION ALL

  SELECT
    'risk.high_critical_open_disputes'::text,
    'RISK'::text,
    count(*)::bigint,
    'COUNT'::text,
    captured_at,
    'dispute.cases'::text,
    'CURRENT'::text,
    'platform-wide canonical dispute cases at query time'::text,
    'Unresolved canonical disputes with HIGH or CRITICAL severity.'::text
  FROM dispute.cases dispute_case
  WHERE dispute_case.status NOT IN ('RESOLVED', 'CLOSED')
    AND dispute_case.severity IN ('HIGH', 'CRITICAL')

  UNION ALL

  SELECT
    'system.outbox_attention_entries'::text,
    'SYSTEM'::text,
    count(*)::bigint,
    'COUNT'::text,
    captured_at,
    'public.outbox_entries'::text,
    'CURRENT'::text,
    'platform-wide canonical durable outbox rows at query time'::text,
    'Canonical durable outbox entries in DEAD_LETTER or MANUAL_REVIEW.'::text
  FROM public."outbox_entries" outbox
  WHERE outbox."status" IN ('DEAD_LETTER', 'MANUAL_REVIEW');
END;
$function$;

CREATE OR REPLACE FUNCTION auth.founder_metric_drilldown(
  p_actor_user_id text,
  p_session_id text,
  p_metric_id text,
  p_limit integer
)
RETURNS TABLE (
  metric_id text,
  object_type text,
  object_id text,
  status text,
  tenant_id text,
  observed_at timestamptz,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth, dispute, pg_catalog, pg_temp
SET row_security = on
AS $function$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Founder metric drill-down limit must be between 1 and 100'
      USING ERRCODE = '22023';
  END IF;
  IF NOT auth.founder_control_actor_authorized(p_actor_user_id, p_session_id) THEN
    RAISE EXCEPTION 'Active PLATFORM_OWNER assignment and recent MFA are required'
      USING ERRCODE = '42501';
  END IF;

  IF p_metric_id = 'business.open_deals' THEN
    RETURN QUERY
    SELECT p_metric_id, 'DEAL'::text, deal."id", deal."status",
           deal."tenantId", deal."updatedAt", '{}'::jsonb
    FROM public."deals" deal
    WHERE deal."status" NOT IN ('SETTLED', 'CLOSED', 'CANCELLATION', 'CANCELLED')
    ORDER BY deal."updatedAt" DESC, deal."id"
    LIMIT p_limit;
    RETURN;
  ELSIF p_metric_id = 'operations.active_shipments' THEN
    RETURN QUERY
    SELECT p_metric_id, 'SHIPMENT'::text, shipment."id", shipment."status",
           shipment."tenantId", shipment."updatedAt",
           jsonb_build_object('dealId', shipment."dealId")
    FROM public."shipments" shipment
    WHERE shipment."status" NOT IN ('DELIVERED', 'COMPLETED', 'CANCELLED', 'CLOSED', 'FAILED')
    ORDER BY shipment."updatedAt" DESC, shipment."id"
    LIMIT p_limit;
    RETURN;
  ELSIF p_metric_id = 'finance.unmatched_statement_entries' THEN
    RETURN QUERY
    SELECT p_metric_id, 'BANK_STATEMENT_ENTRY'::text, statement."id", statement."matchStatus",
           NULL::text, statement."createdAt", '{}'::jsonb
    FROM public."bank_statement_entries" statement
    WHERE statement."matchStatus" IN ('UNMATCHED', 'MISMATCH')
    ORDER BY statement."createdAt" ASC, statement."id"
    LIMIT p_limit;
    RETURN;
  ELSIF p_metric_id = 'risk.high_critical_open_disputes' THEN
    RETURN QUERY
    SELECT p_metric_id, 'DISPUTE'::text, dispute_case.id, dispute_case.status,
           dispute_case.tenant_id, dispute_case.updated_at,
           jsonb_build_object(
             'severity', dispute_case.severity,
             'deadline', dispute_case.sla_deadline,
             'dealId', dispute_case.deal_id,
             'shipmentId', dispute_case.shipment_id
           )
    FROM dispute.cases dispute_case
    WHERE dispute_case.status NOT IN ('RESOLVED', 'CLOSED')
      AND dispute_case.severity IN ('HIGH', 'CRITICAL')
    ORDER BY
      CASE dispute_case.severity WHEN 'CRITICAL' THEN 0 ELSE 1 END,
      dispute_case.sla_deadline,
      dispute_case.id
    LIMIT p_limit;
    RETURN;
  ELSIF p_metric_id = 'system.outbox_attention_entries' THEN
    RETURN QUERY
    SELECT p_metric_id, 'OUTBOX_ENTRY'::text, outbox."id", outbox."status",
           NULL::text,
           COALESCE(outbox."deadLetterAt", outbox."manualReviewAt", outbox."failedAt", outbox."createdAt"),
           jsonb_build_object(
             'dealId', outbox."dealId",
             'eventType', outbox."type",
             'errorCategory', outbox."lastErrorCategory",
             'retryCount', outbox."retryCount"
           )
    FROM public."outbox_entries" outbox
    WHERE outbox."status" IN ('DEAD_LETTER', 'MANUAL_REVIEW')
    ORDER BY
      CASE outbox."status" WHEN 'DEAD_LETTER' THEN 0 ELSE 1 END,
      COALESCE(outbox."deadLetterAt", outbox."manualReviewAt", outbox."failedAt", outbox."createdAt"),
      outbox."id"
    LIMIT p_limit;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Unknown Founder Company Health metric'
    USING ERRCODE = '22023';
END;
$function$;

CREATE OR REPLACE FUNCTION auth.founder_decision_queue(
  p_actor_user_id text,
  p_session_id text,
  p_limit integer
)
RETURNS TABLE (
  item_id text,
  object_type text,
  object_id text,
  object_version text,
  priority text,
  owner_kind text,
  owner_id text,
  deadline timestamptz,
  impact jsonb,
  next_action text,
  escalation text,
  source_relation text,
  source_ref text,
  as_of timestamptz,
  freshness_state text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth, dispute, pg_catalog, pg_temp
SET row_security = on
AS $function$
DECLARE
  captured_at timestamptz := statement_timestamp();
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Founder decision queue limit must be between 1 and 100'
      USING ERRCODE = '22023';
  END IF;
  IF NOT auth.founder_control_actor_authorized(p_actor_user_id, p_session_id) THEN
    RAISE EXCEPTION 'Active PLATFORM_OWNER assignment and recent MFA are required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    ('dispute:' || dispute_case.id || ':v' || dispute_case.version::text)::text,
    'DISPUTE'::text,
    dispute_case.id,
    dispute_case.version::text,
    CASE dispute_case.severity WHEN 'CRITICAL' THEN 'P0' ELSE 'P1' END::text,
    CASE
      WHEN dispute_case.owner_user_id IS NOT NULL THEN 'USER'
      WHEN dispute_case.owner_org_id IS NOT NULL THEN 'ORGANIZATION'
      ELSE 'UNASSIGNED'
    END::text,
    COALESCE(dispute_case.owner_user_id, dispute_case.owner_org_id),
    dispute_case.sla_deadline,
    jsonb_build_object(
      'dealId', dispute_case.deal_id,
      'shipmentId', dispute_case.shipment_id,
      'disputeType', dispute_case.type,
      'claimAmountMinor', CASE
        WHEN dispute_case.claim_amount_minor IS NULL THEN NULL
        ELSE dispute_case.claim_amount_minor::text
      END,
      'currency', dispute_case.currency
    ),
    CASE dispute_case.status
      WHEN 'OPEN' THEN 'ASSIGN_AND_TRIAGE'
      WHEN 'UNDER_REVIEW' THEN 'REVIEW_EVIDENCE'
      WHEN 'EXPERTISE' THEN 'COMPLETE_EXPERTISE'
      WHEN 'DECISION' THEN 'MAKE_AUTHORIZED_DECISION'
      WHEN 'APPEALED' THEN 'REVIEW_APPEAL'
      ELSE 'REVIEW_CURRENT_DISPUTE_STATE'
    END::text,
    CASE
      WHEN dispute_case.sla_deadline <= captured_at THEN 'OVERDUE_ESCALATION'
      WHEN dispute_case.owner_user_id IS NULL AND dispute_case.owner_org_id IS NULL THEN 'ASSIGN_OWNER'
      ELSE 'OWNER_ACTION'
    END::text,
    'dispute.cases'::text,
    ('dispute.cases/' || dispute_case.id)::text,
    captured_at,
    'CURRENT'::text
  FROM dispute.cases dispute_case
  WHERE dispute_case.status NOT IN ('RESOLVED', 'CLOSED')
    AND dispute_case.severity IN ('HIGH', 'CRITICAL')
  ORDER BY
    CASE dispute_case.severity WHEN 'CRITICAL' THEN 0 ELSE 1 END,
    CASE WHEN dispute_case.sla_deadline <= captured_at THEN 0 ELSE 1 END,
    dispute_case.sla_deadline,
    dispute_case.id
  LIMIT p_limit;
END;
$function$;

ALTER FUNCTION auth.founder_control_actor_authorized(text,text)
  OWNER TO pc_founder_control_read_authority;
ALTER FUNCTION auth.founder_company_health(text,text)
  OWNER TO pc_founder_control_read_authority;
ALTER FUNCTION auth.founder_metric_drilldown(text,text,text,integer)
  OWNER TO pc_founder_control_read_authority;
ALTER FUNCTION auth.founder_decision_queue(text,text,integer)
  OWNER TO pc_founder_control_read_authority;

REVOKE ALL ON FUNCTION auth.founder_control_actor_authorized(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.founder_company_health(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.founder_metric_drilldown(text,text,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.founder_decision_queue(text,text,integer) FROM PUBLIC;

DO $founder_control_runtime_grants$
DECLARE
  runtime_role text;
  function_signature text;
  exported_functions text[] := ARRAY[
    'auth.founder_company_health(text,text)',
    'auth.founder_metric_drilldown(text,text,text,integer)',
    'auth.founder_decision_queue(text,text,integer)'
  ];
BEGIN
  FOREACH function_signature IN ARRAY exported_functions LOOP
    FOR runtime_role IN
      SELECT rolname FROM pg_catalog.pg_roles
      WHERE rolname IN ('pc_staff_runtime', 'one_deal_staff', 'app_staff')
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', function_signature, runtime_role);
    END LOOP;

    FOR runtime_role IN
      SELECT rolname FROM pg_catalog.pg_roles
      WHERE rolname IN (
        'pc_auth_runtime', 'pc_deal_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
        'one_deal_auth', 'one_deal_app', 'one_deal_storage',
        'app_auth', 'app_runtime', 'app_storage', 'app_outbox'
      )
    LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', function_signature, runtime_role);
    END LOOP;
  END LOOP;

  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_staff_runtime', 'one_deal_staff', 'app_staff',
      'pc_auth_runtime', 'pc_deal_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
      'one_deal_auth', 'one_deal_app', 'one_deal_storage',
      'app_auth', 'app_runtime', 'app_storage', 'app_outbox'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.founder_control_actor_authorized(text,text) FROM %I',
      runtime_role
    );
  END LOOP;
END
$founder_control_runtime_grants$;

DO $founder_control_authority_proof$
BEGIN
  IF (SELECT count(*)
      FROM pg_catalog.pg_proc function
      JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
      JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
      WHERE schema.nspname = 'auth'
        AND function.proname IN (
          'founder_control_actor_authorized',
          'founder_company_health',
          'founder_metric_drilldown',
          'founder_decision_queue'
        )
        AND function.prosecdef
        AND owner.rolname = 'pc_founder_control_read_authority') <> 4 THEN
    RAISE EXCEPTION 'Founder control function ownership/security is invalid'
      USING ERRCODE = '42501';
  END IF;

  IF has_table_privilege('pc_founder_control_read_authority', 'public.deals', 'INSERT')
     OR has_table_privilege('pc_founder_control_read_authority', 'public.deals', 'UPDATE')
     OR has_table_privilege('pc_founder_control_read_authority', 'public.deals', 'DELETE')
     OR has_table_privilege('pc_founder_control_read_authority', 'public.shipments', 'INSERT')
     OR has_table_privilege('pc_founder_control_read_authority', 'public.shipments', 'UPDATE')
     OR has_table_privilege('pc_founder_control_read_authority', 'public.shipments', 'DELETE')
     OR has_table_privilege('pc_founder_control_read_authority', 'public.outbox_entries', 'INSERT')
     OR has_table_privilege('pc_founder_control_read_authority', 'public.outbox_entries', 'UPDATE')
     OR has_table_privilege('pc_founder_control_read_authority', 'public.outbox_entries', 'DELETE')
     OR has_table_privilege('pc_founder_control_read_authority', 'dispute.cases', 'INSERT')
     OR has_table_privilege('pc_founder_control_read_authority', 'dispute.cases', 'UPDATE')
     OR has_table_privilege('pc_founder_control_read_authority', 'dispute.cases', 'DELETE') THEN
    RAISE EXCEPTION 'Founder control authority must remain read-only'
      USING ERRCODE = '42501';
  END IF;
END
$founder_control_authority_proof$;
