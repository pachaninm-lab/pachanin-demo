#!/usr/bin/env bash
set -Eeuo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
MIGRATION='apps/api/prisma/migrations/20260909114500_role_eligibility_fns_registry_statement_digest_hardening/migration.sql'

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

DO $trigger_shape$
DECLARE statement_guards INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='eligibility.registry_records'::regclass
      AND tgname='registry_records_mutation_guard' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'LEGACY_PER_ROW_REGISTRY_MUTATION_GUARD_PRESENT';
  END IF;
  SELECT count(*)::integer INTO statement_guards
  FROM pg_trigger
  WHERE tgrelid='eligibility.registry_records'::regclass
    AND tgname IN (
      'registry_records_insert_statement_guard',
      'registry_records_update_statement_guard',
      'registry_records_delete_statement_guard'
    )
    AND (tgtype & 1)=0
    AND NOT tgisinternal;
  IF statement_guards <> 3 THEN
    RAISE EXCEPTION 'STATEMENT_LEVEL_REGISTRY_GUARDS_INCOMPLETE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    JOIN pg_language l ON l.oid=p.prolang
    WHERE n.nspname='eligibility' AND p.proname='compute_registry_recordset_sha256'
      AND l.lanname='sql'
  ) THEN
    RAISE EXCEPTION 'RECORDSET_DIGEST_NOT_SET_ORIENTED_SQL';
  END IF;
END
$trigger_shape$;

INSERT INTO eligibility.registry_generations(
  id,source,generation,published_at,downloaded_at,content_sha256,record_count,
  parser_version,schema_version,status,fresh_until,created_at,validated_at
) VALUES
  ('elg_hard_stage_a','FNS','hard-stage-a',clock_timestamp(),clock_timestamp(),repeat('a',64),3,
   'fns-egrul-v1','EGRUL_408','STAGING',clock_timestamp()+interval '1 day',clock_timestamp(),NULL),
  ('elg_hard_stage_b','FNS','hard-stage-b',clock_timestamp()+interval '1 second',clock_timestamp(),repeat('b',64),3,
   'fns-egrul-v1','EGRUL_408','STAGING',clock_timestamp()+interval '1 day',clock_timestamp(),NULL);

INSERT INTO eligibility.registry_records(
  id,generation_id,source,source_record_id,subject_inn,subject_ogrn,record_type,
  normalized_payload,source_published_at,payload_sha256,created_at
) VALUES
  ('hard_a_1','elg_hard_stage_a','FNS','1027700132195','7707083893','1027700132195','EGRUL_LEGAL_ENTITY','{"active":true}'::jsonb,clock_timestamp(),repeat('1',64),clock_timestamp()),
  ('hard_a_2','elg_hard_stage_a','FNS','1047796045770','7812345675','1047796045770','EGRUL_LEGAL_ENTITY','{"active":true}'::jsonb,clock_timestamp(),repeat('2',64),clock_timestamp()),
  ('hard_a_3','elg_hard_stage_a','FNS','1067760123456','7712345678','1067760123456','EGRUL_LEGAL_ENTITY','{"active":true}'::jsonb,clock_timestamp(),repeat('3',64),clock_timestamp());

INSERT INTO eligibility.registry_records(
  id,generation_id,source,source_record_id,subject_inn,subject_ogrn,record_type,
  normalized_payload,source_published_at,payload_sha256,created_at
) VALUES
  ('hard_b_3','elg_hard_stage_b','FNS','1067760123456','7712345678','1067760123456','EGRUL_LEGAL_ENTITY','{"active":true}'::jsonb,clock_timestamp(),repeat('3',64),clock_timestamp()),
  ('hard_b_2','elg_hard_stage_b','FNS','1047796045770','7812345675','1047796045770','EGRUL_LEGAL_ENTITY','{"active":true}'::jsonb,clock_timestamp(),repeat('2',64),clock_timestamp()),
  ('hard_b_1','elg_hard_stage_b','FNS','1027700132195','7707083893','1027700132195','EGRUL_LEGAL_ENTITY','{"active":true}'::jsonb,clock_timestamp(),repeat('1',64),clock_timestamp());

DO $digest_contract$
DECLARE digest_a CHAR(64); digest_b CHAR(64); changed CHAR(64);
BEGIN
  digest_a := eligibility.compute_registry_recordset_sha256('elg_hard_stage_a');
  digest_b := eligibility.compute_registry_recordset_sha256('elg_hard_stage_b');
  IF digest_a IS DISTINCT FROM digest_b THEN
    RAISE EXCEPTION 'RECORDSET_DIGEST_DEPENDS_ON_INSERT_ORDER';
  END IF;
  UPDATE eligibility.registry_records SET payload_sha256=repeat('f',64) WHERE id='hard_a_2';
  changed := eligibility.compute_registry_recordset_sha256('elg_hard_stage_a');
  IF changed IS NOT DISTINCT FROM digest_a THEN
    RAISE EXCEPTION 'RECORDSET_DIGEST_IGNORED_RECORD_MUTATION';
  END IF;
  UPDATE eligibility.registry_records SET payload_sha256=repeat('2',64) WHERE id='hard_a_2';
  IF eligibility.compute_registry_recordset_sha256('elg_hard_stage_a') IS DISTINCT FROM digest_a THEN
    RAISE EXCEPTION 'RECORDSET_DIGEST_REPLAY_NOT_DETERMINISTIC';
  END IF;
