-- IR-AUCTION: make same-scope idempotent commands race-safe.
--
-- The advisory lock minimizes duplicate work. Under SERIALIZABLE, however, a
-- follower can retain a snapshot taken before the leader committed. Therefore
-- save_command also converts the residual unique-key race into SQLSTATE 40001.
-- RlsTransactionService treats 40001 as retryable, restarts the full command,
-- and the new transaction returns the durable replay receipt.

CREATE OR REPLACE FUNCTION auction.replay_command(
  p_command_type text,
  p_idempotency_key text,
  p_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
DECLARE
  stored auction.command_receipts%ROWTYPE;
  lock_material text;
BEGIN
  lock_material := concat_ws(
    ':',
    current_setting('app.current_tenant_id', true),
    p_command_type,
    current_setting('app.current_user_id', true),
    p_idempotency_key
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(lock_material, 0));

  SELECT * INTO stored
  FROM auction.command_receipts receipt
  WHERE receipt.tenant_id = current_setting('app.current_tenant_id', true)
    AND receipt.command_type = p_command_type
    AND receipt.actor_id = current_setting('app.current_user_id', true)
    AND receipt.idempotency_key = p_idempotency_key;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF stored.request_hash <> p_request_hash THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_IDEMPOTENCY_PAYLOAD_MISMATCH';
  END IF;
  RETURN stored.result || jsonb_build_object('duplicate', true);
END
$function$;

CREATE OR REPLACE FUNCTION auction.save_command(
  p_command_type text,
  p_command_id text,
  p_idempotency_key text,
  p_request_hash text,
  p_result jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
BEGIN
  INSERT INTO auction.command_receipts (
    id, tenant_id, command_type, actor_id, idempotency_key,
    command_id, request_hash, result, created_at
  ) VALUES (
    'auction-receipt-' || gen_random_uuid()::text,
    current_setting('app.current_tenant_id', true),
    p_command_type,
    current_setting('app.current_user_id', true),
    p_idempotency_key,
    p_command_id,
    p_request_hash,
    p_result,
    clock_timestamp()
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION USING
      ERRCODE = '40001',
      MESSAGE = 'AUCTION_IDEMPOTENCY_RACE_RETRY';
END
$function$;

REVOKE ALL ON FUNCTION auction.replay_command(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auction.replay_command(text, text, text) TO app_deal;
