-- IR-10.4 Settlement PostgreSQL Authority.
-- Money authority is normalized in the settlement schema. Public payment,
-- bank-operation and ledger tables remain compatibility projections only.

CREATE SCHEMA IF NOT EXISTS settlement;
REVOKE ALL ON SCHEMA settlement FROM PUBLIC;

-- Legacy float rubles are backfilled once. The compatibility column remains
-- physically present because production migrations are forward-only; no
-- authoritative Settlement code reads or writes it after this migration.
UPDATE public."payments"
SET "amountKopecks" = ROUND("amountRub"::numeric * 100)::bigint
WHERE "amountKopecks" IS NULL AND "amountRub" IS NOT NULL;

CREATE TABLE settlement.payment_terms (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  version BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RUB',
  reserve_amount_minor BIGINT NOT NULL,
  release_basis JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  supersedes_id TEXT,
  command_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_fingerprint TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_by_org_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT settlement_terms_deal_fkey
    FOREIGN KEY (deal_id) REFERENCES public."deals"("id") ON DELETE RESTRICT,
  CONSTRAINT settlement_terms_supersedes_fkey
    FOREIGN KEY (supersedes_id) REFERENCES settlement.payment_terms(id) ON DELETE RESTRICT,
  CONSTRAINT settlement_terms_deal_version_key UNIQUE (tenant_id, deal_id, version),
  CONSTRAINT settlement_terms_amount_positive CHECK (reserve_amount_minor > 0),
  CONSTRAINT settlement_terms_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT settlement_terms_status_check CHECK (status IN ('ACTIVE','SUPERSEDED')),
  CONSTRAINT settlement_terms_fingerprint_check CHECK (request_fingerprint ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX settlement_terms_one_active_key
  ON settlement.payment_terms (tenant_id, deal_id) WHERE status = 'ACTIVE';
CREATE INDEX settlement_terms_deal_idx ON settlement.payment_terms (tenant_id, deal_id, created_at);

CREATE TABLE settlement.beneficiaries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  payment_terms_id TEXT NOT NULL,
  beneficiary_org_id TEXT NOT NULL,
  beneficiary_role TEXT NOT NULL,
  allocation_minor BIGINT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  destination_ref TEXT NOT NULL,
  command_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT settlement_beneficiary_deal_fkey
    FOREIGN KEY (deal_id) REFERENCES public."deals"("id") ON DELETE RESTRICT,
  CONSTRAINT settlement_beneficiary_terms_fkey
    FOREIGN KEY (payment_terms_id) REFERENCES settlement.payment_terms(id) ON DELETE RESTRICT,
  CONSTRAINT settlement_beneficiary_org_fkey
    FOREIGN KEY (beneficiary_org_id) REFERENCES public."organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT settlement_beneficiary_terms_org_key UNIQUE (payment_terms_id, beneficiary_org_id, beneficiary_role),
  CONSTRAINT settlement_beneficiary_amount_positive CHECK (allocation_minor > 0),
  CONSTRAINT settlement_beneficiary_priority_nonnegative CHECK (priority >= 0),
  CONSTRAINT settlement_beneficiary_role_check CHECK (beneficiary_role IN ('SELLER','CARRIER','PLATFORM','TAX','OTHER'))
);
CREATE INDEX settlement_beneficiary_deal_idx ON settlement.beneficiaries (tenant_id, deal_id, priority, id);

CREATE TABLE settlement.payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL UNIQUE,
  payment_terms_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'TERMS_ACTIVE',
  currency TEXT NOT NULL DEFAULT 'RUB',
  confirmed_reserved_minor BIGINT NOT NULL DEFAULT 0,
  pending_reserved_minor BIGINT NOT NULL DEFAULT 0,
  confirmed_released_minor BIGINT NOT NULL DEFAULT 0,
  pending_released_minor BIGINT NOT NULL DEFAULT 0,
  confirmed_refunded_minor BIGINT NOT NULL DEFAULT 0,
  pending_refunded_minor BIGINT NOT NULL DEFAULT 0,
  active_hold_minor BIGINT NOT NULL DEFAULT 0,
  reconciliation_status TEXT NOT NULL DEFAULT 'UNRECONCILED',
  manual_review_reason TEXT,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT settlement_payment_deal_fkey
    FOREIGN KEY (deal_id) REFERENCES public."deals"("id") ON DELETE RESTRICT,
  CONSTRAINT settlement_payment_terms_fkey
    FOREIGN KEY (payment_terms_id) REFERENCES settlement.payment_terms(id) ON DELETE RESTRICT,
  CONSTRAINT settlement_payment_status_check CHECK (status IN (
    'TERMS_ACTIVE','RESERVE_PENDING','RESERVED','RELEASE_PENDING','PARTIALLY_RELEASED',
    'RELEASED','REFUND_PENDING','PARTIALLY_REFUNDED','REFUNDED','HOLD_ACTIVE',
    'FAILED','MANUAL_REVIEW'
  )),
  CONSTRAINT settlement_payment_reconciliation_check CHECK (reconciliation_status IN ('UNRECONCILED','MATCHED','MANUAL_REVIEW')),
  CONSTRAINT settlement_payment_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT settlement_payment_nonnegative CHECK (
    confirmed_reserved_minor >= 0 AND pending_reserved_minor >= 0
    AND confirmed_released_minor >= 0 AND pending_released_minor >= 0
    AND confirmed_refunded_minor >= 0 AND pending_refunded_minor >= 0
    AND active_hold_minor >= 0
  ),
  CONSTRAINT settlement_payment_bounds CHECK (
    confirmed_released_minor + pending_released_minor
      + confirmed_refunded_minor + pending_refunded_minor
      + active_hold_minor <= confirmed_reserved_minor
  )
);
CREATE INDEX settlement_payment_tenant_status_idx ON settlement.payments (tenant_id, status, updated_at);

