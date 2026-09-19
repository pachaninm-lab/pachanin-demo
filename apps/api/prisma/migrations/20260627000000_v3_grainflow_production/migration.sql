-- GrainFlow v3 Production Migration
-- Adds: Organizations, Users, UserOrgs, UkepCertificates, DealEvents,
--       LedgerEntries, IntegrationEvents, WebhookIdempotency, KycTasks
-- Extends: Deal (tenantId, dealNumber, sagaState, cropClass, gost, incoterms),
--          Shipment (vehicleType, geoLat, geoLng, lastGeoAt),
--          DealDocument (s3Key, sizeBytes, hash, signatories, edoStatus, edoExternalId, isImmutable),
--          Payment (amountKopecks, holdAmountKopecks, refundedKopecks, commissionKopecks, escrowAccount, idempotencyKey),
--          LabSample (gost, labName, moneyDeltaKopecks, certificateDocId, version),
--          LabTest (normMin, normMax, gradeDelta),
--          OutboxEntry (idempotencyKey, maxRetries, nextRetryAt → DEAD status),
--          Dispute (claimAmountKopecks, arbitratorId, arbitratorNotes, outcomeSplitPct),
--          DisputeMoneyHold (amountKopecks, releasedAt, releaseReason),
--          DisputeEvidence (prevHash),
--          AuditEvent (tenantId, orgId, beforeState, afterState, reason, hash, prevHash)

-- ── Organizations ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "organizations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "inn" TEXT NOT NULL UNIQUE,
  "ogrn" TEXT,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'LEGAL',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "tenantId" TEXT NOT NULL DEFAULT '',
  "verifiedAt" DATETIME,
  "bankDetails" TEXT,
  "address" TEXT,
  "kycStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "amlStatus" TEXT NOT NULL DEFAULT 'CLEAR',
  "sanctionHit" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "organizations_tenantId_idx" ON "organizations"("tenantId");
CREATE INDEX IF NOT EXISTS "organizations_inn_idx" ON "organizations"("inn");

-- ── Users ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "phone" TEXT,
  "passwordHash" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
  "mfaSecret" TEXT,
  "mfaBackup" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" DATETIME
);

-- ── UserOrgs ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "user_orgs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId", "organizationId"),
  FOREIGN KEY ("userId") REFERENCES "users"("id"),
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
);
CREATE INDEX IF NOT EXISTS "user_orgs_organizationId_idx" ON "user_orgs"("organizationId");

-- ── УКЭП Certificates ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ukep_certificates" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "thumbprint" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "issuer" TEXT NOT NULL,
  "validFrom" DATETIME NOT NULL,
  "validUntil" DATETIME NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'VALID',
  "revokedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "users"("id")
);
CREATE INDEX IF NOT EXISTS "ukep_certificates_userId_idx" ON "ukep_certificates"("userId");
CREATE INDEX IF NOT EXISTS "ukep_certificates_thumbprint_idx" ON "ukep_certificates"("thumbprint");

-- ── Deal Events (hash chain) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "deal_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dealId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "tenantId" TEXT,
  "payload" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  "prevHash" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("dealId") REFERENCES "deals"("id")
);
CREATE INDEX IF NOT EXISTS "deal_events_dealId_idx" ON "deal_events"("dealId");

-- ── Ledger Entries ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ledger_entries" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dealId" TEXT,
  "entryType" TEXT NOT NULL,
  "debitAccount" TEXT NOT NULL,
  "creditAccount" TEXT NOT NULL,
  "amountKopecks" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "reference" TEXT,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT
);
CREATE INDEX IF NOT EXISTS "ledger_entries_dealId_idx" ON "ledger_entries"("dealId");
CREATE INDEX IF NOT EXISTS "ledger_entries_debitAccount_idx" ON "ledger_entries"("debitAccount");
CREATE INDEX IF NOT EXISTS "ledger_entries_creditAccount_idx" ON "ledger_entries"("creditAccount");

-- ── Integration Events ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "integration_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "adapterName" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "externalId" TEXT,
  "dealId" TEXT,
  "requestPayload" TEXT,
  "responsePayload" TEXT,
  "status" TEXT NOT NULL,
  "errorMessage" TEXT,
  "httpStatus" INTEGER,
  "durationMs" INTEGER,
  "idempotencyKey" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "integration_events_adapterName_status_idx" ON "integration_events"("adapterName", "status");
CREATE INDEX IF NOT EXISTS "integration_events_dealId_idx" ON "integration_events"("dealId");

-- ── Webhook Idempotency ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "webhook_idempotency" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventId" TEXT NOT NULL UNIQUE,
  "adapterName" TEXT NOT NULL,
  "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS "webhook_idempotency_expiresAt_idx" ON "webhook_idempotency"("expiresAt");

