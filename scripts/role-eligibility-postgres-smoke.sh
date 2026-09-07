#!/usr/bin/env bash
set -Eeuo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
MIGRATION_BASE='apps/api/prisma/migrations/20260902140000_role_eligibility_shadow/migration.sql'
MIGRATION_SUPERSEDED='apps/api/prisma/migrations/20260902143000_role_eligibility_superseded_current_guard/migration.sql'
MIGRATION_COVERAGE='apps/api/prisma/migrations/20260906180000_role_eligibility_fns_registry_coverage_authority/migration.sql'

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
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_COVERAGE"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
-- #5064 domain/coverage/finality authority proof.
INSERT INTO eligibility.registry_generations(
  id,source,generation,published_at,downloaded_at,content_sha256,record_count,
  parser_version,schema_version,status,fresh_until,created_at,validated_at
) VALUES
  ('elg_egrul_a','FNS','egrul-a',clock_timestamp(),clock_timestamp(),repeat('1',64),1,'fns-egrul-v1','EGRUL_408','VALIDATED',clock_timestamp()+interval '1 day',clock_timestamp(),clock_timestamp()),
  ('elg_egrip_a','FNS','egrip-a',clock_timestamp(),clock_timestamp(),repeat('2',64),1,'fns-egrip-v1','EGRIP_407','VALIDATED',clock_timestamp()+interval '1 day',clock_timestamp(),clock_timestamp()),
  ('elg_egrul_b','FNS','egrul-b',clock_timestamp()+interval '1 minute',clock_timestamp(),repeat('3',64),1,'fns-egrul-v1','EGRUL_408','VALIDATED',clock_timestamp()+interval '1 day',clock_timestamp(),clock_timestamp());

DO $domain_backfill$
BEGIN
  IF (SELECT registry_domain FROM eligibility.registry_generations WHERE id='elg_egrul_a') <> 'EGRUL' THEN
    RAISE EXCEPTION 'EGRUL_DOMAIN_DERIVATION_FAILED';
  END IF;
  IF (SELECT registry_domain FROM eligibility.registry_generations WHERE id='elg_egrip_a') <> 'EGRIP' THEN
    RAISE EXCEPTION 'EGRIP_DOMAIN_DERIVATION_FAILED';
  END IF;
END
$domain_backfill$;

SELECT eligibility.activate_registry_generation('FNS','EGRUL','egrul-a');
SELECT eligibility.activate_registry_generation('FNS','EGRIP','egrip-a');

DO $simultaneous_domains$
BEGIN
  IF (SELECT count(*) FROM eligibility.registry_generations WHERE source='FNS' AND status='ACTIVE') <> 2 THEN
    RAISE EXCEPTION 'FNS_ACTIVE_DOMAIN_CARDINALITY_INVALID';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM eligibility.registry_generations WHERE source='FNS' AND registry_domain='EGRUL' AND status='ACTIVE') THEN
    RAISE EXCEPTION 'EGRUL_ACTIVE_MISSING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM eligibility.registry_generations WHERE source='FNS' AND registry_domain='EGRIP' AND status='ACTIVE') THEN
    RAISE EXCEPTION 'EGRIP_ACTIVE_MISSING';
  END IF;
END
$simultaneous_domains$;

SELECT eligibility.activate_registry_generation('FNS','EGRUL','egrul-b');

DO $domain_monotonicity$
BEGIN
  IF (SELECT status FROM eligibility.registry_generations WHERE id='elg_egrul_a') <> 'SUPERSEDED' THEN
    RAISE EXCEPTION 'EGRUL_PREDECESSOR_NOT_SUPERSEDED';
  END IF;
  IF (SELECT status FROM eligibility.registry_generations WHERE id='elg_egrip_a') <> 'ACTIVE' THEN
    RAISE EXCEPTION 'EGRIP_COLLATERALLY_SUPERSEDED';
  END IF;
  IF (SELECT status FROM eligibility.registry_generations WHERE id='elg_egrul_b') <> 'ACTIVE' THEN
    RAISE EXCEPTION 'EGRUL_NEW_ACTIVE_MISSING';
  END IF;
END
$domain_monotonicity$;

