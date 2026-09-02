#!/usr/bin/env bash
set -Eeuo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
MIGRATION_BASE='apps/api/prisma/migrations/20260902140000_role_eligibility_shadow/migration.sql'
MIGRATION_SUPERSEDED='apps/api/prisma/migrations/20260902143000_role_eligibility_superseded_current_guard/migration.sql'

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE public.organizations (
  id TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL
);
CREATE TABLE auth.registration_applications (
  id TEXT PRIMARY KEY,
  version BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  requested_workspace TEXT NOT NULL,
  requested_role TEXT NOT NULL,
  inn TEXT NOT NULL,
  ogrn TEXT,
  kpp TEXT,
  legal_name TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO public.organizations(id,"tenantId") VALUES ('org_smoke','tenant_smoke');
INSERT INTO auth.registration_applications(
  id,version,status,organization_id,requested_workspace,requested_role,inn,ogrn,kpp,legal_name
) VALUES (
  'app_smoke',3,'ORGANIZATION_VERIFICATION_PENDING','org_smoke','bank','ACCOUNTING',
  '7707083893','1027700132195','773601001','Smoke organization'
);
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_BASE"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_SUPERSEDED"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $proof$
DECLARE
  r RECORD;
BEGIN
  SELECT rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole
  INTO r FROM pg_roles WHERE rolname='pc_role_eligibility_observer';
  IF NOT FOUND OR r.rolcanlogin OR r.rolinherit OR r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole THEN
    RAISE EXCEPTION 'OBSERVER_ROLE_ATTRIBUTES_INVALID';
  END IF;
  SELECT rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole
  INTO r FROM pg_roles WHERE rolname='pc_role_eligibility_runtime';
  IF NOT FOUND OR r.rolcanlogin OR r.rolinherit OR r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole THEN
    RAISE EXCEPTION 'RUNTIME_ROLE_ATTRIBUTES_INVALID';
  END IF;
  IF has_table_privilege('pc_role_eligibility_observer','auth.registration_applications','SELECT') THEN
    RAISE EXCEPTION 'OBSERVER_DIRECT_REGISTRATION_SELECT_PRESENT';
  END IF;
  IF has_table_privilege('pc_role_eligibility_observer','auth.registration_applications','INSERT')
     OR has_table_privilege('pc_role_eligibility_observer','auth.registration_applications','UPDATE')
     OR has_table_privilege('pc_role_eligibility_observer','auth.registration_applications','DELETE') THEN
    RAISE EXCEPTION 'OBSERVER_REGISTRATION_WRITE_PRESENT';
  END IF;
  IF NOT has_function_privilege('pc_role_eligibility_observer','auth.read_role_eligibility_candidates(text)','EXECUTE') THEN
    RAISE EXCEPTION 'OBSERVER_BOUNDED_FUNCTION_MISSING';
  END IF;
END
$proof$;

SET ROLE pc_role_eligibility_observer;
DO $bounded$
DECLARE
  c RECORD;
BEGIN
  SELECT * INTO c FROM auth.read_role_eligibility_candidates('app_smoke');
  IF c.application_id <> 'app_smoke' OR c.application_version <> 3 OR c.tenant_id <> 'tenant_smoke'
     OR c.requested_workspace <> 'bank' OR c.requested_role <> 'ACCOUNTING'
     OR c.inn <> '7707083893' OR c.ogrn <> '1027700132195' THEN
    RAISE EXCEPTION 'BOUNDED_CANDIDATE_PROJECTION_INVALID';
  END IF;
END
$bounded$;
RESET ROLE;

INSERT INTO eligibility.organization_checks(
  id,application_id,application_version,application_status_at_start,organization_id,tenant_id,
  inn,ogrn,kpp,requested_workspace,requested_role,status,policy_version,policy_hash,request_key,correlation_id
) VALUES (
  'check_review','app_smoke',3,'ORGANIZATION_VERIFICATION_PENDING','org_smoke','tenant_smoke',
  '7707083893','1027700132195','773601001','bank','ACCOUNTING','CHECKING','p1',repeat('a',64),repeat('b',64),'corr-review'
);

SELECT eligibility.publish_verdict(
  'verdict_review','history_review','audit_review','outbox_review','check_review','REVIEW_REQUIRED',
  '["CBR_AUTHORITATIVE_EVIDENCE_INSUFFICIENT"]'::jsonb,repeat('c',64),repeat('d',64),'[]'::jsonb,'corr-review'
) AS first_review_verdict;

SELECT eligibility.publish_verdict(
  'verdict_review_duplicate','history_review_duplicate','audit_review_duplicate','outbox_review_duplicate','check_review','REVIEW_REQUIRED',
  '["CBR_AUTHORITATIVE_EVIDENCE_INSUFFICIENT"]'::jsonb,repeat('c',64),repeat('d',64),'[]'::jsonb,'corr-review'
) AS replay_review_verdict;

DO $idempotency$
BEGIN
  IF (SELECT count(*) FROM eligibility.verdicts WHERE check_id='check_review') <> 1 THEN RAISE EXCEPTION 'DUPLICATE_VERDICT'; END IF;
  IF (SELECT count(*) FROM eligibility.verdict_history WHERE check_id='check_review') <> 1 THEN RAISE EXCEPTION 'DUPLICATE_HISTORY'; END IF;
  IF (SELECT count(*) FROM eligibility.audit_events WHERE check_id='check_review' AND verdict_id IS NOT NULL) <> 1 THEN RAISE EXCEPTION 'DUPLICATE_TERMINAL_AUDIT'; END IF;
  IF (SELECT count(*) FROM eligibility.outbox WHERE idempotency_key='eligibility:verdict:'||repeat('d',64)) <> 1 THEN RAISE EXCEPTION 'DUPLICATE_OUTBOX'; END IF;
END
$idempotency$;

INSERT INTO eligibility.organization_checks(
  id,application_id,application_version,application_status_at_start,organization_id,tenant_id,
  inn,ogrn,kpp,requested_workspace,requested_role,status,policy_version,policy_hash,request_key,correlation_id
) VALUES (
  'check_bank','app_bank',1,'ORGANIZATION_VERIFICATION_PENDING','org_smoke','tenant_smoke',
  '7707083893','1027700132195','773601001','bank','ACCOUNTING','CHECKING','p1',repeat('1',64),repeat('2',64),'corr-bank'
);
INSERT INTO eligibility.evidence(
  id,check_id,source_type,source_name,source_record_id,registry_generation,subject_ogrn,evidence_type,
  normalized_payload,source_published_at,source_checked_at,fresh_until,parser_version,payload_sha256,confidence_class
) VALUES (
  'evidence_cbr','check_bank','CBR','Банк России','1481:1027700132195','cbr-gen-1','1027700132195','CREDIT_ORGANIZATION_STATUS',
  '{"active":true,"creditOrganization":true,"licenseValid":true}'::jsonb,
  clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '30 days','cbr-test-v1',repeat('3',64),'HIGH'
);

SELECT eligibility.publish_verdict(
  'verdict_bank','history_bank','audit_bank','outbox_bank','check_bank','ELIGIBLE',
  '["CBR_ACTIVE_CREDIT_ORGANIZATION_LICENSE_VALID"]'::jsonb,repeat('4',64),repeat('5',64),
  jsonb_build_array(jsonb_build_object(
    'source','CBR','generation','cbr-gen-1','evidenceId','evidence_cbr','evidenceHash',repeat('3',64),
    'sourcePublishedAt',clock_timestamp(),'parserVersion','cbr-test-v1'
  )),
  'corr-bank'
) AS bank_verdict;

DO $provenance$
BEGIN
  IF (SELECT count(*) FROM eligibility.verdict_sources WHERE verdict_id='verdict_bank') <> 1 THEN RAISE EXCEPTION 'SOURCE_MANIFEST_NOT_BOUND'; END IF;
  IF (SELECT verdict FROM eligibility.verdicts WHERE id='verdict_bank') <> 'ELIGIBLE' THEN RAISE EXCEPTION 'BANK_VERDICT_INVALID'; END IF;
END
$provenance$;

INSERT INTO eligibility.organization_checks(
  id,application_id,application_version,application_status_at_start,organization_id,tenant_id,
  inn,requested_workspace,requested_role,status,policy_version,policy_hash,request_key,correlation_id
) VALUES (
  'check_rollback','app_rollback',1,'ORGANIZATION_VERIFICATION_PENDING','org_smoke','tenant_smoke',
  '7707083893','buyer','BUYER','CHECKING','p1',repeat('6',64),repeat('7',64),'corr-rollback'
);

DO $rollback$
BEGIN
  BEGIN
    PERFORM eligibility.publish_verdict(
      'verdict_rollback','history_rollback','audit_rollback','outbox_rollback','check_rollback','ELIGIBLE',
      '["SHOULD_ROLL_BACK"]'::jsonb,repeat('8',64),repeat('9',64),
      '[{"source":"FNS","generation":"missing","evidenceId":"missing","evidenceHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","sourcePublishedAt":"2026-09-02T00:00:00Z","parserVersion":"missing"}]'::jsonb,
      'corr-rollback'
    );
    RAISE EXCEPTION 'INVALID_PROVENANCE_UNEXPECTEDLY_ACCEPTED';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  IF EXISTS (SELECT 1 FROM eligibility.verdicts WHERE check_id='check_rollback') THEN RAISE EXCEPTION 'ROLLBACK_VERDICT_LEAK'; END IF;
  IF EXISTS (SELECT 1 FROM eligibility.verdict_history WHERE check_id='check_rollback') THEN RAISE EXCEPTION 'ROLLBACK_HISTORY_LEAK'; END IF;
  IF EXISTS (SELECT 1 FROM eligibility.audit_events WHERE check_id='check_rollback' AND verdict_id IS NOT NULL) THEN RAISE EXCEPTION 'ROLLBACK_AUDIT_LEAK'; END IF;
  IF EXISTS (SELECT 1 FROM eligibility.outbox WHERE aggregate_id='org_smoke' AND payload->>'applicationId'='app_rollback') THEN RAISE EXCEPTION 'ROLLBACK_OUTBOX_LEAK'; END IF;
END
$rollback$;

DO $eligible_without_provenance$
BEGIN
  BEGIN
    PERFORM eligibility.publish_verdict(
      'verdict_no_source','history_no_source','audit_no_source','outbox_no_source','check_rollback','ELIGIBLE',
      '[]'::jsonb,repeat('a',64),repeat('b',64),'[]'::jsonb,'corr-no-source'
    );
    RAISE EXCEPTION 'ELIGIBLE_WITHOUT_PROVENANCE_UNEXPECTEDLY_ACCEPTED';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END
$eligible_without_provenance$;

DO $append_only$
BEGIN
  BEGIN
    UPDATE eligibility.evidence SET confidence_class='LOW' WHERE id='evidence_cbr';
    RAISE EXCEPTION 'EVIDENCE_APPEND_ONLY_NOT_ENFORCED';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    NULL;
  END;
END
$append_only$;

-- Race proof: a stale application result is durable historical evidence but it
-- must never become the current verdict or displace the current decision.
INSERT INTO eligibility.organization_checks(
  id,application_id,application_version,application_status_at_start,organization_id,tenant_id,
  inn,requested_workspace,requested_role,status,policy_version,policy_hash,request_key,correlation_id
) VALUES
  ('check_race_current','app_race',9,'ORGANIZATION_VERIFICATION_PENDING','org_smoke','tenant_smoke',
   '7707083893','buyer','BUYER','CHECKING','p1',repeat('e',64),repeat('f',64),'corr-race-current'),
  ('check_race_stale','app_race',9,'ORGANIZATION_VERIFICATION_PENDING','org_smoke','tenant_smoke',
   '7707083893','buyer','BUYER','CHECKING','p1',repeat('0',64),repeat('1',64),'corr-race-stale');

SELECT eligibility.publish_verdict(
  'verdict_race_current','history_race_current','audit_race_current','outbox_race_current',
  'check_race_current','REVIEW_REQUIRED','["CURRENT_DECISION"]'::jsonb,repeat('2',64),repeat('3',64),'[]'::jsonb,'corr-race-current'
);
SELECT eligibility.publish_verdict(
  'verdict_race_stale','history_race_stale','audit_race_stale','outbox_race_stale',
  'check_race_stale','SUPERSEDED','["APPLICATION_CHANGED_DURING_EVALUATION"]'::jsonb,repeat('4',64),repeat('5',64),'[]'::jsonb,'corr-race-stale'
);

DO $superseded$
BEGIN
  IF (SELECT is_current FROM eligibility.verdicts WHERE id='verdict_race_stale') IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'SUPERSEDED_BECAME_CURRENT';
  END IF;
  IF (SELECT is_current FROM eligibility.verdicts WHERE id='verdict_race_current') IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'SUPERSEDED_DISPLACED_CURRENT';
  END IF;
  IF (SELECT count(*) FROM eligibility.verdicts WHERE application_id='app_race' AND application_version=9 AND requested_role='BUYER' AND is_current) <> 1 THEN
    RAISE EXCEPTION 'CURRENT_VERDICT_CARDINALITY_INVALID';
  END IF;
  IF (SELECT count(*) FROM eligibility.verdict_history WHERE check_id='check_race_stale' AND new_verdict='SUPERSEDED') <> 1 THEN
    RAISE EXCEPTION 'SUPERSEDED_HISTORY_MISSING';
  END IF;
END
$superseded$;
SQL

printf '%s\n' \
  'POSTGRESQL_AUTHORITY=PASS' \
  'OBSERVER_AUTHORITY=PASS' \
  'IDEMPOTENCY=PASS' \
  'AUDIT=PASS' \
  'OUTBOX=PASS' \
  'ATOMIC_VERDICT_TRANSACTION=PASS' \
  'EVIDENCE_PROVENANCE=PASS' \
  'SOURCE_MANIFEST=PASS' \
  'SUPERSEDED_GUARD=PASS'
