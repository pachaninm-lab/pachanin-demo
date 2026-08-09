-- P0 registration lifecycle causal outbox receipt.
--
-- A successful approval already commits the ACTIVATED registration event and
-- an append-only auth audit record in one SERIALIZABLE application transaction.
-- The final production acceptance must be able to prove that exact lifecycle,
-- rather than correlate an unrelated outbox row. Keep the producer inside a
-- fixed PostgreSQL authority: callers supply only application/correlation IDs;
-- PostgreSQL re-derives the actor, organization, role, version, audit
-- and activation event before it can insert one bounded receipt.

DO $registration_receipt_role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_registration_receipt_authority'
  ) THEN
    CREATE ROLE pc_registration_receipt_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;

  ALTER ROLE pc_registration_receipt_authority
    NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    WHERE granted.rolname = 'pc_registration_receipt_authority'
  ) THEN
    RAISE EXCEPTION 'pc_registration_receipt_authority must have no members'
      USING ERRCODE = '42501';
  END IF;
END
$registration_receipt_role$;

ALTER TABLE public."outbox_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."outbox_entries" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outbox_entries_registration_receipt_select
  ON public."outbox_entries";
CREATE POLICY outbox_entries_registration_receipt_select
ON public."outbox_entries"
FOR SELECT TO pc_registration_receipt_authority
USING (
  current_user = 'pc_registration_receipt_authority'
  AND "type" = 'auth.registration.lifecycle.receipt'
  AND "idempotencyKey" LIKE 'registration-lifecycle:%'
);

DROP POLICY IF EXISTS outbox_entries_registration_receipt_insert
  ON public."outbox_entries";
CREATE POLICY outbox_entries_registration_receipt_insert
ON public."outbox_entries"
FOR INSERT TO pc_registration_receipt_authority
WITH CHECK (
  current_user = 'pc_registration_receipt_authority'
  AND "type" = 'auth.registration.lifecycle.receipt'
  AND "dealId" IS NULL
  AND "status" = 'PENDING'
  AND "idempotencyKey" =
    'registration-lifecycle:'
      || ("payload" ->> 'applicationId')
      || ':'
      || ("payload" ->> 'applicationVersion')
  AND "correlationId" = "payload" ->> 'correlationId'
  AND "auditId" = "payload" ->> 'auditId'
  AND "triggeredByUserId" = "payload" ->> 'decisionActorUserId'
  AND "maxRetries" = 5
  AND "retryCount" = 0
);

GRANT USAGE ON SCHEMA public, auth TO pc_registration_receipt_authority;
REVOKE ALL PRIVILEGES ON
  auth.registration_applications,
  auth.registration_application_events,
  auth.audit_events,
  public."outbox_entries"
FROM pc_registration_receipt_authority;
GRANT SELECT ON
  auth.registration_applications,
  auth.registration_application_events,
  auth.audit_events
TO pc_registration_receipt_authority;
GRANT SELECT, INSERT ON public."outbox_entries"
TO pc_registration_receipt_authority;