INSERT INTO eligibility.source_health(
  source,registry_domain,status,circuit_state,active_generation,parser_version,schema_version,
  last_success_at,checked_at,fresh_until,consecutive_failures,last_error_code,updated_at
) VALUES
  ('FNS','EGRUL','HEALTHY','CLOSED','egrul-b','fns-egrul-v1','EGRUL_408',clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '1 day',0,NULL,clock_timestamp()),
  ('FNS','EGRIP','HEALTHY','CLOSED','egrip-a','fns-egrip-v1','EGRIP_407',clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '1 day',0,NULL,clock_timestamp());

DO $health_domains$
BEGIN
  IF (SELECT count(*) FROM eligibility.source_health WHERE source='FNS') <> 2 THEN
    RAISE EXCEPTION 'FNS_SOURCE_HEALTH_DOMAIN_COLLISION';
  END IF;
END
$health_domains$;

INSERT INTO eligibility.registry_generation_authority(
  generation_id,source,registry_domain,coverage_kind,generation_mode,
  acquisition_complete,local_import_integrity,baseline_coverage,update_continuity,source_finality,
  baseline_generation_id,predecessor_generation_id,update_package_id,update_package_sha256,
  continuity_policy_version,continuity_policy_hash,effective_cutoff,authority_token
) VALUES (
  'elg_egrul_b','FNS','EGRUL','COMPLETE_EFFECTIVE_CORPUS','DAILY_EFFECTIVE',
  TRUE,TRUE,TRUE,TRUE,FALSE,
  'elg_egrul_a','elg_egrul_a','daily-2026-09-07',repeat('4',64),
  'fns-egrul-continuity-v1',repeat('5',64),clock_timestamp(),repeat('6',64)
);

INSERT INTO eligibility.registry_generation_authority(
  generation_id,source,registry_domain,authority_token
) VALUES ('elg_egrip_a','FNS','EGRIP',repeat('7',64));

DO $conservative_finality$
BEGIN
  IF (SELECT source_finality FROM eligibility.registry_generation_authority WHERE generation_id='elg_egrul_b') IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'CURRENT_YEAR_FINALITY_WAS_FABRICATED';
  END IF;
  IF (SELECT coverage_kind FROM eligibility.registry_generation_authority WHERE generation_id='elg_egrip_a') <> 'UNKNOWN' THEN
    RAISE EXCEPTION 'LEGACY_UNKNOWN_COVERAGE_NOT_CONSERVATIVE';
  END IF;
  IF (SELECT source_finality FROM eligibility.registry_generation_authority WHERE generation_id='elg_egrip_a') IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'DEFAULT_FINALITY_NOT_FALSE';
  END IF;
END
$conservative_finality$;

DO $lineage_domain_guard$
BEGIN
  INSERT INTO eligibility.registry_generations(
    id,source,generation,published_at,downloaded_at,content_sha256,record_count,
    parser_version,schema_version,status,fresh_until,created_at,validated_at
  ) VALUES (
    'elg_egrul_cross','FNS','egrul-cross',clock_timestamp(),clock_timestamp(),repeat('8',64),1,
    'fns-egrul-v1','EGRUL_408','VALIDATED',clock_timestamp()+interval '1 day',clock_timestamp(),clock_timestamp()
  );
  BEGIN
    INSERT INTO eligibility.registry_generation_authority(
      generation_id,source,registry_domain,coverage_kind,generation_mode,baseline_generation_id,authority_token
    ) VALUES ('elg_egrul_cross','FNS','EGRUL','UNKNOWN','UNKNOWN','elg_egrip_a',repeat('9',64));
    RAISE EXCEPTION 'CROSS_DOMAIN_LINEAGE_UNEXPECTEDLY_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'CROSS_DOMAIN_LINEAGE_UNEXPECTEDLY_ACCEPTED' THEN RAISE; END IF;
  END;
END
$lineage_domain_guard$;

DO $authority_append_only$
BEGIN
  BEGIN
    UPDATE eligibility.registry_generation_authority SET source_finality=TRUE WHERE generation_id='elg_egrul_b';
    RAISE EXCEPTION 'AUTHORITY_APPEND_ONLY_NOT_ENFORCED';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL;
  END;
END
$authority_append_only$;

