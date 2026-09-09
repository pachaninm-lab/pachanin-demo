-- #5064: production hardening for FNS registry record mutation and corpus hashing.
-- Supersedes the per-row registry_records guard installed by the preceding
-- coverage-authority migration. Final schema performs expensive generation/
-- seal checks once per statement while retaining a tiny row-level identity guard.

CREATE OR REPLACE FUNCTION eligibility.compute_registry_recordset_sha256(p_generation_id TEXT)
RETURNS CHAR(64)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, eligibility
AS $function$
  WITH canonical AS MATERIALIZED (
    SELECT
      (row_number() OVER (
        ORDER BY source_record_id,record_type,payload_sha256,id
      ) - 1)::bigint AS rn,
      jsonb_build_array(
        source_record_id,record_type,payload_sha256,subject_inn,subject_ogrn
      )::text AS row_text
    FROM eligibility.registry_records
    WHERE generation_id=p_generation_id
  ),
  buckets AS MATERIALIZED (
    SELECT
      (rn / 4096)::bigint AS bucket_no,
      count(*)::bigint AS bucket_rows,
      encode(
        public.digest(
          convert_to(string_agg(row_text,E'\n' ORDER BY rn),'UTF8'),
          'sha256'
        ),
        'hex'
      ) AS bucket_sha256
    FROM canonical
    GROUP BY (rn / 4096)::bigint
  ),
  manifest AS (
    SELECT COALESCE(
      string_agg(
        jsonb_build_array(bucket_no,bucket_rows,bucket_sha256)::text,
        E'\n' ORDER BY bucket_no
      ),
      ''
    ) AS bucket_manifest
    FROM buckets
  )
  SELECT encode(
    public.digest(
      convert_to(
        'role-eligibility.registry-recordset.v2' || E'\n' || bucket_manifest,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )::CHAR(64)
  FROM manifest
$function$;
REVOKE ALL ON FUNCTION eligibility.compute_registry_recordset_sha256(TEXT) FROM PUBLIC;

-- Lock/check each distinct generation exactly once per DML statement. The lock
-- is retained to transaction end, serializing validation/lineage sealing against
-- the record mutation without multiplying catalog reads by corpus cardinality.
CREATE OR REPLACE FUNCTION eligibility.assert_registry_record_mutation_targets(
  p_generation_ids TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, eligibility
AS $function$
DECLARE
  requested_count INTEGER := 0;
  locked_count INTEGER := 0;
BEGIN
  SELECT count(*)::integer INTO requested_count
  FROM (
    SELECT DISTINCT generation_id
    FROM unnest(COALESCE(p_generation_ids,ARRAY[]::TEXT[])) AS u(generation_id)
    WHERE generation_id IS NOT NULL
  ) AS requested;

  IF requested_count = 0 THEN
    RETURN;
  END IF;

  PERFORM g.id
  FROM eligibility.registry_generations AS g
  JOIN (
    SELECT DISTINCT generation_id
    FROM unnest(p_generation_ids) AS u(generation_id)
    WHERE generation_id IS NOT NULL
  ) AS requested ON requested.generation_id=g.id
  ORDER BY g.id
  FOR SHARE;
  GET DIAGNOSTICS locked_count = ROW_COUNT;

  IF locked_count <> requested_count THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='registry record generation is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM eligibility.registry_generations AS g
    WHERE g.id=ANY(p_generation_ids) AND g.status <> 'STAGING'
  ) THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='registry records are immutable outside STAGING';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM eligibility.registry_generation_lineage AS l
    WHERE l.generation_id=ANY(p_generation_ids)
  ) THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='registry records are immutable after composition seal';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM eligibility.registry_generation_authority AS a
    WHERE a.generation_id=ANY(p_generation_ids)
  ) THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='registry records are immutable after authority materialization';
  END IF;
END
$function$;
REVOKE ALL ON FUNCTION eligibility.assert_registry_record_mutation_targets(TEXT[]) FROM PUBLIC;

CREATE OR REPLACE FUNCTION eligibility.guard_registry_record_generation_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, eligibility
AS $function$
BEGIN
  IF NEW.generation_id IS DISTINCT FROM OLD.generation_id THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='registry record generation identity is immutable';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION eligibility.guard_registry_record_generation_identity() FROM PUBLIC;

CREATE OR REPLACE FUNCTION eligibility.guard_registry_record_insert_statement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, eligibility
AS $function$
DECLARE
  generation_ids TEXT[];
BEGIN
  SELECT array_agg(DISTINCT generation_id) INTO generation_ids FROM new_rows;
  PERFORM eligibility.assert_registry_record_mutation_targets(generation_ids);
  RETURN NULL;
END
$function$;
REVOKE ALL ON FUNCTION eligibility.guard_registry_record_insert_statement() FROM PUBLIC;

CREATE OR REPLACE FUNCTION eligibility.guard_registry_record_update_statement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, eligibility
AS $function$
DECLARE
  generation_ids TEXT[];
BEGIN
  SELECT array_agg(DISTINCT generation_id) INTO generation_ids
  FROM (
    SELECT generation_id FROM old_rows
    UNION
    SELECT generation_id FROM new_rows
  ) AS touched;
  PERFORM eligibility.assert_registry_record_mutation_targets(generation_ids);
  RETURN NULL;
END
$function$;
REVOKE ALL ON FUNCTION eligibility.guard_registry_record_update_statement() FROM PUBLIC;

CREATE OR REPLACE FUNCTION eligibility.guard_registry_record_delete_statement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, eligibility
AS $function$
DECLARE
  generation_ids TEXT[];
BEGIN
  SELECT array_agg(DISTINCT generation_id) INTO generation_ids FROM old_rows;
  PERFORM eligibility.assert_registry_record_mutation_targets(generation_ids);
  RETURN NULL;
END
$function$;
REVOKE ALL ON FUNCTION eligibility.guard_registry_record_delete_statement() FROM PUBLIC;

DROP TRIGGER IF EXISTS registry_records_mutation_guard ON eligibility.registry_records;
DROP FUNCTION IF EXISTS eligibility.guard_registry_record_mutation();

DROP TRIGGER IF EXISTS registry_records_generation_identity_guard ON eligibility.registry_records;
CREATE TRIGGER registry_records_generation_identity_guard
BEFORE UPDATE ON eligibility.registry_records
FOR EACH ROW EXECUTE FUNCTION eligibility.guard_registry_record_generation_identity();

DROP TRIGGER IF EXISTS registry_records_insert_statement_guard ON eligibility.registry_records;
CREATE TRIGGER registry_records_insert_statement_guard
AFTER INSERT ON eligibility.registry_records
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION eligibility.guard_registry_record_insert_statement();

DROP TRIGGER IF EXISTS registry_records_update_statement_guard ON eligibility.registry_records;
CREATE TRIGGER registry_records_update_statement_guard
AFTER UPDATE ON eligibility.registry_records
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION eligibility.guard_registry_record_update_statement();

DROP TRIGGER IF EXISTS registry_records_delete_statement_guard ON eligibility.registry_records;
CREATE TRIGGER registry_records_delete_statement_guard
AFTER DELETE ON eligibility.registry_records
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION eligibility.guard_registry_record_delete_statement();