CREATE OR REPLACE FUNCTION auth.emit_registration_lifecycle_receipt(
  p_application_id text,
  p_correlation_id text
)
RETURNS TABLE (
  outbox_id text,
  idempotency_key text,
  correlation_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET row_security = on
AS $function$
DECLARE
  application auth.registration_applications%ROWTYPE;
  approval_event auth.registration_application_events%ROWTYPE;
  activation_event auth.registration_application_events%ROWTYPE;
  approval_audit auth.audit_events%ROWTYPE;
  receipt_id text;
  receipt_key text;
  receipt_payload jsonb;
BEGIN
  IF btrim(COALESCE(p_application_id, '')) = ''
     OR btrim(COALESCE(p_correlation_id, '')) = '' THEN
    RAISE EXCEPTION 'Registration receipt identifiers are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT candidate.*
  INTO application
  FROM auth.registration_applications candidate
  WHERE candidate.id = p_application_id
    AND candidate.status = 'ACTIVATED'
    AND candidate.decision_actor_user_id IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activated registration application is required'
      USING ERRCODE = '23514';
  END IF;

  SELECT event.*
  INTO activation_event
  FROM auth.registration_application_events event
  WHERE event.application_id = application.id
    AND event.actor_kind = 'SYSTEM'
    AND event.previous_status = 'APPROVED'
    AND event.new_status = 'ACTIVATED'
    AND event.application_version = application.version
    AND event.correlation_id = p_correlation_id
  ORDER BY event.created_at DESC, event.id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Causal ACTIVATED registration event is required'
      USING ERRCODE = '23514';
  END IF;

  SELECT event.*
  INTO approval_event
  FROM auth.registration_application_events event
  WHERE event.application_id = application.id
    AND event.actor_kind IN ('ORGANIZATION_ADMIN', 'PLATFORM_REVIEWER')
    AND event.actor_user_id = application.decision_actor_user_id
    AND event.new_status = 'APPROVED'
    AND event.application_version = application.version - 1
    AND event.correlation_id = activation_event.correlation_id
  ORDER BY event.created_at DESC, event.id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Causal APPROVED registration event is required'
      USING ERRCODE = '23514';
  END IF;

  SELECT audit.*
  INTO approval_audit
  FROM auth.audit_events audit
  WHERE audit.user_id = application.decision_actor_user_id
    AND audit.action IN (
      'auth.registration.decision',
      'auth.organization.join_request.decision'
    )
    AND audit.outcome = 'SUCCESS'
    AND audit.reason = 'APPROVE'
    AND audit.metadata ->> 'applicationId' = application.id
    AND audit.metadata ->> 'correlationId' = activation_event.correlation_id
    AND audit.created_at >= approval_event.created_at
  ORDER BY audit.chain_sequence DESC
  LIMIT 1;

  IF NOT FOUND OR approval_audit.hash IS NULL THEN
    RAISE EXCEPTION 'Immutable approval audit is required'
      USING ERRCODE = '23514';
  END IF;

  receipt_key := 'registration-lifecycle:' || application.id || ':' || application.version::text;
  receipt_payload := jsonb_build_object(
    'schemaVersion', 'auth.registration.lifecycle.receipt.v1',
    'applicationId', application.id,
    'applicationKind', application.kind,
    'applicationVersion', application.version::text,
    'status', application.status,
    'userId', application.user_id,
    'organizationId', application.organization_id,
    'membershipId', application.membership_id,
    'requestedWorkspace', application.requested_workspace,
    'requestedRole', application.requested_role,
    'decisionActorUserId', application.decision_actor_user_id,
    'approvalEventId', approval_event.id,
    'activationEventId', activation_event.id,
    'auditId', approval_audit.id,
    'auditHash', approval_audit.hash,
    'correlationId', activation_event.correlation_id
  );

  receipt_id := 'registration_receipt_' || gen_random_uuid()::text;
  INSERT INTO public."outbox_entries" (
    "id", "type", "dealId", "payload", "status", "triggeredByUserId",
    "idempotencyKey", "maxRetries", "retryCount", "nextRetryAt",
    "correlationId", "auditId", "createdAt"
  ) VALUES (
    receipt_id,
    'auth.registration.lifecycle.receipt',
    NULL,
    receipt_payload,
    'PENDING',
    application.decision_actor_user_id,
    receipt_key,
    5,
    0,
    clock_timestamp(),
    activation_event.correlation_id,
    approval_audit.id,
    clock_timestamp()
  )
  ON CONFLICT ("idempotencyKey") DO NOTHING;

  RETURN QUERY
  SELECT entry."id", entry."idempotencyKey", entry."correlationId"
  FROM public."outbox_entries" entry
  WHERE entry."idempotencyKey" = receipt_key
    AND entry."type" = 'auth.registration.lifecycle.receipt'
    AND entry."correlationId" = activation_event.correlation_id
    AND entry."auditId" = approval_audit.id
    AND entry."payload" = receipt_payload;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration lifecycle receipt replay conflict'
      USING ERRCODE = '23505';
  END IF;
END
$function$;

ALTER FUNCTION auth.emit_registration_lifecycle_receipt(text, text)
  OWNER TO pc_registration_receipt_authority;
REVOKE ALL ON FUNCTION auth.emit_registration_lifecycle_receipt(text, text)
  FROM PUBLIC;

DO $registration_receipt_runtime_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth', 'app_service')
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.emit_registration_lifecycle_receipt(text,text) TO %I',
      runtime_role
    );
  END LOOP;

  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_deal_runtime', 'pc_staff_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
      'one_deal_app', 'one_deal_staff', 'one_deal_storage',
      'app_runtime', 'app_staff', 'app_storage', 'app_outbox'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.emit_registration_lifecycle_receipt(text,text) FROM %I',
      runtime_role
    );
  END LOOP;
