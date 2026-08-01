-- P0.3 FIRST VERIFIED TRADE — cross-organization participation.
--
-- The auction contour is authoritative and correct, but it resolves every lot,
-- bid, admission and award through a single `app.current_tenant_id`. Production
-- registration assigns one tenant per organization, so a real buyer and a real
-- seller never share a tenant and cannot trade at all.
--
-- This migration does NOT weaken the tenant predicate. It keeps default-deny and
-- adds one explicit, audited, expiring participation grant — the same shape the
-- FGIS layer already uses for cross-tenant reads
-- (fgis_grain_tenant_read_authorizations). A lot becomes visible and biddable to
-- an outside organization only while a matching ACTIVE grant exists.
--
-- Authority to issue a grant stays with the lot's own tenant, matching the
-- existing admission authority (ADMIN / COMPLIANCE_OFFICER / SUPPORT_MANAGER).
--
-- Registration, memberships, roles and MFA (#3563) are untouched. FGIS
-- connection, sync, snapshots and reconciliation (#3585) are untouched.

-- ---------------------------------------------------------------------------
-- 1. Participant tenancy is recorded explicitly.
-- ---------------------------------------------------------------------------
-- Bids and admissions are stored under the LOT's tenant because their foreign
-- keys point at auction.lots (tenant_id, id). Recording the participant's own
-- tenant keeps cross-tenant rows self-describing for RLS and for audit.

ALTER TABLE auction.bids
  ADD COLUMN IF NOT EXISTS buyer_tenant_id text;
ALTER TABLE auction.admissions
  ADD COLUMN IF NOT EXISTS participant_tenant_id text;

UPDATE auction.bids SET buyer_tenant_id = tenant_id WHERE buyer_tenant_id IS NULL;
UPDATE auction.admissions SET participant_tenant_id = tenant_id WHERE participant_tenant_id IS NULL;

-- ---------------------------------------------------------------------------
-- 2. The participation grant.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS auction.participation_grants (
  id text PRIMARY KEY,
  lot_tenant_id text NOT NULL,
  lot_id text NOT NULL,
  participant_tenant_id text NOT NULL,
  participant_org_id text NOT NULL,
  allowed_operations text[] NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
  valid_until timestamptz NOT NULL,
  authorization_reference text NOT NULL,
  reason text NOT NULL,
  granted_by_actor_id text NOT NULL,
  revoked_by_actor_id text,
  revoked_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT auction_participation_grants_scope_key
    UNIQUE (lot_tenant_id, lot_id, participant_org_id),
  CONSTRAINT auction_participation_grants_lot_fkey
    FOREIGN KEY (lot_tenant_id, lot_id)
    REFERENCES auction.lots (tenant_id, id) ON DELETE RESTRICT ON UPDATE CASCADE,
  -- Only operations the showcase contract knows about may be granted.
  CONSTRAINT auction_participation_grants_operations_check CHECK (
    array_length(allowed_operations, 1) >= 1
    AND allowed_operations <@ ARRAY['VIEW_LOT', 'PLACE_BID']::text[]
  ),
  -- PLACE_BID without VIEW_LOT would let an organization bid blind.
  CONSTRAINT auction_participation_grants_bid_requires_view_check CHECK (
    NOT ('PLACE_BID' = ANY(allowed_operations)) OR 'VIEW_LOT' = ANY(allowed_operations)
  ),
  CONSTRAINT auction_participation_grants_revocation_check CHECK (
    (status = 'REVOKED' AND revoked_by_actor_id IS NOT NULL AND revoked_at IS NOT NULL)
    OR (status <> 'REVOKED' AND revoked_by_actor_id IS NULL AND revoked_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS auction_participation_grants_lookup_idx
  ON auction.participation_grants (
    participant_org_id, status, valid_until, lot_tenant_id, lot_id
  );
CREATE INDEX IF NOT EXISTS auction_participation_grants_lot_idx
  ON auction.participation_grants (lot_tenant_id, lot_id, status);

DROP TRIGGER IF EXISTS auction_participation_grants_touch_version ON auction.participation_grants;
CREATE TRIGGER auction_participation_grants_touch_version
BEFORE UPDATE ON auction.participation_grants
FOR EACH ROW EXECUTE FUNCTION auction.touch_version();

-- A grant must never name the lot's own seller: that is the self-bid path.
CREATE OR REPLACE FUNCTION auction.participation_grant_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
DECLARE
  lot_record auction.lots%ROWTYPE;
  participant_tenant text;
BEGIN
  SELECT * INTO lot_record
  FROM auction.lots
  WHERE tenant_id = NEW.lot_tenant_id AND id = NEW.lot_id
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'AUCTION_GRANT_LOT_NOT_FOUND';
  END IF;

  IF NEW.participant_org_id = lot_record.seller_org_id THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'AUCTION_GRANT_SELF_PARTICIPATION_DENIED';
  END IF;

  -- The recorded participant tenant must be the organization's real tenant.
  SELECT organization."tenantId" INTO participant_tenant
  FROM public."organizations" organization
  WHERE organization."id" = NEW.participant_org_id
  FOR KEY SHARE;
  IF NOT FOUND OR participant_tenant IS DISTINCT FROM NEW.participant_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'AUCTION_GRANT_PARTICIPANT_TENANT_MISMATCH';
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS auction_participation_grants_authority_guard ON auction.participation_grants;
CREATE TRIGGER auction_participation_grants_authority_guard
BEFORE INSERT OR UPDATE ON auction.participation_grants
FOR EACH ROW EXECUTE FUNCTION auction.participation_grant_guard();

-- ---------------------------------------------------------------------------
-- 3. The single predicate every reader and command goes through.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION auction.participation_allowed(
  p_lot_tenant_id text,
  p_lot_id text,
  p_operation text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
STABLE
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM auction.participation_grants grant_row
    WHERE grant_row.lot_tenant_id = p_lot_tenant_id
      AND grant_row.lot_id = p_lot_id
      AND grant_row.participant_org_id = NULLIF(current_setting('app.current_org_id', true), '')
      AND grant_row.participant_tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
      AND grant_row.status = 'ACTIVE'
      AND grant_row.valid_until > clock_timestamp()
      AND p_operation = ANY(grant_row.allowed_operations)
  )
$function$;

-- Readable scope = own tenant, or an explicit unexpired grant.
CREATE OR REPLACE FUNCTION auction.lot_readable(p_lot_tenant_id text, p_lot_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
STABLE
AS $function$
  SELECT
    public.app_rls_context_ready()
    AND (
      p_lot_tenant_id = current_setting('app.current_tenant_id', true)
      OR auction.participation_allowed(p_lot_tenant_id, p_lot_id, 'VIEW_LOT')
    )
$function$;

-- ---------------------------------------------------------------------------
-- 4. RLS: extend, never loosen.
-- ---------------------------------------------------------------------------

ALTER TABLE auction.participation_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction.participation_grants FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auction_participation_grants_select ON auction.participation_grants;
CREATE POLICY auction_participation_grants_select
ON auction.participation_grants
FOR SELECT
USING (
  public.app_rls_context_ready()
  AND (
    lot_tenant_id = current_setting('app.current_tenant_id', true)
    OR (
      participant_org_id = current_setting('app.current_org_id', true)
      AND participant_tenant_id = current_setting('app.current_tenant_id', true)
    )
  )
);

-- The base lot row stays strictly tenant-local. It carries raw FGIS provenance
-- (source_external_id, source_certificate_id), the seller's internal user id and
-- the pickup address. Widening this policy to honour grants would hand all of
-- that to the counterparty, because RLS filters rows, not columns. Cross-tenant
-- disclosure therefore happens ONLY through auction.lot_showcase, which projects
-- the permitted columns and applies the grant predicate itself.
DROP POLICY IF EXISTS auction_lots_tenant_select ON auction.lots;
CREATE POLICY auction_lots_tenant_select
ON auction.lots
FOR SELECT
USING (
  public.app_rls_context_ready()
  AND tenant_id = current_setting('app.current_tenant_id', true)
);

-- Bids were previously readable by every actor in the tenant, which exposed
-- rival bids to competing buyers. Narrow to: privileged, own bids, or the
-- seller of the lot.
DROP POLICY IF EXISTS auction_bids_tenant_select ON auction.bids;
CREATE POLICY auction_bids_tenant_select
ON auction.bids
FOR SELECT
USING (
  public.app_rls_context_ready()
  AND (
    public.app_rls_privileged()
    OR (
      buyer_org_id = current_setting('app.current_org_id', true)
      AND buyer_tenant_id = current_setting('app.current_tenant_id', true)
    )
    OR EXISTS (
      SELECT 1 FROM auction.lots lot
      WHERE lot.tenant_id = bids.tenant_id
        AND lot.id = bids.lot_id
        AND lot.tenant_id = current_setting('app.current_tenant_id', true)
        AND lot.seller_org_id = current_setting('app.current_org_id', true)
    )
  )
);

DROP POLICY IF EXISTS auction_awards_tenant_select ON auction.awards;
CREATE POLICY auction_awards_tenant_select
ON auction.awards
FOR SELECT
USING (
  public.app_rls_context_ready()
  AND (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR EXISTS (
      SELECT 1 FROM auction.bids winning_bid
      WHERE winning_bid.tenant_id = awards.tenant_id
        AND winning_bid.lot_id = awards.lot_id
        AND winning_bid.id = awards.winning_bid_id
        AND winning_bid.buyer_org_id = current_setting('app.current_org_id', true)
        AND winning_bid.buyer_tenant_id = current_setting('app.current_tenant_id', true)
    )
  )
);

DROP POLICY IF EXISTS auction_admissions_tenant_select ON auction.admissions;
CREATE POLICY auction_admissions_tenant_select
ON auction.admissions
FOR SELECT
USING (
  public.app_rls_context_ready()
  AND (
    public.app_rls_privileged()
    OR (
      participant_org_id = current_setting('app.current_org_id', true)
      AND participant_tenant_id = current_setting('app.current_tenant_id', true)
    )
    OR EXISTS (
      SELECT 1 FROM auction.lots lot
      WHERE lot.tenant_id = admissions.tenant_id
        AND lot.id = admissions.lot_id
        AND lot.tenant_id = current_setting('app.current_tenant_id', true)
        AND lot.seller_org_id = current_setting('app.current_org_id', true)
    )
  )
);

-- ---------------------------------------------------------------------------
-- 5. The cross-organization showcase.
-- ---------------------------------------------------------------------------
-- Buyer B sees permitted commercial terms of seller A's lot and nothing else.
-- Withheld: raw FGIS provenance (source_external_id, source_certificate_id),
-- internal actor IDs (seller_user_id), pickup address (PII / operational),
-- and every rival bid. The current leading price is disclosed because a bidder
-- cannot form a valid bid without it; the leading bidder's identity is not.
--
-- The view runs with the owner's rights (security_invoker is deliberately OFF)
-- and carries the authorization in its own WHERE clause. This is what makes the
-- projection meaningful: were it security_invoker, the caller would need SELECT
-- on auction.lots, and could then read the withheld columns straight from the
-- base table. security_barrier stops a cheap leaky-operator predicate from being
-- pushed below the authorization filter.

DROP VIEW IF EXISTS auction.lot_showcase;
CREATE VIEW auction.lot_showcase
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  lot.id AS lot_id,
  lot.tenant_id AS lot_tenant_id,
  lot.seller_org_id,
  seller."name" AS seller_org_name,
  lot.title,
  lot.culture,
  lot.grade,
  lot.volume_tons,
  lot.start_price_kopecks_per_ton,
  lot.step_price_kopecks_per_ton,
  lot.region,
  lot.status,
  lot.auction_ends_at,
  lot.auto_extend_enabled,
  lot.auto_extend_window_minutes,
  lot.auto_extend_minutes,
  lot.version,
  -- Provenance is disclosed as an attestation, never as the raw identifier.
  lot.source_type,
  (lot.source_verified_at IS NOT NULL) AS source_verified,
  lot.source_verified_at,
  lot.admission_status,
  (
    SELECT max(top_bid.amount_kopecks_per_ton)
    FROM auction.bids top_bid
    WHERE top_bid.tenant_id = lot.tenant_id
      AND top_bid.lot_id = lot.id
      AND top_bid.status IN ('PLACED', 'LEADING', 'OUTBID')
  ) AS leading_amount_kopecks_per_ton,
  (
    SELECT count(*)
    FROM auction.bids counted_bid
    WHERE counted_bid.tenant_id = lot.tenant_id
      AND counted_bid.lot_id = lot.id
      AND counted_bid.status IN ('PLACED', 'LEADING', 'OUTBID')
  ) AS bid_count,
  (lot.seller_org_id = NULLIF(current_setting('app.current_org_id', true), '')) AS is_own_lot,
  auction.participation_allowed(lot.tenant_id, lot.id, 'PLACE_BID') AS may_place_bid
FROM auction.lots lot
JOIN public."organizations" seller
  ON seller."id" = lot.seller_org_id
-- Authorization lives here, not in the caller's RLS: own tenant, or an ACTIVE
-- unexpired VIEW_LOT grant for the calling organization.
WHERE auction.lot_readable(lot.tenant_id, lot.id);

COMMENT ON VIEW auction.lot_showcase IS
  'Cross-organization lot projection. Excludes raw FGIS identifiers, internal actor IDs, address and rival bids. RLS on auction.lots decides row visibility.';

-- ---------------------------------------------------------------------------
-- 6. Self-bid prohibition, enforced at the storage layer.
-- ---------------------------------------------------------------------------
-- assert_actor(ARRAY['BUYER']) only blocks a FARMER session. An organization
-- holding both a FARMER and a BUYER membership could bid on its own lot, since
-- user_orgs is unique per (userId, organizationId) but not per organization.

CREATE OR REPLACE FUNCTION auction.bid_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
DECLARE
  lot_record auction.lots%ROWTYPE;
BEGIN
  SELECT * INTO lot_record
  FROM auction.lots
  WHERE tenant_id = NEW.tenant_id
    AND id = NEW.lot_id
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction lot does not exist in the same tenant' USING ERRCODE = '23503';
  END IF;

  IF lot_record.status <> 'BIDDING'
     OR lot_record.admission_status <> 'ADMITTED'
     OR lot_record.source_verified_at IS NULL
     OR lot_record.source_external_id IS NULL
     OR btrim(lot_record.source_external_id) = ''
  THEN
    RAISE EXCEPTION 'auction lot is not open for authoritative bidding' USING ERRCODE = '23514';
  END IF;

  IF NEW.volume_tons > lot_record.volume_tons THEN
    RAISE EXCEPTION 'bid volume exceeds authoritative lot volume' USING ERRCODE = '23514';
  END IF;

  IF NEW.buyer_org_id = lot_record.seller_org_id THEN
    RAISE EXCEPTION 'AUCTION_SELF_BID_DENIED' USING ERRCODE = '23514';
  END IF;

  IF NEW.buyer_tenant_id IS NULL THEN
    RAISE EXCEPTION 'AUCTION_BID_PARTICIPANT_TENANT_REQUIRED' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$function$;

-- ---------------------------------------------------------------------------
-- 7. Issuing a grant is an audited, idempotent command like every other.
-- ---------------------------------------------------------------------------

ALTER TABLE auction.command_receipts
  DROP CONSTRAINT IF EXISTS command_receipts_command_type_check;
DO $command_type_widen$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'auction.command_receipts'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%command_type%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE auction.command_receipts DROP CONSTRAINT %I', constraint_name);
  END IF;
END
$command_type_widen$;

ALTER TABLE auction.command_receipts
  ADD CONSTRAINT auction_command_receipts_command_type_check CHECK (
    command_type IN (
      'REGISTER_LOT', 'RECORD_ADMISSION', 'PLACE_BID', 'CLOSE_LOT',
      'GRANT_PARTICIPATION', 'REVOKE_PARTICIPATION'
    )
  );

CREATE OR REPLACE FUNCTION auction.grant_participation(
  p_lot_id text,
  p_participant_org_id text,
  p_allowed_operations text[],
  p_valid_until timestamptz,
  p_authorization_reference text,
  p_reason text,
  p_expected_version bigint,
  p_command_id text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
DECLARE
  request_hash text;
  replay jsonb;
  lot auction.lots%ROWTYPE;
  participant_tenant text;
  grant_id text := 'grant-' || gen_random_uuid()::text;
  existing auction.participation_grants%ROWTYPE;
  audit_id text;
  outbox_id text;
  result jsonb;
  now_at timestamptz := clock_timestamp();
BEGIN
  PERFORM auction.assert_actor(ARRAY['ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER']);
  request_hash := encode(digest(convert_to(concat_ws('|',
    p_lot_id, p_participant_org_id, array_to_string(p_allowed_operations, ','),
    p_valid_until::text, p_authorization_reference, p_reason, p_expected_version::text
  ), 'UTF8'), 'sha256'), 'hex');
  replay := auction.replay_command('GRANT_PARTICIPATION', p_idempotency_key, request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  PERFORM auction.lock_lot(p_lot_id);
  SELECT * INTO lot
  FROM auction.lots
  WHERE tenant_id = current_setting('app.current_tenant_id', true)
    AND id = p_lot_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_LOT_NOT_FOUND';
  END IF;
  IF lot.version <> p_expected_version THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_STALE_VERSION';
  END IF;
  IF lot.status NOT IN ('OPEN', 'BIDDING') OR now_at >= lot.auction_ends_at THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_NOT_OPEN';
  END IF;
  IF p_valid_until <= now_at THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_GRANT_EXPIRY_INVALID';
  END IF;
  IF NULLIF(btrim(p_authorization_reference), '') IS NULL
     OR NULLIF(btrim(p_reason), '') IS NULL
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_GRANT_JUSTIFICATION_REQUIRED';
  END IF;
  IF p_allowed_operations IS NULL
     OR array_length(p_allowed_operations, 1) IS NULL
     OR NOT (p_allowed_operations <@ ARRAY['VIEW_LOT', 'PLACE_BID']::text[])
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_GRANT_OPERATIONS_INVALID';
  END IF;
  IF p_participant_org_id = lot.seller_org_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_GRANT_SELF_PARTICIPATION_DENIED';
  END IF;

  -- The counterparty must clear the same risk bar the actor model applies.
  SELECT organization."tenantId" INTO participant_tenant
  FROM public."organizations" organization
  WHERE organization."id" = p_participant_org_id
    AND organization."status" IN ('VERIFIED', 'ACTIVE')
    AND organization."kycStatus" = 'APPROVED'
    AND organization."amlStatus" = 'CLEAR'
    AND organization."sanctionHit" = false
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_GRANT_PARTICIPANT_NOT_ELIGIBLE';
  END IF;

  SELECT * INTO existing
  FROM auction.participation_grants
  WHERE lot_tenant_id = lot.tenant_id
    AND lot_id = lot.id
    AND participant_org_id = p_participant_org_id
  FOR UPDATE;

  IF FOUND THEN
    UPDATE auction.participation_grants
    SET allowed_operations = p_allowed_operations,
        status = 'ACTIVE',
        valid_until = p_valid_until,
        authorization_reference = p_authorization_reference,
        reason = p_reason,
        granted_by_actor_id = current_setting('app.current_user_id', true),
        revoked_by_actor_id = NULL,
        revoked_at = NULL
    WHERE id = existing.id
    RETURNING id INTO grant_id;
  ELSE
    INSERT INTO auction.participation_grants (
      id, lot_tenant_id, lot_id, participant_tenant_id, participant_org_id,
      allowed_operations, status, valid_until, authorization_reference, reason,
      granted_by_actor_id, version, created_at, updated_at
    ) VALUES (
      grant_id, lot.tenant_id, lot.id, participant_tenant, p_participant_org_id,
      p_allowed_operations, 'ACTIVE', p_valid_until, p_authorization_reference,
      p_reason, current_setting('app.current_user_id', true), 1, now_at, now_at
    );
  END IF;

  audit_id := auction.append_audit(
    'auction.participation.grant',
    lot.id,
    NULL,
    jsonb_build_object(
      'grantId', grant_id,
      'participantOrgId', p_participant_org_id,
      'participantTenantId', participant_tenant,
      'allowedOperations', to_jsonb(p_allowed_operations),
      'validUntil', p_valid_until,
      'status', 'ACTIVE'
    ),
    jsonb_build_object(
      'commandId', p_command_id,
      'authorizationReference', p_authorization_reference,
      'reason', p_reason,
      'requestFingerprint', request_hash
    ),
    p_command_id
  );
  outbox_id := auction.append_outbox(
    'auction.participation.granted',
    jsonb_build_object(
      'lotId', lot.id,
      'grantId', grant_id,
      'participantOrgId', p_participant_org_id
    ),
    'auction-grant-event:' || lot.tenant_id || ':' || p_idempotency_key,
    p_command_id,
    audit_id
  );
  result := jsonb_build_object(
    'grantId', grant_id,
    'lotId', lot.id,
    'participantOrgId', p_participant_org_id,
    'participantTenantId', participant_tenant,
    'allowedOperations', to_jsonb(p_allowed_operations),
    'status', 'ACTIVE',
    'validUntil', p_valid_until,
    'requestFingerprint', request_hash,
    'auditId', audit_id,
    'outboxId', outbox_id,
    'duplicate', false
  );
  PERFORM auction.save_command(
    'GRANT_PARTICIPATION', p_command_id, p_idempotency_key, request_hash, result
  );
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION auction.revoke_participation(
  p_lot_id text,
  p_participant_org_id text,
  p_reason text,
  p_command_id text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
DECLARE
  request_hash text;
  replay jsonb;
  lot auction.lots%ROWTYPE;
  existing auction.participation_grants%ROWTYPE;
  audit_id text;
  result jsonb;
  now_at timestamptz := clock_timestamp();
BEGIN
  PERFORM auction.assert_actor(ARRAY['ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER']);
  request_hash := encode(digest(convert_to(concat_ws('|',
    p_lot_id, p_participant_org_id, p_reason
  ), 'UTF8'), 'sha256'), 'hex');
  replay := auction.replay_command('REVOKE_PARTICIPATION', p_idempotency_key, request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  PERFORM auction.lock_lot(p_lot_id);
  SELECT * INTO lot
  FROM auction.lots
  WHERE tenant_id = current_setting('app.current_tenant_id', true)
    AND id = p_lot_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_LOT_NOT_FOUND';
  END IF;
  IF NULLIF(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_GRANT_JUSTIFICATION_REQUIRED';
  END IF;

  SELECT * INTO existing
  FROM auction.participation_grants
  WHERE lot_tenant_id = lot.tenant_id
    AND lot_id = lot.id
    AND participant_org_id = p_participant_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_GRANT_NOT_FOUND';
  END IF;

  UPDATE auction.participation_grants
  SET status = 'REVOKED',
      reason = p_reason,
      revoked_by_actor_id = current_setting('app.current_user_id', true),
      revoked_at = now_at
  WHERE id = existing.id;

  audit_id := auction.append_audit(
    'auction.participation.revoke',
    lot.id,
    jsonb_build_object('grantId', existing.id, 'status', existing.status),
    jsonb_build_object('grantId', existing.id, 'status', 'REVOKED'),
    jsonb_build_object(
      'commandId', p_command_id,
      'reason', p_reason,
      'requestFingerprint', request_hash
    ),
    p_command_id
  );
  result := jsonb_build_object(
    'grantId', existing.id,
    'lotId', lot.id,
    'status', 'REVOKED',
    'requestFingerprint', request_hash,
    'auditId', audit_id,
    'duplicate', false
  );
  PERFORM auction.save_command(
    'REVOKE_PARTICIPATION', p_command_id, p_idempotency_key, request_hash, result
  );
  RETURN result;
END
$function$;

-- ---------------------------------------------------------------------------
-- 8. Grants for the application role.
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE auction.participation_grants FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.participation_grant_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.participation_allowed(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.lot_readable(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.grant_participation(text, text, text[], timestamptz, text, text, bigint, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.revoke_participation(text, text, text, text, text) FROM PUBLIC;

DO $auction_participation_grants_acl$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT SELECT ON auction.participation_grants TO app_deal;
    GRANT SELECT ON auction.lot_showcase TO app_deal;
    GRANT EXECUTE ON FUNCTION auction.participation_allowed(text, text, text) TO app_deal;
    GRANT EXECUTE ON FUNCTION auction.lot_readable(text, text) TO app_deal;
    GRANT EXECUTE ON FUNCTION auction.participation_grant_guard() TO app_deal;
    GRANT EXECUTE ON FUNCTION auction.grant_participation(text, text, text[], timestamptz, text, text, bigint, text, text) TO app_deal;
    GRANT EXECUTE ON FUNCTION auction.revoke_participation(text, text, text, text, text) TO app_deal;
  END IF;
END
$auction_participation_grants_acl$;

-- ---------------------------------------------------------------------------
-- 9. Serialization must key on the LOT's tenant, not the caller's.
-- ---------------------------------------------------------------------------
-- auction.lock_lot() hashes `app.current_tenant_id || ':auction:' || lot_id`.
-- Once bidders come from their own tenants, two buyers bidding on the same lot
-- would take two DIFFERENT advisory locks and serialize against nothing. The
-- lock must be derived from the lot's tenant so every participant contends on
-- the same key.

CREATE OR REPLACE FUNCTION auction.lock_lot_in_tenant(
  p_lot_tenant_id text,
  p_lot_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
BEGIN
  IF NULLIF(btrim(p_lot_id), '') IS NULL OR NULLIF(btrim(p_lot_tenant_id), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_LOT_ID_REQUIRED';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_lot_tenant_id || ':auction:' || p_lot_id, 2615)
  );
END
$function$;

-- Resolve a lot the caller may act on, from either their own tenant or a grant.
CREATE OR REPLACE FUNCTION auction.resolve_lot_tenant(
  p_lot_id text,
  p_operation text
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
STABLE
AS $function$
  SELECT lot.tenant_id
  FROM auction.lots lot
  WHERE lot.id = p_lot_id
    AND (
      lot.tenant_id = current_setting('app.current_tenant_id', true)
      OR auction.participation_allowed(lot.tenant_id, lot.id, p_operation)
    )
  LIMIT 1
$function$;

-- ---------------------------------------------------------------------------
-- 10. place_bid: cross-tenant capable, self-bid denied.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION auction.place_bid(
  p_lot_id text,
  p_amount_kopecks_per_ton bigint,
  p_volume_tons numeric,
  p_expected_version bigint,
  p_command_id text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
DECLARE
  request_hash text;
  replay jsonb;
  lot auction.lots%ROWTYPE;
  lot_tenant text;
  buyer_tenant text := current_setting('app.current_tenant_id', true);
  buyer_org text := current_setting('app.current_org_id', true);
  current_top bigint;
  bid_id text := 'bid-' || gen_random_uuid()::text;
  leader_id text;
  leader_amount bigint;
  new_end timestamptz;
  audit_id text;
  outbox_id text;
  result jsonb;
  now_at timestamptz := clock_timestamp();
BEGIN
  PERFORM auction.assert_actor(ARRAY['BUYER']);
  request_hash := encode(digest(convert_to(concat_ws('|',
    p_lot_id, p_amount_kopecks_per_ton::text, p_volume_tons::text,
    p_expected_version::text
  ), 'UTF8'), 'sha256'), 'hex');
  replay := auction.replay_command('PLACE_BID', p_idempotency_key, request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  lot_tenant := auction.resolve_lot_tenant(p_lot_id, 'PLACE_BID');
  IF lot_tenant IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_LOT_NOT_FOUND';
  END IF;

  PERFORM auction.lock_lot_in_tenant(lot_tenant, p_lot_id);
  SELECT * INTO lot
  FROM auction.lots
  WHERE tenant_id = lot_tenant
    AND id = p_lot_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_LOT_NOT_FOUND';
  END IF;

  -- Re-check the grant under the lock: it may have been revoked or expired
  -- between resolution and here.
  IF lot.tenant_id <> buyer_tenant
     AND NOT auction.participation_allowed(lot.tenant_id, lot.id, 'PLACE_BID')
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_PARTICIPATION_NOT_GRANTED';
  END IF;

  IF lot.seller_org_id = buyer_org THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_SELF_BID_DENIED';
  END IF;
  IF lot.version <> p_expected_version THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_STALE_VERSION';
  END IF;
  IF lot.status <> 'BIDDING' OR lot.admission_status <> 'ADMITTED' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_NOT_OPEN';
  END IF;
  IF now_at >= lot.auction_ends_at THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_BID_CUTOFF_REACHED';
  END IF;
  IF lot.seller_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_SELLER_AUTHORITY_MISSING';
  END IF;
  IF p_amount_kopecks_per_ton <= 0
     OR p_volume_tons <= 0
     OR p_volume_tons > lot.volume_tons
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_BID_TERMS_INVALID';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM auction.admissions admission
    WHERE admission.tenant_id = lot.tenant_id
      AND admission.lot_id = lot.id
      AND admission.participant_org_id = buyer_org
      AND admission.participant_tenant_id = buyer_tenant
      AND admission.participant_user_id = current_setting('app.current_user_id', true)
      AND admission.participant_role = 'BUYER'
      AND admission.status = 'ADMITTED'
      AND admission.valid_until > now_at
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_ADMISSION_REQUIRED';
  END IF;

  SELECT max(amount_kopecks_per_ton) INTO current_top
  FROM auction.bids
  WHERE tenant_id = lot.tenant_id
    AND lot_id = lot.id
    AND status IN ('PLACED', 'LEADING', 'OUTBID');
  IF current_top IS NULL THEN
    IF p_amount_kopecks_per_ton < lot.start_price_kopecks_per_ton THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_BID_BELOW_START';
    END IF;
  ELSE
    IF p_amount_kopecks_per_ton < current_top THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_BID_BELOW_CURRENT';
    END IF;
    IF p_amount_kopecks_per_ton > current_top
       AND p_amount_kopecks_per_ton - current_top < lot.step_price_kopecks_per_ton
    THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_BID_STEP_INVALID';
    END IF;
  END IF;

  INSERT INTO auction.bids (
    id, tenant_id, lot_id, buyer_org_id, buyer_tenant_id, placed_by_user_id,
    buyer_name, amount_rub_per_ton, amount_kopecks_per_ton, volume_tons, status,
    placed_at, version, command_id, idempotency_key, request_hash,
    created_at, updated_at
  ) VALUES (
    bid_id,
    lot.tenant_id,
    lot.id,
    buyer_org,
    buyer_tenant,
    current_setting('app.current_user_id', true),
    buyer_org,
    p_amount_kopecks_per_ton / 100,
    p_amount_kopecks_per_ton,
    p_volume_tons,
    'PLACED',
    now_at,
    1,
    p_command_id,
    p_idempotency_key,
    request_hash,
    now_at,
    now_at
  );

  WITH ranked AS (
    SELECT
      id,
      row_number() OVER (
        ORDER BY amount_kopecks_per_ton DESC, placed_at ASC, id ASC
      ) AS position
    FROM auction.bids
    WHERE tenant_id = lot.tenant_id
      AND lot_id = lot.id
      AND status IN ('PLACED', 'LEADING', 'OUTBID')
  )
  UPDATE auction.bids bid
  SET status = CASE WHEN ranked.position = 1 THEN 'LEADING' ELSE 'OUTBID' END
  FROM ranked
  WHERE bid.id = ranked.id
    AND bid.tenant_id = lot.tenant_id
    AND bid.lot_id = lot.id;

  new_end := lot.auction_ends_at;
  IF lot.auto_extend_enabled
     AND lot.auto_extend_window_minutes > 0
     AND lot.auto_extend_minutes > 0
     AND lot.auction_ends_at - now_at <= make_interval(mins => lot.auto_extend_window_minutes)
  THEN
    new_end := lot.auction_ends_at + make_interval(mins => lot.auto_extend_minutes);
  END IF;

  UPDATE auction.lots
  SET auction_ends_at = new_end, status = status
  WHERE tenant_id = lot.tenant_id AND id = lot.id
  RETURNING * INTO lot;

  SELECT id, amount_kopecks_per_ton INTO leader_id, leader_amount
  FROM auction.bids
  WHERE tenant_id = lot.tenant_id
    AND lot_id = lot.id
    AND status = 'LEADING'
  ORDER BY amount_kopecks_per_ton DESC, placed_at ASC, id ASC
  LIMIT 1;

  audit_id := auction.append_audit(
    'auction.bid.place',
    lot.id,
    jsonb_build_object(
      'version', p_expected_version::text,
      'leaderAmountKopecksPerTon', current_top
    ),
    jsonb_build_object(
      'version', lot.version::text,
      'bidId', bid_id,
      'leaderId', leader_id,
      'leaderAmountKopecksPerTon', leader_amount::text,
      'auctionEndsAt', lot.auction_ends_at
    ),
    jsonb_build_object(
      'commandId', p_command_id,
      'buyerOrgId', buyer_org,
      'buyerTenantId', buyer_tenant,
      'lotTenantId', lot.tenant_id,
      'crossTenant', (lot.tenant_id <> buyer_tenant),
      'amountKopecksPerTon', p_amount_kopecks_per_ton::text,
      'volumeTons', p_volume_tons::text,
      'requestFingerprint', request_hash
    ),
    p_command_id
  );
  outbox_id := auction.append_outbox(
    'auction.bid.placed',
    jsonb_build_object(
      'lotId', lot.id,
      'bidId', bid_id,
      'leaderId', leader_id,
      'lotVersion', lot.version::text
    ),
    'auction-bid-event:' || lot.tenant_id || ':' || p_idempotency_key,
    p_command_id,
    audit_id
  );
  result := jsonb_build_object(
    'lotId', lot.id,
    'lotVersion', lot.version::text,
    'bidId', bid_id,
    'bidStatus', CASE WHEN bid_id = leader_id THEN 'LEADING' ELSE 'OUTBID' END,
    'amountKopecksPerTon', p_amount_kopecks_per_ton::text,
    'leaderId', leader_id,
    'leaderAmountKopecksPerTon', leader_amount::text,
    'auctionEndsAt', lot.auction_ends_at,
    'requestFingerprint', request_hash,
    'auditId', audit_id,
    'outboxId', outbox_id,
    'duplicate', false
  );
  PERFORM auction.save_command(
    'PLACE_BID', p_command_id, p_idempotency_key, request_hash, result
  );
  RETURN result;
END
$function$;

REVOKE ALL ON FUNCTION auction.lock_lot_in_tenant(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.resolve_lot_tenant(text, text) FROM PUBLIC;

DO $auction_participation_command_acl$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT EXECUTE ON FUNCTION auction.lock_lot_in_tenant(text, text) TO app_deal;
    GRANT EXECUTE ON FUNCTION auction.resolve_lot_tenant(text, text) TO app_deal;
  END IF;
END
$auction_participation_command_acl$;

-- ---------------------------------------------------------------------------
-- 11. record_admission: admit a granted counterparty from another tenant.
-- ---------------------------------------------------------------------------
-- The previous body required organization."tenantId" = lot.tenant_id, so a real
-- buyer could never be admitted. The tenant equality is replaced by: same tenant
-- OR an ACTIVE VIEW_LOT participation grant. Every other eligibility check
-- (status, KYC, AML, sanctions, BUYER membership, active user) is unchanged.

CREATE OR REPLACE FUNCTION auction.record_admission(
  p_lot_id text,
  p_buyer_org_id text,
  p_buyer_user_id text,
  p_status text,
  p_valid_until timestamptz,
  p_reason text,
  p_expected_version bigint,
  p_command_id text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
DECLARE
  request_hash text;
  replay jsonb;
  lot auction.lots%ROWTYPE;
  admission auction.admissions%ROWTYPE;
  buyer_tenant text;
  audit_id text;
  outbox_id text;
  result jsonb;
  now_at timestamptz := clock_timestamp();
BEGIN
  PERFORM auction.assert_actor(ARRAY['ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER']);
  request_hash := encode(digest(convert_to(concat_ws('|',
    p_lot_id, p_buyer_org_id, p_buyer_user_id, p_status,
    p_valid_until::text, p_reason, p_expected_version::text
  ), 'UTF8'), 'sha256'), 'hex');
  replay := auction.replay_command('RECORD_ADMISSION', p_idempotency_key, request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  PERFORM auction.lock_lot(p_lot_id);
  SELECT * INTO lot
  FROM auction.lots
  WHERE tenant_id = current_setting('app.current_tenant_id', true)
    AND id = p_lot_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_LOT_NOT_FOUND';
  END IF;
  IF lot.version <> p_expected_version THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_STALE_VERSION';
  END IF;
  IF lot.status NOT IN ('OPEN', 'BIDDING') OR now_at >= lot.auction_ends_at THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_NOT_OPEN';
  END IF;
  IF p_status NOT IN ('ADMITTED', 'BLOCKED') OR NULLIF(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_ADMISSION_DECISION_INVALID';
  END IF;
  IF p_status = 'ADMITTED' AND p_valid_until <= now_at THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_ADMISSION_EXPIRY_INVALID';
  END IF;
  IF p_buyer_org_id = lot.seller_org_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_SELF_BID_DENIED';
  END IF;

  SELECT organization."tenantId" INTO buyer_tenant
  FROM public."organizations" organization
  JOIN public."user_orgs" membership
    ON membership."organizationId" = organization."id"
  JOIN public."users" actor
    ON actor."id" = membership."userId"
  WHERE organization."id" = p_buyer_org_id
    AND organization."status" IN ('VERIFIED', 'ACTIVE')
    AND organization."kycStatus" = 'APPROVED'
    AND organization."amlStatus" = 'CLEAR'
    AND organization."sanctionHit" = false
    AND membership."userId" = p_buyer_user_id
    AND membership."role" = 'BUYER'
    AND actor."status" = 'ACTIVE'
    AND actor."deletedAt" IS NULL
  LIMIT 1;
  IF buyer_tenant IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_BUYER_AUTHORITY_INVALID';
  END IF;

  -- Cross-tenant admission requires a standing participation grant. Same-tenant
  -- admission keeps working exactly as before.
  IF buyer_tenant <> lot.tenant_id
     AND NOT EXISTS (
       SELECT 1
       FROM auction.participation_grants grant_row
       WHERE grant_row.lot_tenant_id = lot.tenant_id
         AND grant_row.lot_id = lot.id
         AND grant_row.participant_org_id = p_buyer_org_id
         AND grant_row.participant_tenant_id = buyer_tenant
         AND grant_row.status = 'ACTIVE'
         AND grant_row.valid_until > now_at
         AND 'VIEW_LOT' = ANY(grant_row.allowed_operations)
     )
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_PARTICIPATION_NOT_GRANTED';
  END IF;

  INSERT INTO auction.admissions (
    id, tenant_id, lot_id, participant_org_id, participant_tenant_id,
    participant_user_id, participant_role, status, valid_until, reason,
    decided_by_actor_id, version, created_at, updated_at
  ) VALUES (
    'admission-' || gen_random_uuid()::text,
    lot.tenant_id,
    lot.id,
    p_buyer_org_id,
    buyer_tenant,
    p_buyer_user_id,
    'BUYER',
    p_status,
    p_valid_until,
    p_reason,
    current_setting('app.current_user_id', true),
    1,
    now_at,
    now_at
  )
  ON CONFLICT (tenant_id, lot_id, participant_org_id, participant_user_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    valid_until = EXCLUDED.valid_until,
    reason = EXCLUDED.reason,
    decided_by_actor_id = EXCLUDED.decided_by_actor_id,
    participant_tenant_id = EXCLUDED.participant_tenant_id
  RETURNING * INTO admission;

  UPDATE auction.lots
  SET status = status
  WHERE tenant_id = lot.tenant_id AND id = lot.id
  RETURNING * INTO lot;

  audit_id := auction.append_audit(
    'auction.admission.record',
    lot.id,
    NULL,
    jsonb_build_object(
      'buyerOrgId', p_buyer_org_id,
      'buyerTenantId', buyer_tenant,
      'buyerUserId', p_buyer_user_id,
      'status', admission.status,
      'validUntil', admission.valid_until,
      'crossTenant', (buyer_tenant <> lot.tenant_id)
    ),
    jsonb_build_object(
      'commandId', p_command_id,
      'reason', p_reason,
      'requestFingerprint', request_hash,
      'admissionVersion', admission.version::text
    ),
    p_command_id
  );
  outbox_id := auction.append_outbox(
    'auction.admission.recorded',
    jsonb_build_object(
      'lotId', lot.id,
      'buyerOrgId', p_buyer_org_id,
      'buyerUserId', p_buyer_user_id,
      'status', admission.status
    ),
    'auction-admission-event:' || lot.tenant_id || ':' || p_idempotency_key,
    p_command_id,
    audit_id
  );
  result := jsonb_build_object(
    'lotId', lot.id,
    'lotVersion', lot.version::text,
    'admissionId', admission.id,
    'admissionVersion', admission.version::text,
    'status', admission.status,
    'validUntil', admission.valid_until,
    'buyerTenantId', buyer_tenant,
    'requestFingerprint', request_hash,
    'auditId', audit_id,
    'outboxId', outbox_id,
    'duplicate', false
  );
  PERFORM auction.save_command(
    'RECORD_ADMISSION', p_command_id, p_idempotency_key, request_hash, result
  );
  RETURN result;
END
$function$;

-- close_lot must accept the winning bid of a granted cross-tenant buyer. The
-- admission join previously matched only same-tenant rows by construction;
-- pinning participant_tenant_id keeps the join exact now that it can differ.

CREATE OR REPLACE FUNCTION auction.close_lot(p_lot_id text, p_expected_version bigint, p_command_id text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auction'
AS $function$
DECLARE
  request_hash text;
  replay jsonb;
  lot auction.lots%ROWTYPE;
  winner auction.bids%ROWTYPE;
  award_id text := 'award-' || gen_random_uuid()::text;
  integration_event_id text := 'auction-basis-' || gen_random_uuid()::text;
  basis_external_id text;
  deal_number text;
  total_kopecks bigint;
  price_per_ton_rub numeric(20, 2);
  basis jsonb;
  source_hash text;
  audit_id text;
  outbox_id text;
  result jsonb;
  now_at timestamptz := clock_timestamp();
BEGIN
  PERFORM auction.assert_actor(
    ARRAY['FARMER', 'ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER']
  );
  request_hash := encode(digest(convert_to(concat_ws('|',
    p_lot_id, p_expected_version::text
  ), 'UTF8'), 'sha256'), 'hex');
  replay := auction.replay_command('CLOSE_LOT', p_idempotency_key, request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  PERFORM auction.lock_lot(p_lot_id);
  SELECT * INTO lot
  FROM auction.lots
  WHERE tenant_id = current_setting('app.current_tenant_id', true)
    AND id = p_lot_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_LOT_NOT_FOUND';
  END IF;
  IF current_setting('app.current_role', true) = 'FARMER'
     AND lot.seller_org_id <> current_setting('app.current_org_id', true)
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_SELLER_SCOPE_DENIED';
  END IF;
  IF lot.version <> p_expected_version THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_STALE_VERSION';
  END IF;
  IF lot.status <> 'BIDDING' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_ALREADY_CLOSED';
  END IF;
  IF now_at < lot.auction_ends_at THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_NOT_ENDED';
  END IF;
  IF lot.seller_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_SELLER_AUTHORITY_MISSING';
  END IF;

  SELECT bid.* INTO winner
  FROM auction.bids bid
  JOIN auction.admissions admission
    ON admission.tenant_id = bid.tenant_id
   AND admission.lot_id = bid.lot_id
   AND admission.participant_org_id = bid.buyer_org_id
   AND admission.participant_user_id = bid.placed_by_user_id
   AND admission.participant_tenant_id = bid.buyer_tenant_id
   AND admission.status = 'ADMITTED'
   AND admission.valid_until >= bid.placed_at
   AND (
     bid.buyer_tenant_id = lot.tenant_id
     OR EXISTS (
       SELECT 1
       FROM auction.participation_grants grant_row
       WHERE grant_row.lot_tenant_id = lot.tenant_id
         AND grant_row.lot_id = lot.id
         AND grant_row.participant_org_id = bid.buyer_org_id
         AND grant_row.participant_tenant_id = bid.buyer_tenant_id
         AND grant_row.status = 'ACTIVE'
         AND grant_row.valid_until > now_at
         AND 'PLACE_BID' = ANY(grant_row.allowed_operations)
     )
   )
  WHERE bid.tenant_id = lot.tenant_id
    AND bid.lot_id = lot.id
    AND bid.status IN ('PLACED', 'LEADING', 'OUTBID')
  ORDER BY bid.amount_kopecks_per_ton DESC, bid.placed_at ASC, bid.id ASC
  LIMIT 1
  FOR UPDATE OF bid;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_NO_ELIGIBLE_BIDS';
  END IF;
  IF winner.placed_by_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_BUYER_AUTHORITY_MISSING';
  END IF;

  UPDATE auction.bids
  SET status = CASE WHEN id = winner.id THEN 'WINNING' ELSE 'OUTBID' END
  WHERE tenant_id = lot.tenant_id
    AND lot_id = lot.id
    AND status IN ('PLACED', 'LEADING', 'OUTBID');

  UPDATE auction.lots
  SET status = 'MATCHED'
  WHERE tenant_id = lot.tenant_id AND id = lot.id
  RETURNING * INTO lot;

  INSERT INTO auction.awards (
    id, tenant_id, lot_id, winning_bid_id, deal_id, status,
    awarded_by_actor_id, awarded_at, version, created_at, updated_at
  ) VALUES (
    award_id,
    lot.tenant_id,
    lot.id,
    winner.id,
    NULL,
    'AWARDED',
    current_setting('app.current_user_id', true),
    now_at,
    1,
    now_at,
    now_at
  );

  basis_external_id := lot.id || ':' || winner.id;
  deal_number := 'TP-AUC-' || upper(substr(
    encode(digest(convert_to(basis_external_id, 'UTF8'), 'sha256'), 'hex'),
    1,
    16
  ));
  total_kopecks := round(
    winner.amount_kopecks_per_ton::numeric * winner.volume_tons
  )::bigint;
  price_per_ton_rub := winner.amount_kopecks_per_ton::numeric / 100;
  basis := jsonb_build_object(
    'dealNumber', deal_number,
    'tenantId', lot.tenant_id,
    'lotId', lot.id,
    'winnerBidId', winner.id,
    'sellerOrgId', lot.seller_org_id,
    'buyerOrgId', winner.buyer_org_id,
    'sellerTenantId', lot.tenant_id,
    'buyerTenantId', winner.buyer_tenant_id,
    'sellerUserId', lot.seller_user_id,
    'buyerUserId', winner.placed_by_user_id,
    'culture', lot.culture,
    'cropClass', lot.grade,
    'region', lot.region,
    'incoterms', NULL,
    'volumeTons', winner.volume_tons::text,
    'pricePerTon', price_per_ton_rub::text,
    'totalKopecks', total_kopecks::text,
    'currency', 'RUB'
  );
  source_hash := auction.basis_hash(basis);
  basis := basis || jsonb_build_object('sourceHash', source_hash);

  INSERT INTO public."integration_events" (
    "id", "adapterName", "direction", "eventType", "externalId", "dealId",
    "requestPayload", "responsePayload", "status", "idempotencyKey", "createdAt"
  ) VALUES (
    integration_event_id,
    'auction',
    'INBOUND',
    'DEAL_BASIS_READY',
    basis_external_id,
    NULL,
    basis,
    basis,
    'CONFIRMED',
    'auction-basis:' || lot.tenant_id || ':' || lot.id,
    now_at
  );

  audit_id := auction.append_audit(
    'auction.close',
    lot.id,
    jsonb_build_object(
      'status', 'BIDDING',
      'version', p_expected_version::text
    ),
    jsonb_build_object(
      'status', lot.status,
      'version', lot.version::text,
      'winnerBidId', winner.id,
      'awardId', award_id,
      'basisEventId', integration_event_id
    ),
    jsonb_build_object(
      'commandId', p_command_id,
      'requestFingerprint', request_hash,
      'basisHash', source_hash,
      'amountKopecksPerTon', winner.amount_kopecks_per_ton::text,
      'totalKopecks', total_kopecks::text
    ),
    p_command_id
  );
  outbox_id := auction.append_outbox(
    'auction.deal-basis.ready',
    jsonb_build_object(
      'lotId', lot.id,
      'winnerBidId', winner.id,
      'awardId', award_id,
      'integrationEventId', integration_event_id,
      'basis', basis
    ),
    'auction-basis-outbox:' || lot.tenant_id || ':' || lot.id,
    p_command_id,
    audit_id
  );
  result := jsonb_build_object(
    'lotId', lot.id,
    'lotStatus', lot.status,
    'lotVersion', lot.version::text,
    'winnerBidId', winner.id,
    'amountKopecksPerTon', winner.amount_kopecks_per_ton::text,
    'awardId', award_id,
    'integrationEventId', integration_event_id,
    'basisExternalId', basis_external_id,
    'basisHash', source_hash,
    'requestFingerprint', request_hash,
    'auditId', audit_id,
    'outboxId', outbox_id,
    'duplicate', false
  );
  PERFORM auction.save_command(
    'CLOSE_LOT', p_command_id, p_idempotency_key, request_hash, result
  );
  RETURN result;
END
$function$

;
