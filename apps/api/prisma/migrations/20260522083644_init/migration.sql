-- CreateTable
CREATE TABLE "outbox_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "dealId" TEXT,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "confirmedAt" DATETIME,
    "failedAt" DATETIME
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "initiatorOrgId" TEXT NOT NULL,
    "respondentOrgId" TEXT,
    "claimAmountRub" REAL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "slaMinutes" INTEGER,
    "outcome" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "dispute_money_holds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "disputeId" TEXT NOT NULL,
    "amountRub" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "heldAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dispute_money_holds_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "dispute_evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "disputeId" TEXT NOT NULL,
    "fileId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "trusted" BOOLEAN NOT NULL DEFAULT false,
    "submittedBy" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hash" TEXT,
    CONSTRAINT "dispute_evidence_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "evidence_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "disputeId" TEXT,
    "type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "prevHash" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "dealId" TEXT,
    "disputeId" TEXT,
    "objectType" TEXT,
    "objectId" TEXT,
    "outcome" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_events_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "outbox_entries_status_idx" ON "outbox_entries"("status");

-- CreateIndex
CREATE INDEX "outbox_entries_dealId_idx" ON "outbox_entries"("dealId");

-- CreateIndex
CREATE INDEX "disputes_dealId_idx" ON "disputes"("dealId");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "dispute_money_holds_disputeId_key" ON "dispute_money_holds"("disputeId");

-- CreateIndex
CREATE INDEX "dispute_evidence_disputeId_idx" ON "dispute_evidence"("disputeId");

-- CreateIndex
CREATE INDEX "evidence_files_dealId_idx" ON "evidence_files"("dealId");

-- CreateIndex
CREATE INDEX "evidence_files_disputeId_idx" ON "evidence_files"("disputeId");

-- CreateIndex
CREATE INDEX "audit_events_dealId_idx" ON "audit_events"("dealId");

-- CreateIndex
CREATE INDEX "audit_events_actorUserId_idx" ON "audit_events"("actorUserId");

-- CreateIndex
CREATE INDEX "audit_events_action_idx" ON "audit_events"("action");
