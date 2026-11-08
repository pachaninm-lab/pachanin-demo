#!/usr/bin/env bash
set -Eeuo pipefail
set +x
: "${DATABASE_URL:?DATABASE_URL is required}"
MIGRATION='apps/api/prisma/migrations/20260903170000_role_eligibility_enforcement_state/migration.sql'

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $initial_state$
DECLARE r RECORD;
BEGIN
  SELECT enabled,generation,exact_sha,policy_id INTO r
  FROM eligibility.enforcement_state WHERE singleton=1;
  IF NOT FOUND THEN RAISE EXCEPTION 'ENFORCEMENT_STATE_MISSING'; END IF;
  IF r.enabled IS DISTINCT FROM FALSE OR r.generation <> 0 OR r.exact_sha IS NOT NULL OR r.policy_id IS NOT NULL THEN
    RAISE EXCEPTION 'ENFORCEMENT_STATE_NOT_FAIL_CLOSED';
  END IF;
END
$initial_state$;

DO $control_role$
DECLARE r RECORD; runtime_role TEXT;
BEGIN
  SELECT rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole
  INTO r FROM pg_roles WHERE rolname='pc_role_eligibility_control';
  IF NOT FOUND OR r.rolcanlogin OR r.rolinherit OR r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole THEN
    RAISE EXCEPTION 'CONTROL_ROLE_ATTRIBUTES_INVALID';
  END IF;

  FOREACH runtime_role IN ARRAY ARRAY['pc_deal_runtime','app_runtime']
  LOOP
    IF pg_has_role(runtime_role,'pc_role_eligibility_control','MEMBER') THEN
      RAISE EXCEPTION '%_CONTROL_MEMBERSHIP_PRESENT', runtime_role;
    END IF;
    IF NOT has_table_privilege(runtime_role,'eligibility.enforcement_state','SELECT')
       OR NOT has_table_privilege(runtime_role,'eligibility.enforcement_policies','SELECT') THEN
      RAISE EXCEPTION '%_ENFORCEMENT_READ_AUTHORITY_MISSING', runtime_role;
    END IF;
    IF has_table_privilege(runtime_role,'eligibility.enforcement_state','INSERT')
       OR has_table_privilege(runtime_role,'eligibility.enforcement_state','UPDATE')
       OR has_table_privilege(runtime_role,'eligibility.enforcement_state','DELETE')
       OR has_table_privilege(runtime_role,'eligibility.enforcement_policies','INSERT')
       OR has_table_privilege(runtime_role,'eligibility.enforcement_policies','UPDATE')
       OR has_table_privilege(runtime_role,'eligibility.enforcement_policies','DELETE') THEN
      RAISE EXCEPTION '%_ENFORCEMENT_WRITE_AUTHORITY_PRESENT', runtime_role;
    END IF;
    IF has_function_privilege(
      runtime_role,
      'eligibility.set_enforcement_state(boolean,text,text,bigint,text,text,character)',
      'EXECUTE'
    ) THEN
      RAISE EXCEPTION '%_CONTROL_FUNCTION_EXECUTE_PRESENT', runtime_role;
    END IF;
  END LOOP;
END
$control_role$;

INSERT INTO eligibility.enforcement_policies(
  id,version,policy_hash,document,registered_sha,created_by
) VALUES (
  'policy-smoke-v1',
  'smoke.v1',
  repeat('a',64),
  '{"schemaVersion":"role-eligibility-enforcement-policy.v1","version":"smoke.v1","defaultDecision":"ADVISORY_ONLY","roles":{}}'::jsonb,
  repeat('b',40),
  'owner-smoke'
);

SET ROLE pc_role_eligibility_control;
SELECT eligibility.set_enforcement_state(
  TRUE, repeat('b',40), 'policy-smoke-v1', 0,
  'owner-smoke', 'enable-smoke', repeat('c',64)
) AS enabled_generation;
SELECT eligibility.set_enforcement_state(
  TRUE, repeat('b',40), 'policy-smoke-v1', 0,
  'owner-smoke', 'enable-smoke', repeat('c',64)
) AS replay_enabled_generation;
RESET ROLE;