CREATE TABLE settlement.holds (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  amount_minor BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  basis_type TEXT NOT NULL,
  basis_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  command_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_fingerprint TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  released_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT settlement_hold_deal_fkey
    FOREIGN KEY (deal_id) REFERENCES public."deals"("id") ON DELETE RESTRICT,
  CONSTRAINT settlement_hold_payment_fkey
    FOREIGN KEY (payment_id) REFERENCES settlement.payments(id) ON DELETE RESTRICT,
  CONSTRAINT settlement_hold_amount_positive CHECK (amount_minor > 0),
  CONSTRAINT settlement_hold_status_check CHECK (status IN ('ACTIVE','RELEASED')),
  CONSTRAINT settlement_hold_fingerprint_check CHECK (request_fingerprint ~ '^[0-9a-f]{64}$')
);
CREATE INDEX settlement_hold_active_idx ON settlement.holds (tenant_id, deal_id, status, created_at);

CREATE TABLE settlement.bank_operations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  payment_terms_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  amount_minor BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RUB',
  beneficiary_id TEXT,
  required_partner_id TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  command_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  expected_payment_version BIGINT NOT NULL,
  bank_ref TEXT,
  failure_reason TEXT,
  callback_event_id TEXT,
  callback_key_id TEXT,
  callback_payload_fingerprint TEXT,
  request_payload JSONB NOT NULL,
  response_payload JSONB,
  initiated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  CONSTRAINT settlement_operation_deal_fkey
    FOREIGN KEY (deal_id) REFERENCES public."deals"("id") ON DELETE RESTRICT,
  CONSTRAINT settlement_operation_payment_fkey
    FOREIGN KEY (payment_id) REFERENCES settlement.payments(id) ON DELETE RESTRICT,
  CONSTRAINT settlement_operation_terms_fkey
    FOREIGN KEY (payment_terms_id) REFERENCES settlement.payment_terms(id) ON DELETE RESTRICT,
  CONSTRAINT settlement_operation_beneficiary_fkey
    FOREIGN KEY (beneficiary_id) REFERENCES settlement.beneficiaries(id) ON DELETE RESTRICT,
  CONSTRAINT settlement_operation_type_check CHECK (operation_type IN ('RESERVE','RELEASE','REFUND')),
  CONSTRAINT settlement_operation_status_check CHECK (status IN ('PENDING','CONFIRMED','FAILED','MANUAL_REVIEW')),
  CONSTRAINT settlement_operation_amount_positive CHECK (amount_minor > 0),
  CONSTRAINT settlement_operation_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT settlement_operation_request_fingerprint_check CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT settlement_operation_callback_fingerprint_check CHECK (
    callback_payload_fingerprint IS NULL OR callback_payload_fingerprint ~ '^[0-9a-f]{64}$'
  )
);
CREATE INDEX settlement_operation_lookup_idx
  ON settlement.bank_operations (tenant_id, deal_id, operation_type, status, created_at);
