CREATE OR REPLACE FUNCTION reconciliation.get_reconciliation_report(
  p_partner_id TEXT,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS TABLE (
  total_imported BIGINT,
  total_matched BIGINT,
  total_unmatched BIGINT,
  matched_amount_kopecks NUMERIC,
  unmatched_amount_kopecks NUMERIC,
  batch_count BIGINT,
  latest_checkpoint_cursor TEXT,
  checkpoint_version BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public, reconciliation
AS $report$
  WITH effective AS (
    SELECT
      record.amount_kopecks,
      CASE WHEN decision.id IS NOT NULL THEN 'MANUAL' ELSE record.match_status END AS effective_status
    FROM reconciliation.statement_records AS record
    JOIN reconciliation.statement_batches AS batch ON batch.id = record.batch_id
    LEFT JOIN LATERAL (
      SELECT d.id
      FROM reconciliation.manual_match_decisions AS d
      WHERE d.record_id = record.id
      ORDER BY d.created_at DESC, d.id DESC
      LIMIT 1
    ) AS decision ON TRUE
    WHERE batch.partner_id = trim(p_partner_id)
      AND record.created_at >= COALESCE(p_from, '-infinity'::timestamptz)
      AND record.created_at <= COALESCE(p_to, 'infinity'::timestamptz)
  ), batches AS (
    SELECT count(*)::bigint AS batch_count
    FROM reconciliation.statement_batches
    WHERE partner_id = trim(p_partner_id)
      AND imported_at >= COALESCE(p_from, '-infinity'::timestamptz)
      AND imported_at <= COALESCE(p_to, 'infinity'::timestamptz)
  )
  SELECT
    count(*)::bigint,
    count(*) FILTER (WHERE effective_status IN ('MATCHED', 'MANUAL'))::bigint,
    count(*) FILTER (WHERE effective_status NOT IN ('MATCHED', 'MANUAL'))::bigint,
    COALESCE(sum(amount_kopecks) FILTER (WHERE effective_status IN ('MATCHED', 'MANUAL')), 0)::numeric,
    COALESCE(sum(amount_kopecks) FILTER (WHERE effective_status NOT IN ('MATCHED', 'MANUAL')), 0)::numeric,
    batches.batch_count,
    checkpoint.cursor_value,
    checkpoint.version
  FROM effective
  CROSS JOIN batches
  LEFT JOIN reconciliation.checkpoints AS checkpoint ON checkpoint.partner_id = trim(p_partner_id)
  GROUP BY batches.batch_count, checkpoint.cursor_value, checkpoint.version
$report$;

REVOKE ALL ON FUNCTION reconciliation.get_reconciliation_report(TEXT,TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC;

DO $report_grants$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'app_api'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION reconciliation.get_reconciliation_report(TEXT,TIMESTAMPTZ,TIMESTAMPTZ) TO %I',
        role_name
      );
    END IF;
  END LOOP;
END
$report_grants$;