-- ── KYC Tasks ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "kyc_tasks" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'INITIAL',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "assignedTo" TEXT,
  "notes" TEXT,
  "fnsResponse" TEXT,
  "sanctionResult" TEXT,
  "amlResult" TEXT,
  "resolvedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "kyc_tasks_status_idx" ON "kyc_tasks"("status");
CREATE INDEX IF NOT EXISTS "kyc_tasks_organizationId_idx" ON "kyc_tasks"("organizationId");

-- ── Extend existing tables ─────────────────────────────────────────────────────

-- Deal
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "dealNumber" TEXT;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "cropClass" TEXT;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "gost" TEXT;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "incoterms" TEXT;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "sagaState" TEXT;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "sagaStep" TEXT;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "totalKopecks" INTEGER;

-- Shipment
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "vehicleType" TEXT;
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "geoLat" REAL;
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "geoLng" REAL;
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "lastGeoAt" DATETIME;

-- DealDocument
ALTER TABLE "deal_documents" ADD COLUMN IF NOT EXISTS "s3Key" TEXT;
ALTER TABLE "deal_documents" ADD COLUMN IF NOT EXISTS "sizeBytes" INTEGER;
ALTER TABLE "deal_documents" ADD COLUMN IF NOT EXISTS "hash" TEXT;
ALTER TABLE "deal_documents" ADD COLUMN IF NOT EXISTS "signatories" TEXT;
ALTER TABLE "deal_documents" ADD COLUMN IF NOT EXISTS "edoStatus" TEXT;
ALTER TABLE "deal_documents" ADD COLUMN IF NOT EXISTS "edoExternalId" TEXT;
ALTER TABLE "deal_documents" ADD COLUMN IF NOT EXISTS "isImmutable" BOOLEAN NOT NULL DEFAULT false;

-- Payment
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "amountKopecks" INTEGER;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "holdAmountKopecks" INTEGER;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refundedKopecks" INTEGER;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "commissionKopecks" INTEGER;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "escrowAccount" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- LabSample
ALTER TABLE "lab_samples" ADD COLUMN IF NOT EXISTS "gost" TEXT;
ALTER TABLE "lab_samples" ADD COLUMN IF NOT EXISTS "labName" TEXT;
ALTER TABLE "lab_samples" ADD COLUMN IF NOT EXISTS "moneyDeltaKopecks" INTEGER;
ALTER TABLE "lab_samples" ADD COLUMN IF NOT EXISTS "certificateDocId" TEXT;
ALTER TABLE "lab_samples" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

-- LabTest
ALTER TABLE "lab_tests" ADD COLUMN IF NOT EXISTS "normMin" REAL;
ALTER TABLE "lab_tests" ADD COLUMN IF NOT EXISTS "normMax" REAL;
ALTER TABLE "lab_tests" ADD COLUMN IF NOT EXISTS "gradeDelta" REAL;

-- OutboxEntry
ALTER TABLE "outbox_entries" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "outbox_entries" ADD COLUMN IF NOT EXISTS "maxRetries" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "outbox_entries" ADD COLUMN IF NOT EXISTS "nextRetryAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Dispute
ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "claimAmountKopecks" INTEGER;
ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "arbitratorId" TEXT;
ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "arbitratorNotes" TEXT;
ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "outcomeSplitPct" INTEGER;

-- DisputeMoneyHold
ALTER TABLE "dispute_money_holds" ADD COLUMN IF NOT EXISTS "amountKopecks" INTEGER;
ALTER TABLE "dispute_money_holds" ADD COLUMN IF NOT EXISTS "releasedAt" DATETIME;
ALTER TABLE "dispute_money_holds" ADD COLUMN IF NOT EXISTS "releaseReason" TEXT;

-- DisputeEvidence
ALTER TABLE "dispute_evidence" ADD COLUMN IF NOT EXISTS "prevHash" TEXT;

-- AuditEvent
ALTER TABLE "audit_events" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "audit_events" ADD COLUMN IF NOT EXISTS "orgId" TEXT;
ALTER TABLE "audit_events" ADD COLUMN IF NOT EXISTS "disputeId" TEXT;
ALTER TABLE "audit_events" ADD COLUMN IF NOT EXISTS "beforeState" TEXT;
ALTER TABLE "audit_events" ADD COLUMN IF NOT EXISTS "afterState" TEXT;
ALTER TABLE "audit_events" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "audit_events" ADD COLUMN IF NOT EXISTS "hash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "audit_events" ADD COLUMN IF NOT EXISTS "prevHash" TEXT;

CREATE INDEX IF NOT EXISTS "audit_events_tenantId_idx" ON "audit_events"("tenantId");

-- Checkpoint
ALTER TABLE "checkpoints" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
ALTER TABLE "checkpoints" ADD COLUMN IF NOT EXISTS "actorId" TEXT;
