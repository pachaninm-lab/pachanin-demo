-- IR-10.5: canonical PostgreSQL dispute execution authority.
--
-- This bounded context owns dispute state, evidence, appeals and durable command
-- receipts around the canonical public.deals object. Money remains in the shared
-- append-only public.ledger_entries journal; dispute.ledger_links adds the
-- dispute dimension without creating a second financial source of truth.
-- All mutations are SECURITY DEFINER commands. app_deal receives SELECT and
-- EXECUTE only, never direct INSERT/UPDATE/DELETE on dispute authority tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS dispute;
REVOKE ALL ON SCHEMA dispute FROM PUBLIC;

CREATE TABLE IF NOT EXISTS dispute.cases (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  deal_id text NOT NULL,
  shipment_id text,
  case_type text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'ARBITRATION', 'RESOLVED', 'APPEALED', 'FINAL')),
  description text NOT NULL,
  initiator_org_id text NOT NULL,
  respondent_org_id text NOT NULL,
  claim_amount_kopecks bigint NOT NULL DEFAULT 0 CHECK (claim_amount_kopecks >= 0),
  severity text NOT NULL DEFAULT 'MEDIUM'
    CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  sla_deadline_at timestamptz,
  operator_user_id text,
  assigned_arbitrator_user_id text,
  arbitrator_notes text,
  outcome text CHECK (outcome IS NULL OR outcome IN ('BUYER_WINS', 'SELLER_WINS', 'SPLIT', 'CANCELLED')),
  outcome_split_buyer_pct integer CHECK (outcome_split_buyer_pct IS NULL OR outcome_split_buyer_pct BETWEEN 0 AND 100),
  decision_reason text,
  resolved_by_user_id text,
  resolved_at timestamptz,
  appeal_deadline_at timestamptz,
  bank_basis_document_id text,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT dispute_cases_tenant_id_key UNIQUE (tenant_id, id),
  CONSTRAINT dispute_cases_deal_fkey FOREIGN KEY (deal_id)
    REFERENCES public.deals (id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS dispute.holds (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  case_id text NOT NULL,
  amount_kopecks bigint NOT NULL CHECK (amount_kopecks > 0),
  status text NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD', 'RELEASED')),
  reason text NOT NULL,
  held_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  released_at timestamptz,
  release_reason text,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  CONSTRAINT dispute_holds_case_key UNIQUE (tenant_id, case_id),
  CONSTRAINT dispute_holds_case_fkey FOREIGN KEY (tenant_id, case_id)
    REFERENCES dispute.cases (tenant_id, id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS dispute.evidence (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  case_id text NOT NULL,
  evidence_type text NOT NULL,
  description text NOT NULL,
  source text NOT NULL,
  file_id text,
  trusted boolean NOT NULL DEFAULT false,
  submitted_by_user_id text NOT NULL,
  submitted_by_role text NOT NULL,
  evidence_hash text NOT NULL,
  previous_hash text,
  command_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT dispute_evidence_case_fkey FOREIGN KEY (tenant_id, case_id)
    REFERENCES dispute.cases (tenant_id, id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS dispute.appeals (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  case_id text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'GRANTED', 'DENIED')),
  requested_outcome text CHECK (requested_outcome IS NULL OR requested_outcome IN ('BUYER_WINS', 'SELLER_WINS', 'SPLIT', 'CANCELLED')),
  requested_split_buyer_pct integer CHECK (requested_split_buyer_pct IS NULL OR requested_split_buyer_pct BETWEEN 0 AND 100),
  reason text NOT NULL,
  opened_by_user_id text NOT NULL,
  opened_by_org_id text NOT NULL,
  decided_by_user_id text,
  decision_note text,
  opened_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  resolved_at timestamptz,
  CONSTRAINT dispute_appeals_case_once_key UNIQUE (tenant_id, case_id),
  CONSTRAINT dispute_appeals_case_fkey FOREIGN KEY (tenant_id, case_id)
    REFERENCES dispute.cases (tenant_id, id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS dispute.ledger_links (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  case_id text NOT NULL,
  ledger_entry_id text NOT NULL UNIQUE,
  posting_kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT dispute_ledger_links_case_fkey FOREIGN KEY (tenant_id, case_id)
    REFERENCES dispute.cases (tenant_id, id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT dispute_ledger_links_entry_fkey FOREIGN KEY (ledger_entry_id)
    REFERENCES public.ledger_entries (id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS dispute.command_receipts (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  command_type text NOT NULL CHECK (command_type IN (
    'OPEN_CASE', 'TRIAGE_CASE', 'ADD_EVIDENCE', 'ASSIGN_ARBITRATOR',
    'ADD_NOTE', 'RESOLVE_CASE', 'OPEN_APPEAL', 'RESOLVE_APPEAL'
  )),
  actor_user_id text NOT NULL,
  idempotency_key text NOT NULL,
  command_id text NOT NULL,
  request_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT dispute_command_receipts_scope_key
    UNIQUE (tenant_id, command_type, actor_user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS dispute_cases_deal_idx
  ON dispute.cases (tenant_id, deal_id, created_at DESC, id);
CREATE INDEX IF NOT EXISTS dispute_cases_status_idx
  ON dispute.cases (tenant_id, status, updated_at DESC, id);
CREATE INDEX IF NOT EXISTS dispute_cases_arbitrator_idx
  ON dispute.cases (tenant_id, assigned_arbitrator_user_id, status, created_at, id);
CREATE INDEX IF NOT EXISTS dispute_evidence_case_idx
  ON dispute.evidence (tenant_id, case_id, created_at, id);
CREATE INDEX IF NOT EXISTS dispute_appeals_status_idx
  ON dispute.appeals (tenant_id, status, opened_at, id);
CREATE INDEX IF NOT EXISTS dispute_ledger_links_case_idx
  ON dispute.ledger_links (tenant_id, case_id, created_at, id);
CREATE INDEX IF NOT EXISTS dispute_receipts_created_idx
  ON dispute.command_receipts (tenant_id, created_at DESC, id);

CREATE OR REPLACE FUNCTION dispute.touch_case_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, dispute
AS $function$
BEGIN
  NEW.updated_at := transaction_timestamp();
  NEW.version := OLD.version + 1;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS dispute_cases_touch_version ON dispute.cases;
CREATE TRIGGER dispute_cases_touch_version
BEFORE UPDATE ON dispute.cases
FOR EACH ROW EXECUTE FUNCTION dispute.touch_case_version();

CREATE OR REPLACE FUNCTION dispute.reject_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, dispute
AS $function$
BEGIN
  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_APPEND_ONLY_RECORD';
END
$function$;

DROP TRIGGER IF EXISTS dispute_evidence_append_only ON dispute.evidence;
CREATE TRIGGER dispute_evidence_append_only
BEFORE UPDATE OR DELETE ON dispute.evidence
FOR EACH ROW EXECUTE FUNCTION dispute.reject_append_only_mutation();
DROP TRIGGER IF EXISTS dispute_ledger_links_append_only ON dispute.ledger_links;
CREATE TRIGGER dispute_ledger_links_append_only
BEFORE UPDATE OR DELETE ON dispute.ledger_links
FOR EACH ROW EXECUTE FUNCTION dispute.reject_append_only_mutation();
DROP TRIGGER IF EXISTS dispute_command_receipts_append_only ON dispute.command_receipts;
CREATE TRIGGER dispute_command_receipts_append_only
BEFORE UPDATE OR DELETE ON dispute.command_receipts
FOR EACH ROW EXECUTE FUNCTION dispute.reject_append_only_mutation();

CREATE OR REPLACE FUNCTION dispute.current_actor_active()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
STABLE
AS $function$
  SELECT
    public.app_rls_context_ready()
    AND EXISTS (
      SELECT 1
      FROM public.users actor
      JOIN public.user_orgs membership ON membership."userId" = actor.id
      JOIN public.organizations organization ON organization.id = membership."organizationId"
      WHERE actor.id = current_setting('app.current_user_id', true)
        AND actor.status = 'ACTIVE'
        AND actor."deletedAt" IS NULL
        AND membership."organizationId" = current_setting('app.current_org_id', true)
        AND membership.role = current_setting('app.current_role', true)
        AND organization."tenantId" = current_setting('app.current_tenant_id', true)
        AND organization.status IN ('VERIFIED', 'ACTIVE')
        AND organization."kycStatus" = 'APPROVED'
    )
$function$;

CREATE OR REPLACE FUNCTION dispute.assert_actor(p_allowed_roles text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
BEGIN
  IF NOT public.app_rls_context_ready() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_TRUSTED_CONTEXT_REQUIRED';
  END IF;
  IF NOT (current_setting('app.current_role', true) = ANY(p_allowed_roles)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_ROLE_DENIED';
  END IF;
  IF NOT dispute.current_actor_active() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_ACTIVE_MEMBERSHIP_REQUIRED';
  END IF;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.can_read_case(p_case_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
STABLE
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM dispute.cases c
    WHERE c.id = p_case_id
      AND c.tenant_id = current_setting('app.current_tenant_id', true)
      AND (
        current_setting('app.current_role', true) = ANY(ARRAY[
          'ADMIN', 'SUPPORT_MANAGER', 'COMPLIANCE_OFFICER', 'ARBITRATOR', 'EXECUTIVE'
        ])
        OR c.initiator_org_id = current_setting('app.current_org_id', true)
        OR c.respondent_org_id = current_setting('app.current_org_id', true)
        OR EXISTS (
          SELECT 1 FROM public.deal_participants participant
          WHERE participant."dealId" = c.deal_id
            AND participant."tenantId" = c.tenant_id
            AND participant."userId" = current_setting('app.current_user_id', true)
            AND participant.status = 'ACTIVE'
        )
      )
  )
$function$;

CREATE OR REPLACE FUNCTION dispute.replay_command(
  p_command_type text,
  p_idempotency_key text,
  p_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE
  stored dispute.command_receipts%ROWTYPE;
BEGIN
  SELECT * INTO stored
  FROM dispute.command_receipts receipt
  WHERE receipt.tenant_id = current_setting('app.current_tenant_id', true)
    AND receipt.command_type = p_command_type
    AND receipt.actor_user_id = current_setting('app.current_user_id', true)
    AND receipt.idempotency_key = p_idempotency_key;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF stored.request_hash <> p_request_hash THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_IDEMPOTENCY_PAYLOAD_MISMATCH';
  END IF;
  RETURN stored.result || jsonb_build_object('duplicate', true);
END
$function$;

CREATE OR REPLACE FUNCTION dispute.save_command(
  p_command_type text,
  p_command_id text,
  p_idempotency_key text,
  p_request_hash text,
  p_result jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
BEGIN
  INSERT INTO dispute.command_receipts (
    id, tenant_id, command_type, actor_user_id, idempotency_key,
    command_id, request_hash, result, created_at
  ) VALUES (
    'dispute-receipt:' || gen_random_uuid()::text,
    current_setting('app.current_tenant_id', true), p_command_type,
    current_setting('app.current_user_id', true), p_idempotency_key,
    p_command_id, p_request_hash, p_result, clock_timestamp()
  );
END
$function$;

CREATE OR REPLACE FUNCTION dispute.append_audit(
  p_action text,
  p_case_id text,
  p_deal_id text,
  p_before jsonb,
  p_after jsonb,
  p_metadata jsonb,
  p_command_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE
  audit_id text := 'dispute-audit:' || gen_random_uuid()::text;
  previous_hash text;
  audit_material jsonb;
  audit_hash text;
BEGIN
  SELECT event.hash INTO previous_hash
  FROM public.audit_events event
  WHERE event."tenantId" = current_setting('app.current_tenant_id', true)
    AND event."objectType" = 'dispute_case'
    AND event."objectId" = p_case_id
  ORDER BY event."createdAt" DESC, event.id DESC
  LIMIT 1;
  audit_material := jsonb_build_object(
    'id', audit_id, 'action', p_action,
    'actorUserId', current_setting('app.current_user_id', true),
    'actorRole', current_setting('app.current_role', true),
    'tenantId', current_setting('app.current_tenant_id', true),
    'orgId', current_setting('app.current_org_id', true),
    'dealId', p_deal_id, 'disputeId', p_case_id,
    'objectType', 'dispute_case', 'objectId', p_case_id,
    'beforeState', p_before, 'afterState', p_after,
    'outcome', 'SUCCESS', 'metadata', p_metadata,
    'correlationId', p_command_id, 'prevHash', previous_hash
  );
  audit_hash := encode(digest(convert_to(audit_material::text, 'UTF8'), 'sha256'), 'hex');
  INSERT INTO public.audit_events (
    id, action, "actorUserId", "actorRole", "tenantId", "orgId", "dealId", "disputeId",
    "objectType", "objectId", "beforeState", "afterState", outcome, metadata,
    "correlationId", hash, "prevHash", "createdAt"
  ) VALUES (
    audit_id, p_action, current_setting('app.current_user_id', true),
    current_setting('app.current_role', true), current_setting('app.current_tenant_id', true),
    current_setting('app.current_org_id', true), p_deal_id, p_case_id,
    'dispute_case', p_case_id, p_before, p_after, 'SUCCESS', p_metadata,
    p_command_id, audit_hash, previous_hash, clock_timestamp()
  );
  RETURN audit_id;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.append_outbox(
  p_type text,
  p_case_id text,
  p_deal_id text,
  p_payload jsonb,
  p_idempotency_key text,
  p_command_id text,
  p_audit_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE outbox_id text := 'dispute-outbox:' || gen_random_uuid()::text;
BEGIN
  INSERT INTO public.outbox_entries (
    id, type, "dealId", payload, status, "idempotencyKey", "maxRetries", "retryCount",
    "nextRetryAt", "correlationId", "auditId", "createdAt"
  ) VALUES (
    outbox_id, p_type, p_deal_id,
    p_payload || jsonb_build_object('disputeId', p_case_id, 'dealId', p_deal_id),
    'PENDING', p_idempotency_key, 8, 0, clock_timestamp(), p_command_id,
    p_audit_id, clock_timestamp()
  );
  RETURN outbox_id;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.post_ledger(
  p_case_id text,
  p_deal_id text,
  p_posting_kind text,
  p_debit_account text,
  p_credit_account text,
  p_amount_kopecks bigint,
  p_idempotency_key text,
  p_description text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE
  entry_id text := 'ledger:' || gen_random_uuid()::text;
  debit_balance bigint;
BEGIN
  IF p_amount_kopecks <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_AMOUNT_MUST_BE_POSITIVE';
  END IF;
  SELECT COALESCE(SUM(CASE
    WHEN entry."creditAccount" = p_debit_account THEN entry."amountKopecks"
    WHEN entry."debitAccount" = p_debit_account THEN -entry."amountKopecks"
    ELSE 0 END), 0)::bigint
  INTO debit_balance
  FROM public.ledger_entries entry
  WHERE entry."creditAccount" = p_debit_account OR entry."debitAccount" = p_debit_account;
  IF debit_balance < p_amount_kopecks THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_INSUFFICIENT_LEDGER_BALANCE';
  END IF;
  INSERT INTO public.ledger_entries (
    id, "dealId", "entryType", "debitAccount", "creditAccount", "amountKopecks",
    currency, reference, "idempotencyKey", description, "createdByUserId", "createdAt"
  ) VALUES (
    entry_id, p_deal_id, p_posting_kind, p_debit_account, p_credit_account,
    p_amount_kopecks, 'RUB', 'dispute:' || p_case_id, p_idempotency_key,
    p_description, current_setting('app.current_user_id', true), clock_timestamp()
  );
  INSERT INTO dispute.ledger_links (
    id, tenant_id, case_id, ledger_entry_id, posting_kind, created_at
  ) VALUES (
    'dispute-ledger-link:' || gen_random_uuid()::text,
    current_setting('app.current_tenant_id', true), p_case_id, entry_id,
    p_posting_kind, clock_timestamp()
  );
  RETURN entry_id;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.case_snapshot(p_case_id text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
STABLE
AS $function$
  SELECT jsonb_build_object(
    'id', c.id, 'tenantId', c.tenant_id, 'dealId', c.deal_id,
    'shipmentId', c.shipment_id, 'type', c.case_type, 'status', c.status,
    'description', c.description, 'initiatorOrgId', c.initiator_org_id,
    'respondentOrgId', c.respondent_org_id,
    'claimAmountKopecks', c.claim_amount_kopecks::text,
    'severity', c.severity, 'slaDeadlineAt', c.sla_deadline_at,
    'operatorUserId', c.operator_user_id,
    'arbitratorId', c.assigned_arbitrator_user_id,
    'arbitratorNotes', c.arbitrator_notes,
    'outcome', c.outcome, 'outcomeSplitBuyerPct', c.outcome_split_buyer_pct,
    'decisionReason', c.decision_reason, 'resolvedByUserId', c.resolved_by_user_id,
    'resolvedAt', c.resolved_at, 'appealDeadlineAt', c.appeal_deadline_at,
    'bankBasisDocumentId', c.bank_basis_document_id,
    'version', c.version::text, 'createdAt', c.created_at, 'updatedAt', c.updated_at,
    'moneyHold', CASE WHEN h.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', h.id, 'amountKopecks', h.amount_kopecks::text, 'status', h.status,
      'reason', h.reason, 'heldAt', h.held_at, 'releasedAt', h.released_at,
      'releaseReason', h.release_reason, 'version', h.version::text
    ) END,
    'evidence', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', e.id, 'type', e.evidence_type, 'description', e.description,
      'source', e.source, 'fileId', e.file_id, 'trusted', e.trusted,
      'submittedBy', e.submitted_by_user_id, 'submittedByRole', e.submitted_by_role,
      'hash', e.evidence_hash, 'prevHash', e.previous_hash,
      'submittedAt', e.created_at
    ) ORDER BY e.created_at, e.id) FROM dispute.evidence e
      WHERE e.tenant_id = c.tenant_id AND e.case_id = c.id), '[]'::jsonb),
    'appeals', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', a.id, 'status', a.status, 'requestedOutcome', a.requested_outcome,
      'requestedSplitBuyerPct', a.requested_split_buyer_pct, 'reason', a.reason,
      'openedByUserId', a.opened_by_user_id, 'openedByOrgId', a.opened_by_org_id,
      'decidedByUserId', a.decided_by_user_id, 'decisionNote', a.decision_note,
      'openedAt', a.opened_at, 'resolvedAt', a.resolved_at
    ) ORDER BY a.opened_at, a.id) FROM dispute.appeals a
      WHERE a.tenant_id = c.tenant_id AND a.case_id = c.id), '[]'::jsonb)
  )
  FROM dispute.cases c
  LEFT JOIN dispute.holds h ON h.tenant_id = c.tenant_id AND h.case_id = c.id
  WHERE c.id = p_case_id
    AND c.tenant_id = current_setting('app.current_tenant_id', true)
    AND dispute.can_read_case(c.id)
$function$;

CREATE OR REPLACE FUNCTION dispute.open_case(
  p_deal_id text,
  p_shipment_id text,
  p_case_type text,
  p_description text,
  p_claim_amount_kopecks bigint,
  p_severity text,
  p_command_id text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE
  deal_row public.deals%ROWTYPE;
  case_id text := 'dispute:' || gen_random_uuid()::text;
  respondent_org text;
  request_hash text;
  replay jsonb;
  result jsonb;
  audit_id text;
  hold_account text;
BEGIN
  PERFORM dispute.assert_actor(ARRAY['BUYER','FARMER','LAB','SURVEYOR','SUPPORT_MANAGER','COMPLIANCE_OFFICER','ADMIN']);
  IF p_claim_amount_kopecks < 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_INVALID_CLAIM_AMOUNT';
  END IF;
  request_hash := encode(digest(convert_to(jsonb_build_object(
    'dealId', p_deal_id, 'shipmentId', p_shipment_id, 'caseType', p_case_type,
    'description', p_description, 'claimAmountKopecks', p_claim_amount_kopecks,
    'severity', p_severity)::text, 'UTF8'), 'sha256'), 'hex');
  replay := dispute.replay_command('OPEN_CASE', p_idempotency_key, request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('dispute:deal:' || p_deal_id, 0));
  SELECT * INTO deal_row FROM public.deals d WHERE d.id = p_deal_id FOR UPDATE;
  IF NOT FOUND OR deal_row."tenantId" IS DISTINCT FROM current_setting('app.current_tenant_id', true) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_DEAL_NOT_FOUND';
  END IF;
  IF current_setting('app.current_role', true) = 'BUYER'
     AND deal_row."buyerOrgId" <> current_setting('app.current_org_id', true) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_DEAL_ACCESS_DENIED';
  END IF;
  IF current_setting('app.current_role', true) = 'FARMER'
     AND deal_row."sellerOrgId" <> current_setting('app.current_org_id', true) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_DEAL_ACCESS_DENIED';
  END IF;
  IF p_claim_amount_kopecks > COALESCE(deal_row."totalKopecks", 0) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_CLAIM_EXCEEDS_DEAL_TOTAL';
  END IF;
  respondent_org := CASE
    WHEN current_setting('app.current_org_id', true) = deal_row."buyerOrgId" THEN deal_row."sellerOrgId"
    ELSE deal_row."buyerOrgId" END;
  INSERT INTO dispute.cases (
    id, tenant_id, deal_id, shipment_id, case_type, status, description,
    initiator_org_id, respondent_org_id, claim_amount_kopecks, severity,
    sla_deadline_at, created_at, updated_at
  ) VALUES (
    case_id, current_setting('app.current_tenant_id', true), p_deal_id,
    NULLIF(p_shipment_id, ''), p_case_type, 'OPEN', p_description,
    current_setting('app.current_org_id', true), respondent_org,
    p_claim_amount_kopecks, p_severity,
    transaction_timestamp() + CASE p_severity
      WHEN 'CRITICAL' THEN interval '4 hours' WHEN 'HIGH' THEN interval '12 hours'
      WHEN 'MEDIUM' THEN interval '24 hours' ELSE interval '72 hours' END,
    clock_timestamp(), clock_timestamp()
  );
  IF p_claim_amount_kopecks > 0 THEN
    hold_account := 'dispute-hold:' || case_id;
    PERFORM dispute.post_ledger(
      case_id, p_deal_id, 'HOLD', 'escrow:' || p_deal_id, hold_account,
      p_claim_amount_kopecks, 'dispute-hold:' || case_id,
      'Dispute hold for ' || case_id
    );
    INSERT INTO dispute.holds (
      id, tenant_id, case_id, amount_kopecks, reason, held_at
    ) VALUES (
      'dispute-hold-record:' || gen_random_uuid()::text,
      current_setting('app.current_tenant_id', true), case_id,
      p_claim_amount_kopecks, 'Claim amount reserved for dispute resolution', clock_timestamp()
    );
  END IF;
  result := dispute.case_snapshot(case_id);
  audit_id := dispute.append_audit('dispute:opened', case_id, p_deal_id, NULL, result,
    jsonb_build_object('claimAmountKopecks', p_claim_amount_kopecks::text), p_command_id);
  PERFORM dispute.append_outbox('DISPUTE_OPENED', case_id, p_deal_id, result,
    'dispute-opened:' || case_id, p_command_id, audit_id);
  PERFORM dispute.save_command('OPEN_CASE', p_command_id, p_idempotency_key, request_hash, result);
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.triage_case(
  p_case_id text, p_command_id text, p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE c dispute.cases%ROWTYPE; before_state jsonb; result jsonb; request_hash text; replay jsonb; audit_id text;
BEGIN
  PERFORM dispute.assert_actor(ARRAY['SUPPORT_MANAGER','COMPLIANCE_OFFICER','ADMIN']);
  request_hash := encode(digest(convert_to(jsonb_build_object('caseId',p_case_id)::text,'UTF8'),'sha256'),'hex');
  replay := dispute.replay_command('TRIAGE_CASE', p_idempotency_key, request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('dispute:case:' || p_case_id, 0));
  SELECT * INTO c FROM dispute.cases WHERE id=p_case_id AND tenant_id=current_setting('app.current_tenant_id',true) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_CASE_NOT_FOUND'; END IF;
  IF c.status <> 'OPEN' THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_INVALID_STATE'; END IF;
  before_state := dispute.case_snapshot(p_case_id);
  UPDATE dispute.cases SET status='UNDER_REVIEW', operator_user_id=current_setting('app.current_user_id',true)
    WHERE id=p_case_id;
  result := dispute.case_snapshot(p_case_id);
  audit_id := dispute.append_audit('dispute:triaged',p_case_id,c.deal_id,before_state,result,'{}'::jsonb,p_command_id);
  PERFORM dispute.append_outbox('DISPUTE_TRIAGED',p_case_id,c.deal_id,result,'dispute-triaged:'||p_case_id,p_command_id,audit_id);
  PERFORM dispute.save_command('TRIAGE_CASE',p_command_id,p_idempotency_key,request_hash,result);
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.add_evidence(
  p_case_id text, p_type text, p_description text, p_source text, p_file_id text,
  p_command_id text, p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE c dispute.cases%ROWTYPE; previous_hash text; evidence_hash text; evidence_id text := 'dispute-evidence:'||gen_random_uuid()::text;
  request_hash text; replay jsonb; result jsonb; audit_id text; trusted_value boolean;
BEGIN
  PERFORM dispute.assert_actor(ARRAY['BUYER','FARMER','LAB','SURVEYOR','SUPPORT_MANAGER','COMPLIANCE_OFFICER','ARBITRATOR','ADMIN']);
  request_hash := encode(digest(convert_to(jsonb_build_object('caseId',p_case_id,'type',p_type,'description',p_description,'source',p_source,'fileId',p_file_id)::text,'UTF8'),'sha256'),'hex');
  replay := dispute.replay_command('ADD_EVIDENCE',p_idempotency_key,request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('dispute:case:'||p_case_id,0));
  SELECT * INTO c FROM dispute.cases WHERE id=p_case_id AND tenant_id=current_setting('app.current_tenant_id',true) FOR UPDATE;
  IF NOT FOUND OR NOT dispute.can_read_case(p_case_id) THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_CASE_NOT_FOUND'; END IF;
  IF c.status = 'FINAL' THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_INVALID_STATE'; END IF;
  SELECT e.evidence_hash INTO previous_hash FROM dispute.evidence e
    WHERE e.tenant_id=c.tenant_id AND e.case_id=c.id ORDER BY e.created_at DESC,e.id DESC LIMIT 1;
  trusted_value := current_setting('app.current_role',true)=ANY(ARRAY['LAB','SURVEYOR','COMPLIANCE_OFFICER','ADMIN']);
  evidence_hash := encode(digest(convert_to(jsonb_build_object(
    'id',evidence_id,'caseId',p_case_id,'type',p_type,'description',p_description,
    'source',p_source,'fileId',p_file_id,'trusted',trusted_value,
    'submittedBy',current_setting('app.current_user_id',true),'previousHash',previous_hash
  )::text,'UTF8'),'sha256'),'hex');
  INSERT INTO dispute.evidence (
    id,tenant_id,case_id,evidence_type,description,source,file_id,trusted,
    submitted_by_user_id,submitted_by_role,evidence_hash,previous_hash,command_id,created_at
  ) VALUES (
    evidence_id,c.tenant_id,c.id,p_type,p_description,p_source,NULLIF(p_file_id,''),trusted_value,
    current_setting('app.current_user_id',true),current_setting('app.current_role',true),
    evidence_hash,previous_hash,p_command_id,clock_timestamp()
  );
  result := dispute.case_snapshot(p_case_id);
  audit_id := dispute.append_audit('dispute:evidence_added',p_case_id,c.deal_id,NULL,result,
    jsonb_build_object('evidenceId',evidence_id,'evidenceHash',evidence_hash),p_command_id);
  PERFORM dispute.append_outbox('DISPUTE_EVIDENCE_ADDED',p_case_id,c.deal_id,
    jsonb_build_object('evidenceId',evidence_id,'evidenceHash',evidence_hash),
    'dispute-evidence:'||evidence_id,p_command_id,audit_id);
  PERFORM dispute.save_command('ADD_EVIDENCE',p_command_id,p_idempotency_key,request_hash,result);
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.assign_arbitrator(
  p_case_id text, p_command_id text, p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE c dispute.cases%ROWTYPE; before_state jsonb; result jsonb; request_hash text; replay jsonb; audit_id text;
BEGIN
  PERFORM dispute.assert_actor(ARRAY['ARBITRATOR','ADMIN']);
  request_hash := encode(digest(convert_to(jsonb_build_object('caseId',p_case_id)::text,'UTF8'),'sha256'),'hex');
  replay := dispute.replay_command('ASSIGN_ARBITRATOR',p_idempotency_key,request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('dispute:case:'||p_case_id,0));
  SELECT * INTO c FROM dispute.cases WHERE id=p_case_id AND tenant_id=current_setting('app.current_tenant_id',true) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_CASE_NOT_FOUND'; END IF;
  IF c.status NOT IN ('OPEN','UNDER_REVIEW','ARBITRATION') THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_INVALID_STATE'; END IF;
  IF c.assigned_arbitrator_user_id IS NOT NULL AND c.assigned_arbitrator_user_id<>current_setting('app.current_user_id',true)
     AND current_setting('app.current_role',true)<>'ADMIN' THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_ALREADY_ASSIGNED';
  END IF;
  before_state := dispute.case_snapshot(p_case_id);
  UPDATE dispute.cases SET status='ARBITRATION',assigned_arbitrator_user_id=current_setting('app.current_user_id',true)
    WHERE id=p_case_id;
  result := dispute.case_snapshot(p_case_id);
  audit_id := dispute.append_audit('dispute:arbitrator_assigned',p_case_id,c.deal_id,before_state,result,'{}'::jsonb,p_command_id);
  PERFORM dispute.append_outbox('DISPUTE_ARBITRATOR_ASSIGNED',p_case_id,c.deal_id,result,
    'dispute-assigned:'||p_case_id,p_command_id,audit_id);
  PERFORM dispute.save_command('ASSIGN_ARBITRATOR',p_command_id,p_idempotency_key,request_hash,result);
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.add_note(
  p_case_id text, p_note text, p_command_id text, p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE c dispute.cases%ROWTYPE; result jsonb; request_hash text; replay jsonb; audit_id text;
BEGIN
  PERFORM dispute.assert_actor(ARRAY['ARBITRATOR','ADMIN']);
  request_hash := encode(digest(convert_to(jsonb_build_object('caseId',p_case_id,'note',p_note)::text,'UTF8'),'sha256'),'hex');
  replay := dispute.replay_command('ADD_NOTE',p_idempotency_key,request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('dispute:case:'||p_case_id,0));
  SELECT * INTO c FROM dispute.cases WHERE id=p_case_id AND tenant_id=current_setting('app.current_tenant_id',true) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_CASE_NOT_FOUND'; END IF;
  IF c.assigned_arbitrator_user_id<>current_setting('app.current_user_id',true) AND current_setting('app.current_role',true)<>'ADMIN' THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_ARBITRATOR_REQUIRED';
  END IF;
  UPDATE dispute.cases SET arbitrator_notes=p_note WHERE id=p_case_id;
  result := dispute.case_snapshot(p_case_id);
  audit_id := dispute.append_audit('dispute:arbitrator_note',p_case_id,c.deal_id,NULL,result,'{}'::jsonb,p_command_id);
  PERFORM dispute.save_command('ADD_NOTE',p_command_id,p_idempotency_key,request_hash,result);
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.resolve_case(
  p_case_id text, p_outcome text, p_split_buyer_pct integer, p_reason text,
  p_command_id text, p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE c dispute.cases%ROWTYPE; h dispute.holds%ROWTYPE; deal_row public.deals%ROWTYPE;
  request_hash text; replay jsonb; before_state jsonb; result jsonb; audit_id text;
  buyer_amount bigint:=0; seller_amount bigint:=0; escrow_amount bigint:=0; hold_account text;
BEGIN
  PERFORM dispute.assert_actor(ARRAY['ARBITRATOR','ADMIN']);
  IF p_outcome NOT IN ('BUYER_WINS','SELLER_WINS','SPLIT','CANCELLED') THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_INVALID_OUTCOME';
  END IF;
  IF p_outcome='SPLIT' AND (p_split_buyer_pct IS NULL OR p_split_buyer_pct NOT BETWEEN 0 AND 100) THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_INVALID_SPLIT';
  END IF;
  request_hash := encode(digest(convert_to(jsonb_build_object('caseId',p_case_id,'outcome',p_outcome,'splitBuyerPct',p_split_buyer_pct,'reason',p_reason)::text,'UTF8'),'sha256'),'hex');
  replay := dispute.replay_command('RESOLVE_CASE',p_idempotency_key,request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('dispute:case:'||p_case_id,0));
  SELECT * INTO c FROM dispute.cases WHERE id=p_case_id AND tenant_id=current_setting('app.current_tenant_id',true) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_CASE_NOT_FOUND'; END IF;
  IF c.status NOT IN ('UNDER_REVIEW','ARBITRATION') THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_INVALID_STATE'; END IF;
  IF c.assigned_arbitrator_user_id IS DISTINCT FROM current_setting('app.current_user_id',true)
     AND current_setting('app.current_role',true)<>'ADMIN' THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_ARBITRATOR_REQUIRED';
  END IF;
  SELECT * INTO deal_row FROM public.deals WHERE id=c.deal_id;
  SELECT * INTO h FROM dispute.holds WHERE tenant_id=c.tenant_id AND case_id=c.id FOR UPDATE;
  before_state := dispute.case_snapshot(p_case_id);
  IF h.id IS NOT NULL AND h.status='HELD' THEN
    IF p_outcome='BUYER_WINS' THEN buyer_amount:=h.amount_kopecks;
    ELSIF p_outcome='SELLER_WINS' THEN seller_amount:=h.amount_kopecks;
    ELSIF p_outcome='SPLIT' THEN
      buyer_amount := (h.amount_kopecks * p_split_buyer_pct + 50) / 100;
      seller_amount := h.amount_kopecks - buyer_amount;
    ELSE escrow_amount:=h.amount_kopecks; END IF;
    hold_account := 'dispute-hold:'||c.id;
    IF buyer_amount>0 THEN PERFORM dispute.post_ledger(c.id,c.deal_id,'REFUND',hold_account,'buyer:'||deal_row."buyerOrgId",buyer_amount,'dispute-resolve:'||c.id||':buyer','Buyer dispute allocation'); END IF;
    IF seller_amount>0 THEN PERFORM dispute.post_ledger(c.id,c.deal_id,'RELEASE',hold_account,'seller:'||deal_row."sellerOrgId",seller_amount,'dispute-resolve:'||c.id||':seller','Seller dispute allocation'); END IF;
    IF escrow_amount>0 THEN PERFORM dispute.post_ledger(c.id,c.deal_id,'REFUND',hold_account,'escrow:'||c.deal_id,escrow_amount,'dispute-resolve:'||c.id||':escrow','Return disputed hold to deal escrow'); END IF;
    UPDATE dispute.holds SET status='RELEASED',released_at=clock_timestamp(),release_reason=p_outcome,version=version+1
      WHERE tenant_id=c.tenant_id AND case_id=c.id;
  END IF;
  UPDATE dispute.cases SET status='RESOLVED',outcome=p_outcome,
    outcome_split_buyer_pct=CASE WHEN p_outcome='SPLIT' THEN p_split_buyer_pct ELSE NULL END,
    decision_reason=p_reason,resolved_by_user_id=current_setting('app.current_user_id',true),
    resolved_at=clock_timestamp(),appeal_deadline_at=transaction_timestamp()+interval '7 days',
    bank_basis_document_id='dispute-basis:'||c.id||':'||(c.version+1)::text
    WHERE id=c.id;
  result := dispute.case_snapshot(p_case_id);
  audit_id := dispute.append_audit('dispute:resolved',c.id,c.deal_id,before_state,result,
    jsonb_build_object('outcome',p_outcome,'buyerAmountKopecks',buyer_amount::text,'sellerAmountKopecks',seller_amount::text,'escrowAmountKopecks',escrow_amount::text),p_command_id);
  PERFORM dispute.append_outbox('DISPUTE_SETTLEMENT_BASIS_READY',c.id,c.deal_id,
    jsonb_build_object('outcome',p_outcome,'buyerAmountKopecks',buyer_amount::text,'sellerAmountKopecks',seller_amount::text,'escrowAmountKopecks',escrow_amount::text,'appealDeadlineAt',(transaction_timestamp()+interval '7 days'),'releaseEligible',false),
    'dispute-settlement-basis:'||c.id||':'||(c.version+1)::text,p_command_id,audit_id);
  PERFORM dispute.save_command('RESOLVE_CASE',p_command_id,p_idempotency_key,request_hash,result);
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.open_appeal(
  p_case_id text, p_requested_outcome text, p_requested_split_buyer_pct integer,
  p_reason text, p_command_id text, p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE c dispute.cases%ROWTYPE; appeal_id text:='dispute-appeal:'||gen_random_uuid()::text;
  request_hash text; replay jsonb; result jsonb; audit_id text;
BEGIN
  PERFORM dispute.assert_actor(ARRAY['BUYER','FARMER','ADMIN']);
  IF p_requested_outcome NOT IN ('BUYER_WINS','SELLER_WINS','SPLIT','CANCELLED') THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_INVALID_OUTCOME'; END IF;
  IF p_requested_outcome='SPLIT' AND (p_requested_split_buyer_pct IS NULL OR p_requested_split_buyer_pct NOT BETWEEN 0 AND 100) THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_INVALID_SPLIT'; END IF;
  request_hash:=encode(digest(convert_to(jsonb_build_object('caseId',p_case_id,'requestedOutcome',p_requested_outcome,'splitBuyerPct',p_requested_split_buyer_pct,'reason',p_reason)::text,'UTF8'),'sha256'),'hex');
  replay:=dispute.replay_command('OPEN_APPEAL',p_idempotency_key,request_hash); IF replay IS NOT NULL THEN RETURN replay; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('dispute:case:'||p_case_id,0));
  SELECT * INTO c FROM dispute.cases WHERE id=p_case_id AND tenant_id=current_setting('app.current_tenant_id',true) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_CASE_NOT_FOUND'; END IF;
  IF c.status<>'RESOLVED' OR c.appeal_deadline_at<transaction_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_APPEAL_WINDOW_CLOSED'; END IF;
  IF current_setting('app.current_role',true)<>'ADMIN' AND current_setting('app.current_org_id',true) NOT IN (c.initiator_org_id,c.respondent_org_id) THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_DEAL_ACCESS_DENIED'; END IF;
  INSERT INTO dispute.appeals (id,tenant_id,case_id,status,requested_outcome,requested_split_buyer_pct,reason,opened_by_user_id,opened_by_org_id,opened_at)
    VALUES (appeal_id,c.tenant_id,c.id,'OPEN',p_requested_outcome,CASE WHEN p_requested_outcome='SPLIT' THEN p_requested_split_buyer_pct ELSE NULL END,p_reason,current_setting('app.current_user_id',true),current_setting('app.current_org_id',true),clock_timestamp());
  UPDATE dispute.cases SET status='APPEALED' WHERE id=c.id;
  result:=dispute.case_snapshot(c.id);
  audit_id:=dispute.append_audit('dispute:appeal_opened',c.id,c.deal_id,NULL,result,jsonb_build_object('appealId',appeal_id),p_command_id);
  PERFORM dispute.append_outbox('DISPUTE_APPEAL_OPENED',c.id,c.deal_id,jsonb_build_object('appealId',appeal_id),'dispute-appeal-opened:'||c.id,p_command_id,audit_id);
  PERFORM dispute.save_command('OPEN_APPEAL',p_command_id,p_idempotency_key,request_hash,result);
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.resolve_appeal(
  p_case_id text, p_granted boolean, p_final_outcome text, p_final_split_buyer_pct integer,
  p_note text, p_command_id text, p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE c dispute.cases%ROWTYPE; a dispute.appeals%ROWTYPE; deal_row public.deals%ROWTYPE; h dispute.holds%ROWTYPE;
  request_hash text; replay jsonb; result jsonb; audit_id text; hold_account text;
  old_buyer bigint:=0;old_seller bigint:=0;old_escrow bigint:=0;new_buyer bigint:=0;new_seller bigint:=0;new_escrow bigint:=0;
BEGIN
  PERFORM dispute.assert_actor(ARRAY['ARBITRATOR','ADMIN']);
  IF p_granted AND p_final_outcome NOT IN ('BUYER_WINS','SELLER_WINS','SPLIT','CANCELLED') THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_INVALID_OUTCOME'; END IF;
  IF p_granted AND p_final_outcome='SPLIT' AND (p_final_split_buyer_pct IS NULL OR p_final_split_buyer_pct NOT BETWEEN 0 AND 100) THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_INVALID_SPLIT'; END IF;
  request_hash:=encode(digest(convert_to(jsonb_build_object('caseId',p_case_id,'granted',p_granted,'finalOutcome',p_final_outcome,'splitBuyerPct',p_final_split_buyer_pct,'note',p_note)::text,'UTF8'),'sha256'),'hex');
  replay:=dispute.replay_command('RESOLVE_APPEAL',p_idempotency_key,request_hash); IF replay IS NOT NULL THEN RETURN replay; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('dispute:case:'||p_case_id,0));
  SELECT * INTO c FROM dispute.cases WHERE id=p_case_id AND tenant_id=current_setting('app.current_tenant_id',true) FOR UPDATE;
  SELECT * INTO a FROM dispute.appeals WHERE tenant_id=current_setting('app.current_tenant_id',true) AND case_id=p_case_id FOR UPDATE;
  IF c.id IS NULL OR a.id IS NULL OR c.status<>'APPEALED' OR a.status<>'OPEN' THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='DISPUTE_INVALID_STATE'; END IF;
  SELECT * INTO deal_row FROM public.deals WHERE id=c.deal_id;
  SELECT * INTO h FROM dispute.holds WHERE tenant_id=c.tenant_id AND case_id=c.id;
  IF p_granted AND h.id IS NOT NULL THEN
    IF c.outcome='BUYER_WINS' THEN old_buyer:=h.amount_kopecks; ELSIF c.outcome='SELLER_WINS' THEN old_seller:=h.amount_kopecks;
    ELSIF c.outcome='SPLIT' THEN old_buyer:=(h.amount_kopecks*COALESCE(c.outcome_split_buyer_pct,50)+50)/100;old_seller:=h.amount_kopecks-old_buyer;
    ELSE old_escrow:=h.amount_kopecks; END IF;
    IF p_final_outcome='BUYER_WINS' THEN new_buyer:=h.amount_kopecks; ELSIF p_final_outcome='SELLER_WINS' THEN new_seller:=h.amount_kopecks;
    ELSIF p_final_outcome='SPLIT' THEN new_buyer:=(h.amount_kopecks*p_final_split_buyer_pct+50)/100;new_seller:=h.amount_kopecks-new_buyer;
    ELSE new_escrow:=h.amount_kopecks; END IF;
    hold_account:='dispute-hold:'||c.id;
    IF old_buyer>0 THEN PERFORM dispute.post_ledger(c.id,c.deal_id,'REFUND','buyer:'||deal_row."buyerOrgId",hold_account,old_buyer,'dispute-appeal:'||c.id||':reverse-buyer','Reverse prior buyer allocation'); END IF;
    IF old_seller>0 THEN PERFORM dispute.post_ledger(c.id,c.deal_id,'REFUND','seller:'||deal_row."sellerOrgId",hold_account,old_seller,'dispute-appeal:'||c.id||':reverse-seller','Reverse prior seller allocation'); END IF;
    IF old_escrow>0 THEN PERFORM dispute.post_ledger(c.id,c.deal_id,'HOLD','escrow:'||c.deal_id,hold_account,old_escrow,'dispute-appeal:'||c.id||':reverse-escrow','Restore appealed amount to dispute hold'); END IF;
    IF new_buyer>0 THEN PERFORM dispute.post_ledger(c.id,c.deal_id,'REFUND',hold_account,'buyer:'||deal_row."buyerOrgId",new_buyer,'dispute-appeal:'||c.id||':buyer','Final buyer allocation'); END IF;
    IF new_seller>0 THEN PERFORM dispute.post_ledger(c.id,c.deal_id,'RELEASE',hold_account,'seller:'||deal_row."sellerOrgId",new_seller,'dispute-appeal:'||c.id||':seller','Final seller allocation'); END IF;
    IF new_escrow>0 THEN PERFORM dispute.post_ledger(c.id,c.deal_id,'REFUND',hold_account,'escrow:'||c.deal_id,new_escrow,'dispute-appeal:'||c.id||':escrow','Final return to escrow'); END IF;
    UPDATE dispute.cases SET outcome=p_final_outcome,outcome_split_buyer_pct=CASE WHEN p_final_outcome='SPLIT' THEN p_final_split_buyer_pct ELSE NULL END,
      decision_reason=p_note,resolved_by_user_id=current_setting('app.current_user_id',true),resolved_at=clock_timestamp(),bank_basis_document_id='dispute-basis:'||c.id||':appeal' WHERE id=c.id;
  END IF;
  UPDATE dispute.appeals SET status=CASE WHEN p_granted THEN 'GRANTED' ELSE 'DENIED' END,decided_by_user_id=current_setting('app.current_user_id',true),decision_note=p_note,resolved_at=clock_timestamp() WHERE id=a.id;
  UPDATE dispute.cases SET status='FINAL' WHERE id=c.id;
  result:=dispute.case_snapshot(c.id);
  audit_id:=dispute.append_audit('dispute:appeal_resolved',c.id,c.deal_id,NULL,result,jsonb_build_object('granted',p_granted),p_command_id);
  PERFORM dispute.append_outbox('DISPUTE_FINAL_SETTLEMENT_BASIS_READY',c.id,c.deal_id,
    jsonb_build_object('granted',p_granted,'outcome',CASE WHEN p_granted THEN p_final_outcome ELSE c.outcome END,'releaseEligible',true),
    'dispute-final-basis:'||c.id,p_command_id,audit_id);
  PERFORM dispute.save_command('RESOLVE_APPEAL',p_command_id,p_idempotency_key,request_hash,result);
  RETURN result;
END
$function$;

-- Tenant-scoped read policies. Mutations remain function-only.
DO $block$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['cases','holds','evidence','appeals','ledger_links','command_receipts'] LOOP
    EXECUTE format('ALTER TABLE dispute.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE dispute.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS dispute_tenant_read ON dispute.%I', table_name);
  END LOOP;
END
$block$;

CREATE POLICY dispute_tenant_read ON dispute.cases FOR SELECT TO app_deal
USING (tenant_id=current_setting('app.current_tenant_id',true) AND dispute.can_read_case(id));
CREATE POLICY dispute_tenant_read ON dispute.holds FOR SELECT TO app_deal
USING (tenant_id=current_setting('app.current_tenant_id',true) AND dispute.can_read_case(case_id));
CREATE POLICY dispute_tenant_read ON dispute.evidence FOR SELECT TO app_deal
USING (tenant_id=current_setting('app.current_tenant_id',true) AND dispute.can_read_case(case_id));
CREATE POLICY dispute_tenant_read ON dispute.appeals FOR SELECT TO app_deal
USING (tenant_id=current_setting('app.current_tenant_id',true) AND dispute.can_read_case(case_id));
CREATE POLICY dispute_tenant_read ON dispute.ledger_links FOR SELECT TO app_deal
USING (tenant_id=current_setting('app.current_tenant_id',true) AND dispute.can_read_case(case_id));
CREATE POLICY dispute_tenant_read ON dispute.command_receipts FOR SELECT TO app_deal
USING (tenant_id=current_setting('app.current_tenant_id',true) AND actor_user_id=current_setting('app.current_user_id',true));

REVOKE ALL ON ALL TABLES IN SCHEMA dispute FROM PUBLIC, app_deal;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dispute FROM PUBLIC;
GRANT USAGE ON SCHEMA dispute TO app_deal;
GRANT SELECT ON dispute.cases, dispute.holds, dispute.evidence, dispute.appeals,
  dispute.ledger_links, dispute.command_receipts TO app_deal;
GRANT EXECUTE ON FUNCTION dispute.case_snapshot(text) TO app_deal;
GRANT EXECUTE ON FUNCTION dispute.open_case(text,text,text,text,bigint,text,text,text) TO app_deal;
GRANT EXECUTE ON FUNCTION dispute.triage_case(text,text,text) TO app_deal;
GRANT EXECUTE ON FUNCTION dispute.add_evidence(text,text,text,text,text,text,text) TO app_deal;
GRANT EXECUTE ON FUNCTION dispute.assign_arbitrator(text,text,text) TO app_deal;
GRANT EXECUTE ON FUNCTION dispute.add_note(text,text,text,text) TO app_deal;
GRANT EXECUTE ON FUNCTION dispute.resolve_case(text,text,integer,text,text,text) TO app_deal;
GRANT EXECUTE ON FUNCTION dispute.open_appeal(text,text,integer,text,text,text) TO app_deal;
GRANT EXECUTE ON FUNCTION dispute.resolve_appeal(text,boolean,text,integer,text,text,text) TO app_deal;