DO $enabled_proof$
BEGIN
  IF (SELECT enabled FROM eligibility.enforcement_state WHERE singleton=1) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'ENFORCEMENT_ENABLE_NOT_APPLIED';
  END IF;
  IF (SELECT generation FROM eligibility.enforcement_state WHERE singleton=1) <> 1 THEN
    RAISE EXCEPTION 'ENFORCEMENT_ENABLE_GENERATION_INVALID';
  END IF;
  IF (SELECT count(*) FROM eligibility.enforcement_state_history) <> 1 THEN
    RAISE EXCEPTION 'ENFORCEMENT_ENABLE_NOT_IDEMPOTENT';
  END IF;
  IF (SELECT count(*) FROM eligibility.enforcement_audit_events) <> 1 THEN
    RAISE EXCEPTION 'ENFORCEMENT_ENABLE_AUDIT_INVALID';
  END IF;
  IF (SELECT count(*) FROM eligibility.outbox WHERE aggregate_id='role-eligibility-enforcement') <> 1 THEN
    RAISE EXCEPTION 'ENFORCEMENT_ENABLE_OUTBOX_INVALID';
  END IF;
END
$enabled_proof$;

DO $generation_conflict$
BEGIN
  BEGIN
    PERFORM eligibility.set_enforcement_state(
      FALSE, repeat('b',40), NULL, 0,
      'owner-smoke', 'stale-generation', repeat('d',64)
    );
    RAISE EXCEPTION 'STALE_GENERATION_UNEXPECTEDLY_ACCEPTED';
  EXCEPTION WHEN serialization_failure THEN
    NULL;
  END;
END
$generation_conflict$;

SET ROLE pc_role_eligibility_control;
SELECT eligibility.set_enforcement_state(
  FALSE, repeat('b',40), NULL, 1,
  'owner-smoke', 'rollback-smoke', repeat('e',64)
) AS rollback_generation;
RESET ROLE;

DO $rollback_proof$
BEGIN
  IF (SELECT enabled FROM eligibility.enforcement_state WHERE singleton=1) IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'ROLLBACK_DID_NOT_DISABLE_ENFORCEMENT';
  END IF;
  IF (SELECT generation FROM eligibility.enforcement_state WHERE singleton=1) <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK_GENERATION_INVALID';
  END IF;
  IF (SELECT count(*) FROM eligibility.enforcement_state_history) <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK_HISTORY_INVALID';
  END IF;
  IF (SELECT count(*) FROM eligibility.enforcement_audit_events) <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK_AUDIT_INVALID';
  END IF;
  IF (SELECT count(*) FROM eligibility.outbox WHERE aggregate_id='role-eligibility-enforcement') <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK_OUTBOX_INVALID';
  END IF;
END
$rollback_proof$;

DO $append_only$
BEGIN
  BEGIN
    UPDATE eligibility.enforcement_state_history SET reason='tamper' WHERE idempotency_key=repeat('c',64);
    RAISE EXCEPTION 'ENFORCEMENT_HISTORY_APPEND_ONLY_NOT_ENFORCED';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL;
  END;
  BEGIN
    UPDATE eligibility.enforcement_audit_events SET reason='tamper' WHERE idempotency_key=repeat('c',64);
    RAISE EXCEPTION 'ENFORCEMENT_AUDIT_APPEND_ONLY_NOT_ENFORCED';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL;
  END;
  BEGIN
    UPDATE eligibility.enforcement_policies SET created_by='tamper' WHERE id='policy-smoke-v1';
    RAISE EXCEPTION 'ENFORCEMENT_POLICY_APPEND_ONLY_NOT_ENFORCED';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL;
  END;
END
$append_only$;

DO $registration_boundary$
BEGIN
  IF has_table_privilege('pc_role_eligibility_control','auth.registration_applications','SELECT')
     OR has_table_privilege('pc_role_eligibility_control','auth.registration_applications','INSERT')
     OR has_table_privilege('pc_role_eligibility_control','auth.registration_applications','UPDATE')
     OR has_table_privilege('pc_role_eligibility_control','auth.registration_applications','DELETE') THEN
    RAISE EXCEPTION 'CONTROL_ROLE_REGISTRATION_PRIVILEGE_PRESENT';
  END IF;
END
$registration_boundary$;
SQL

printf '%s\n' \
  'ENFORCEMENT_POSTGRES_STATE=PASS' \
  'ENFORCEMENT_DEFAULT=false' \
  'CONTROL_ROLE_BOUNDARY=PASS' \
  'ENFORCEMENT_IDEMPOTENCY=PASS' \
  'ENFORCEMENT_AUDIT=PASS' \
  'ENFORCEMENT_OUTBOX=PASS' \
  'ROLLBACK_ACCEPTANCE=PASS' \
  'REGISTRATION_ENFORCEMENT_BOUNDARY=PASS'
