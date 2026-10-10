-- No bulk deletion at deployment: only an authenticated user's explicit
-- delete/clear action invokes the purge. The existing account store remains
-- canonical; no tenant, role or platform RLS policy is changed.
CREATE TABLE public.gekta_history_imports (
  "accountId" TEXT NOT NULL,
  "importKey" VARCHAR(80) NOT NULL,
  "payloadHash" VARCHAR(64) NOT NULL,
  "conversationId" TEXT NOT NULL,
  "importedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT gekta_history_imports_pkey PRIMARY KEY ("accountId", "importKey"),
  CONSTRAINT gekta_history_imports_account_fk FOREIGN KEY ("accountId")
    REFERENCES public.gekta_accounts(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT gekta_history_imports_key_shape CHECK (
    "importKey" ~ '^(id-v1|legacy-v1):[0-9a-f]{64}$'
    AND "payloadHash" ~ '^[0-9a-f]{64}$'
  )
);
CREATE INDEX gekta_history_imports_conversation_idx
  ON public.gekta_history_imports("accountId", "conversationId");

-- The runtime gets EXECUTE, never direct DELETE on conversation/message
-- tables. The service derives accountId from the existing verified session,
-- holds that account's row lock, and retains technical import receipts before
-- invoking this single-purpose authority. Existing FK cascades erase messages,
-- citations and attachment metadata with the conversation.
CREATE FUNCTION public.purge_gekta_history(p_account_id TEXT, p_conversation_id TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $purge$
DECLARE
  deleted_count BIGINT;
BEGIN
  IF p_account_id IS NULL OR length(p_account_id) = 0 THEN
    RAISE EXCEPTION 'gekta_account_required';
  END IF;
  -- Also serialize direct calls with the same existing account boundary.
  PERFORM id FROM public.gekta_accounts WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gekta_account_not_found';
  END IF;
  DELETE FROM public.gekta_conversations
    WHERE "accountId" = p_account_id
      AND (p_conversation_id IS NULL OR id = p_conversation_id);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$purge$;
REVOKE ALL ON FUNCTION public.purge_gekta_history(TEXT, TEXT) FROM PUBLIC;

DO $gekta_history_runtime_grants$
DECLARE runtime_role TEXT;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_deal_runtime', 'one_deal_app', 'app_runtime')
  LOOP
    EXECUTE format('GRANT SELECT, INSERT ON public.gekta_history_imports TO %I', runtime_role);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.purge_gekta_history(TEXT, TEXT) TO %I', runtime_role);
  END LOOP;
END;
$gekta_history_runtime_grants$;
