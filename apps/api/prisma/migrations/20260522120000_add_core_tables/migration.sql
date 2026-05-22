-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sellerOrgId" TEXT NOT NULL,
    "buyerOrgId" TEXT NOT NULL,
    "volumeTons" REAL,
    "pricePerTon" REAL,
    "totalRub" REAL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "culture" TEXT,
    "region" TEXT,
    "fundingChoice" TEXT,
    "owner" TEXT,
    "nextAction" TEXT,
    "slaAt" DATETIME,
    "signedAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "meta" TEXT
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "driverUserId" TEXT,
    "driverName" TEXT,
    "vehicleNumber" TEXT,
    "carrierOrgId" TEXT,
    "carrierName" TEXT,
    "routeFrom" TEXT,
    "routeTo" TEXT,
    "etaHours" REAL,
    "loadedTons" REAL,
    "pinVerified" BOOLEAN NOT NULL DEFAULT false,
    "nextAction" TEXT,
    "blockers" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "shipments_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "checkpoints" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "completedAt" DATETIME,
    "lat" REAL,
    "lng" REAL,
    "note" TEXT,
    CONSTRAINT "checkpoints_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "deal_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "name" TEXT NOT NULL,
    "mimeType" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedByUserId" TEXT,
    "signedAt" DATETIME,
    "bankRequired" BOOLEAN NOT NULL DEFAULT false,
    "releaseRequired" BOOLEAN NOT NULL DEFAULT false,
    "bankAcceptance" TEXT NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "deal_documents_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amountRub" REAL,
    "reservedAt" DATETIME,
    "releasedAt" DATETIME,
    "holdAmountRub" REAL,
    "callbackState" TEXT NOT NULL DEFAULT 'NONE',
    "bankRef" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lab_samples" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "culture" TEXT,
    "protocol" TEXT,
    "labId" TEXT,
    "collectedAt" DATETIME,
    "finalizedAt" DATETIME,
    "moneyDeltaRub" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "lab_tests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "unit" TEXT,
    "norm" TEXT,
    "passed" BOOLEAN NOT NULL DEFAULT true,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lab_tests_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "lab_samples" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "deals_sellerOrgId_idx" ON "deals"("sellerOrgId");

-- CreateIndex
CREATE INDEX "deals_buyerOrgId_idx" ON "deals"("buyerOrgId");

-- CreateIndex
CREATE INDEX "deals_status_idx" ON "deals"("status");

-- CreateIndex
CREATE INDEX "shipments_dealId_idx" ON "shipments"("dealId");

-- CreateIndex
CREATE INDEX "shipments_driverUserId_idx" ON "shipments"("driverUserId");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "checkpoints_shipmentId_idx" ON "checkpoints"("shipmentId");

-- CreateIndex
CREATE INDEX "deal_documents_dealId_idx" ON "deal_documents"("dealId");

-- CreateIndex
CREATE INDEX "deal_documents_type_idx" ON "deal_documents"("type");

-- CreateIndex
CREATE INDEX "payments_dealId_idx" ON "payments"("dealId");

-- CreateIndex
CREATE INDEX "lab_samples_dealId_idx" ON "lab_samples"("dealId");

-- CreateIndex
CREATE INDEX "lab_tests_sampleId_idx" ON "lab_tests"("sampleId");
