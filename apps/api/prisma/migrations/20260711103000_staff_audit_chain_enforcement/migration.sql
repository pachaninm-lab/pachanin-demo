-- Enforce a single, monotonic, append-only audit chain per actual staff actor.
-- The trigger owns serialization so a caller cannot fork the chain by omitting
-- the application advisory lock or by starting a transaction earlier.

CREATE OR REPLACE FUNCTION auth.enforce_staff_access_event_chain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_last_hash TEXT;
  v_last_created_at TIMESTAMPTZ;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.actor_user_id, 0));

  SELECT e.hash, e.created_at
  INTO v_last_hash, v_last_created_at
  FROM auth.staff_access_events e
  WHERE e.actor_user_id = NEW.actor_user_id
  ORDER BY e.created_at DESC, e.id DESC
  LIMIT 1;

  IF NEW.prev_hash IS DISTINCT FROM v_last_hash THEN
    RAISE EXCEPTION 'staff audit chain continuity violation for actor %', NEW.actor_user_id
      USING ERRCODE = '23514';
  END IF;

  NEW.created_at := GREATEST(
    clock_timestamp(),
    COALESCE(v_last_created_at + INTERVAL '1 microsecond', '-infinity'::timestamptz)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER auth_staff_access_events_chain_guard
BEFORE INSERT ON auth.staff_access_events
FOR EACH ROW EXECUTE FUNCTION auth.enforce_staff_access_event_chain();

REVOKE ALL ON FUNCTION auth.enforce_staff_access_event_chain() FROM PUBLIC;
