-- Role Eligibility runtime boundary for the production API principal observed by
-- read-only production evidence. This is additive to Role Eligibility only.
-- Registration tables/state are not mutated and no direct registration-table
-- privilege is granted.

DO $role_eligibility_app_deal_api$
DECLARE
  v_super BOOLEAN;
  v_bypassrls BOOLEAN;
  v_createdb BOOLEAN;
  v_createrole BOOLEAN;
  v_replication BOOLEAN;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'app_deal_api') THEN
    RETURN;
  END IF;

  SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication
    INTO v_super, v_bypassrls, v_createdb, v_createrole, v_replication
  FROM pg_catalog.pg_roles
  WHERE rolname = 'app_deal_api';

  IF v_super OR v_bypassrls OR v_createdb OR v_createrole OR v_replication THEN
    RAISE EXCEPTION 'app_deal_api violates Role Eligibility runtime capability boundary'
      USING ERRCODE = '42501';
  END IF;

  -- Candidate intake is read-only through the bounded SECURITY DEFINER function.
  GRANT USAGE ON SCHEMA auth TO app_deal_api;
  GRANT EXECUTE ON FUNCTION auth.read_role_eligibility_candidates(TEXT) TO app_deal_api;

  -- Independent Role Eligibility authority required by the API/worker runtime.
  GRANT USAGE ON SCHEMA eligibility TO app_deal_api;
  GRANT SELECT, INSERT, UPDATE ON eligibility.registry_generations TO app_deal_api;
  GRANT SELECT, INSERT ON eligibility.registry_records TO app_deal_api;
  GRANT SELECT, INSERT, UPDATE ON eligibility.organization_checks TO app_deal_api;
  GRANT SELECT, INSERT ON eligibility.evidence TO app_deal_api;
  GRANT SELECT ON eligibility.verdicts TO app_deal_api;
  GRANT SELECT ON eligibility.verdict_sources TO app_deal_api;
  GRANT SELECT ON eligibility.verdict_history TO app_deal_api;
  GRANT SELECT, INSERT ON eligibility.audit_events TO app_deal_api;
  GRANT SELECT, INSERT, UPDATE ON eligibility.outbox TO app_deal_api;
  GRANT SELECT, INSERT, UPDATE ON eligibility.source_health TO app_deal_api;
  GRANT EXECUTE ON FUNCTION eligibility.activate_registry_generation(TEXT, TEXT) TO app_deal_api;
  GRANT EXECUTE ON FUNCTION eligibility.publish_verdict(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, CHAR(64), CHAR(64), JSONB, TEXT
  ) TO app_deal_api;

  -- Preserve the registration boundary explicitly.
  REVOKE ALL ON TABLE auth.registration_applications FROM app_deal_api;
END
$role_eligibility_app_deal_api$;