SET ROLE pc_role_eligibility_runtime;
DO $runtime_no_promotion$
BEGIN
  BEGIN
    INSERT INTO eligibility.registry_generation_authority(generation_id,source,registry_domain,authority_token)
    VALUES ('elg_egrul_cross','FNS','EGRUL',repeat('a',64));
    RAISE EXCEPTION 'RUNTIME_AUTHORITY_INSERT_UNEXPECTEDLY_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE eligibility.registry_generation_authority SET source_finality=TRUE WHERE generation_id='elg_egrul_b';
    RAISE EXCEPTION 'RUNTIME_AUTHORITY_UPDATE_UNEXPECTEDLY_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$runtime_no_promotion$;
RESET ROLE;

-- Execute the canonical FNS/EGRUL absence resolver against real PostgreSQL.
-- Unit mocks are insufficient evidence for finality/absence semantics.
UPDATE eligibility.source_health AS h
SET fresh_until = g.fresh_until
FROM eligibility.registry_generations AS g
WHERE h.source='FNS' AND h.registry_domain='EGRUL'
  AND g.id='elg_egrul_b';

INSERT INTO eligibility.registry_records(
  id,generation_id,source,source_record_id,subject_inn,subject_ogrn,record_type,
  normalized_payload,source_published_at,payload_sha256,created_at
) VALUES (
  'elr_egrul_b_present','elg_egrul_b','FNS','1027700132195','7707083893','1027700132195',
  'EGRUL_LEGAL_ENTITY','{"active":true}'::jsonb,clock_timestamp(),repeat('b',64),clock_timestamp()
);

SET ROLE pc_role_eligibility_runtime;
DO $resolver_without_finality$
DECLARE
  resolved_state TEXT;
  resolved_generation TEXT;
BEGIN
  SELECT state,generation INTO STRICT resolved_state,resolved_generation
  FROM eligibility.resolve_fns_egrul_inn(
    '7736050003',
    (SELECT effective_cutoff FROM eligibility.registry_generation_authority WHERE generation_id='elg_egrul_b')
  );
  IF resolved_state IS DISTINCT FROM 'COVERAGE_NOT_FINAL' OR resolved_generation IS DISTINCT FROM 'egrul-b' THEN
    RAISE EXCEPTION 'CURRENT_YEAR_ABSENCE_WITHOUT_FINALITY_FAIL_CLOSED_INVALID state=% generation=%',
      resolved_state,resolved_generation;
  END IF;

  SELECT state INTO STRICT resolved_state
  FROM eligibility.resolve_fns_egrul_inn(
    '7707083893',
    (SELECT effective_cutoff FROM eligibility.registry_generation_authority WHERE generation_id='elg_egrul_b')
  );
  IF resolved_state IS DISTINCT FROM 'FOUND' THEN
    RAISE EXCEPTION 'EGRUL_PRESENT_IDENTIFIER_NOT_FOUND state=%',resolved_state;
  END IF;
END
$resolver_without_finality$;
RESET ROLE;

-- A separately accepted finality fact may authorize a zero-row negative only
-- when every other exact-generation/domain/health/coverage predicate is true.
INSERT INTO eligibility.registry_generations(
  id,source,generation,published_at,downloaded_at,content_sha256,record_count,
  parser_version,schema_version,status,fresh_until,created_at,validated_at
) VALUES (
  'elg_egrul_final','FNS','egrul-final',clock_timestamp()+interval '2 minutes',clock_timestamp(),repeat('c',64),1,
  'fns-egrul-v1','EGRUL_408','VALIDATED',clock_timestamp()+interval '1 day',clock_timestamp(),clock_timestamp()
);
INSERT INTO eligibility.registry_records(
  id,generation_id,source,source_record_id,subject_inn,subject_ogrn,record_type,
  normalized_payload,source_published_at,payload_sha256,created_at
) VALUES (
  'elr_egrul_final_present','elg_egrul_final','FNS','1027700132195','7707083893','1027700132195',
  'EGRUL_LEGAL_ENTITY','{"active":true}'::jsonb,clock_timestamp(),repeat('d',64),clock_timestamp()
);
INSERT INTO eligibility.registry_generation_authority(
  generation_id,source,registry_domain,coverage_kind,generation_mode,
  acquisition_complete,local_import_integrity,baseline_coverage,update_continuity,source_finality,
  continuity_policy_version,continuity_policy_hash,finality_policy_version,finality_policy_hash,
  effective_cutoff,authority_token
) VALUES (
  'elg_egrul_final','FNS','EGRUL','COMPLETE_NATIONAL_CORPUS','FULL_BASELINE',
  TRUE,TRUE,TRUE,TRUE,TRUE,
  'fns-egrul-continuity-v1',repeat('e',64),'fns-egrul-finality-test-v1',repeat('f',64),
  clock_timestamp()+interval '1 minute',repeat('0',64)
);
SELECT eligibility.activate_registry_generation('FNS','EGRUL','egrul-final');
UPDATE eligibility.source_health AS h
SET status='HEALTHY',circuit_state='CLOSED',active_generation=g.generation,
    parser_version=g.parser_version,schema_version=g.schema_version,
    fresh_until=g.fresh_until,consecutive_failures=0,last_error_code=NULL,
    last_success_at=clock_timestamp(),checked_at=clock_timestamp(),updated_at=clock_timestamp()
