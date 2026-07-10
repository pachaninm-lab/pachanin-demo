-- Forward-only PostgreSQL reconciliation generated from the canonical Prisma schema.
--
-- This migration exists because the repository historically crossed from SQLite to
-- PostgreSQL while preserving ordered migration identifiers. The two legacy SQLite
-- migrations immediately before this file are documented PostgreSQL no-ops; this
-- migration brings a clean PostgreSQL 16 database produced by the complete history
-- into exact alignment with apps/api/prisma/schema.prisma.
--
-- Source: `prisma migrate diff --from-url <ephemeral-postgres> --to-schema-datamodel prisma/schema.prisma --script`.
-- Production application remains locked until this migration is reviewed against a
-- production snapshot, backed up and rehearsed with rollback/restore evidence.

-- DropForeignKey
ALTER TABLE "checkpoints" DROP CONSTRAINT "checkpoints_shipmentId_fkey";

-- DropForeignKey
ALTER TABLE "deal_documents" DROP CONSTRAINT "deal_docs_dealId_fkey";

-- DropForeignKey
ALTER TABLE "deal_events" DROP CONSTRAINT "deal_events_dealId_fkey";

-- DropForeignKey
ALTER TABLE "dispute_evidence" DROP CONSTRAINT "de_disputeId_fkey";

-- DropForeignKey
ALTER TABLE "dispute_money_holds" DROP CONSTRAINT "dmh_disputeId_fkey";

-- DropForeignKey
ALTER TABLE "lab_samples" DROP CONSTRAINT "lab_samples_dealId_fkey";

-- DropForeignKey
ALTER TABLE "lab_tests" DROP CONSTRAINT "lab_tests_sampleId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_dealId_fkey";

-- DropForeignKey
ALTER TABLE "shipments" DROP CONSTRAINT "shipments_dealId_fkey";

-- DropForeignKey
ALTER TABLE "ukep_certificates" DROP CONSTRAINT "ukep_certs_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_orgs" DROP CONSTRAINT "user_orgs_orgId_fkey";

-- DropForeignKey
ALTER TABLE "user_orgs" DROP CONSTRAINT "user_orgs_userId_fkey";

-- DropIndex
DROP INDEX "audit_events_createdAt_idx";

-- AlterTable
ALTER TABLE "accounts" ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "audit_events" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "checkpoints" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "completedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "deal_documents" ALTER COLUMN "sizeBytes" SET DATA TYPE INTEGER,
ALTER COLUMN "uploadedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "signedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "signatories" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "deal_events" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "payload" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "sourceLotId" TEXT,
ALTER COLUMN "totalKopecks" SET DATA TYPE INTEGER,
ALTER COLUMN "slaAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "signedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "closedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "meta" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "dispute_evidence" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "submittedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "dispute_money_holds" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "amountKopecks" SET DATA TYPE INTEGER,
ALTER COLUMN "heldAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "releasedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "disputes" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "claimAmountKopecks" SET DATA TYPE INTEGER,
ALTER COLUMN "resolvedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "evidence_files" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "sizeBytes" SET DATA TYPE INTEGER,
ALTER COLUMN "uploadedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "factoring_applications" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "dueDate" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "repaidAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "geofences" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "integration_events" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "kyc_tasks" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "type" DROP DEFAULT,
ALTER COLUMN "resolvedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "lab_samples" ADD COLUMN     "acceptanceId" TEXT,
ALTER COLUMN "collectedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "finalizedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "moneyDeltaKopecks" SET DATA TYPE INTEGER,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "lab_tests" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "recordedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ledger_entries" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "amountKopecks" SET DATA TYPE INTEGER,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "tenantId" DROP DEFAULT,
ALTER COLUMN "verifiedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "outbox_entries" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "payload" DROP DEFAULT,
ALTER COLUMN "nextRetryAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "sentAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "confirmedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "failedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "amountKopecks" SET DATA TYPE INTEGER,
ALTER COLUMN "reservedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "releasedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "holdAmountKopecks" SET DATA TYPE INTEGER,
ALTER COLUMN "refundedKopecks" SET DATA TYPE INTEGER,
ALTER COLUMN "commissionKopecks" SET DATA TYPE INTEGER,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "shipments" ALTER COLUMN "blockers" SET DATA TYPE TEXT,
ALTER COLUMN "lastGeoAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "stored_files" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "confirmedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ukep_certificates" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "validFrom" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "validUntil" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "revokedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user_orgs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "joinedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "webhook_idempotency" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "processedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "acceptance_records" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "weightActualTons" DOUBLE PRECISION,
    "volumeActualTons" DOUBLE PRECISION,
    "qualityStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "gost" TEXT,
    "actDocId" TEXT,
    "actSignedAt" TIMESTAMP(3),
    "actorId" TEXT NOT NULL,
    "notes" TEXT,
    "moneyAdjustKopecks" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acceptance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_operations" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amountKopecks" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "debitAccount" TEXT NOT NULL,
    "creditAccount" TEXT NOT NULL,
    "bankRef" TEXT,
    "bankName" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "initiatorUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "acceptance_records_dealId_idx" ON "acceptance_records"("dealId");

