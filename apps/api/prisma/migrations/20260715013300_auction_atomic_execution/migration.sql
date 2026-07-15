-- IR-AUCTION: serialize same-scope idempotent commands before replay lookup.
--
-- A transaction-scoped advisory lock is taken from the server-derived tenant,
-- command type, actor and idempotency key. Concurrent identical requests can no
-- longer both observe a missing receipt: the follower waits for the leader to
-- commit, then re-reads and returns the durable replay result. Different actors,
-- commands or idempotency keys remain independent.

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

REVOKE ALL ON FUNCTION auction.replay_command(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auction.replay_command(text, text, text) TO app_deal;
