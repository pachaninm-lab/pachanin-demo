-- Canonical PostgreSQL authority for dispute execution.
-- Public legacy dispute tables remain compatibility-only and receive no writes
-- from the production dispute module after this migration.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS dispute;
REVOKE ALL ON SCHEMA dispute FROM PUBLIC;

CREATE TABLE dispute.cases (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  deal_id text NOT NULL,
  shipment_id text,
  status text NOT NULL DEFAULT 'OPEN',
  type text NOT NULL,
  description text NOT NULL,
  initiator_org_id text NOT NULL,
  initiator_user_id text NOT NULL,
  respondent_org_id text NOT NULL,
  claim_amount_minor bigint,
  currency text NOT NULL DEFAULT 'RUB',
  severity text NOT NULL,
  owner_user_id text,
  owner_org_id text,
  sla_deadline timestamptz NOT NULL,
  outcome text,
  outcome_split_pct integer,
  decision_note text,
  decided_at timestamptz,
  appeal_deadline timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  settlement_hold_id text,
  decision_version bigint NOT NULL DEFAULT 0,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT dispute_case_deal_fkey FOREIGN KEY (deal_id)
    REFERENCES public."deals"("id") ON DELETE RESTRICT,
  CONSTRAINT dispute_case_shipment_fkey FOREIGN KEY (shipment_id)
    REFERENCES public."shipments"("id") ON DELETE RESTRICT,
  CONSTRAINT dispute_case_initiator_org_fkey FOREIGN KEY (initiator_org_id)
    REFERENCES public."organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT dispute_case_respondent_org_fkey FOREIGN KEY (respondent_org_id)
    REFERENCES public."organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT dispute_case_hold_fkey FOREIGN KEY (settlement_hold_id)
    REFERENCES settlement.holds(id) ON DELETE RESTRICT,
  CONSTRAINT dispute_case_status_check CHECK (status IN (
    'OPEN','UNDER_REVIEW','EXPERTISE','DECISION','APPEALED','RESOLVED','CLOSED'
  )),
  CONSTRAINT dispute_case_outcome_check CHECK (
    outcome IS NULL OR outcome IN ('BUYER_WIN','SELLER_WIN','SPLIT','NO_CLAIM')
  ),
  CONSTRAINT dispute_case_amount_check CHECK (claim_amount_minor IS NULL OR claim_amount_minor > 0),
  CONSTRAINT dispute_case_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT dispute_case_severity_check CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  CONSTRAINT dispute_case_split_check CHECK (
    (outcome = 'SPLIT' AND outcome_split_pct BETWEEN 1 AND 99)
    OR (outcome IS DISTINCT FROM 'SPLIT' AND outcome_split_pct IS NULL)
  ),
  CONSTRAINT dispute_case_version_check CHECK (version > 0 AND decision_version >= 0)
);
CREATE INDEX dispute_cases_deal_idx ON dispute.cases (tenant_id, deal_id, created_at DESC);
CREATE INDEX dispute_cases_status_idx ON dispute.cases (tenant_id, status, sla_deadline);
CREATE INDEX dispute_cases_org_idx ON dispute.cases (tenant_id, initiator_org_id, respondent_org_id);
CREATE UNIQUE INDEX dispute_cases_active_deal_type_idx
  ON dispute.cases (tenant_id, deal_id, type)
  WHERE status NOT IN ('CLOSED');

CREATE TABLE dispute.participants (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  dispute_id text NOT NULL,
  deal_id text NOT NULL,
  organization_id text NOT NULL,
  user_id text,
  role text NOT NULL,
  side text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT dispute_participant_case_fkey FOREIGN KEY (dispute_id)
    REFERENCES dispute.cases(id) ON DELETE RESTRICT,
  CONSTRAINT dispute_participant_deal_fkey FOREIGN KEY (deal_id)
    REFERENCES public."deals"("id") ON DELETE RESTRICT,
  CONSTRAINT dispute_participant_org_fkey FOREIGN KEY (organization_id)
    REFERENCES public."organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT dispute_participant_side_check CHECK (side IN ('CLAIMANT','RESPONDENT','NEUTRAL')),
  CONSTRAINT dispute_participant_status_check CHECK (status IN ('ACTIVE','REMOVED')),
  CONSTRAINT dispute_participant_scope_key UNIQUE (tenant_id, dispute_id, organization_id, role)
);
CREATE INDEX dispute_participants_case_idx ON dispute.participants (tenant_id, dispute_id, status);

