-- Preserve the existing API PostgreSQL principal boundary: production runtime
-- principals are NOINHERIT and must not become members of auxiliary roles.
-- Role Eligibility still reads registration only through the bounded SECURITY
-- DEFINER function; no direct auth.registration_applications privilege is added.

DO $revoke_membership$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'pc_deal_runtime', 'app_runtime', 'one_deal_app', 'app_deal', 'app_service',
    'pc_auth_runtime', 'app_auth', 'auth_service'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE pc_role_eligibility_observer FROM %I', role_name);
      EXECUTE format('REVOKE pc_role_eligibility_runtime FROM %I', role_name);
    END IF;
  END LOOP;
END
$revoke_membership$;

DO $bounded_direct_grants$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'pc_deal_runtime', 'app_runtime', 'one_deal_app', 'app_deal', 'app_service'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      -- Registration authority: bounded EXECUTE only. No direct table SELECT.
      EXECUTE format('GRANT USAGE ON SCHEMA auth TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION auth.read_role_eligibility_candidates(TEXT) TO %I', role_name);
      EXECUTE format('REVOKE ALL ON TABLE auth.registration_applications FROM %I', role_name);

      -- Independent eligibility authority. These grants do not cross into auth
      -- registration state and do not grant role membership or BYPASSRLS.
      EXECUTE format('GRANT USAGE ON SCHEMA eligibility TO %I', role_name);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON eligibility.registry_generations TO %I', role_name);
      EXECUTE format('GRANT SELECT, INSERT ON eligibility.registry_records TO %I', role_name);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON eligibility.organization_checks TO %I', role_name);
      EXECUTE format('GRANT SELECT, INSERT ON eligibility.evidence TO %I', role_name);
      EXECUTE format('GRANT SELECT ON eligibility.verdicts TO %I', role_name);
      EXECUTE format('GRANT SELECT ON eligibility.verdict_sources TO %I', role_name);
      EXECUTE format('GRANT SELECT ON eligibility.verdict_history TO %I', role_name);
      EXECUTE format('GRANT SELECT, INSERT ON eligibility.audit_events TO %I', role_name);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON eligibility.outbox TO %I', role_name);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON eligibility.source_health TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION eligibility.activate_registry_generation(TEXT, TEXT) TO %I', role_name);
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION eligibility.publish_verdict(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, CHAR(64), CHAR(64), JSONB, TEXT) TO %I',
        role_name
      );
    END IF;
  END LOOP;
END
$bounded_direct_grants$;

-- The observer itself remains a proofable NOLOGIN bounded authority with no
-- direct registration table access.
REVOKE ALL ON TABLE auth.registration_applications FROM pc_role_eligibility_observer;
GRANT USAGE ON SCHEMA auth TO pc_role_eligibility_observer;
GRANT EXECUTE ON FUNCTION auth.read_role_eligibility_candidates(TEXT) TO pc_role_eligibility_observer;