FROM eligibility.registry_generations AS g
WHERE h.source='FNS' AND h.registry_domain='EGRUL' AND g.id='elg_egrul_final';

SET ROLE pc_role_eligibility_runtime;
DO $resolver_with_finality$
DECLARE
  resolved_state TEXT;
  resolved_token TEXT;
  invalid_time TIMESTAMPTZ;
BEGIN
  SELECT state,authority_token INTO STRICT resolved_state,resolved_token
  FROM eligibility.resolve_fns_egrul_inn('7736050003',clock_timestamp());
  IF resolved_state IS DISTINCT FROM 'AUTHORITATIVE_NOT_FOUND' OR resolved_token IS NULL THEN
    RAISE EXCEPTION 'PROVEN_FINALITY_NEGATIVE_RESOLUTION_INVALID state=% token=%',resolved_state,resolved_token;
  END IF;

  SELECT state INTO STRICT resolved_state
  FROM eligibility.resolve_fns_egrul_inn('7707083893',clock_timestamp());
  IF resolved_state IS DISTINCT FROM 'FOUND' THEN
    RAISE EXCEPTION 'FINAL_AUTHORITY_PRESENT_IDENTIFIER_NOT_FOUND state=%',resolved_state;
  END IF;

  SELECT state INTO STRICT resolved_state
  FROM eligibility.resolve_fns_egrul_inn('7707083892',clock_timestamp());
  IF resolved_state IS DISTINCT FROM 'INVALID_IDENTIFIER' THEN
    RAISE EXCEPTION 'INVALID_IDENTIFIER_REACHED_NEGATIVE_AUTHORITY state=%',resolved_state;
  END IF;
  FOREACH invalid_time IN ARRAY ARRAY[NULL::TIMESTAMPTZ,'infinity'::TIMESTAMPTZ,'-infinity'::TIMESTAMPTZ] LOOP
    SELECT state INTO STRICT resolved_state
    FROM eligibility.resolve_fns_egrul_inn('7736050003',invalid_time);
    IF resolved_state IS DISTINCT FROM 'SOURCE_UNAVAILABLE' THEN
      RAISE EXCEPTION 'INVALID_DECISION_TIME_REACHED_NEGATIVE_AUTHORITY state=%',resolved_state;
    END IF;
  END LOOP;
END
$resolver_with_finality$;
RESET ROLE;
SQL

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
  'check_race_stale','SUPERSEDED','["APPLICATION_CHANGED_DURING_EVALUATION"]'::jsonb,repeat('4',64),repeat('6',64),'[]'::jsonb,'corr-race-stale'
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

# Roll back each diagnostic mutation; no accepted fixture is permanently changed.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET LOCAL ROLE pc_role_eligibility_runtime;
DO $resolver_invalidation_guards$
DECLARE
  original eligibility.source_health%ROWTYPE;
  resolved_state TEXT;
  cutoff TIMESTAMPTZ;
