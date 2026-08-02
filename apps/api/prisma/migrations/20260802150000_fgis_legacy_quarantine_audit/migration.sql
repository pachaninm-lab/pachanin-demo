-- P0.2-1A follow-up — durable audit for retired ФГИС «Зерно» path denials.
--
-- The quarantine slice recorded denials with `Logger.warn`. A log line is not
-- an audit record: it is not transactional, not append-only, not tenant-scoped,
-- and it disappears with log rotation. An attempt to reach a withdrawn
-- regulatory path is exactly the kind of fact that must survive.
--
-- This migration adds the append command used by the quarantine boundary. It
-- follows the same pattern as `public.create_fgis_grain_acknowledgement`:
-- advisory lock on the audit head, hash chained onto the previous row,
-- SECURITY DEFINER with a fixed search_path.
--
-- The recorded fact is deliberately narrow: who tried, from which tenant and
-- organization, which route, which denial code, which correlation code, and
-- when. No request body, XML, header, certificate, token or credential is
-- accepted by the function signature at all, so none can be stored by mistake.

-- Note on append-only, deliberately NOT changed here.
--
-- While building this slice I found that `public.audit_events` lost its
-- `no_update_audit_events` / `no_delete_audit_events` RULES in migration
-- 20260712090000, whose comment says the table "keeps its existing
-- auth_audit_events_append_only trigger" — but that trigger is attached to
-- `auth.audit_events`, a different table. So at owner level the public table is
-- rewritable today.
--
-- For the application it is not: RLS is enabled and the only policies are
-- `audit_insert_only` (FOR INSERT) and `audit_select_all` (FOR SELECT). With no
-- UPDATE or DELETE policy, RLS denies both to every non-BYPASSRLS role, which
-- covers app_deal, app_service and app_runtime — the roles the running platform
-- actually uses. That is the guarantee this slice depends on and it already
-- holds.
--
-- I first added a table-wide BEFORE UPDATE OR DELETE OR TRUNCATE trigger here.
-- It broke six industrial suites: five reset with
-- `TRUNCATE TABLE public."audit_events"`, and two more delete their own rows by
-- RUN_ID to stay isolated in a shared test database. Closing the owner-level
-- gap properly means giving those suites a different isolation mechanism, which
-- is a cross-cutting change with its own blast radius and no connection to the
-- ФГИС quarantine. Widening a narrow slice to carry it would be the wrong
-- trade, and shipping a trigger with a documented `DISABLE TRIGGER` bypass
-- would be worse than shipping none.
--
-- Raised for the owner as separate work rather than fixed silently here.

-- ── Quarantine denial append command ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_fgis_legacy_quarantine_denial(
  p_tenant_id text,
  p_organization_id text,
  p_actor_user_id text,
  p_actor_role text,
  p_session_id text,
  p_route text,
  p_denial_code text,
  p_correlation_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_audit_id text;
  v_prev_hash text;
  v_hash text;
  v_metadata jsonb;
  v_material jsonb;
  v_created_at timestamptz := clock_timestamp();
BEGIN
  IF NULLIF(btrim(p_route), '') IS NULL THEN
    RAISE EXCEPTION 'FGIS_QUARANTINE_AUDIT_ROUTE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF NULLIF(btrim(p_denial_code), '') IS NULL THEN
    RAISE EXCEPTION 'FGIS_QUARANTINE_AUDIT_DENIAL_CODE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF NULLIF(btrim(p_correlation_id), '') IS NULL THEN
    RAISE EXCEPTION 'FGIS_QUARANTINE_AUDIT_CORRELATION_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  -- Bounded on purpose. Long values here would mean a caller is trying to push
  -- payload into the audit trail through a field meant for a route or a code.
  IF length(p_route) > 400
     OR length(p_denial_code) > 120
     OR length(p_correlation_id) > 120
     OR length(COALESCE(p_session_id, '')) > 200
  THEN
    RAISE EXCEPTION 'FGIS_QUARANTINE_AUDIT_FIELD_TOO_LONG' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('public.audit_events.global-head', 0));
  SELECT a."hash"
  INTO v_prev_hash
  FROM public."audit_events" a
  ORDER BY a."createdAt" DESC, a."id" DESC
  LIMIT 1;

  v_audit_id := 'fgis-quarantine-audit-' || gen_random_uuid()::text;
  v_metadata := jsonb_build_object(
    'boundary', 'LEGACY_FGIS_QUARANTINE',
    'route', p_route,
    'denialCode', p_denial_code,
    'sessionId', p_session_id
  );
  v_material := jsonb_build_object(
    'id', v_audit_id,
    'action', 'FGIS_LEGACY_PATH_DENIED',
    'actorUserId', p_actor_user_id,
    'actorRole', p_actor_role,
    'tenantId', p_tenant_id,
    'orgId', p_organization_id,
    'objectType', 'LEGACY_FGIS_QUARANTINE',
    'objectId', p_route,
    'outcome', 'DENIED',
    'reason', p_denial_code,
    'metadata', v_metadata,
    'correlationId', p_correlation_id,
    'prevHash', v_prev_hash
  );
  v_hash := encode(digest(convert_to(v_material::text, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public."audit_events" (
    "id", "action", "actorUserId", "actorRole", "tenantId", "orgId",
    "objectType", "objectId", "outcome", "reason", "metadata",
    "correlationId", "hash", "prevHash", "createdAt"
  ) VALUES (
    v_audit_id,
    'FGIS_LEGACY_PATH_DENIED',
    COALESCE(NULLIF(btrim(p_actor_user_id), ''), 'anonymous'),
    COALESCE(NULLIF(btrim(p_actor_role), ''), 'ANONYMOUS'),
    NULLIF(btrim(p_tenant_id), ''),
    NULLIF(btrim(p_organization_id), ''),
    'LEGACY_FGIS_QUARANTINE',
    p_route,
    'DENIED',
    p_denial_code,
    v_metadata,
    p_correlation_id,
    v_hash,
    v_prev_hash,
    v_created_at
  );

  RETURN jsonb_build_object(
    'auditEventId', v_audit_id,
    'correlationId', p_correlation_id,
    'outcome', 'DENIED',
    'boundary', 'LEGACY_FGIS_QUARANTINE',
    'createdAt', v_created_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_fgis_legacy_quarantine_denial(
  text, text, text, text, text, text, text, text
) FROM PUBLIC;

DO $do$
DECLARE
  target_role text;
BEGIN
  FOREACH target_role IN ARRAY ARRAY['app_deal', 'app_service', 'app_runtime'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.record_fgis_legacy_quarantine_denial('
        || 'text, text, text, text, text, text, text, text) TO %I',
        target_role
      );
    END IF;
  END LOOP;
END
$do$;