END
$digest_contract$;

DO $generation_identity_guard$
BEGIN
  BEGIN
    UPDATE eligibility.registry_records SET generation_id='elg_hard_stage_b' WHERE id='hard_a_1';
    RAISE EXCEPTION 'GENERATION_IDENTITY_MUTATION_UNEXPECTEDLY_ACCEPTED';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
END
$generation_identity_guard$;

UPDATE eligibility.registry_generations SET status='VALIDATED',validated_at=clock_timestamp()
WHERE id='elg_hard_stage_a';

DO $non_staging_guards$
BEGIN
  BEGIN
    INSERT INTO eligibility.registry_records(
      id,generation_id,source,source_record_id,subject_inn,subject_ogrn,record_type,
      normalized_payload,source_published_at,payload_sha256,created_at
    ) VALUES ('hard_after_validate','elg_hard_stage_a','FNS','1087746123456','7723456789','1087746123456','EGRUL_LEGAL_ENTITY','{}'::jsonb,clock_timestamp(),repeat('4',64),clock_timestamp());
    RAISE EXCEPTION 'VALIDATED_INSERT_UNEXPECTEDLY_ACCEPTED';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  BEGIN
    UPDATE eligibility.registry_records SET payload_sha256=repeat('9',64) WHERE id='hard_a_1';
    RAISE EXCEPTION 'VALIDATED_UPDATE_UNEXPECTEDLY_ACCEPTED';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  BEGIN
    DELETE FROM eligibility.registry_records WHERE id='hard_a_1';
    RAISE EXCEPTION 'VALIDATED_DELETE_UNEXPECTEDLY_ACCEPTED';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
END
$non_staging_guards$;

INSERT INTO eligibility.registry_generations(
  id,source,generation,published_at,downloaded_at,content_sha256,record_count,
  parser_version,schema_version,status,fresh_until,created_at,validated_at
) VALUES
  ('elg_hard_sealed','FNS','hard-sealed',clock_timestamp()+interval '2 seconds',clock_timestamp(),repeat('c',64),1,
   'fns-egrul-v1','EGRUL_408','STAGING',clock_timestamp()+interval '1 day',clock_timestamp(),NULL),
  ('elg_hard_authority','FNS','hard-authority',clock_timestamp()+interval '3 seconds',clock_timestamp(),repeat('d',64),1,
   'fns-egrul-v1','EGRUL_408','STAGING',clock_timestamp()+interval '1 day',clock_timestamp(),NULL);

INSERT INTO eligibility.registry_records(
  id,generation_id,source,source_record_id,subject_inn,subject_ogrn,record_type,
  normalized_payload,source_published_at,payload_sha256,created_at
) VALUES
  ('hard_sealed_1','elg_hard_sealed','FNS','1027700132195','7707083893','1027700132195','EGRUL_LEGAL_ENTITY','{}'::jsonb,clock_timestamp(),repeat('5',64),clock_timestamp()),
  ('hard_authority_1','elg_hard_authority','FNS','1047796045770','7812345675','1047796045770','EGRUL_LEGAL_ENTITY','{}'::jsonb,clock_timestamp(),repeat('6',64),clock_timestamp());

INSERT INTO eligibility.registry_generation_lineage(
  generation_id,source,registry_domain,predecessor_generation_id,update_package_id,update_package_sha256,
  source_published_at,effective_cutoff,predecessor_record_count,effective_record_count,
  predecessor_covered_count,new_subject_count,predecessor_recordset_sha256,effective_recordset_sha256,created_at
) VALUES (
  'elg_hard_sealed','FNS','EGRUL','elg_egrul_a','hard-sealed',repeat('c',64),clock_timestamp(),clock_timestamp(),
  1,1,1,0,repeat('7',64),repeat('8',64),clock_timestamp()
);

INSERT INTO eligibility.registry_generation_authority(
  generation_id,source,registry_domain,coverage_kind,generation_mode,authority_token,created_at
) VALUES ('elg_hard_authority','FNS','EGRUL','UNKNOWN','UNKNOWN',repeat('0',64),clock_timestamp());

DO $seal_guards$
BEGIN
  BEGIN
    DELETE FROM eligibility.registry_records WHERE generation_id='elg_hard_sealed';
    RAISE EXCEPTION 'COMPOSITION_SEALED_DELETE_UNEXPECTEDLY_ACCEPTED';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  BEGIN
    UPDATE eligibility.registry_records SET payload_sha256=repeat('a',64) WHERE generation_id='elg_hard_authority';
    RAISE EXCEPTION 'AUTHORITY_SEALED_UPDATE_UNEXPECTEDLY_ACCEPTED';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
END
$seal_guards$;

ROLLBACK;
SQL

echo 'FNS_REGISTRY_STATEMENT_GUARD=PASS'
echo 'FNS_REGISTRY_RECORDSET_DIGEST_V2=PASS'
