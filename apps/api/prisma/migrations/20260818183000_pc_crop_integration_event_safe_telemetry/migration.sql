-- PC-CROP Federal Accounting / MASTER SECURITY v3.0
-- Database backstop for IntegrationEvent telemetry redaction.
--
-- PR #4423 makes the known application writer metadata-only and makes the
-- default staff reader metadata-only. This migration closes the bypass where a
-- second/future direct writer could still put a raw provider request, response,
-- token-bearing error or other arbitrary value into the same existing table.
--
-- IMPORTANT: the constraints are NOT VALID deliberately. PostgreSQL still
-- enforces a NOT VALID CHECK for every INSERT and UPDATE after it is created,
-- while historical rows are not scanned/rejected. Historical telemetry may be
-- evidence under retention/legal-hold rules, so rewriting it is a separate
-- governed decision. The default application endpoint is already redacted by
-- the parent slice.

CREATE OR REPLACE FUNCTION public.pc_crop_integration_event_safe_payload(payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $safe_payload$
DECLARE
  payload_kind text;
  numeric_text text;
  numeric_value numeric;
BEGIN
  -- SQL NULL means the caller had no request/response metadata to record.
  IF payload IS NULL THEN
    RETURN true;
  END IF;

  -- Every permitted value is one structural metadata object emitted by the
  -- application policy. Scalars/arrays at the top level would be original data.
  IF jsonb_typeof(payload) <> 'object' THEN
    RETURN false;
  END IF;

  payload_kind := payload ->> 'kind';

  IF payload_kind IN ('NULL', 'NUMBER', 'BOOLEAN', 'OTHER') THEN
    RETURN jsonb_object_length(payload) = 1
       AND payload ? 'kind';
  END IF;

  IF payload_kind = 'ARRAY' THEN
    IF jsonb_object_length(payload) <> 3
       OR NOT (payload ?& ARRAY['kind', 'itemCount', 'truncated'])
       OR jsonb_typeof(payload -> 'itemCount') <> 'number'
       OR jsonb_typeof(payload -> 'truncated') <> 'boolean' THEN
      RETURN false;
    END IF;
    numeric_text := payload ->> 'itemCount';
    IF numeric_text !~ '^[0-9]+$' THEN
      RETURN false;
    END IF;
    numeric_value := numeric_text::numeric;
    RETURN numeric_value BETWEEN 0 AND 1000000;
  END IF;

  IF payload_kind = 'OBJECT' THEN
    IF jsonb_object_length(payload) <> 3
       OR NOT (payload ?& ARRAY['kind', 'fieldCount', 'truncated'])
       OR jsonb_typeof(payload -> 'fieldCount') <> 'number'
       OR jsonb_typeof(payload -> 'truncated') <> 'boolean' THEN
      RETURN false;
    END IF;
    numeric_text := payload ->> 'fieldCount';
    IF numeric_text !~ '^[0-9]+$' THEN
      RETURN false;
    END IF;
    numeric_value := numeric_text::numeric;
    RETURN numeric_value BETWEEN 0 AND 1000000;
  END IF;

  IF payload_kind = 'STRING' THEN
    IF jsonb_object_length(payload) <> 3
       OR NOT (payload ?& ARRAY['kind', 'length', 'truncated'])
       OR jsonb_typeof(payload -> 'length') <> 'number'
       OR jsonb_typeof(payload -> 'truncated') <> 'boolean' THEN
      RETURN false;
    END IF;
    numeric_text := payload ->> 'length';
    IF numeric_text !~ '^[0-9]+$' THEN
      RETURN false;
    END IF;
    numeric_value := numeric_text::numeric;
    RETURN numeric_value BETWEEN 0 AND 10000000;
  END IF;

  RETURN false;
EXCEPTION
  -- A malformed JSON number or any other unexpected shape fails closed. A
  -- telemetry validator is not a reason for an arbitrary payload to get in.
  WHEN OTHERS THEN
    RETURN false;
END
$safe_payload$;

ALTER TABLE public."integration_events"
  ADD CONSTRAINT integration_events_request_payload_safe_ck
  CHECK (
    "requestPayload" IS NULL
    OR public.pc_crop_integration_event_safe_payload("requestPayload")
  ) NOT VALID;

ALTER TABLE public."integration_events"
  ADD CONSTRAINT integration_events_response_payload_safe_ck
  CHECK (
    "responsePayload" IS NULL
    OR public.pc_crop_integration_event_safe_payload("responsePayload")
  ) NOT VALID;

ALTER TABLE public."integration_events"
  ADD CONSTRAINT integration_events_error_message_safe_ck
  CHECK (
    "errorMessage" IS NULL
    OR "errorMessage" ~ '^[A-Z][A-Z0-9_.:-]{0,95}$'
  ) NOT VALID;

COMMENT ON FUNCTION public.pc_crop_integration_event_safe_payload(jsonb) IS
  'Fail-closed structural metadata validator for integration_events request/response telemetry. Never accepts original arbitrary payload values.';

COMMENT ON CONSTRAINT integration_events_request_payload_safe_ck
  ON public."integration_events" IS
  'Enforced for new/updated rows immediately; historical rows intentionally await governed scrub/retention review.';

COMMENT ON CONSTRAINT integration_events_response_payload_safe_ck
  ON public."integration_events" IS
  'Enforced for new/updated rows immediately; historical rows intentionally await governed scrub/retention review.';

COMMENT ON CONSTRAINT integration_events_error_message_safe_ck
  ON public."integration_events" IS
  'Only bounded machine-safe codes may be newly persisted; free-text errors belong neither in telemetry storage nor staff output.';