-- CreateIndex
CREATE INDEX "acceptance_records_shipmentId_idx" ON "acceptance_records"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_operations_idempotencyKey_key" ON "bank_operations"("idempotencyKey");

-- CreateIndex
CREATE INDEX "bank_operations_dealId_idx" ON "bank_operations"("dealId");

-- CreateIndex
CREATE INDEX "bank_operations_status_idx" ON "bank_operations"("status");

-- CreateIndex
CREATE INDEX "bank_operations_type_idx" ON "bank_operations"("type");

-- CreateIndex
CREATE INDEX "accounts_orgId_idx" ON "accounts"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "deals_dealNumber_key" ON "deals"("dealNumber");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_entries_idempotencyKey_key" ON "outbox_entries"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "user_orgs" ADD CONSTRAINT "user_orgs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_orgs" ADD CONSTRAINT "user_orgs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ukep_certificates" ADD CONSTRAINT "ukep_certificates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_events" ADD CONSTRAINT "deal_events_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_samples" ADD CONSTRAINT "lab_samples_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "lab_samples"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_money_holds" ADD CONSTRAINT "dispute_money_holds_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acceptance_records" ADD CONSTRAINT "acceptance_records_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_operations" ADD CONSTRAINT "bank_operations_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "deal_docs_dealId_idx" RENAME TO "deal_documents_dealId_idx";

-- RenameIndex
ALTER INDEX "deal_docs_type_idx" RENAME TO "deal_documents_type_idx";

-- RenameIndex
ALTER INDEX "dispute_money_holds_disputeId_unique" RENAME TO "dispute_money_holds_disputeId_key";

-- RenameIndex
ALTER INDEX "factoring_dueDate_idx" RENAME TO "factoring_applications_dueDate_idx";

-- RenameIndex
ALTER INDEX "factoring_orgId_idx" RENAME TO "factoring_applications_organizationId_idx";

-- RenameIndex
ALTER INDEX "factoring_status_idx" RENAME TO "factoring_applications_status_idx";

-- RenameIndex
ALTER INDEX "ledger_idempotencyKey_key" RENAME TO "ledger_entries_idempotencyKey_key";

-- RenameIndex
ALTER INDEX "outbox_dealId_idx" RENAME TO "outbox_entries_dealId_idx";

-- RenameIndex
ALTER INDEX "outbox_status_nextRetry_idx" RENAME TO "outbox_entries_status_nextRetryAt_idx";

-- RenameIndex
ALTER INDEX "shipments_driverId_idx" RENAME TO "shipments_driverUserId_idx";

-- RenameIndex
ALTER INDEX "user_orgs_userId_orgId_key" RENAME TO "user_orgs_userId_organizationId_key";

-- RenameIndex
ALTER INDEX "webhook_eventId_key" RENAME TO "webhook_idempotency_eventId_key";
