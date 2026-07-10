CREATE SCHEMA IF NOT EXISTS reconciliation;
REVOKE ALL ON SCHEMA reconciliation FROM PUBLIC;

CREATE TABLE IF NOT EXISTS reconciliation.statement_batches (
  id                 TEXT        PRIMARY KEY,
  partner_id         TEXT        NOT NULL,
  cursor_value       TEXT        NOT NULL,
  statement_hash     TEXT        NOT NULL,
  imported_by        TEXT        NOT NULL,
  imported_at        TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  record_count       INTEGER     NOT NULL DEFAULT 0,
  matched_count      INTEGER     NOT NULL DEFAULT 0,
  mismatch_count     INTEGER     NOT NULL DEFAULT 0,
  status             TEXT        NOT NULL DEFAULT 'COMPLETE',
  CONSTRAINT statement_batches_partner_check CHECK (length(partner_id) BETWEEN 1 AND 96),
  CONSTRAINT statement_batches_cursor_check CHECK (length(cursor_value) BETWEEN 1 AND 240),
  CONSTRAINT statement_batches_hash_check CHECK (statement_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT statement_batches_actor_check CHECK (length(imported_by) BETWEEN 1 AND 160),
  CONSTRAINT statement_batches_counts_check CHECK (
    record_count >= 0 AND matched_count >= 0 AND mismatch_count >= 0
    AND matched_count + mismatch_count <= record_count
  ),
  CONSTRAINT statement_batches_status_check CHECK (status IN ('COMPLETE', 'MANUAL_REVIEW')),
  CONSTRAINT statement_batches_partner_hash_unique UNIQUE (partner_id, statement_hash),
  CONSTRAINT statement_batches_partner_cursor_unique UNIQUE (partner_id, cursor_value)
);

CREATE INDEX IF NOT EXISTS statement_batches_imported_idx
  ON reconciliation.statement_batches (partner_id, imported_at DESC);

CREATE TABLE IF NOT EXISTS reconciliation.statement_records (
  id                 TEXT        PRIMARY KEY,
  batch_id           TEXT        NOT NULL REFERENCES reconciliation.statement_batches(id) ON DELETE RESTRICT,
  external_ref       TEXT        NOT NULL,
  value_date         DATE        NOT NULL,
  amount_kopecks     BIGINT      NOT NULL,
  currency           TEXT        NOT NULL,
  counterparty_hash  TEXT,
  description_hash   TEXT        NOT NULL,
  raw_hash           TEXT        NOT NULL,
  match_status       TEXT        NOT NULL,
  payment_id         TEXT,
  deal_id            TEXT,
  mismatch_code      TEXT,
  evidence_hash      TEXT        NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT statement_records_id_check CHECK (id ~ '^recon_[a-f0-9]{64}$'),
  CONSTRAINT statement_records_ref_check CHECK (length(external_ref) BETWEEN 1 AND 240),
  CONSTRAINT statement_records_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT statement_records_counterparty_hash_check CHECK (
    counterparty_hash IS NULL OR counterparty_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT statement_records_description_hash_check CHECK (description_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT statement_records_raw_hash_check CHECK (raw_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT statement_records_status_check CHECK (match_status IN ('MATCHED', 'UNMATCHED', 'MISMATCH')),
  CONSTRAINT statement_records_evidence_hash_check CHECK (evidence_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS statement_records_batch_idx
  ON reconciliation.statement_records (batch_id, created_at, id);
CREATE INDEX IF NOT EXISTS statement_records_match_idx
  ON reconciliation.statement_records (match_status, created_at);

CREATE TABLE IF NOT EXISTS reconciliation.manual_match_decisions (
  id                 BIGSERIAL   PRIMARY KEY,
  record_id          TEXT        NOT NULL REFERENCES reconciliation.statement_records(id) ON DELETE RESTRICT,
  deal_id            TEXT        NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
  actor_user_id      TEXT        NOT NULL,
  reason_hash        TEXT        NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT manual_match_actor_check CHECK (length(actor_user_id) BETWEEN 1 AND 160),
  CONSTRAINT manual_match_reason_hash_check CHECK (reason_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS manual_match_record_idx
  ON reconciliation.manual_match_decisions (record_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS reconciliation.checkpoints (
  partner_id         TEXT        PRIMARY KEY,
  cursor_value       TEXT        NOT NULL,
  statement_hash     TEXT        NOT NULL,
  version            BIGINT      NOT NULL DEFAULT 1,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT checkpoints_partner_check CHECK (length(partner_id) BETWEEN 1 AND 96),
  CONSTRAINT checkpoints_cursor_check CHECK (length(cursor_value) BETWEEN 1 AND 240),
  CONSTRAINT checkpoints_hash_check CHECK (statement_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT checkpoints_version_check CHECK (version >= 1)
);

CREATE OR REPLACE FUNCTION reconciliation.record_statement_batch(
  p_partner_id TEXT,
  p_cursor_value TEXT,
  p_statement_hash TEXT,
  p_actor_user_id TEXT,
  p_records JSONB
)
RETURNS TABLE (
  batch_id TEXT,
  duplicate BOOLEAN,
  imported_count INTEGER,
  matched_count INTEGER,
  mismatch_count INTEGER,
  checkpoint_version BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, reconciliation
AS $record_statement$
DECLARE
  v_partner TEXT := trim(p_partner_id);
  v_cursor TEXT := trim(p_cursor_value);
  v_actor TEXT := trim(p_actor_user_id);
  v_batch_id TEXT;
  v_inserted INTEGER := 0;
  v_record_count INTEGER;
  v_matched_count INTEGER;
  v_mismatch_count INTEGER;
  v_checkpoint reconciliation.checkpoints%ROWTYPE;
  v_checkpoint_version BIGINT;
BEGIN
  IF length(v_partner) NOT BETWEEN 1 AND 96 OR v_partner !~ '^[A-Za-z0-9:_-]+$' THEN
    RAISE EXCEPTION 'invalid reconciliation partner id' USING ERRCODE = '22023';
  END IF;
  IF length(v_cursor) NOT BETWEEN 1 AND 240 OR v_cursor ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'invalid reconciliation cursor' USING ERRCODE = '22023';
  END IF;
  IF p_statement_hash IS NULL OR p_statement_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid statement hash' USING ERRCODE = '22023';
  END IF;
  IF length(v_actor) NOT BETWEEN 1 AND 160 OR v_actor ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'invalid reconciliation actor' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_records) <> 'array' OR jsonb_array_length(p_records) < 1 OR jsonb_array_length(p_records) > 5000 THEN
    RAISE EXCEPTION 'invalid reconciliation record batch' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_checkpoint
  FROM reconciliation.checkpoints
  WHERE partner_id = v_partner
  FOR UPDATE;
  IF FOUND AND v_checkpoint.cursor_value = v_cursor AND v_checkpoint.statement_hash <> p_statement_hash THEN
    RAISE EXCEPTION 'reconciliation cursor collision' USING ERRCODE = '23505';
  END IF;

  v_batch_id := 'batch_' || encode(digest(v_partner || ':' || p_statement_hash, 'sha256'), 'hex');
  SELECT
    jsonb_array_length(p_records),
    count(*) FILTER (WHERE item->>'matchStatus' = 'MATCHED'),
    count(*) FILTER (WHERE item->>'matchStatus' <> 'MATCHED')
  INTO v_record_count, v_matched_count, v_mismatch_count
  FROM jsonb_array_elements(p_records) AS item;

  INSERT INTO reconciliation.statement_batches (
    id, partner_id, cursor_value, statement_hash, imported_by,
    record_count, matched_count, mismatch_count,
    status
  ) VALUES (
    v_batch_id, v_partner, v_cursor, p_statement_hash, v_actor,
    v_record_count, v_matched_count, v_mismatch_count,
    CASE WHEN v_mismatch_count > 0 THEN 'MANUAL_REVIEW' ELSE 'COMPLETE' END
  )
  ON CONFLICT (partner_id, statement_hash) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT id, record_count, matched_count, mismatch_count
    INTO v_batch_id, v_record_count, v_matched_count, v_mismatch_count
    FROM reconciliation.statement_batches
    WHERE partner_id = v_partner AND statement_hash = p_statement_hash;
    SELECT version INTO v_checkpoint_version
    FROM reconciliation.checkpoints
    WHERE partner_id = v_partner;
    RETURN QUERY SELECT v_batch_id, TRUE, v_record_count, v_matched_count, v_mismatch_count, COALESCE(v_checkpoint_version, 0);
    RETURN;
  END IF;

  INSERT INTO reconciliation.statement_records (
    id, batch_id, external_ref, value_date, amount_kopecks, currency,
    counterparty_hash, description_hash, raw_hash, match_status,
    payment_id, deal_id, mismatch_code, evidence_hash
  )
  SELECT
    item->>'id',
    v_batch_id,
    item->>'externalRef',
    (item->>'valueDate')::date,
    (item->>'amountKopecks')::bigint,
    item->>'currency',
    NULLIF(item->>'counterpartyHash', ''),
    item->>'descriptionHash',
    item->>'rawHash',
    item->>'matchStatus',
    NULLIF(item->>'paymentId', ''),
    NULLIF(item->>'dealId', ''),
    NULLIF(item->>'mismatchCode', ''),
    item->>'evidenceHash'
  FROM jsonb_array_elements(p_records) AS item;

  INSERT INTO reconciliation.checkpoints (
    partner_id, cursor_value, statement_hash, version, updated_at
  ) VALUES (
    v_partner, v_cursor, p_statement_hash, 1, clock_timestamp()
  )
  ON CONFLICT (partner_id)
  DO UPDATE SET
    cursor_value = EXCLUDED.cursor_value,
    statement_hash = EXCLUDED.statement_hash,
    version = reconciliation.checkpoints.version + 1,
    updated_at = clock_timestamp()
  RETURNING version INTO v_checkpoint_version;

  RETURN QUERY SELECT v_batch_id, FALSE, v_record_count, v_matched_count, v_mismatch_count, v_checkpoint_version;
END
$record_statement$;

CREATE OR REPLACE FUNCTION reconciliation.record_manual_match(
  p_record_id TEXT,
  p_deal_id TEXT,
  p_actor_user_id TEXT,
  p_reason_hash TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, reconciliation
AS $manual_match$
DECLARE
  v_decision_id BIGINT;
BEGIN
  IF p_reason_hash IS NULL OR p_reason_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid reconciliation reason hash' USING ERRCODE = '22023';
  END IF;
  IF length(trim(p_actor_user_id)) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'invalid reconciliation actor' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM reconciliation.statement_records
    WHERE id = p_record_id AND match_status IN ('UNMATCHED', 'MISMATCH')
  ) THEN
    RAISE EXCEPTION 'record is not eligible for manual match' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.deals WHERE id = p_deal_id) THEN
    RAISE EXCEPTION 'deal not found for reconciliation match' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO reconciliation.manual_match_decisions (
    record_id, deal_id, actor_user_id, reason_hash
  ) VALUES (
    p_record_id, p_deal_id, trim(p_actor_user_id), p_reason_hash
  ) RETURNING id INTO v_decision_id;
  RETURN v_decision_id;
END
$manual_match$;

CREATE OR REPLACE FUNCTION reconciliation.list_statement_records(
  p_partner_id TEXT,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_unmatched_only BOOLEAN,
  p_limit INTEGER,
  p_offset INTEGER
)
RETURNS TABLE (
  id TEXT,
  batch_id TEXT,
  external_ref TEXT,
  value_date DATE,
  amount_kopecks BIGINT,
  currency TEXT,
  match_status TEXT,
  payment_id TEXT,
  deal_id TEXT,
  mismatch_code TEXT,
  evidence_hash TEXT,
  created_at TIMESTAMPTZ,
  manual_decision_id BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public, reconciliation
AS $list_records$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 OR p_offset IS NULL OR p_offset < 0 OR p_offset > 1000000 THEN
    RAISE EXCEPTION 'invalid reconciliation pagination' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT
    record.id,
    record.batch_id,
    record.external_ref,
    record.value_date,
    record.amount_kopecks,
    record.currency,
    CASE WHEN decision.id IS NOT NULL THEN 'MANUAL' ELSE record.match_status END,
    record.payment_id,
    COALESCE(decision.deal_id, record.deal_id),
    record.mismatch_code,
    record.evidence_hash,
    record.created_at,
    decision.id
  FROM reconciliation.statement_records AS record
  JOIN reconciliation.statement_batches AS batch ON batch.id = record.batch_id
  LEFT JOIN LATERAL (
    SELECT d.id, d.deal_id
    FROM reconciliation.manual_match_decisions AS d
    WHERE d.record_id = record.id
    ORDER BY d.created_at DESC, d.id DESC
    LIMIT 1
  ) AS decision ON TRUE
  WHERE batch.partner_id = trim(p_partner_id)
    AND record.created_at >= COALESCE(p_from, '-infinity'::timestamptz)
    AND record.created_at <= COALESCE(p_to, 'infinity'::timestamptz)
    AND (
      NOT COALESCE(p_unmatched_only, FALSE)
      OR (decision.id IS NULL AND record.match_status IN ('UNMATCHED', 'MISMATCH'))
    )
  ORDER BY record.created_at DESC, record.id DESC
  LIMIT p_limit OFFSET p_offset;
END
$list_records$;

CREATE OR REPLACE FUNCTION reconciliation.get_reconciliation_checkpoint(p_partner_id TEXT)
RETURNS TABLE (
  partner_id TEXT,
  cursor_value TEXT,
  statement_hash TEXT,
  version BIGINT,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, reconciliation
AS $checkpoint$
  SELECT partner_id, cursor_value, statement_hash, version, updated_at
  FROM reconciliation.checkpoints
  WHERE partner_id = trim(p_partner_id)
$checkpoint$;

REVOKE ALL ON ALL TABLES IN SCHEMA reconciliation FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA reconciliation FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA reconciliation FROM PUBLIC;

DO $reconciliation_grants$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'app_api'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA reconciliation TO %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA reconciliation FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA reconciliation FROM %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION reconciliation.record_statement_batch(TEXT,TEXT,TEXT,TEXT,JSONB) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION reconciliation.record_manual_match(TEXT,TEXT,TEXT,TEXT) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION reconciliation.list_statement_records(TEXT,TIMESTAMPTZ,TIMESTAMPTZ,BOOLEAN,INTEGER,INTEGER) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION reconciliation.get_reconciliation_checkpoint(TEXT) TO %I', role_name);
    END IF;
  END LOOP;
END
$reconciliation_grants$;