BEGIN
  SELECT * INTO STRICT original FROM eligibility.source_health
  WHERE source='FNS' AND registry_domain='EGRUL';
  SELECT effective_cutoff INTO STRICT cutoff FROM eligibility.registry_generation_authority
  WHERE generation_id='elg_egrul_final';

  SELECT state INTO STRICT resolved_state
  FROM eligibility.resolve_fns_egrul_inn('7736050003',cutoff+interval '1 microsecond');
  IF resolved_state IS DISTINCT FROM 'COVERAGE_NOT_PROVEN' THEN
    RAISE EXCEPTION 'EXPIRED_CUTOFF_REACHED_NEGATIVE_AUTHORITY state=%',resolved_state;
  END IF;
  SELECT state INTO STRICT resolved_state
  FROM eligibility.resolve_fns_egrul_inn('7736050003',original.fresh_until);
  IF resolved_state IS DISTINCT FROM 'STALE' THEN
    RAISE EXCEPTION 'EXPIRED_FRESHNESS_REACHED_NEGATIVE_AUTHORITY state=%',resolved_state;
  END IF;

  UPDATE eligibility.source_health SET active_generation='different-generation'
  WHERE source='FNS' AND registry_domain='EGRUL';
  SELECT state INTO STRICT resolved_state FROM eligibility.resolve_fns_egrul_inn('7736050003',cutoff);
  IF resolved_state IS DISTINCT FROM 'SOURCE_UNAVAILABLE' THEN
    RAISE EXCEPTION 'MISMATCHED_GENERATION_REACHED_NEGATIVE_AUTHORITY state=%',resolved_state;
  END IF;
  UPDATE eligibility.source_health SET active_generation=original.active_generation,status='DEGRADED'
  WHERE source='FNS' AND registry_domain='EGRUL';
  SELECT state INTO STRICT resolved_state FROM eligibility.resolve_fns_egrul_inn('7736050003',cutoff);
  IF resolved_state IS DISTINCT FROM 'SOURCE_UNAVAILABLE' THEN
    RAISE EXCEPTION 'DEGRADED_SOURCE_REACHED_NEGATIVE_AUTHORITY state=%',resolved_state;
  END IF;
  UPDATE eligibility.source_health SET status=original.status,circuit_state='OPEN'
  WHERE source='FNS' AND registry_domain='EGRUL';
  SELECT state INTO STRICT resolved_state FROM eligibility.resolve_fns_egrul_inn('7736050003',cutoff);
  IF resolved_state IS DISTINCT FROM 'SOURCE_UNAVAILABLE' THEN
    RAISE EXCEPTION 'OPEN_CIRCUIT_REACHED_NEGATIVE_AUTHORITY state=%',resolved_state;
  END IF;
  UPDATE eligibility.source_health SET circuit_state=original.circuit_state,parser_version='unaccepted-parser'
  WHERE source='FNS' AND registry_domain='EGRUL';
  SELECT state INTO STRICT resolved_state FROM eligibility.resolve_fns_egrul_inn('7736050003',cutoff);
  IF resolved_state IS DISTINCT FROM 'SOURCE_UNAVAILABLE' THEN
    RAISE EXCEPTION 'MISMATCHED_PARSER_REACHED_NEGATIVE_AUTHORITY state=%',resolved_state;
  END IF;
  UPDATE eligibility.source_health SET parser_version=original.parser_version,fresh_until=original.fresh_until+interval '1 second'
  WHERE source='FNS' AND registry_domain='EGRUL';
  SELECT state INTO STRICT resolved_state FROM eligibility.resolve_fns_egrul_inn('7736050003',cutoff);
  IF resolved_state IS DISTINCT FROM 'STALE' THEN
    RAISE EXCEPTION 'INCOHERENT_FRESHNESS_REACHED_NEGATIVE_AUTHORITY state=%',resolved_state;
  END IF;
END
$resolver_invalidation_guards$;
ROLLBACK;
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
  'SUPERSEDED_GUARD=PASS' \
  'REGISTRY_DOMAIN_AUTHORITY=PASS' \
  'REGISTRY_COVERAGE_MODEL=PASS' \
  'FNS_SOURCE_FINALITY_MODEL=PASS' \
  'EGRUL_EGRIP_ACTIVE_DOMAIN_SEPARATION=PASS' \
  'CURRENT_YEAR_BULK_ABSENCE_WITHOUT_FINALITY_NOT_FOUND=0' \
  'FNS_NEGATIVE_AUTHORITY_PREDICATE=PASS'
