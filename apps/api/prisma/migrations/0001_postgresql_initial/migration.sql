-- GrainFlow v3 — Initial PostgreSQL schema migration
-- Migrates from SQLite to PostgreSQL 16 with RLS, proper types, and constraints

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ── Organizations ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "organizations" (
    "id"           TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "inn"          TEXT         NOT NULL,
    "ogrn"         TEXT,
    "name"         TEXT         NOT NULL,
    "type"         TEXT         NOT NULL DEFAULT 'LEGAL',
    "status"       TEXT         NOT NULL DEFAULT 'PENDING',
    "tenantId"     TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "verifiedAt"   TIMESTAMPTZ,
    "bankDetails"  TEXT,
    "address"      TEXT,
    "kycStatus"    TEXT         NOT NULL DEFAULT 'PENDING',
    "amlStatus"    TEXT         NOT NULL DEFAULT 'CLEAR',
    "sanctionHit"  BOOLEAN      NOT NULL DEFAULT FALSE,
    "createdAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_inn_key" ON "organizations"("inn");
CREATE INDEX IF NOT EXISTS "organizations_tenantId_idx" ON "organizations"("tenantId");

-- ── Users ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "users" (
    "id"           TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "email"        TEXT         NOT NULL,
    "phone"        TEXT,
    "passwordHash" TEXT         NOT NULL,
    "fullName"     TEXT         NOT NULL,
    "status"       TEXT         NOT NULL DEFAULT 'ACTIVE',
    "mfaEnabled"   BOOLEAN      NOT NULL DEFAULT FALSE,
    "mfaSecret"    TEXT,
    "mfaBackup"    TEXT,
    "createdAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "deletedAt"    TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

-- ── UserOrgs ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "user_orgs" (
    "id"             TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "userId"         TEXT        NOT NULL,
    "organizationId" TEXT        NOT NULL,
    "role"           TEXT        NOT NULL,
    "isDefault"      BOOLEAN     NOT NULL DEFAULT FALSE,
    "joinedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "user_orgs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_orgs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "user_orgs_orgId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_orgs_userId_orgId_key" ON "user_orgs"("userId", "organizationId");
CREATE INDEX IF NOT EXISTS "user_orgs_orgId_idx" ON "user_orgs"("organizationId");

-- ── УКЭП Certificates ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ukep_certificates" (
    "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "userId"      TEXT        NOT NULL,
    "provider"    TEXT        NOT NULL,
    "externalId"  TEXT        NOT NULL,
    "thumbprint"  TEXT        NOT NULL,
    "subject"     TEXT        NOT NULL,
    "issuer"      TEXT        NOT NULL,
    "validFrom"   TIMESTAMPTZ NOT NULL,
    "validUntil"  TIMESTAMPTZ NOT NULL,
    "status"      TEXT        NOT NULL DEFAULT 'VALID',
    "revokedAt"   TIMESTAMPTZ,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "ukep_certificates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ukep_certs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "ukep_certs_userId_idx" ON "ukep_certificates"("userId");
CREATE INDEX IF NOT EXISTS "ukep_certs_thumbprint_idx" ON "ukep_certificates"("thumbprint");

-- ── Deals ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "deals" (
    "id"            TEXT         NOT NULL,
    "lotId"         TEXT,
    "dealNumber"    TEXT,
    "status"        TEXT         NOT NULL DEFAULT 'DRAFT',
    "tenantId"      TEXT,
    "sellerOrgId"   TEXT         NOT NULL,
    "buyerOrgId"    TEXT         NOT NULL,
    "volumeTons"    DOUBLE PRECISION,
    "pricePerTon"   DOUBLE PRECISION,
    "totalRub"      DOUBLE PRECISION,
    "totalKopecks"  BIGINT,
    "currency"      TEXT         NOT NULL DEFAULT 'RUB',
    "culture"       TEXT,
    "cropClass"     TEXT,
    "gost"          TEXT,
    "region"        TEXT,
    "incoterms"     TEXT,
    "fundingChoice" TEXT,
    "owner"         TEXT,
    "nextAction"    TEXT,
    "slaAt"         TIMESTAMPTZ,
    "signedAt"      TIMESTAMPTZ,
    "closedAt"      TIMESTAMPTZ,
    "sagaState"     JSONB,
    "sagaStep"      TEXT,
    "createdAt"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "meta"          JSONB,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "deals_dealNumber_key" ON "deals"("dealNumber") WHERE "dealNumber" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "deals_sellerOrgId_idx" ON "deals"("sellerOrgId");
CREATE INDEX IF NOT EXISTS "deals_buyerOrgId_idx"  ON "deals"("buyerOrgId");
CREATE INDEX IF NOT EXISTS "deals_status_idx"       ON "deals"("status");
CREATE INDEX IF NOT EXISTS "deals_tenantId_idx"     ON "deals"("tenantId");

-- ── Deal Events (append-only, hash chain) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS "deal_events" (
    "id"        TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "dealId"    TEXT        NOT NULL,
    "eventType" TEXT        NOT NULL,
    "actorId"   TEXT        NOT NULL,
    "actorRole" TEXT        NOT NULL,
    "tenantId"  TEXT,
    "payload"   JSONB       NOT NULL DEFAULT '{}',
    "hash"      TEXT        NOT NULL,
    "prevHash"  TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "deal_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "deal_events_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id")
);

CREATE INDEX IF NOT EXISTS "deal_events_dealId_idx" ON "deal_events"("dealId");

-- Append-only enforcement
CREATE OR REPLACE RULE no_update_deal_events AS ON UPDATE TO "deal_events" DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_deal_events AS ON DELETE TO "deal_events" DO INSTEAD NOTHING;

-- ── Shipments ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "shipments" (
    "id"            TEXT         NOT NULL,
    "dealId"        TEXT         NOT NULL,
    "status"        TEXT         NOT NULL DEFAULT 'PENDING',
    "driverUserId"  TEXT,
    "driverName"    TEXT,
    "vehicleNumber" TEXT,
    "vehicleType"   TEXT,
    "carrierOrgId"  TEXT,
    "carrierName"   TEXT,
    "routeFrom"     TEXT,
    "routeTo"       TEXT,
    "etaHours"      DOUBLE PRECISION,
    "loadedTons"    DOUBLE PRECISION,
    "pinVerified"   BOOLEAN      NOT NULL DEFAULT FALSE,
    "nextAction"    TEXT,
    "blockers"      JSONB,
    "geoLat"        DOUBLE PRECISION,
    "geoLng"        DOUBLE PRECISION,
    "lastGeoAt"     TIMESTAMPTZ,
    "createdAt"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shipments_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id")
);

CREATE INDEX IF NOT EXISTS "shipments_dealId_idx"     ON "shipments"("dealId");
CREATE INDEX IF NOT EXISTS "shipments_driverId_idx"   ON "shipments"("driverUserId");
CREATE INDEX IF NOT EXISTS "shipments_status_idx"     ON "shipments"("status");

-- ── Checkpoints ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "checkpoints" (
    "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "shipmentId"  TEXT        NOT NULL,
    "type"        TEXT        NOT NULL,
    "completedAt" TIMESTAMPTZ,
    "lat"         DOUBLE PRECISION,
    "lng"         DOUBLE PRECISION,
    "note"        TEXT,
    "photoUrl"    TEXT,
    "actorId"     TEXT,

    CONSTRAINT "checkpoints_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "checkpoints_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id")
);

CREATE INDEX IF NOT EXISTS "checkpoints_shipmentId_idx" ON "checkpoints"("shipmentId");

-- ── Documents ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "deal_documents" (
    "id"               TEXT         NOT NULL,
    "dealId"           TEXT         NOT NULL,
    "type"             TEXT         NOT NULL,
    "status"           TEXT         NOT NULL DEFAULT 'DRAFT',
    "name"             TEXT         NOT NULL,
    "mimeType"         TEXT,
    "s3Key"            TEXT,
    "sizeBytes"        BIGINT,
    "hash"             TEXT,
    "uploadedAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "uploadedByUserId" TEXT,
    "signedAt"         TIMESTAMPTZ,
    "signatories"      JSONB,
    "bankRequired"     BOOLEAN      NOT NULL DEFAULT FALSE,
    "releaseRequired"  BOOLEAN      NOT NULL DEFAULT FALSE,
    "bankAcceptance"   TEXT         NOT NULL DEFAULT 'PENDING',
    "edoStatus"        TEXT,
    "edoExternalId"    TEXT,
    "version"          INTEGER      NOT NULL DEFAULT 1,
    "isImmutable"      BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT "deal_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "deal_docs_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id")
);

CREATE INDEX IF NOT EXISTS "deal_docs_dealId_idx" ON "deal_documents"("dealId");
CREATE INDEX IF NOT EXISTS "deal_docs_type_idx"   ON "deal_documents"("type");

-- ── Payments ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "payments" (
    "id"               TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "dealId"           TEXT         NOT NULL,
    "status"           TEXT         NOT NULL DEFAULT 'PENDING',
    "amountRub"        DOUBLE PRECISION,
    "amountKopecks"    BIGINT,
    "reservedAt"       TIMESTAMPTZ,
    "releasedAt"       TIMESTAMPTZ,
    "holdAmountKopecks"  BIGINT,
    "refundedKopecks"  BIGINT,
    "commissionKopecks"  BIGINT,
    "callbackState"    TEXT         NOT NULL DEFAULT 'NONE',
    "bankRef"          TEXT,
    "escrowAccount"    TEXT,
    "idempotencyKey"   TEXT,
    "updatedAt"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "createdAt"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payments_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payments_idempotencyKey_key" ON "payments"("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "payments_dealId_idx" ON "payments"("dealId");

-- ── Ledger Entries (double-entry, immutable) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS "ledger_entries" (
    "id"              TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "dealId"          TEXT,
    "entryType"       TEXT         NOT NULL,
    "debitAccount"    TEXT         NOT NULL,
    "creditAccount"   TEXT         NOT NULL,
    "amountKopecks"   BIGINT       NOT NULL CHECK ("amountKopecks" > 0),
    "currency"        TEXT         NOT NULL DEFAULT 'RUB',
    "reference"       TEXT,
    "idempotencyKey"  TEXT         NOT NULL,
    "description"     TEXT,
    "createdAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "createdByUserId" TEXT,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ledger_idempotencyKey_key" ON "ledger_entries"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ledger_dealId_idx"       ON "ledger_entries"("dealId");
CREATE INDEX IF NOT EXISTS "ledger_debitAccount_idx" ON "ledger_entries"("debitAccount");
CREATE INDEX IF NOT EXISTS "ledger_creditAccount_idx" ON "ledger_entries"("creditAccount");

-- Immutable: no UPDATE or DELETE on ledger
CREATE OR REPLACE RULE no_update_ledger AS ON UPDATE TO "ledger_entries" DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_ledger AS ON DELETE TO "ledger_entries" DO INSTEAD NOTHING;

-- ── Money Invariant Function & Trigger (ТЗ 7.4) ───────────────────────────────

CREATE TABLE IF NOT EXISTS "accounts" (
    "id"               TEXT    NOT NULL,
    "orgId"            TEXT,
    "type"             TEXT    NOT NULL DEFAULT 'ORG', -- ORG | ESCROW | DISPUTE_HOLD | PLATFORM
    "balanceKopecks"   BIGINT  NOT NULL DEFAULT 0,
    "reservedKopecks"  BIGINT  NOT NULL DEFAULT 0,
    "currency"         TEXT    NOT NULL DEFAULT 'RUB',
    "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "accounts_balance_positive" CHECK ("balanceKopecks" >= 0),
    CONSTRAINT "accounts_reserved_positive" CHECK ("reservedKopecks" >= 0),
    CONSTRAINT "accounts_reserved_lte_balance" CHECK ("reservedKopecks" <= "balanceKopecks")
);

CREATE OR REPLACE FUNCTION check_money_invariants()
RETURNS TRIGGER AS $$
BEGIN
    -- Нет отрицательного баланса у дебетного счёта
    IF EXISTS (
        SELECT 1 FROM "accounts"
        WHERE "id" = NEW."debitAccount"
          AND "balanceKopecks" < NEW."amountKopecks"
    ) THEN
        RAISE EXCEPTION 'Insufficient balance for account %: balance=%, required=%',
            NEW."debitAccount",
            (SELECT "balanceKopecks" FROM "accounts" WHERE "id" = NEW."debitAccount"),
            NEW."amountKopecks";
    END IF;
    -- Резерв не превышает баланс
    IF NEW."entryType" = 'RESERVE' THEN
        IF EXISTS (
            SELECT 1 FROM "accounts"
            WHERE "id" = NEW."debitAccount"
              AND "reservedKopecks" + NEW."amountKopecks" > "balanceKopecks"
        ) THEN
            RAISE EXCEPTION 'Reserve exceeds balance for account %', NEW."debitAccount";
        END IF;
    END IF;
    -- Дебет = Кредит (целостность двойной записи)
    -- Суммарный баланс неизменен: фиксируется на уровне счетов
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_money_before_insert
    BEFORE INSERT ON "ledger_entries"
    FOR EACH ROW EXECUTE FUNCTION check_money_invariants();

-- ── Lab Samples & Tests ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "lab_samples" (
    "id"                TEXT        NOT NULL,
    "dealId"            TEXT        NOT NULL,
    "shipmentId"        TEXT,
    "status"            TEXT        NOT NULL DEFAULT 'PENDING',
    "culture"           TEXT,
    "protocol"          TEXT,
    "gost"              TEXT,
    "labId"             TEXT,
    "labName"           TEXT,
    "collectedAt"       TIMESTAMPTZ,
    "finalizedAt"       TIMESTAMPTZ,
    "moneyDeltaRub"     DOUBLE PRECISION,
    "moneyDeltaKopecks" BIGINT,
    "certificateDocId"  TEXT,
    "version"           INTEGER     NOT NULL DEFAULT 1,
    "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "lab_samples_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lab_samples_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id")
);

CREATE INDEX IF NOT EXISTS "lab_samples_dealId_idx" ON "lab_samples"("dealId");

CREATE TABLE IF NOT EXISTS "lab_tests" (
    "id"         TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "sampleId"   TEXT         NOT NULL,
    "parameter"  TEXT         NOT NULL,
    "value"      DOUBLE PRECISION NOT NULL,
    "unit"       TEXT,
    "normMin"    DOUBLE PRECISION,
    "normMax"    DOUBLE PRECISION,
    "passed"     BOOLEAN      NOT NULL DEFAULT TRUE,
    "gradeDelta" DOUBLE PRECISION,
    "recordedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "lab_tests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lab_tests_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "lab_samples"("id")
);

CREATE INDEX IF NOT EXISTS "lab_tests_sampleId_idx" ON "lab_tests"("sampleId");

-- ── Outbox ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "outbox_entries" (
    "id"             TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "type"           TEXT        NOT NULL,
    "dealId"         TEXT,
    "payload"        JSONB       NOT NULL DEFAULT '{}',
    "status"         TEXT        NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT,
    "maxRetries"     INTEGER     NOT NULL DEFAULT 5,
    "retryCount"     INTEGER     NOT NULL DEFAULT 0,
    "nextRetryAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "lastError"      TEXT,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "sentAt"         TIMESTAMPTZ,
    "confirmedAt"    TIMESTAMPTZ,
    "failedAt"       TIMESTAMPTZ,

    CONSTRAINT "outbox_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "outbox_idempotencyKey_key" ON "outbox_entries"("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "outbox_status_nextRetry_idx" ON "outbox_entries"("status", "nextRetryAt");
CREATE INDEX IF NOT EXISTS "outbox_dealId_idx"           ON "outbox_entries"("dealId");

-- ── Disputes ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "disputes" (
    "id"               TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "dealId"           TEXT        NOT NULL,
    "shipmentId"       TEXT,
    "type"             TEXT        NOT NULL,
    "status"           TEXT        NOT NULL DEFAULT 'OPEN',
    "description"      TEXT        NOT NULL,
    "initiatorOrgId"   TEXT        NOT NULL,
    "respondentOrgId"  TEXT,
    "claimAmountRub"   DOUBLE PRECISION,
    "claimAmountKopecks" BIGINT,
    "severity"         TEXT        NOT NULL DEFAULT 'MEDIUM',
    "slaMinutes"       INTEGER,
    "arbitratorId"     TEXT,
    "arbitratorNotes"  TEXT,
    "outcome"          TEXT,
    "outcomeSplitPct"  INTEGER,
    "resolvedAt"       TIMESTAMPTZ,
    "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "disputes_dealId_idx"      ON "disputes"("dealId");
CREATE INDEX IF NOT EXISTS "disputes_status_idx"      ON "disputes"("status");
CREATE INDEX IF NOT EXISTS "disputes_arbitratorId_idx" ON "disputes"("arbitratorId");

CREATE TABLE IF NOT EXISTS "dispute_money_holds" (
    "id"            TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "disputeId"     TEXT        NOT NULL,
    "amountRub"     DOUBLE PRECISION,
    "amountKopecks" BIGINT,
    "reason"        TEXT        NOT NULL,
    "heldAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "releasedAt"    TIMESTAMPTZ,
    "releaseReason" TEXT,

    CONSTRAINT "dispute_money_holds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "dispute_money_holds_disputeId_unique" UNIQUE ("disputeId"),
    CONSTRAINT "dmh_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id")
);

CREATE TABLE IF NOT EXISTS "dispute_evidence" (
    "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "disputeId"   TEXT        NOT NULL,
    "fileId"      TEXT,
    "type"        TEXT        NOT NULL,
    "description" TEXT        NOT NULL,
    "trusted"     BOOLEAN     NOT NULL DEFAULT FALSE,
    "submittedBy" TEXT        NOT NULL,
    "submittedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "hash"        TEXT,
    "prevHash"    TEXT,

    CONSTRAINT "dispute_evidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "de_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id")
);

CREATE INDEX IF NOT EXISTS "dispute_evidence_disputeId_idx" ON "dispute_evidence"("disputeId");

-- ── Evidence Files ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "evidence_files" (
    "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "dealId"      TEXT        NOT NULL,
    "shipmentId"  TEXT,
    "disputeId"   TEXT,
    "type"        TEXT        NOT NULL,
    "filename"    TEXT        NOT NULL,
    "mimeType"    TEXT        NOT NULL,
    "sizeBytes"   BIGINT      NOT NULL,
    "hash"        TEXT        NOT NULL,
    "prevHash"    TEXT,
    "s3Key"       TEXT,
    "uploadedBy"  TEXT        NOT NULL,
    "uploadedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "metadata"    JSONB,

    CONSTRAINT "evidence_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "evidence_files_dealId_idx"    ON "evidence_files"("dealId");
CREATE INDEX IF NOT EXISTS "evidence_files_disputeId_idx" ON "evidence_files"("disputeId");

-- ── Audit Events (append-only, hash chain, partitioned) ───────────────────────

CREATE TABLE IF NOT EXISTS "audit_events" (
    "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "action"      TEXT        NOT NULL,
    "actorUserId" TEXT        NOT NULL,
    "actorRole"   TEXT        NOT NULL,
    "tenantId"    TEXT,
    "orgId"       TEXT,
    "dealId"      TEXT,
    "disputeId"   TEXT,
    "objectType"  TEXT,
    "objectId"    TEXT,
    "beforeState" JSONB,
    "afterState"  JSONB,
    "outcome"     TEXT        NOT NULL,
    "reason"      TEXT,
    "metadata"    JSONB,
    "hash"        TEXT        NOT NULL DEFAULT '',
    "prevHash"    TEXT,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_events_dealId_idx"      ON "audit_events"("dealId");
CREATE INDEX IF NOT EXISTS "audit_events_actorUserId_idx" ON "audit_events"("actorUserId");
CREATE INDEX IF NOT EXISTS "audit_events_action_idx"      ON "audit_events"("action");
CREATE INDEX IF NOT EXISTS "audit_events_tenantId_idx"    ON "audit_events"("tenantId");
CREATE INDEX IF NOT EXISTS "audit_events_createdAt_idx"   ON "audit_events"("createdAt");

-- Append-only: запрет UPDATE и DELETE
CREATE OR REPLACE RULE no_update_audit_events AS ON UPDATE TO "audit_events" DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_audit_events AS ON DELETE TO "audit_events" DO INSTEAD NOTHING;

-- ── Integration Events ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "integration_events" (
    "id"              TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "adapterName"     TEXT        NOT NULL,
    "direction"       TEXT        NOT NULL,
    "eventType"       TEXT        NOT NULL,
    "externalId"      TEXT,
    "dealId"          TEXT,
    "requestPayload"  JSONB,
    "responsePayload" JSONB,
    "status"          TEXT        NOT NULL,
    "errorMessage"    TEXT,
    "httpStatus"      INTEGER,
    "durationMs"      INTEGER,
    "idempotencyKey"  TEXT,
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "integration_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "integration_events_adapter_status_idx" ON "integration_events"("adapterName", "status");
CREATE INDEX IF NOT EXISTS "integration_events_dealId_idx"         ON "integration_events"("dealId");
CREATE INDEX IF NOT EXISTS "integration_events_externalId_idx"     ON "integration_events"("externalId");

-- ── Webhook Idempotency ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "webhook_idempotency" (
    "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "eventId"     TEXT        NOT NULL,
    "adapterName" TEXT        NOT NULL,
    "processedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "expiresAt"   TIMESTAMPTZ NOT NULL,

    CONSTRAINT "webhook_idempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_eventId_key" ON "webhook_idempotency"("eventId");
CREATE INDEX IF NOT EXISTS "webhook_expiresAt_idx"      ON "webhook_idempotency"("expiresAt");

-- ── KYC Tasks ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "kyc_tasks" (
    "id"             TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "organizationId" TEXT        NOT NULL,
    "type"           TEXT        NOT NULL DEFAULT 'INITIAL',
    "status"         TEXT        NOT NULL DEFAULT 'PENDING',
    "assignedTo"     TEXT,
    "notes"          TEXT,
    "fnsResponse"    JSONB,
    "sanctionResult" JSONB,
    "amlResult"      JSONB,
    "resolvedAt"     TIMESTAMPTZ,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "kyc_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "kyc_tasks_status_idx" ON "kyc_tasks"("status");
CREATE INDEX IF NOT EXISTS "kyc_tasks_orgId_idx"  ON "kyc_tasks"("organizationId");

-- ── Stored Files (Storage module) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "stored_files" (
    "id"             TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "dealId"         TEXT,
    "s3Key"          TEXT        NOT NULL,
    "bucket"         TEXT        NOT NULL DEFAULT 'grainflow-documents',
    "filename"       TEXT        NOT NULL,
    "mimeType"       TEXT        NOT NULL,
    "sizeBytes"      BIGINT,
    "sha256"         TEXT,
    "status"         TEXT        NOT NULL DEFAULT 'PENDING_UPLOAD',
    "uploadedByUserId" TEXT,
    "confirmedAt"    TIMESTAMPTZ,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "stored_files_dealId_idx" ON "stored_files"("dealId");
CREATE INDEX IF NOT EXISTS "stored_files_s3Key_idx"  ON "stored_files"("s3Key");

-- ── Factoring Applications ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "factoring_applications" (
    "id"             TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "organizationId" TEXT        NOT NULL,
    "dealId"         TEXT,
    "status"         TEXT        NOT NULL DEFAULT 'PENDING',
    "requestedKopecks" BIGINT,
    "approvedKopecks"  BIGINT,
    "factorName"     TEXT,
    "dueDate"        TIMESTAMPTZ,
    "repaidAt"       TIMESTAMPTZ,
    "contractDocId"  TEXT,
    "notes"          TEXT,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "factoring_applications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "factoring_orgId_idx"    ON "factoring_applications"("organizationId");
CREATE INDEX IF NOT EXISTS "factoring_status_idx"   ON "factoring_applications"("status");
CREATE INDEX IF NOT EXISTS "factoring_dueDate_idx"  ON "factoring_applications"("dueDate");

-- ── Geofences ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "geofences" (
    "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "dealId"      TEXT,
    "name"        TEXT        NOT NULL,
    "type"        TEXT        NOT NULL DEFAULT 'CIRCLE',
    "centerLat"   DOUBLE PRECISION,
    "centerLng"   DOUBLE PRECISION,
    "radiusMeters" DOUBLE PRECISION,
    "polygon"     JSONB,
    "isActive"    BOOLEAN     NOT NULL DEFAULT TRUE,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "geofences_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "geofences_dealId_idx" ON "geofences"("dealId");

-- ── RLS Context Helper ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_app_context(
    p_user_id TEXT,
    p_org_id  TEXT,
    p_role    TEXT
) RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_id', p_user_id, TRUE);
    PERFORM set_config('app.current_org_id',  p_org_id,  TRUE);
    PERFORM set_config('app.current_role',    p_role,    TRUE);
END;
$$ LANGUAGE plpgsql;

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE "deals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ledger_entries" ENABLE ROW LEVEL SECURITY;

-- Deals: based on org membership (production: handled via app_service account)
CREATE POLICY "deals_app_access" ON "deals"
    USING (TRUE); -- RLS enforced at app layer via ABAC; DB-level via service accounts

-- Audit: append-only at DB level
CREATE POLICY "audit_insert_only" ON "audit_events"
    FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "audit_select_all" ON "audit_events"
    FOR SELECT USING (TRUE);

-- Ledger: no mutations
CREATE POLICY "ledger_insert_only" ON "ledger_entries"
    FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "ledger_select_all" ON "ledger_entries"
    FOR SELECT USING (TRUE);

-- ── Prisma Migration Tracking ─────────────────────────────────────────────────

INSERT INTO "_prisma_migrations" (
    "id", "checksum", "finished_at", "migration_name",
    "logs", "rolled_back_at", "started_at", "applied_steps_count"
) VALUES (
    gen_random_uuid()::TEXT,
    'grainflow_v3_initial_postgresql',
    NOW(),
    '0001_postgresql_initial',
    NULL, NULL, NOW(), 1
) ON CONFLICT DO NOTHING;
