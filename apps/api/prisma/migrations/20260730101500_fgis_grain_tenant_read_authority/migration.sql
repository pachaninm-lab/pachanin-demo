CREATE OR REPLACE FUNCTION public.text_array_has_unique_elements(items text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $function$
  SELECT cardinality(items) = (
    SELECT count(DISTINCT value)::integer
    FROM unnest(items) AS item(value)
  );
$function$;

ALTER TABLE public."fgis_grain_provider_configurations"
ADD COLUMN "tenantReadTransportAdmittedVersion" bigint,
ADD CONSTRAINT "fgis_grain_provider_config_tenant_read_admission_version_ck"
  CHECK (
    "tenantReadTransportAdmittedVersion" IS NULL
    OR "tenantReadTransportAdmittedVersion" >= 0
  );

CREATE TABLE public."fgis_grain_tenant_read_authorizations" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "configurationId" text NOT NULL,
  "configurationVersion" bigint NOT NULL,
  "allowedOperations" text[] NOT NULL,
  "authorizationReference" text NOT NULL,
  "status" text NOT NULL DEFAULT 'ACCESS_REQUIRED',
  "validUntil" timestamptz NOT NULL,
  "reason" text NOT NULL,
  "attestationEvidenceReference" text,
  "attestationValidUntil" timestamptz,
  "attestationJustification" text,
  "attestedByUserId" text,
  "version" bigint NOT NULL DEFAULT 0,
  "createdByUserId" text NOT NULL,
  "updatedByUserId" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_tenant_read_auth_config_fk"
    FOREIGN KEY ("configurationId")
    REFERENCES public."fgis_grain_provider_configurations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_auth_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_auth_created_user_fk"
    FOREIGN KEY ("createdByUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_auth_updated_user_fk"
    FOREIGN KEY ("updatedByUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_auth_attested_user_fk"
    FOREIGN KEY ("attestedByUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_auth_status_ck"
    CHECK ("status" IN (
      'ACCESS_REQUIRED',
      'AUTHORIZED_NOT_ATTESTED',
      'READ_ONLY_ATTESTED',
      'SUSPENDED',
      'REVOKED'
    )),
  CONSTRAINT "fgis_grain_tenant_read_auth_version_ck"
    CHECK ("version" >= 0 AND "configurationVersion" >= 0),
  CONSTRAINT "fgis_grain_tenant_read_auth_operations_ck"
    CHECK (
      cardinality("allowedOperations") > 0
      AND "allowedOperations" <@ ARRAY[
        'DICTIONARIES',
        'GET_LIST_GPB',
        'GET_LIST_GPB_DEBIT',
        'GET_LIST_GPB_EXTINCTION',
        'GET_LIST_GPB_EXTINCTION_REFUSAL',
        'GET_LIST_GPB_SDIZ',
        'GET_LIST_GM_APPLICATION',
        'GET_LIST_HARVESTED_CROP',
        'GET_LIST_PRIMARY_STORAGE_PLACE',
        'GET_LIST_RESEARCH',
        'GET_LIST_SAMPLES_PICKING',
        'GET_LIST_LOT',
        'GET_LIST_LOT_DEBIT',
        'GET_LIST_PURCHASE_FROM_INDIVIDUAL_DOC',
        'GET_LIST_EXTINCTION',
        'GET_LIST_EXTINCTION_REFUSAL',
        'GET_LIST_SDIZ',
        'GET_LIST_SDIZ_ELEVATOR',
        'GET_LIST_VED_CONTRACT'
      ]::text[]
      AND public.text_array_has_unique_elements("allowedOperations")
    ),
  CONSTRAINT "fgis_grain_tenant_read_auth_ttl_ck"
    CHECK ("validUntil" > "createdAt"),
  CONSTRAINT "fgis_grain_tenant_read_attestation_pair_ck"
    CHECK (
      ("attestationEvidenceReference" IS NULL
        AND "attestationValidUntil" IS NULL
        AND "attestationJustification" IS NULL
        AND "attestedByUserId" IS NULL)
      OR
      ("attestationEvidenceReference" IS NOT NULL
        AND "attestationValidUntil" IS NOT NULL
        AND "attestationJustification" IS NOT NULL
        AND "attestedByUserId" IS NOT NULL)
    ),
  CONSTRAINT "fgis_grain_tenant_read_auth_config_key"
    UNIQUE ("tenantId", "organizationId", "configurationId"),
  CONSTRAINT "fgis_grain_tenant_read_auth_tenant_key"
    UNIQUE ("id", "tenantId", "organizationId")
);

CREATE INDEX "fgis_grain_tenant_read_auth_status_idx"
  ON public."fgis_grain_tenant_read_authorizations"
  ("tenantId", "organizationId", "status", "validUntil");
CREATE INDEX "fgis_grain_tenant_read_auth_updated_idx"
  ON public."fgis_grain_tenant_read_authorizations"
  ("updatedAt" DESC, "id");

CREATE TABLE public."fgis_grain_tenant_read_provider_claims" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "authorizationId" text NOT NULL,
  "authorizationVersion" bigint NOT NULL,
  "configurationId" text NOT NULL,
  "actorUserId" text NOT NULL,
  "actorRole" text NOT NULL,
  "operationCode" text NOT NULL,
  "correlationId" text NOT NULL,
  "requestIdempotencyKey" text NOT NULL,
  "requestReference" text NOT NULL,
  "requestSha256" char(64) NOT NULL,
  "completionTokenSha256" char(64) NOT NULL,
  "completedAuditId" text,
  "completedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_tenant_read_claim_auth_fk"
    FOREIGN KEY ("authorizationId", "tenantId", "organizationId")
    REFERENCES public."fgis_grain_tenant_read_authorizations"("id", "tenantId", "organizationId")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_claim_config_fk"
    FOREIGN KEY ("configurationId")
    REFERENCES public."fgis_grain_provider_configurations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_claim_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_claim_user_fk"
    FOREIGN KEY ("actorUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_claim_version_ck"
    CHECK ("authorizationVersion" >= 0),
  CONSTRAINT "fgis_grain_tenant_read_claim_request_hash_ck"
    CHECK ("requestSha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_tenant_read_claim_completion_token_hash_ck"
    CHECK ("completionTokenSha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_tenant_read_claim_completion_pair_ck"
    CHECK (
      ("completedAuditId" IS NULL AND "completedAt" IS NULL)
      OR
      ("completedAuditId" IS NOT NULL AND "completedAt" IS NOT NULL)
    ),
  CONSTRAINT "fgis_grain_tenant_read_claim_completed_audit_key"
    UNIQUE ("completedAuditId"),
  CONSTRAINT "fgis_grain_tenant_read_claim_request_key"
    UNIQUE ("tenantId", "organizationId", "requestIdempotencyKey")
);

CREATE TABLE public."fgis_grain_tenant_read_audits" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "chainSequence" bigint NOT NULL,
  "authorizationId" text NOT NULL,
  "authorizationVersion" bigint NOT NULL,
  "configurationId" text NOT NULL,
  "actorUserId" text NOT NULL,
  "actorRole" text NOT NULL,
  "operationCode" text NOT NULL,
  "correlationId" text NOT NULL,
  "idempotencyKey" text NOT NULL,
  "requestIdempotencyKey" text NOT NULL,
  "requestReference" text NOT NULL,
  "requestSha256" char(64) NOT NULL,
  "decision" text NOT NULL,
  "reasonCode" text NOT NULL,
  "providerRequestId" text,
  "responseReference" text,
  "responseSha256" char(64),
  "receivedAt" timestamptz,
  "providerClaimId" text,
  "hash" char(64) NOT NULL,
  "prevHash" char(64),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_tenant_read_audit_auth_fk"
    FOREIGN KEY ("authorizationId", "tenantId", "organizationId")
    REFERENCES public."fgis_grain_tenant_read_authorizations"("id", "tenantId", "organizationId")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_audit_config_fk"
    FOREIGN KEY ("configurationId")
    REFERENCES public."fgis_grain_provider_configurations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_audit_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_audit_user_fk"
    FOREIGN KEY ("actorUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_audit_claim_fk"
    FOREIGN KEY ("providerClaimId")
    REFERENCES public."fgis_grain_tenant_read_provider_claims"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_audit_decision_ck"
    CHECK ("decision" IN ('AUTHORIZED', 'ATTESTED', 'DENIED', 'IN_FLIGHT', 'SUCCEEDED', 'FAILED')),
  CONSTRAINT "fgis_grain_tenant_read_audit_sequence_ck"
    CHECK ("chainSequence" > 0),
  CONSTRAINT "fgis_grain_tenant_read_audit_authorization_version_ck"
    CHECK ("authorizationVersion" >= 0),
  CONSTRAINT "fgis_grain_tenant_read_audit_request_hash_ck"
    CHECK ("requestSha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_tenant_read_audit_response_hash_ck"
    CHECK ("responseSha256" IS NULL OR "responseSha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_tenant_read_audit_hash_ck"
    CHECK ("hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_tenant_read_audit_prev_hash_ck"
    CHECK ("prevHash" IS NULL OR "prevHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_tenant_read_audit_provider_pair_ck"
    CHECK (
      ("providerRequestId" IS NULL
        AND "responseReference" IS NULL
        AND "responseSha256" IS NULL
        AND "receivedAt" IS NULL)
      OR
      ("providerRequestId" IS NOT NULL
        AND "responseReference" IS NOT NULL
        AND "responseSha256" IS NOT NULL
        AND "receivedAt" IS NOT NULL)
    ),
  CONSTRAINT "fgis_grain_tenant_read_audit_claim_pair_ck"
    CHECK (
      ("decision" IN ('IN_FLIGHT', 'SUCCEEDED', 'FAILED') AND "providerClaimId" IS NOT NULL)
      OR
      ("decision" NOT IN ('IN_FLIGHT', 'SUCCEEDED', 'FAILED') AND "providerClaimId" IS NULL)
    ),
  CONSTRAINT "fgis_grain_tenant_read_audit_idempotency_key"
    UNIQUE ("tenantId", "organizationId", "idempotencyKey"),
  CONSTRAINT "fgis_grain_tenant_read_audit_chain_sequence_key"
    UNIQUE ("tenantId", "organizationId", "chainSequence")
);

CREATE INDEX "fgis_grain_tenant_read_audit_auth_idx"
  ON public."fgis_grain_tenant_read_audits"
  ("authorizationId", "chainSequence" DESC);
CREATE INDEX "fgis_grain_tenant_read_audit_correlation_idx"
  ON public."fgis_grain_tenant_read_audits" ("correlationId");
CREATE INDEX "fgis_grain_tenant_read_audit_request_idx"
  ON public."fgis_grain_tenant_read_audits"
  ("tenantId", "organizationId", "requestIdempotencyKey", "chainSequence" DESC);
CREATE INDEX "fgis_grain_tenant_read_audit_decision_idx"
  ON public."fgis_grain_tenant_read_audits"
  ("tenantId", "organizationId", "decision", "chainSequence" DESC);
CREATE UNIQUE INDEX "fgis_grain_tenant_read_audit_claim_outcome_key"
  ON public."fgis_grain_tenant_read_audits" ("providerClaimId")
  WHERE "decision" IN ('SUCCEEDED', 'FAILED');

ALTER TABLE public."fgis_grain_tenant_read_provider_claims"
  ADD CONSTRAINT "fgis_grain_tenant_read_claim_completed_audit_fk"
  FOREIGN KEY ("completedAuditId")
  REFERENCES public."fgis_grain_tenant_read_audits"("id")
  ON UPDATE RESTRICT ON DELETE RESTRICT;

CREATE TABLE public."fgis_grain_tenant_read_audit_heads" (
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "lastSequence" bigint NOT NULL DEFAULT 0,
  "lastAuditId" text,
  "lastHash" char(64),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_tenant_read_audit_head_pkey"
    PRIMARY KEY ("tenantId", "organizationId"),
  CONSTRAINT "fgis_grain_tenant_read_audit_head_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_audit_head_last_audit_key"
    UNIQUE ("lastAuditId"),
  CONSTRAINT "fgis_grain_tenant_read_audit_head_last_audit_fk"
    FOREIGN KEY ("lastAuditId")
    REFERENCES public."fgis_grain_tenant_read_audits"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_audit_head_sequence_ck"
    CHECK ("lastSequence" >= 0),
  CONSTRAINT "fgis_grain_tenant_read_audit_head_hash_ck"
    CHECK ("lastHash" IS NULL OR "lastHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_tenant_read_audit_head_state_ck"
    CHECK (
      ("lastSequence" = 0 AND "lastAuditId" IS NULL AND "lastHash" IS NULL)
      OR
      ("lastSequence" > 0 AND "lastAuditId" IS NOT NULL AND "lastHash" IS NOT NULL)
    )
);

CREATE OR REPLACE FUNCTION public.fgis_grain_tenant_read_context_ready(
  require_mfa boolean
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT public.app_rls_context_ready()
    AND EXISTS (
      SELECT 1
      FROM auth.sessions AS auth_session
      JOIN public."user_orgs" AS membership
        ON membership."id" = auth_session.membership_id
       AND membership."userId" = auth_session.user_id
       AND membership."organizationId" = auth_session.organization_id
      JOIN public."users" AS app_user
        ON app_user."id" = auth_session.user_id
      JOIN public."organizations" AS organization
        ON organization."id" = auth_session.organization_id
       AND organization."tenantId" = auth_session.tenant_id
      WHERE auth_session.id = current_setting('app.current_session_id', true)
        AND auth_session.user_id = current_setting('app.current_user_id', true)
        AND auth_session.organization_id = current_setting('app.current_org_id', true)
        AND auth_session.tenant_id = current_setting('app.current_tenant_id', true)
        AND membership."role" = current_setting('app.current_role', true)
        AND auth_session.status = 'ACTIVE'
        AND auth_session.revoked_at IS NULL
        AND auth_session.expires_at > statement_timestamp()
        AND app_user."status" = 'ACTIVE'
        AND app_user."deletedAt" IS NULL
        AND (
          NOT require_mfa
          OR (
            auth_session.mfa_verified_at IS NOT NULL
            AND auth_session.mfa_level IN ('TOTP', 'BACKUP')
          )
        )
    );
$function$;

CREATE OR REPLACE FUNCTION public.fgis_grain_tenant_read_provider_authority_valid(
  p_configuration_id text,
  p_configuration_version bigint
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public."fgis_grain_provider_configurations" AS configuration
    WHERE configuration."id" = p_configuration_id
      AND configuration."tenantId" = current_setting('app.current_tenant_id', true)
      AND configuration."organizationId" = current_setting('app.current_org_id', true)
      AND configuration."version" = p_configuration_version
      AND configuration."status" = 'TEST_APPROVED'
  )
  AND (
    SELECT count(*) = 4 AND count(DISTINCT latest."actorUserId") = 4
    FROM (
      SELECT DISTINCT ON (attestation."gate")
        attestation."gate",
        attestation."decision",
        attestation."configurationVersion",
        attestation."actorUserId",
        attestation."validUntil"
      FROM public."fgis_grain_provider_attestations" AS attestation
      WHERE attestation."configurationId" = p_configuration_id
        AND attestation."tenantId" = current_setting('app.current_tenant_id', true)
        AND attestation."organizationId" = current_setting('app.current_org_id', true)
      ORDER BY attestation."gate", attestation."createdAt" DESC, attestation."id" DESC
    ) AS latest
    WHERE latest."gate" IN ('OWNER', 'SECURITY', 'LEGAL', 'OPERATIONS')
      AND latest."decision" = 'APPROVED'
      AND latest."configurationVersion" = p_configuration_version
      AND latest."validUntil" > statement_timestamp()
  );
$function$;

CREATE OR REPLACE FUNCTION public.append_fgis_grain_tenant_read_audit_internal(
  p_id text,
  p_tenant_id text,
  p_organization_id text,
  p_authorization_id text,
  p_authorization_version bigint,
  p_configuration_id text,
  p_actor_user_id text,
  p_actor_role text,
  p_operation_code text,
  p_correlation_id text,
  p_idempotency_key text,
  p_request_idempotency_key text,
  p_request_reference text,
  p_request_sha256 text,
  p_decision text,
  p_reason_code text,
  p_provider_request_id text,
  p_response_reference text,
  p_response_sha256 text,
  p_received_at timestamptz,
  p_provider_claim_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  current_head text;
  current_sequence bigint;
  next_sequence bigint;
  audit_created_at timestamptz;
  computed_hash text;
BEGIN
  INSERT INTO public."fgis_grain_tenant_read_audit_heads" (
    "tenantId", "organizationId"
  ) VALUES (
    p_tenant_id, p_organization_id
  )
  ON CONFLICT ("tenantId", "organizationId") DO NOTHING;

  SELECT head."lastSequence", head."lastHash"
  INTO current_sequence, current_head
  FROM public."fgis_grain_tenant_read_audit_heads" AS head
  WHERE head."tenantId" = p_tenant_id
    AND head."organizationId" = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read audit head is unavailable'
      USING ERRCODE = '55000';
  END IF;

  next_sequence := current_sequence + 1;
  audit_created_at := clock_timestamp();
  computed_hash := encode(public.digest(convert_to(jsonb_build_object(
    'id', p_id,
    'tenantId', p_tenant_id,
    'organizationId', p_organization_id,
    'chainSequence', next_sequence::text,
    'authorizationId', p_authorization_id,
    'authorizationVersion', p_authorization_version::text,
    'configurationId', p_configuration_id,
    'actorUserId', p_actor_user_id,
    'actorRole', p_actor_role,
    'operationCode', p_operation_code,
    'correlationId', p_correlation_id,
    'idempotencyKey', p_idempotency_key,
    'requestIdempotencyKey', p_request_idempotency_key,
    'requestReference', p_request_reference,
    'requestSha256', p_request_sha256,
    'decision', p_decision,
    'reasonCode', p_reason_code,
    'providerRequestId', p_provider_request_id,
    'responseReference', p_response_reference,
    'responseSha256', p_response_sha256,
    'receivedAt', CASE
      WHEN p_received_at IS NULL THEN NULL
      ELSE to_char(
        p_received_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
      )
    END,
    'providerClaimId', p_provider_claim_id,
    'prevHash', current_head,
    'createdAt', to_char(
      audit_created_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
    )
  )::text, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public."fgis_grain_tenant_read_audits" (
    "id", "tenantId", "organizationId", "chainSequence", "authorizationId",
    "authorizationVersion", "configurationId", "actorUserId", "actorRole",
    "operationCode", "correlationId", "idempotencyKey",
    "requestIdempotencyKey", "requestReference", "requestSha256", "decision",
    "reasonCode", "providerRequestId", "responseReference", "responseSha256",
    "receivedAt", "providerClaimId", "hash", "prevHash", "createdAt"
  ) VALUES (
    p_id,
    p_tenant_id,
    p_organization_id,
    next_sequence,
    p_authorization_id,
    p_authorization_version,
    p_configuration_id,
    p_actor_user_id,
    p_actor_role,
    p_operation_code,
    p_correlation_id,
    p_idempotency_key,
    p_request_idempotency_key,
    p_request_reference,
    p_request_sha256,
    p_decision,
    p_reason_code,
    p_provider_request_id,
    p_response_reference,
    p_response_sha256,
    p_received_at,
    p_provider_claim_id,
    computed_hash,
    current_head,
    audit_created_at
  );

  UPDATE public."fgis_grain_tenant_read_audit_heads"
  SET "lastSequence" = next_sequence,
      "lastAuditId" = p_id,
      "lastHash" = computed_hash,
      "updatedAt" = audit_created_at
  WHERE "tenantId" = p_tenant_id
    AND "organizationId" = p_organization_id;

  RETURN p_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.write_fgis_grain_tenant_read_authorization(
  p_authorization_id text,
  p_configuration_id text,
  p_configuration_version bigint,
  p_allowed_operations text[],
  p_authorization_reference text,
  p_valid_until timestamptz,
  p_reason text,
  p_expected_version bigint,
  p_audit_id text,
  p_audit_correlation_id text,
  p_audit_idempotency_key text,
  p_audit_request_sha256 text
)
RETURNS TABLE(authorization_id text, authorization_version bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  current_row public."fgis_grain_tenant_read_authorizations"%ROWTYPE;
  next_version bigint;
BEGIN
  IF session_user NOT IN ('app_runtime', 'app_service')
     AND NOT COALESCE((
       SELECT role_row.rolsuper
       FROM pg_catalog.pg_roles AS role_row
       WHERE role_row.rolname = session_user
     ), false)
  THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read command principal is denied'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.fgis_grain_tenant_read_context_ready(true)
     OR current_setting('app.current_role', true)
       NOT IN ('EXECUTIVE', 'ADMIN', 'COMPLIANCE_OFFICER')
  THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read authorization context is denied'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.fgis_grain_tenant_read_provider_authority_valid(
    p_configuration_id,
    p_configuration_version
  ) THEN
    RAISE EXCEPTION 'FGIS Grain provider authority is missing or stale'
      USING ERRCODE = '42501';
  END IF;

  IF p_expected_version IS NULL THEN
    INSERT INTO public."fgis_grain_tenant_read_authorizations" (
      "id", "tenantId", "organizationId", "configurationId",
      "configurationVersion", "allowedOperations", "authorizationReference",
      "status", "validUntil", "reason", "version",
      "createdByUserId", "updatedByUserId"
    ) VALUES (
      p_authorization_id,
      current_setting('app.current_tenant_id', true),
      current_setting('app.current_org_id', true),
      p_configuration_id,
      p_configuration_version,
      p_allowed_operations,
      p_authorization_reference,
      'AUTHORIZED_NOT_ATTESTED',
      p_valid_until,
      p_reason,
      0,
      current_setting('app.current_user_id', true),
      current_setting('app.current_user_id', true)
    );
    next_version := 0;
  ELSE
    SELECT *
    INTO current_row
    FROM public."fgis_grain_tenant_read_authorizations" AS target_authorization
    WHERE target_authorization."id" = p_authorization_id
      AND target_authorization."tenantId" = current_setting('app.current_tenant_id', true)
      AND target_authorization."organizationId" = current_setting('app.current_org_id', true)
    FOR UPDATE;

    IF NOT FOUND OR current_row."version" IS DISTINCT FROM p_expected_version THEN
      RAISE EXCEPTION 'FGIS Grain tenant-read authorization version changed'
        USING ERRCODE = '40001';
    END IF;
    IF current_row."status" = 'REVOKED' THEN
      RAISE EXCEPTION 'Revoked FGIS Grain tenant-read authorization cannot be reused'
        USING ERRCODE = '55000';
    END IF;

    UPDATE public."fgis_grain_tenant_read_authorizations"
    SET "configurationVersion" = p_configuration_version,
        "allowedOperations" = p_allowed_operations,
        "authorizationReference" = p_authorization_reference,
        "status" = 'AUTHORIZED_NOT_ATTESTED',
        "validUntil" = p_valid_until,
        "attestationEvidenceReference" = NULL,
        "attestationValidUntil" = NULL,
        "attestationJustification" = NULL,
        "attestedByUserId" = NULL,
        "reason" = p_reason,
        "version" = p_expected_version + 1,
        "updatedByUserId" = current_setting('app.current_user_id', true),
        "updatedAt" = clock_timestamp()
    WHERE "id" = p_authorization_id
      AND "tenantId" = current_setting('app.current_tenant_id', true)
      AND "organizationId" = current_setting('app.current_org_id', true)
      AND "version" = p_expected_version;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'FGIS Grain tenant-read authorization version changed'
        USING ERRCODE = '40001';
    END IF;
    next_version := p_expected_version + 1;
  END IF;

  PERFORM public.append_fgis_grain_tenant_read_audit_internal(
    p_audit_id,
    current_setting('app.current_tenant_id', true),
    current_setting('app.current_org_id', true),
    p_authorization_id,
    next_version,
    p_configuration_id,
    current_setting('app.current_user_id', true),
    current_setting('app.current_role', true),
    'AUTHORIZE',
    p_audit_correlation_id,
    p_audit_idempotency_key,
    p_audit_idempotency_key,
    p_authorization_reference,
    p_audit_request_sha256,
    'AUTHORIZED',
    'TENANT_READ_AUTHORIZATION_RECORDED',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
  );

  RETURN QUERY SELECT p_authorization_id, next_version;
END;
$function$;

CREATE OR REPLACE FUNCTION public.attest_fgis_grain_tenant_read_authorization(
  p_authorization_id text,
  p_expected_version bigint,
  p_evidence_reference text,
  p_valid_until timestamptz,
  p_justification text,
  p_audit_id text,
  p_audit_correlation_id text,
  p_audit_idempotency_key text,
  p_audit_request_sha256 text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  current_row public."fgis_grain_tenant_read_authorizations"%ROWTYPE;
BEGIN
  IF session_user NOT IN ('app_runtime', 'app_service')
     AND NOT COALESCE((
       SELECT role_row.rolsuper
       FROM pg_catalog.pg_roles AS role_row
       WHERE role_row.rolname = session_user
     ), false)
  THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read command principal is denied'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.fgis_grain_tenant_read_context_ready(true)
     OR current_setting('app.current_role', true) NOT IN ('ADMIN', 'COMPLIANCE_OFFICER')
  THEN
    RAISE EXCEPTION 'FGIS Grain external-read attestation context is denied'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO current_row
  FROM public."fgis_grain_tenant_read_authorizations" AS target_authorization
  WHERE target_authorization."id" = p_authorization_id
    AND target_authorization."tenantId" = current_setting('app.current_tenant_id', true)
    AND target_authorization."organizationId" = current_setting('app.current_org_id', true)
  FOR UPDATE;

  IF NOT FOUND
     OR current_row."version" IS DISTINCT FROM p_expected_version
     OR current_row."status" IS DISTINCT FROM 'AUTHORIZED_NOT_ATTESTED'
  THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read authorization cannot be attested'
      USING ERRCODE = '40001';
  END IF;
  IF current_row."validUntil" <= statement_timestamp()
     OR p_valid_until <= statement_timestamp()
     OR p_valid_until > current_row."validUntil"
  THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read attestation lifetime is invalid'
      USING ERRCODE = '22023';
  END IF;
  IF NOT public.fgis_grain_tenant_read_provider_authority_valid(
    current_row."configurationId",
    current_row."configurationVersion"
  ) THEN
    RAISE EXCEPTION 'FGIS Grain provider authority is missing or stale'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public."fgis_grain_provider_configurations" AS transport_configuration
    WHERE transport_configuration."id" = current_row."configurationId"
      AND transport_configuration."tenantId"
        = current_setting('app.current_tenant_id', true)
      AND transport_configuration."organizationId"
        = current_setting('app.current_org_id', true)
      AND transport_configuration."tenantReadTransportAdmittedVersion"
        = current_row."configurationVersion"
  ) THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read transport admission is missing'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public."fgis_grain_tenant_read_authorizations"
  SET "status" = 'READ_ONLY_ATTESTED',
      "attestationEvidenceReference" = p_evidence_reference,
      "attestationValidUntil" = p_valid_until,
      "attestationJustification" = p_justification,
      "attestedByUserId" = current_setting('app.current_user_id', true),
      "version" = p_expected_version + 1,
      "updatedByUserId" = current_setting('app.current_user_id', true),
      "updatedAt" = clock_timestamp()
  WHERE "id" = p_authorization_id
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
    AND "version" = p_expected_version
    AND "status" = 'AUTHORIZED_NOT_ATTESTED';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read authorization state changed'
      USING ERRCODE = '40001';
  END IF;

  PERFORM public.append_fgis_grain_tenant_read_audit_internal(
    p_audit_id,
    current_setting('app.current_tenant_id', true),
    current_setting('app.current_org_id', true),
    p_authorization_id,
    p_expected_version + 1,
    current_row."configurationId",
    current_setting('app.current_user_id', true),
    current_setting('app.current_role', true),
    'ATTEST',
    p_audit_correlation_id,
    p_audit_idempotency_key,
    p_audit_idempotency_key,
    p_evidence_reference,
    p_audit_request_sha256,
    'ATTESTED',
    'EXTERNAL_READ_EVIDENCE_RECORDED',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
  );

  RETURN p_expected_version + 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.append_fgis_grain_tenant_read_audit(
  p_id text,
  p_authorization_id text,
  p_authorization_version bigint,
  p_configuration_id text,
  p_operation_code text,
  p_correlation_id text,
  p_idempotency_key text,
  p_request_idempotency_key text,
  p_request_reference text,
  p_request_sha256 text,
  p_decision text,
  p_reason_code text,
  p_provider_request_id text,
  p_response_reference text,
  p_response_sha256 text,
  p_received_at timestamptz,
  p_completion_token_sha256 text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  current_authorization public."fgis_grain_tenant_read_authorizations"%ROWTYPE;
BEGIN
  IF session_user NOT IN ('app_runtime', 'app_service')
     AND NOT COALESCE((
       SELECT role_row.rolsuper
       FROM pg_catalog.pg_roles AS role_row
       WHERE role_row.rolname = session_user
     ), false)
  THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read audit principal is denied'
      USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('DENIED', 'IN_FLIGHT') THEN
    RAISE EXCEPTION 'FGIS Grain audit decision requires its database-owned command'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.fgis_grain_tenant_read_context_ready(false) THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read audit context is denied'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO current_authorization
  FROM public."fgis_grain_tenant_read_authorizations" AS candidate
  WHERE candidate."id" = p_authorization_id
    AND candidate."tenantId" = current_setting('app.current_tenant_id', true)
    AND candidate."organizationId" = current_setting('app.current_org_id', true)
    AND candidate."configurationId" = p_configuration_id;

  IF NOT FOUND
     OR current_authorization."version" IS DISTINCT FROM p_authorization_version
  THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read audit authorization binding is invalid'
      USING ERRCODE = '42501';
  END IF;

  IF current_setting('app.current_role', true) NOT IN (
    'FARMER', 'BUYER', 'LOGISTICIAN', 'ELEVATOR', 'LAB', 'ACCOUNTING',
    'EXECUTIVE', 'ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER'
  ) THEN
    RAISE EXCEPTION 'FGIS Grain read audit role is denied'
      USING ERRCODE = '42501';
  END IF;
  IF p_operation_code NOT IN (
    'DICTIONARIES',
    'GET_LIST_GPB',
    'GET_LIST_GPB_DEBIT',
    'GET_LIST_GPB_EXTINCTION',
    'GET_LIST_GPB_EXTINCTION_REFUSAL',
    'GET_LIST_GPB_SDIZ',
    'GET_LIST_GM_APPLICATION',
    'GET_LIST_HARVESTED_CROP',
    'GET_LIST_PRIMARY_STORAGE_PLACE',
    'GET_LIST_RESEARCH',
    'GET_LIST_SAMPLES_PICKING',
    'GET_LIST_LOT',
    'GET_LIST_LOT_DEBIT',
    'GET_LIST_PURCHASE_FROM_INDIVIDUAL_DOC',
    'GET_LIST_EXTINCTION',
    'GET_LIST_EXTINCTION_REFUSAL',
    'GET_LIST_SDIZ',
    'GET_LIST_SDIZ_ELEVATOR',
    'GET_LIST_VED_CONTRACT'
  ) THEN
    RAISE EXCEPTION 'FGIS Grain mutation operation cannot enter read audit'
      USING ERRCODE = '42501';
  END IF;

  IF p_decision = 'IN_FLIGHT' THEN
    IF current_authorization."status" <> 'READ_ONLY_ATTESTED'
       OR current_authorization."validUntil" <= statement_timestamp()
       OR current_authorization."attestationValidUntil" IS NULL
       OR current_authorization."attestationValidUntil" <= statement_timestamp()
       OR NOT (
         p_operation_code = ANY(current_authorization."allowedOperations")
       )
       OR NOT public.fgis_grain_tenant_read_provider_authority_valid(
         current_authorization."configurationId",
         current_authorization."configurationVersion"
       )
       OR NOT EXISTS (
         SELECT 1
         FROM public."fgis_grain_provider_configurations" AS transport_configuration
         WHERE transport_configuration."id" = current_authorization."configurationId"
           AND transport_configuration."tenantId"
             = current_setting('app.current_tenant_id', true)
           AND transport_configuration."organizationId"
             = current_setting('app.current_org_id', true)
           AND transport_configuration."tenantReadTransportAdmittedVersion"
             = current_authorization."configurationVersion"
       )
    THEN
      RAISE EXCEPTION 'FGIS Grain read execution authority is missing or stale'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_decision = 'IN_FLIGHT' THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        'platform-v7:fgis-grain-tenant-read-idempotency'
          || ':' || current_setting('app.current_tenant_id', true)
          || ':' || current_setting('app.current_org_id', true)
          || ':' || p_request_idempotency_key,
        0
      )
    );
    IF p_reason_code <> 'PROVIDER_READ_CLAIMED'
       OR p_completion_token_sha256 IS NULL
       OR p_completion_token_sha256 !~ '^[a-f0-9]{64}$'
       OR p_provider_request_id IS NOT NULL
       OR p_response_reference IS NOT NULL
       OR p_response_sha256 IS NOT NULL
       OR p_received_at IS NOT NULL
       OR EXISTS (
         SELECT 1
         FROM public."fgis_grain_tenant_read_audits" AS prior
         WHERE prior."tenantId" = current_setting('app.current_tenant_id', true)
           AND prior."organizationId" = current_setting('app.current_org_id', true)
           AND prior."requestIdempotencyKey" = p_request_idempotency_key
       )
    THEN
      RAISE EXCEPTION 'FGIS Grain read execution claim is invalid'
        USING ERRCODE = '23505';
    END IF;
    INSERT INTO public."fgis_grain_tenant_read_provider_claims" (
      "id", "tenantId", "organizationId", "authorizationId",
      "authorizationVersion", "configurationId", "actorUserId", "actorRole",
      "operationCode", "correlationId", "requestIdempotencyKey",
      "requestReference", "requestSha256", "completionTokenSha256"
    ) VALUES (
      p_id,
      current_setting('app.current_tenant_id', true),
      current_setting('app.current_org_id', true),
      p_authorization_id,
      p_authorization_version,
      p_configuration_id,
      current_setting('app.current_user_id', true),
      current_setting('app.current_role', true),
      p_operation_code,
      p_correlation_id,
      p_request_idempotency_key,
      p_request_reference,
      p_request_sha256,
      p_completion_token_sha256
    );
  ELSE
    IF p_reason_code NOT IN (
      'AUTHORIZATION_NOT_ATTESTED',
      'AUTHORIZATION_OR_ATTESTATION_EXPIRED',
      'OPERATION_NOT_AUTHORIZED',
      'PROVIDER_TRANSPORT_DISABLED'
    )
       OR p_completion_token_sha256 IS NOT NULL
       OR p_provider_request_id IS NOT NULL
       OR p_response_reference IS NOT NULL
       OR p_response_sha256 IS NOT NULL
       OR p_received_at IS NOT NULL
    THEN
      RAISE EXCEPTION 'FGIS Grain read denial audit is invalid'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN public.append_fgis_grain_tenant_read_audit_internal(
    p_id,
    current_setting('app.current_tenant_id', true),
    current_setting('app.current_org_id', true),
    p_authorization_id,
    p_authorization_version,
    p_configuration_id,
    current_setting('app.current_user_id', true),
    current_setting('app.current_role', true),
    p_operation_code,
    p_correlation_id,
    p_idempotency_key,
    p_request_idempotency_key,
    p_request_reference,
    p_request_sha256,
    p_decision,
    p_reason_code,
    p_provider_request_id,
    p_response_reference,
    p_response_sha256,
    p_received_at,
    CASE WHEN p_decision = 'IN_FLIGHT' THEN p_id ELSE NULL END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_fgis_grain_tenant_read_claim(
  p_claim_id text,
  p_completion_token text,
  p_decision text,
  p_reason_code text,
  p_provider_request_id text,
  p_response_reference text,
  p_response_sha256 text,
  p_received_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  claim public."fgis_grain_tenant_read_provider_claims"%ROWTYPE;
  outcome_id text;
  outcome_idempotency_key text;
BEGIN
  IF session_user NOT IN ('app_runtime', 'app_service')
     AND NOT COALESCE((
       SELECT role_row.rolsuper
       FROM pg_catalog.pg_roles AS role_row
       WHERE role_row.rolname = session_user
     ), false)
  THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read claim finalizer principal is denied'
      USING ERRCODE = '42501';
  END IF;

  IF p_completion_token IS NULL
     OR length(p_completion_token) < 43
  THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read completion capability is invalid'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO claim
  FROM public."fgis_grain_tenant_read_provider_claims" AS candidate
  WHERE candidate."id" = p_claim_id
    AND candidate."completionTokenSha256" = encode(
      public.digest(convert_to(p_completion_token, 'UTF8'), 'sha256'),
      'hex'
    )
  FOR UPDATE;

  IF NOT FOUND OR claim."completedAuditId" IS NOT NULL THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read claim is missing or already finalized'
      USING ERRCODE = '42501';
  END IF;

  IF (
    p_decision = 'SUCCEEDED'
    AND (
      p_reason_code <> 'PROVIDER_READ_SUCCEEDED'
      OR p_provider_request_id IS NULL
      OR p_response_reference IS NULL
      OR p_response_sha256 IS NULL
      OR p_response_sha256 !~ '^[a-f0-9]{64}$'
      OR p_received_at IS NULL
    )
  ) OR (
    p_decision = 'FAILED'
    AND (
      p_reason_code <> 'PROVIDER_READ_FAILED'
      OR p_provider_request_id IS NOT NULL
      OR p_response_reference IS NOT NULL
      OR p_response_sha256 IS NOT NULL
      OR p_received_at IS NOT NULL
    )
  ) OR p_decision NOT IN ('SUCCEEDED', 'FAILED')
  THEN
    RAISE EXCEPTION 'FGIS Grain read execution outcome is not claim-bound'
      USING ERRCODE = '42501';
  END IF;

  outcome_id := public.gen_random_uuid()::text;
  outcome_idempotency_key := 'fgis-read:outcome:' || encode(
    public.digest(
      convert_to('OUTCOME:' || claim."requestIdempotencyKey", 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  PERFORM public.append_fgis_grain_tenant_read_audit_internal(
    outcome_id,
    claim."tenantId",
    claim."organizationId",
    claim."authorizationId",
    claim."authorizationVersion",
    claim."configurationId",
    claim."actorUserId",
    claim."actorRole",
    claim."operationCode",
    claim."correlationId",
    outcome_idempotency_key,
    claim."requestIdempotencyKey",
    claim."requestReference",
    claim."requestSha256",
    p_decision,
    p_reason_code,
    p_provider_request_id,
    p_response_reference,
    p_response_sha256,
    p_received_at,
    claim."id"
  );

  UPDATE public."fgis_grain_tenant_read_provider_claims"
  SET "completedAuditId" = outcome_id,
      "completedAt" = clock_timestamp()
  WHERE "id" = claim."id"
    AND "completedAuditId" IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read claim finalization raced'
      USING ERRCODE = '40001';
  END IF;

  RETURN outcome_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_fgis_grain_tenant_read_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'FGIS Grain tenant-read audits are immutable'
    USING ERRCODE = '55000';
END;
$function$;

CREATE TRIGGER "fgis_grain_tenant_read_audits_no_update"
BEFORE UPDATE ON public."fgis_grain_tenant_read_audits"
FOR EACH ROW EXECUTE FUNCTION public.reject_fgis_grain_tenant_read_audit_mutation();

CREATE TRIGGER "fgis_grain_tenant_read_audits_no_delete"
BEFORE DELETE ON public."fgis_grain_tenant_read_audits"
FOR EACH ROW EXECUTE FUNCTION public.reject_fgis_grain_tenant_read_audit_mutation();

CREATE OR REPLACE FUNCTION public.guard_fgis_grain_tenant_read_claim_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD."completedAuditId" IS NOT NULL
     OR ROW(
       NEW."id",
       NEW."tenantId",
       NEW."organizationId",
       NEW."authorizationId",
       NEW."authorizationVersion",
       NEW."configurationId",
       NEW."actorUserId",
       NEW."actorRole",
       NEW."operationCode",
       NEW."correlationId",
       NEW."requestIdempotencyKey",
       NEW."requestReference",
       NEW."requestSha256",
       NEW."completionTokenSha256",
       NEW."createdAt"
     ) IS DISTINCT FROM ROW(
       OLD."id",
       OLD."tenantId",
       OLD."organizationId",
       OLD."authorizationId",
       OLD."authorizationVersion",
       OLD."configurationId",
       OLD."actorUserId",
       OLD."actorRole",
       OLD."operationCode",
       OLD."correlationId",
       OLD."requestIdempotencyKey",
       OLD."requestReference",
       OLD."requestSha256",
       OLD."completionTokenSha256",
       OLD."createdAt"
     )
     OR NEW."completedAuditId" IS NULL
     OR NEW."completedAt" IS NULL
  THEN
    RAISE EXCEPTION 'FGIS Grain tenant-read provider claim facts are immutable'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_fgis_grain_tenant_read_claim_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'FGIS Grain tenant-read provider claims cannot be deleted'
    USING ERRCODE = '55000';
END;
$function$;

CREATE TRIGGER "fgis_grain_tenant_read_claims_guard_update"
BEFORE UPDATE ON public."fgis_grain_tenant_read_provider_claims"
FOR EACH ROW EXECUTE FUNCTION public.guard_fgis_grain_tenant_read_claim_update();

CREATE TRIGGER "fgis_grain_tenant_read_claims_no_delete"
BEFORE DELETE ON public."fgis_grain_tenant_read_provider_claims"
FOR EACH ROW EXECUTE FUNCTION public.reject_fgis_grain_tenant_read_claim_delete();

ALTER TABLE public."fgis_grain_tenant_read_authorizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_tenant_read_authorizations" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_tenant_read_audits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_tenant_read_audits" FORCE ROW LEVEL SECURITY;

CREATE POLICY "fgis_grain_tenant_read_auth_select_policy"
ON public."fgis_grain_tenant_read_authorizations"
FOR SELECT
USING (
  public.fgis_grain_tenant_read_context_ready(false)
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
  AND current_setting('app.current_role', true) IN (
    'FARMER', 'BUYER', 'LOGISTICIAN', 'ELEVATOR', 'LAB', 'ACCOUNTING',
    'EXECUTIVE', 'ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER'
  )
);

CREATE POLICY "fgis_grain_tenant_read_auth_insert_policy"
ON public."fgis_grain_tenant_read_authorizations"
FOR INSERT
WITH CHECK (
  public.fgis_grain_tenant_read_context_ready(true)
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
  AND current_setting('app.current_role', true) IN ('EXECUTIVE', 'ADMIN', 'COMPLIANCE_OFFICER')
);

CREATE POLICY "fgis_grain_tenant_read_auth_update_policy"
ON public."fgis_grain_tenant_read_authorizations"
FOR UPDATE
USING (
  public.fgis_grain_tenant_read_context_ready(true)
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
  AND current_setting('app.current_role', true) IN ('EXECUTIVE', 'ADMIN', 'COMPLIANCE_OFFICER')
)
WITH CHECK (
  public.fgis_grain_tenant_read_context_ready(true)
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
  AND current_setting('app.current_role', true) IN ('EXECUTIVE', 'ADMIN', 'COMPLIANCE_OFFICER')
);

CREATE POLICY "fgis_grain_tenant_read_audit_select_policy"
ON public."fgis_grain_tenant_read_audits"
FOR SELECT
USING (
  public.fgis_grain_tenant_read_context_ready(false)
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
  AND current_setting('app.current_role', true) IN (
    'FARMER', 'BUYER', 'LOGISTICIAN', 'ELEVATOR', 'LAB', 'ACCOUNTING',
    'EXECUTIVE', 'ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER'
  )
);

CREATE POLICY "fgis_grain_tenant_read_audit_insert_policy"
ON public."fgis_grain_tenant_read_audits"
FOR INSERT
WITH CHECK (
  (
    public.fgis_grain_tenant_read_context_ready(false)
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
    AND "actorUserId" = current_setting('app.current_user_id', true)
    AND "actorRole" = current_setting('app.current_role', true)
    AND current_setting('app.current_role', true) IN (
      'FARMER', 'BUYER', 'LOGISTICIAN', 'ELEVATOR', 'LAB', 'ACCOUNTING',
      'EXECUTIVE', 'ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER'
    )
  )
  OR (
    "decision" IN ('SUCCEEDED', 'FAILED')
    AND EXISTS (
      SELECT 1
      FROM public."fgis_grain_tenant_read_provider_claims" AS claim
      WHERE claim."id" = "fgis_grain_tenant_read_audits"."providerClaimId"
        AND claim."completedAuditId" IS NULL
        AND claim."tenantId" = "fgis_grain_tenant_read_audits"."tenantId"
        AND claim."organizationId" = "fgis_grain_tenant_read_audits"."organizationId"
        AND claim."authorizationId" = "fgis_grain_tenant_read_audits"."authorizationId"
        AND claim."authorizationVersion" = "fgis_grain_tenant_read_audits"."authorizationVersion"
        AND claim."configurationId" = "fgis_grain_tenant_read_audits"."configurationId"
        AND claim."actorUserId" = "fgis_grain_tenant_read_audits"."actorUserId"
        AND claim."actorRole" = "fgis_grain_tenant_read_audits"."actorRole"
        AND claim."operationCode" = "fgis_grain_tenant_read_audits"."operationCode"
        AND claim."correlationId" = "fgis_grain_tenant_read_audits"."correlationId"
        AND claim."requestIdempotencyKey" = "fgis_grain_tenant_read_audits"."requestIdempotencyKey"
        AND claim."requestReference" = "fgis_grain_tenant_read_audits"."requestReference"
        AND claim."requestSha256" = "fgis_grain_tenant_read_audits"."requestSha256"
    )
  )
);

REVOKE ALL ON TABLE public."fgis_grain_tenant_read_authorizations" FROM PUBLIC;
REVOKE ALL ON TABLE public."fgis_grain_tenant_read_audits" FROM PUBLIC;
REVOKE ALL ON TABLE public."fgis_grain_tenant_read_provider_claims" FROM PUBLIC;
REVOKE ALL ON TABLE public."fgis_grain_tenant_read_audit_heads" FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fgis_grain_tenant_read_context_ready(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fgis_grain_tenant_read_provider_authority_valid(text, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.append_fgis_grain_tenant_read_audit_internal(
  text, text, text, text, bigint, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, timestamptz, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.write_fgis_grain_tenant_read_authorization(
  text, text, bigint, text[], text, timestamptz, text, bigint,
  text, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attest_fgis_grain_tenant_read_authorization(
  text, bigint, text, timestamptz, text, text, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.append_fgis_grain_tenant_read_audit(
  text, text, bigint, text, text, text, text, text, text, text,
  text, text, text, text, text, timestamptz, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_fgis_grain_tenant_read_claim(
  text, text, text, text, text, text, text, timestamptz
) FROM PUBLIC;

DO $grants$
DECLARE
  runtime_role text;
BEGIN
  FOREACH runtime_role IN ARRAY ARRAY['app_runtime', 'app_service']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = runtime_role) THEN
      EXECUTE format(
        'REVOKE INSERT, UPDATE, DELETE ON TABLE public."fgis_grain_provider_configurations" FROM %I',
        runtime_role
      );
      EXECUTE format(
        'GRANT INSERT (
          "id", "tenantId", "organizationId", "adapterCode", "apiVersion",
          "mappingVersion", "signingPolicyVersion", "environment",
          "endpointReference", "tlsPolicyReference", "credentialReference",
          "signingKeyReference", "payloadStoreReference", "status", "version",
          "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
        ) ON TABLE public."fgis_grain_provider_configurations" TO %I',
        runtime_role
      );
      EXECUTE format(
        'GRANT UPDATE (
          "id", "tenantId", "organizationId", "adapterCode", "apiVersion",
          "mappingVersion", "signingPolicyVersion", "environment",
          "endpointReference", "tlsPolicyReference", "credentialReference",
          "signingKeyReference", "payloadStoreReference", "status", "version",
          "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
        ) ON TABLE public."fgis_grain_provider_configurations" TO %I',
        runtime_role
      );
      EXECUTE format(
        'GRANT SELECT ON TABLE public."fgis_grain_tenant_read_authorizations" TO %I',
        runtime_role
      );
      EXECUTE format(
        'GRANT SELECT ON TABLE public."fgis_grain_tenant_read_audits" TO %I',
        runtime_role
      );
      EXECUTE format(
        'GRANT SELECT ON TABLE public."fgis_grain_provider_configurations", public."fgis_grain_provider_attestations" TO %I',
        runtime_role
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.fgis_grain_tenant_read_context_ready(boolean) TO %I',
        runtime_role
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.fgis_grain_tenant_read_provider_authority_valid(text, bigint) TO %I',
        runtime_role
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.write_fgis_grain_tenant_read_authorization(text, text, bigint, text[], text, timestamptz, text, bigint, text, text, text, text) TO %I',
        runtime_role
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.attest_fgis_grain_tenant_read_authorization(text, bigint, text, timestamptz, text, text, text, text, text) TO %I',
        runtime_role
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.append_fgis_grain_tenant_read_audit(text, text, bigint, text, text, text, text, text, text, text, text, text, text, text, text, timestamptz, text) TO %I',
        runtime_role
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.finalize_fgis_grain_tenant_read_claim(text, text, text, text, text, text, text, timestamptz) TO %I',
        runtime_role
      );
    END IF;
  END LOOP;
END;
$grants$;