CREATE UNIQUE INDEX settlement_operation_callback_event_key
  ON settlement.bank_operations (required_partner_id, callback_event_id)
  WHERE callback_event_id IS NOT NULL;

CREATE TABLE settlement.bank_callbacks (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  partner_id TEXT NOT NULL,
  key_id TEXT NOT NULL,
  callback_status TEXT NOT NULL,
  payload_fingerprint TEXT NOT NULL,
  bank_ref TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT settlement_callback_operation_fkey
    FOREIGN KEY (operation_id) REFERENCES settlement.bank_operations(id) ON DELETE RESTRICT,
  CONSTRAINT settlement_callback_event_key UNIQUE (partner_id, event_id),
  CONSTRAINT settlement_callback_status_check CHECK (callback_status IN ('SUCCESS','FAILED')),
  CONSTRAINT settlement_callback_fingerprint_check CHECK (payload_fingerprint ~ '^[0-9a-f]{64}$')
);
CREATE INDEX settlement_callback_deal_idx ON settlement.bank_callbacks (tenant_id, deal_id, received_at);

CREATE TABLE settlement.ledger_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  debit_account TEXT NOT NULL,
  credit_account TEXT NOT NULL,
  amount_minor BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RUB',
  idempotency_key TEXT NOT NULL UNIQUE,
  prev_hash TEXT,
  hash TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT settlement_ledger_deal_fkey
    FOREIGN KEY (deal_id) REFERENCES public."deals"("id") ON DELETE RESTRICT,
  CONSTRAINT settlement_ledger_payment_fkey
    FOREIGN KEY (payment_id) REFERENCES settlement.payments(id) ON DELETE RESTRICT,
  CONSTRAINT settlement_ledger_operation_fkey
    FOREIGN KEY (operation_id) REFERENCES settlement.bank_operations(id) ON DELETE RESTRICT,
  CONSTRAINT settlement_ledger_type_check CHECK (entry_type IN ('RESERVE','RELEASE','REFUND')),
  CONSTRAINT settlement_ledger_amount_positive CHECK (amount_minor > 0),
  CONSTRAINT settlement_ledger_accounts_distinct CHECK (debit_account <> credit_account),
  CONSTRAINT settlement_ledger_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT settlement_ledger_prev_hash_check CHECK (prev_hash IS NULL OR prev_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT settlement_ledger_hash_check CHECK (hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX settlement_ledger_chain_idx ON settlement.ledger_entries (tenant_id, deal_id, created_at, id);

CREATE TABLE settlement.reconciliation_facts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  statement_entry_id TEXT,
  verdict TEXT NOT NULL,
  expected_amount_minor BIGINT NOT NULL,
  observed_amount_minor BIGINT NOT NULL,
  reason TEXT,
  payload_fingerprint TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT settlement_reconciliation_operation_fkey
    FOREIGN KEY (operation_id) REFERENCES settlement.bank_operations(id) ON DELETE RESTRICT,
  CONSTRAINT settlement_reconciliation_statement_fkey
    FOREIGN KEY (statement_entry_id) REFERENCES public."bank_statement_entries"("id") ON DELETE RESTRICT,
  CONSTRAINT settlement_reconciliation_verdict_check CHECK (verdict IN ('MATCH','MISMATCH')),
  CONSTRAINT settlement_reconciliation_amounts_nonnegative CHECK (
    expected_amount_minor >= 0 AND observed_amount_minor >= 0
  ),
  CONSTRAINT settlement_reconciliation_fingerprint_check CHECK (payload_fingerprint ~ '^[0-9a-f]{64}$')
);
CREATE INDEX settlement_reconciliation_deal_idx
  ON settlement.reconciliation_facts (tenant_id, deal_id, created_at);

CREATE OR REPLACE FUNCTION settlement.context_ready()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT
    NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL
    AND NULLIF(current_setting('app.current_org_id', true), '') IS NOT NULL
    AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
    AND NULLIF(current_setting('app.current_role', true), '') IS NOT NULL
    AND NULLIF(current_setting('app.current_session_id', true), '') IS NOT NULL
$function$;

CREATE OR REPLACE FUNCTION settlement.deal_authorized(p_deal_id TEXT, p_write BOOLEAN DEFAULT FALSE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, settlement
AS $function$
  SELECT settlement.context_ready()
    AND EXISTS (
      SELECT 1
      FROM public."deals" deal
      WHERE deal."id" = p_deal_id
        AND deal."tenantId" = current_setting('app.current_tenant_id', true)
        AND (
          current_setting('app.current_role', true) IN ('ADMIN','SUPPORT_MANAGER')
          OR (
            current_setting('app.current_role', true) = 'BANK_CALLBACK'
            AND deal."buyerOrgId" = current_setting('app.current_org_id', true)
          )
          OR EXISTS (
            SELECT 1
            FROM public."deal_participants" participant
            WHERE participant."dealId" = deal."id"
              AND participant."tenantId" = current_setting('app.current_tenant_id', true)
              AND participant."organizationId" = current_setting('app.current_org_id', true)
              AND participant."userId" = current_setting('app.current_user_id', true)
              AND participant."role" = current_setting('app.current_role', true)
              AND participant."status" = 'ACTIVE'
              AND participant."accessLevel" IN (
                CASE WHEN p_write THEN 'WORK' ELSE 'READ' END,
                CASE WHEN p_write THEN 'APPROVE' ELSE 'WORK' END,
                'APPROVE'
              )
          )
        )
        AND (
          NOT p_write
          OR current_setting('app.current_role', true) IN (
            'BUYER','ACCOUNTING','ADMIN','SUPPORT_MANAGER','BANK_CALLBACK','ARBITRATOR'
          )
        )
    )
$function$;

CREATE OR REPLACE FUNCTION public.app_bank_callback_scope(p_deal_id TEXT, p_operation_id TEXT)
RETURNS TABLE ("tenantId" TEXT, "buyerOrgId" TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, settlement
STABLE
AS $function$
  SELECT deal."tenantId", deal."buyerOrgId"
  FROM settlement.bank_operations operation
  JOIN public."deals" deal ON deal."id" = operation.deal_id
  WHERE operation.deal_id = p_deal_id
    AND operation.id = p_operation_id
    AND operation.status = 'PENDING'
    AND deal."tenantId" = operation.tenant_id
$function$;

CREATE OR REPLACE FUNCTION settlement.forbid_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION 'settlement fact % is append-only: % is forbidden', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '23514';
END
$function$;

CREATE OR REPLACE FUNCTION settlement.validate_beneficiary_total()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, settlement
AS $function$
DECLARE
  terms_id TEXT := COALESCE(NEW.payment_terms_id, OLD.payment_terms_id);
  allowed_amount BIGINT;
  allocated_amount BIGINT;
BEGIN
  SELECT reserve_amount_minor INTO allowed_amount
  FROM settlement.payment_terms WHERE id = terms_id;
  SELECT COALESCE(sum(allocation_minor), 0) INTO allocated_amount
  FROM settlement.beneficiaries WHERE payment_terms_id = terms_id;
  IF allocated_amount > allowed_amount THEN
    RAISE EXCEPTION 'beneficiary allocations exceed payment terms reserve'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END
$function$;
DROP TRIGGER IF EXISTS settlement_beneficiary_total_guard ON settlement.beneficiaries;
CREATE CONSTRAINT TRIGGER settlement_beneficiary_total_guard
AFTER INSERT ON settlement.beneficiaries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION settlement.validate_beneficiary_total();

CREATE OR REPLACE FUNCTION settlement.validate_payment_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, settlement
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.version <> 0 THEN
      RAISE EXCEPTION 'settlement payment must start at version zero' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.deal_id IS DISTINCT FROM OLD.deal_id
    OR NEW.payment_terms_id IS DISTINCT FROM OLD.payment_terms_id
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'settlement payment identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'settlement payment update requires exact CAS version increment' USING ERRCODE = '40001';
  END IF;
  IF NEW.confirmed_reserved_minor < OLD.confirmed_reserved_minor
    OR NEW.confirmed_released_minor < OLD.confirmed_released_minor
    OR NEW.confirmed_refunded_minor < OLD.confirmed_refunded_minor
  THEN
    RAISE EXCEPTION 'confirmed settlement counters are monotonic' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS settlement_payment_transition_guard ON settlement.payments;
CREATE TRIGGER settlement_payment_transition_guard
BEFORE INSERT OR UPDATE ON settlement.payments
FOR EACH ROW EXECUTE FUNCTION settlement.validate_payment_transition();

CREATE OR REPLACE FUNCTION settlement.validate_hold_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'settlement holds are lifecycle-managed and cannot be deleted' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.deal_id IS DISTINCT FROM OLD.deal_id
      OR NEW.payment_id IS DISTINCT FROM OLD.payment_id
      OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
      OR NEW.basis_type IS DISTINCT FROM OLD.basis_type
      OR NEW.basis_id IS DISTINCT FROM OLD.basis_id
      OR NEW.reason IS DISTINCT FROM OLD.reason
      OR NEW.command_id IS DISTINCT FROM OLD.command_id
      OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
      OR NEW.request_fingerprint IS DISTINCT FROM OLD.request_fingerprint
      OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'settlement hold identity and amount are immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.status <> 'ACTIVE' OR NEW.status <> 'RELEASED'
      OR NEW.released_at IS NULL OR NEW.released_by_user_id IS NULL
      OR NEW.version <> OLD.version + 1
    THEN
      RAISE EXCEPTION 'invalid settlement hold transition' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS settlement_hold_transition_guard ON settlement.holds;
CREATE TRIGGER settlement_hold_transition_guard
BEFORE UPDATE OR DELETE ON settlement.holds
FOR EACH ROW EXECUTE FUNCTION settlement.validate_hold_transition();

CREATE OR REPLACE FUNCTION settlement.validate_operation_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'settlement bank operations cannot be deleted' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.deal_id IS DISTINCT FROM OLD.deal_id
      OR NEW.payment_id IS DISTINCT FROM OLD.payment_id
      OR NEW.payment_terms_id IS DISTINCT FROM OLD.payment_terms_id
      OR NEW.operation_type IS DISTINCT FROM OLD.operation_type
      OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
      OR NEW.currency IS DISTINCT FROM OLD.currency
      OR NEW.beneficiary_id IS DISTINCT FROM OLD.beneficiary_id
      OR NEW.required_partner_id IS DISTINCT FROM OLD.required_partner_id
      OR NEW.request_fingerprint IS DISTINCT FROM OLD.request_fingerprint
      OR NEW.command_id IS DISTINCT FROM OLD.command_id
      OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
      OR NEW.expected_payment_version IS DISTINCT FROM OLD.expected_payment_version
      OR NEW.request_payload IS DISTINCT FROM OLD.request_payload
      OR NEW.initiated_by_user_id IS DISTINCT FROM OLD.initiated_by_user_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'bank operation request identity is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'PENDING' AND NEW.status IN ('CONFIRMED','FAILED') THEN
      IF current_setting('app.current_role', true) <> 'BANK_CALLBACK'
        OR NEW.callback_event_id IS NULL
        OR NEW.callback_key_id IS NULL
        OR NEW.callback_payload_fingerprint IS NULL
      THEN
        RAISE EXCEPTION 'only a verified bank callback can confirm or fail money movement'
          USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.status = 'MANUAL_REVIEW' AND OLD.status IN ('PENDING','CONFIRMED') THEN
      IF current_setting('app.current_role', true) NOT IN ('ACCOUNTING','ADMIN','SUPPORT_MANAGER') THEN
        RAISE EXCEPTION 'manual review transition requires settlement oversight role'
          USING ERRCODE = '42501';
      END IF;
    ELSE
      RAISE EXCEPTION 'invalid settlement bank operation transition from % to %', OLD.status, NEW.status
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS settlement_operation_transition_guard ON settlement.bank_operations;
CREATE TRIGGER settlement_operation_transition_guard
BEFORE UPDATE OR DELETE ON settlement.bank_operations
FOR EACH ROW EXECUTE FUNCTION settlement.validate_operation_transition();

CREATE OR REPLACE FUNCTION settlement.validate_callback_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, settlement
AS $function$
DECLARE
  operation settlement.bank_operations%ROWTYPE;
BEGIN
  IF current_setting('app.current_role', true) <> 'BANK_CALLBACK' THEN
    RAISE EXCEPTION 'settlement callbacks require verified bank actor' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO operation FROM settlement.bank_operations WHERE id = NEW.operation_id FOR UPDATE;
  IF NOT FOUND OR operation.status <> 'PENDING'
    OR operation.tenant_id <> NEW.tenant_id
    OR operation.deal_id <> NEW.deal_id
    OR operation.required_partner_id <> NEW.partner_id
  THEN
    RAISE EXCEPTION 'callback is not bound to the exact pending settlement operation'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS settlement_callback_insert_guard ON settlement.bank_callbacks;
CREATE TRIGGER settlement_callback_insert_guard
BEFORE INSERT ON settlement.bank_callbacks
FOR EACH ROW EXECUTE FUNCTION settlement.validate_callback_insert();
DROP TRIGGER IF EXISTS settlement_callback_append_only ON settlement.bank_callbacks;
CREATE TRIGGER settlement_callback_append_only
BEFORE UPDATE OR DELETE ON settlement.bank_callbacks
FOR EACH ROW EXECUTE FUNCTION settlement.forbid_mutation();

CREATE OR REPLACE FUNCTION settlement.validate_ledger_chain()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, settlement
AS $function$
DECLARE
  previous_hash TEXT;
BEGIN
  SELECT hash INTO previous_hash
  FROM settlement.ledger_entries
  WHERE tenant_id = NEW.tenant_id AND deal_id = NEW.deal_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;
  IF NEW.prev_hash IS DISTINCT FROM previous_hash THEN
    RAISE EXCEPTION 'settlement ledger chain predecessor mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS settlement_ledger_chain_guard ON settlement.ledger_entries;
CREATE TRIGGER settlement_ledger_chain_guard
BEFORE INSERT ON settlement.ledger_entries
FOR EACH ROW EXECUTE FUNCTION settlement.validate_ledger_chain();
DROP TRIGGER IF EXISTS settlement_ledger_append_only ON settlement.ledger_entries;
CREATE TRIGGER settlement_ledger_append_only
BEFORE UPDATE OR DELETE ON settlement.ledger_entries
FOR EACH ROW EXECUTE FUNCTION settlement.forbid_mutation();

DROP TRIGGER IF EXISTS settlement_terms_append_only ON settlement.payment_terms;
CREATE TRIGGER settlement_terms_append_only
BEFORE UPDATE OR DELETE ON settlement.payment_terms
FOR EACH ROW EXECUTE FUNCTION settlement.forbid_mutation();
DROP TRIGGER IF EXISTS settlement_beneficiaries_append_only ON settlement.beneficiaries;
CREATE TRIGGER settlement_beneficiaries_append_only
BEFORE UPDATE OR DELETE ON settlement.beneficiaries
FOR EACH ROW EXECUTE FUNCTION settlement.forbid_mutation();
DROP TRIGGER IF EXISTS settlement_reconciliation_append_only ON settlement.reconciliation_facts;
CREATE TRIGGER settlement_reconciliation_append_only
BEFORE UPDATE OR DELETE ON settlement.reconciliation_facts
FOR EACH ROW EXECUTE FUNCTION settlement.forbid_mutation();

CREATE OR REPLACE FUNCTION settlement.guard_public_projection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, settlement
AS $function$
DECLARE
  deal_id TEXT;
BEGIN
  IF current_setting('app.settlement_projection_write', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  deal_id := CASE TG_TABLE_NAME
    WHEN 'payments' THEN COALESCE(NEW."dealId", OLD."dealId")
    WHEN 'bank_operations' THEN COALESCE(NEW."dealId", OLD."dealId")
    WHEN 'ledger_entries' THEN COALESCE(NEW."dealId", OLD."dealId")
  END;
  IF deal_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM settlement.payments authority WHERE authority.deal_id = deal_id
  ) THEN
    RAISE EXCEPTION 'public money tables are read projections; settlement authority must be used'
      USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END
$function$;
DROP TRIGGER IF EXISTS settlement_public_payment_guard ON public."payments";
CREATE TRIGGER settlement_public_payment_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."payments"
FOR EACH ROW EXECUTE FUNCTION settlement.guard_public_projection();
DROP TRIGGER IF EXISTS settlement_public_operation_guard ON public."bank_operations";
CREATE TRIGGER settlement_public_operation_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."bank_operations"
FOR EACH ROW EXECUTE FUNCTION settlement.guard_public_projection();
DROP TRIGGER IF EXISTS settlement_public_ledger_guard ON public."ledger_entries";
CREATE TRIGGER settlement_public_ledger_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."ledger_entries"
FOR EACH ROW EXECUTE FUNCTION settlement.guard_public_projection();

-- RLS is enabled in the migration so application access fails closed even when
-- the deployment overlay has not yet been applied.
ALTER TABLE settlement.payment_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.payment_terms FORCE ROW LEVEL SECURITY;
ALTER TABLE settlement.beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.beneficiaries FORCE ROW LEVEL SECURITY;
ALTER TABLE settlement.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE settlement.holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.holds FORCE ROW LEVEL SECURITY;
ALTER TABLE settlement.bank_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.bank_operations FORCE ROW LEVEL SECURITY;
ALTER TABLE settlement.bank_callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.bank_callbacks FORCE ROW LEVEL SECURITY;
ALTER TABLE settlement.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.ledger_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE settlement.reconciliation_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.reconciliation_facts FORCE ROW LEVEL SECURITY;

DO $settlement_policies$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'payment_terms','beneficiaries','payments','holds','bank_operations',
    'bank_callbacks','ledger_entries','reconciliation_facts'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON settlement.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I_select ON settlement.%I FOR SELECT USING (tenant_id = current_setting(''app.current_tenant_id'', true) AND settlement.deal_authorized(deal_id, false))',
      table_name, table_name
    );
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON settlement.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I_insert ON settlement.%I FOR INSERT WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true) AND settlement.deal_authorized(deal_id, true))',
      table_name, table_name
    );
  END LOOP;
END
$settlement_policies$;

CREATE POLICY payments_update ON settlement.payments FOR UPDATE
USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND settlement.deal_authorized(deal_id, true)
)
WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND settlement.deal_authorized(deal_id, true)
);
CREATE POLICY holds_update ON settlement.holds FOR UPDATE
USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND settlement.deal_authorized(deal_id, true)
)
WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND settlement.deal_authorized(deal_id, true)
);
CREATE POLICY bank_operations_update ON settlement.bank_operations FOR UPDATE
USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND settlement.deal_authorized(deal_id, true)
)
WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND settlement.deal_authorized(deal_id, true)
);

COMMENT ON SCHEMA settlement IS
  'IR-10.4 PostgreSQL authority for payment terms, beneficiaries, holds, bank operations, callbacks, reconciliation and ledger.';