CREATE TABLE dispute.evidence (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  dispute_id text NOT NULL,
  deal_id text NOT NULL,
  type text NOT NULL,
  file_id text,
  description text NOT NULL,
  source text NOT NULL,
  submitted_by_user_id text NOT NULL,
  submitted_by_org_id text NOT NULL,
  submitted_by_role text NOT NULL,
  trusted boolean NOT NULL,
  command_id text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  request_fingerprint text NOT NULL,
  prev_hash text,
  hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT dispute_evidence_case_fkey FOREIGN KEY (dispute_id)
    REFERENCES dispute.cases(id) ON DELETE RESTRICT,
  CONSTRAINT dispute_evidence_deal_fkey FOREIGN KEY (deal_id)
    REFERENCES public."deals"("id") ON DELETE RESTRICT,
  CONSTRAINT dispute_evidence_type_check CHECK (type IN (
    'PHOTO','DOCUMENT','GPS','WEIGHT','LAB','STATEMENT','OTHER'
  )),
  CONSTRAINT dispute_evidence_fingerprint_check CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT dispute_evidence_prev_hash_check CHECK (prev_hash IS NULL OR prev_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT dispute_evidence_hash_check CHECK (hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX dispute_evidence_chain_idx ON dispute.evidence (tenant_id, dispute_id, created_at, id);

CREATE TABLE dispute.appeals (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  dispute_id text NOT NULL,
  deal_id text NOT NULL,
  decision_version bigint NOT NULL,
  filed_by_user_id text NOT NULL,
  filed_by_org_id text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  resolution text,
  final_outcome text,
  final_split_pct integer,
  decision_note text,
  decided_by_user_id text,
  decided_at timestamptz,
  command_id text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  request_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT dispute_appeal_case_fkey FOREIGN KEY (dispute_id)
    REFERENCES dispute.cases(id) ON DELETE RESTRICT,
  CONSTRAINT dispute_appeal_deal_fkey FOREIGN KEY (deal_id)
    REFERENCES public."deals"("id") ON DELETE RESTRICT,
  CONSTRAINT dispute_appeal_status_check CHECK (status IN ('PENDING','UPHELD','OVERTURNED','MODIFIED','REJECTED')),
  CONSTRAINT dispute_appeal_resolution_check CHECK (
    resolution IS NULL OR resolution IN ('UPHELD','OVERTURNED','MODIFIED','REJECTED')
  ),
  CONSTRAINT dispute_appeal_outcome_check CHECK (
    final_outcome IS NULL OR final_outcome IN ('BUYER_WIN','SELLER_WIN','SPLIT','NO_CLAIM')
  ),
  CONSTRAINT dispute_appeal_split_check CHECK (
    (final_outcome = 'SPLIT' AND final_split_pct BETWEEN 1 AND 99)
    OR (final_outcome IS DISTINCT FROM 'SPLIT' AND final_split_pct IS NULL)
  ),
  CONSTRAINT dispute_appeal_fingerprint_check CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT dispute_appeal_decision_key UNIQUE (tenant_id, dispute_id, decision_version)
);
CREATE INDEX dispute_appeals_case_idx ON dispute.appeals (tenant_id, dispute_id, status, created_at);

CREATE TABLE dispute.money_instructions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  dispute_id text NOT NULL,
  deal_id text NOT NULL,
  decision_version bigint NOT NULL,
  action text NOT NULL,
  amount_minor bigint NOT NULL,
  seller_amount_minor bigint NOT NULL,
  buyer_refund_minor bigint NOT NULL,
  currency text NOT NULL DEFAULT 'RUB',
  status text NOT NULL,
  basis_document_id text NOT NULL,
  supersedes_id text,
  command_id text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  request_fingerprint text NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  executed_at timestamptz,
  CONSTRAINT dispute_instruction_case_fkey FOREIGN KEY (dispute_id)
    REFERENCES dispute.cases(id) ON DELETE RESTRICT,
  CONSTRAINT dispute_instruction_deal_fkey FOREIGN KEY (deal_id)
    REFERENCES public."deals"("id") ON DELETE RESTRICT,
  CONSTRAINT dispute_instruction_supersedes_fkey FOREIGN KEY (supersedes_id)
    REFERENCES dispute.money_instructions(id) ON DELETE RESTRICT,
  CONSTRAINT dispute_instruction_action_check CHECK (action IN (
    'REFUND_BUYER','RELEASE_TO_SELLER','SPLIT_RELEASE','NO_MONEY'
  )),
  CONSTRAINT dispute_instruction_status_check CHECK (status IN (
    'PENDING_APPEAL','BLOCKED_BY_APPEAL','READY','SUPERSEDED','EXECUTED'
  )),
  CONSTRAINT dispute_instruction_amounts_check CHECK (
    amount_minor >= 0 AND seller_amount_minor >= 0 AND buyer_refund_minor >= 0
    AND seller_amount_minor + buyer_refund_minor = amount_minor
  ),
  CONSTRAINT dispute_instruction_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT dispute_instruction_fingerprint_check CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT dispute_instruction_decision_key UNIQUE (tenant_id, dispute_id, decision_version)
);
CREATE INDEX dispute_instruction_case_idx ON dispute.money_instructions (tenant_id, dispute_id, status);

CREATE TABLE dispute.command_receipts (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  command_type text NOT NULL,
  actor_id text NOT NULL,
  idempotency_key text NOT NULL,
  command_id text NOT NULL,
  request_fingerprint text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT dispute_receipt_scope_key UNIQUE (tenant_id, command_type, actor_id, idempotency_key),
  CONSTRAINT dispute_receipt_fingerprint_check CHECK (request_fingerprint ~ '^[0-9a-f]{64}$')
);
CREATE INDEX dispute_receipts_created_idx ON dispute.command_receipts (tenant_id, created_at DESC, id);

CREATE OR REPLACE FUNCTION dispute.context_ready()
RETURNS boolean
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

CREATE OR REPLACE FUNCTION dispute.actor_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
  SELECT dispute.context_ready() AND EXISTS (
    SELECT 1
    FROM public."users" actor
    JOIN public."user_orgs" membership ON membership."userId" = actor."id"
    JOIN public."organizations" organization ON organization."id" = membership."organizationId"
    WHERE actor."id" = current_setting('app.current_user_id', true)
      AND actor."status" = 'ACTIVE'
      AND actor."deletedAt" IS NULL
      AND membership."organizationId" = current_setting('app.current_org_id', true)
      AND membership."role" = current_setting('app.current_role', true)
      AND organization."tenantId" = current_setting('app.current_tenant_id', true)
      AND organization."status" IN ('VERIFIED','ACTIVE')
      AND organization."kycStatus" = 'APPROVED'
  )
$function$;

CREATE OR REPLACE FUNCTION dispute.deal_authorized(p_deal_id text, p_write boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
  SELECT dispute.actor_active() AND EXISTS (
    SELECT 1
    FROM public."deals" deal
    WHERE deal."id" = p_deal_id
      AND deal."tenantId" = current_setting('app.current_tenant_id', true)
      AND (
        current_setting('app.current_role', true) IN ('ADMIN','SUPPORT_MANAGER','ARBITRATOR','COMPLIANCE_OFFICER')
        OR (
          current_setting('app.current_role', true) = 'BUYER'
          AND deal."buyerOrgId" = current_setting('app.current_org_id', true)
        )
        OR (
          current_setting('app.current_role', true) = 'FARMER'
          AND deal."sellerOrgId" = current_setting('app.current_org_id', true)
        )
        OR EXISTS (
          SELECT 1 FROM public."deal_participants" participant
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
  )
$function$;

CREATE OR REPLACE FUNCTION dispute.case_visible(p_dispute_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM dispute.cases c
    WHERE c.id = p_dispute_id
      AND c.tenant_id = current_setting('app.current_tenant_id', true)
      AND (
        current_setting('app.current_role', true) IN ('ADMIN','SUPPORT_MANAGER','ARBITRATOR','COMPLIANCE_OFFICER')
        OR dispute.deal_authorized(c.deal_id, false)
        OR c.initiator_org_id = current_setting('app.current_org_id', true)
        OR c.respondent_org_id = current_setting('app.current_org_id', true)
      )
  )
$function$;

CREATE OR REPLACE FUNCTION dispute.assert_roles(p_roles text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
BEGIN
  IF NOT dispute.actor_active() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'DISPUTE_ACTIVE_MEMBERSHIP_REQUIRED';
  END IF;
  IF NOT (current_setting('app.current_role', true) = ANY(p_roles)) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'DISPUTE_ROLE_DENIED';
  END IF;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.replay_command(
  p_command_type text,
  p_idempotency_key text,
  p_request_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE
  stored dispute.command_receipts%ROWTYPE;
  lock_material text;
BEGIN
  lock_material := concat_ws(':', current_setting('app.current_tenant_id', true),
    p_command_type, current_setting('app.current_user_id', true), p_idempotency_key);
  PERFORM pg_advisory_xact_lock(hashtextextended(lock_material, 0));

  SELECT * INTO stored FROM dispute.command_receipts receipt
  WHERE receipt.tenant_id = current_setting('app.current_tenant_id', true)
    AND receipt.command_type = p_command_type
    AND receipt.actor_id = current_setting('app.current_user_id', true)
    AND receipt.idempotency_key = p_idempotency_key;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF stored.request_fingerprint <> p_request_fingerprint THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_IDEMPOTENCY_PAYLOAD_MISMATCH';
  END IF;
  RETURN stored.result || jsonb_build_object('duplicate', true);
END
$function$;

CREATE OR REPLACE FUNCTION dispute.save_command(
  p_command_type text,
  p_command_id text,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_result jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
BEGIN
  INSERT INTO dispute.command_receipts (
    id, tenant_id, command_type, actor_id, idempotency_key,
    command_id, request_fingerprint, result
  ) VALUES (
    'dispute-receipt-' || gen_random_uuid()::text,
    current_setting('app.current_tenant_id', true), p_command_type,
    current_setting('app.current_user_id', true), p_idempotency_key,
    p_command_id, p_request_fingerprint, p_result
  );
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DISPUTE_IDEMPOTENCY_RACE_RETRY';
END
$function$;

CREATE OR REPLACE FUNCTION dispute.forbid_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION 'dispute fact % is append-only: % forbidden', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '23514';
END
$function$;

CREATE OR REPLACE FUNCTION dispute.guard_case_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'dispute cases cannot be deleted' USING ERRCODE = '23514';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.deal_id IS DISTINCT FROM OLD.deal_id OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.initiator_org_id IS DISTINCT FROM OLD.initiator_org_id
     OR NEW.initiator_user_id IS DISTINCT FROM OLD.initiator_user_id
     OR NEW.claim_amount_minor IS DISTINCT FROM OLD.claim_amount_minor
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.settlement_hold_id IS DISTINCT FROM OLD.settlement_hold_id THEN
    RAISE EXCEPTION 'dispute identity, claim and hold binding are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'dispute update requires exact CAS version increment' USING ERRCODE = '40001';
  END IF;
  NEW.updated_at := transaction_timestamp();
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS dispute_case_transition_guard ON dispute.cases;
CREATE TRIGGER dispute_case_transition_guard
BEFORE UPDATE OR DELETE ON dispute.cases
FOR EACH ROW EXECUTE FUNCTION dispute.guard_case_transition();

DROP TRIGGER IF EXISTS dispute_participants_append_only ON dispute.participants;
CREATE TRIGGER dispute_participants_append_only BEFORE UPDATE OR DELETE ON dispute.participants
FOR EACH ROW EXECUTE FUNCTION dispute.forbid_mutation();
DROP TRIGGER IF EXISTS dispute_evidence_append_only ON dispute.evidence;
CREATE TRIGGER dispute_evidence_append_only BEFORE UPDATE OR DELETE ON dispute.evidence
FOR EACH ROW EXECUTE FUNCTION dispute.forbid_mutation();
DROP TRIGGER IF EXISTS dispute_appeals_append_only ON dispute.appeals;
CREATE TRIGGER dispute_appeals_append_only BEFORE DELETE ON dispute.appeals
FOR EACH ROW EXECUTE FUNCTION dispute.forbid_mutation();
DROP TRIGGER IF EXISTS dispute_receipts_append_only ON dispute.command_receipts;
CREATE TRIGGER dispute_receipts_append_only BEFORE UPDATE OR DELETE ON dispute.command_receipts
FOR EACH ROW EXECUTE FUNCTION dispute.forbid_mutation();

ALTER TABLE dispute.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute.cases FORCE ROW LEVEL SECURITY;
ALTER TABLE dispute.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute.participants FORCE ROW LEVEL SECURITY;
ALTER TABLE dispute.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute.evidence FORCE ROW LEVEL SECURITY;
ALTER TABLE dispute.appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute.appeals FORCE ROW LEVEL SECURITY;
ALTER TABLE dispute.money_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute.money_instructions FORCE ROW LEVEL SECURITY;
ALTER TABLE dispute.command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute.command_receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY dispute_cases_select ON dispute.cases FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true) AND dispute.case_visible(id)
);
CREATE POLICY dispute_participants_select ON dispute.participants FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true) AND dispute.case_visible(dispute_id)
);
CREATE POLICY dispute_evidence_select ON dispute.evidence FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true) AND dispute.case_visible(dispute_id)
);
CREATE POLICY dispute_appeals_select ON dispute.appeals FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true) AND dispute.case_visible(dispute_id)
);
CREATE POLICY dispute_instructions_select ON dispute.money_instructions FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true) AND dispute.case_visible(dispute_id)
);
CREATE POLICY dispute_receipts_select ON dispute.command_receipts FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND (actor_id = current_setting('app.current_user_id', true)
    OR current_setting('app.current_role', true) IN ('ADMIN','SUPPORT_MANAGER','ARBITRATOR'))
);

REVOKE ALL ON ALL TABLES IN SCHEMA dispute FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dispute FROM PUBLIC;

COMMENT ON SCHEMA dispute IS
  'Canonical PostgreSQL dispute authority with tenant isolation, evidence chain, appeal and settlement hold binding.';
