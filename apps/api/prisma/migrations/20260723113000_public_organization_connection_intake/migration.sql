BEGIN;

CREATE TABLE IF NOT EXISTS public.public_organization_connection_requests (
  id text PRIMARY KEY,
  "requestNumber" text NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'NEW',
  locale varchar(2) NOT NULL,
  "organizationName" text NOT NULL,
  inn varchar(12) NOT NULL,
  "contactName" text NOT NULL,
  position text NOT NULL,
  phone varchar(32) NOT NULL,
  email varchar(254) NOT NULL,
  "organizationRole" varchar(48) NOT NULL,
  scenario varchar(48) NOT NULL,
  "consentVersion" varchar(64) NOT NULL,
  "consentedAt" timestamptz(3) NOT NULL,
  "payloadHash" char(64) NOT NULL,
  "idempotencyKey" varchar(128) NOT NULL,
  "correlationId" varchar(128) NOT NULL,
  source varchar(48) NOT NULL DEFAULT 'PUBLIC_PLATFORM_V7',
  "auditEventId" text NOT NULL,
  "outboxEntryId" text NOT NULL,
  "retentionUntil" timestamptz(3) NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT public_org_connection_requests_number_key UNIQUE ("requestNumber"),
  CONSTRAINT public_org_connection_requests_idempotency_key UNIQUE ("idempotencyKey"),
  CONSTRAINT public_org_connection_requests_audit_key UNIQUE ("auditEventId"),
  CONSTRAINT public_org_connection_requests_outbox_key UNIQUE ("outboxEntryId"),
  CONSTRAINT public_org_connection_requests_status_check CHECK (status IN ('NEW', 'IN_REVIEW', 'CONTACTED', 'CLOSED', 'REJECTED')),
  CONSTRAINT public_org_connection_requests_locale_check CHECK (locale IN ('ru', 'en', 'zh')),
  CONSTRAINT public_org_connection_requests_inn_check CHECK (inn ~ '^[0-9]{10}([0-9]{2})?$'),
  CONSTRAINT public_org_connection_requests_payload_hash_check CHECK ("payloadHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT public_org_connection_requests_consent_check CHECK ("consentVersion" <> '' AND "consentedAt" <= now()),
  CONSTRAINT public_org_connection_requests_retention_check CHECK ("retentionUntil" > "createdAt"),
  CONSTRAINT public_org_connection_requests_audit_fkey FOREIGN KEY ("auditEventId")
    REFERENCES public.audit_events(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT public_org_connection_requests_outbox_fkey FOREIGN KEY ("outboxEntryId")
    REFERENCES public.outbox_entries(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS public_org_connection_requests_status_created_idx
  ON public.public_organization_connection_requests (status, "createdAt" DESC, id);
CREATE INDEX IF NOT EXISTS public_org_connection_requests_inn_created_idx
  ON public.public_organization_connection_requests (inn, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS public_org_connection_requests_email_created_idx
  ON public.public_organization_connection_requests (email, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS public_org_connection_requests_payload_hash_idx
  ON public.public_organization_connection_requests ("payloadHash");
CREATE INDEX IF NOT EXISTS public_org_connection_requests_retention_idx
  ON public.public_organization_connection_requests ("retentionUntil");

COMMENT ON TABLE public.public_organization_connection_requests IS
  'Pre-tenant public organization connection requests. Does not create Organization, User, membership, role or tenant authority.';
COMMENT ON COLUMN public.public_organization_connection_requests."auditEventId" IS
  'Atomic non-PII audit evidence row created in the same PostgreSQL transaction.';
COMMENT ON COLUMN public.public_organization_connection_requests."outboxEntryId" IS
  'Atomic non-PII operator-queue event created in the same PostgreSQL transaction.';

COMMIT;
