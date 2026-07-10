-- Normalized object-level access for one Deal.
--
-- A participant binds one authenticated user, organization and role to one deal.
-- This replaces tenant-wide role bypasses and JSON permissions in Deal.meta.
-- Access is lifecycle-managed through status; rows are not physically deleted.

CREATE TABLE "deal_participants" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "accessLevel" TEXT NOT NULL DEFAULT 'WORK',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "assignedByUserId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "deal_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deal_participants_dealId_userId_role_key"
    ON "deal_participants"("dealId", "userId", "role");
CREATE INDEX "deal_participants_dealId_status_idx"
    ON "deal_participants"("dealId", "status");
CREATE INDEX "deal_participants_tenantId_organizationId_idx"
    ON "deal_participants"("tenantId", "organizationId");
CREATE INDEX "deal_participants_userId_status_idx"
    ON "deal_participants"("userId", "status");
CREATE INDEX "deal_participants_role_status_idx"
    ON "deal_participants"("role", "status");

ALTER TABLE "deal_participants"
    ADD CONSTRAINT "deal_participants_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "deals"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deal_participants"
    ADD CONSTRAINT "deal_participants_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deal_participants"
    ADD CONSTRAINT "deal_participants_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