END
$registration_receipt_runtime_grants$;

DO $registration_receipt_authority_proof$
DECLARE
  function_definition text;
  select_policy text;
  insert_policy text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(function.oid)
  INTO function_definition
  FROM pg_catalog.pg_proc function
  JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
  JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
  WHERE schema.nspname = 'auth'
    AND function.proname = 'emit_registration_lifecycle_receipt'
    AND function.prosecdef
    AND owner.rolname = 'pc_registration_receipt_authority';

  SELECT qual INTO select_policy
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'outbox_entries'
    AND policyname = 'outbox_entries_registration_receipt_select'
    AND cmd = 'SELECT';

  SELECT with_check INTO insert_policy
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'outbox_entries'
    AND policyname = 'outbox_entries_registration_receipt_insert'
    AND cmd = 'INSERT';

  IF function_definition IS NULL
     OR function_definition NOT LIKE '%SET row_security TO ''on''%'
     OR function_definition NOT LIKE '%auth.registration.lifecycle.receipt%'
     OR function_definition NOT LIKE '%registration-lifecycle:%'
     OR function_definition NOT LIKE '%auth.audit_events%'
  THEN
    RAISE EXCEPTION 'Registration lifecycle receipt function is not bounded'
      USING ERRCODE = '42501';
  END IF;

  IF select_policy IS NULL
     OR insert_policy IS NULL
     OR select_policy NOT LIKE '%pc_registration_receipt_authority%'
     OR select_policy NOT LIKE '%auth.registration.lifecycle.receipt%'
     OR insert_policy NOT LIKE '%pc_registration_receipt_authority%'
     OR insert_policy NOT LIKE '%auth.registration.lifecycle.receipt%'
     OR insert_policy NOT LIKE '%registration-lifecycle:%'
  THEN
    RAISE EXCEPTION 'Registration lifecycle receipt RLS policy is not bounded'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class relation
    JOIN pg_catalog.pg_namespace schema ON schema.oid = relation.relnamespace
    WHERE schema.nspname = 'public'
      AND relation.relname = 'outbox_entries'
      AND relation.relrowsecurity
      AND relation.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'public.outbox_entries must remain ENABLE + FORCE RLS'
      USING ERRCODE = '42501';
  END IF;

  IF has_table_privilege(
       'pc_registration_receipt_authority', 'public.outbox_entries', 'UPDATE'
     )
     OR has_table_privilege(
       'pc_registration_receipt_authority', 'public.outbox_entries', 'DELETE'
     )
     OR has_table_privilege(
       'pc_registration_receipt_authority', 'auth.registration_applications', 'INSERT'
     )
     OR has_table_privilege(
       'pc_registration_receipt_authority', 'auth.registration_applications', 'UPDATE'
     )
     OR has_table_privilege(
       'pc_registration_receipt_authority', 'auth.registration_applications', 'DELETE'
     )
  THEN
    RAISE EXCEPTION 'Registration receipt authority is broader than read + bounded insert'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger trigger
    JOIN pg_catalog.pg_class relation ON relation.oid = trigger.tgrelid
    JOIN pg_catalog.pg_namespace schema ON schema.oid = relation.relnamespace
    WHERE schema.nspname = 'auth'
      AND relation.relname = 'audit_events'
      AND trigger.tgname IN (
        'auth_audit_events_append_only',
        'auth_audit_events_no_truncate'
      )
      AND trigger.tgenabled <> 'D'
    GROUP BY relation.oid
    HAVING count(*) = 2
  ) THEN
    RAISE EXCEPTION 'Auth approval audit must remain append-only'
      USING ERRCODE = '42501';
  END IF;
END
$registration_receipt_authority_proof$;
