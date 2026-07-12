-- Block 2: Money & Ledger — bank reconciliation with a persisted cursor,
-- immutable statement evidence, and bank-callback key rotation/revocation.

-- ── 1. Bank statement entries (immutable evidence of imported rows) ──────────

CREATE TABLE "bank_statement_entries" (
  "id"                  TEXT NOT NULL,
  "importBatchId"       TEXT NOT NULL,
  "source"              TEXT NOT NULL DEFAULT 'MT940',
  "lineNo"              INTEGER NOT NULL,
  "statementDate"       DATE,
  "valueDate"           DATE,
  "amountKopecks"       BIGINT NOT NULL,
  "currency"            TEXT NOT NULL DEFAULT 'RUB',
  "reference"           TEXT NOT NULL,
  "counterpartyName"    TEXT,
  "counterpartyInn"     TEXT,
  "counterpartyAccount" TEXT,
  "description"         TEXT,
  "contentHash"         TEXT NOT NULL,
  "matchStatus"         TEXT NOT NULL DEFAULT 'UNMATCHED',
  "matchedDealId"       TEXT,
  "matchedBankOperationId" TEXT,
  "mismatchReason"      TEXT,
  "matchedAt"           TIMESTAMP(3),
  "matchedByUserId"     TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "bank_statement_entries_pkey" PRIMARY KEY ("id")
);

-- The same statement row can never be imported twice (idempotent import).
CREATE UNIQUE INDEX "bank_statement_entries_content_hash_key"
  ON "bank_statement_entries" ("contentHash");
CREATE INDEX "bank_statement_entries_batch_idx"
  ON "bank_statement_entries" ("importBatchId");
CREATE INDEX "bank_statement_entries_status_idx"
  ON "bank_statement_entries" ("matchStatus");
CREATE INDEX "bank_statement_entries_deal_idx"
  ON "bank_statement_entries" ("matchedDealId");

-- Statement content is immutable evidence: only the match verdict may change.
CREATE OR REPLACE FUNCTION reconciliation_statement_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'bank_statement_entries is append-only: DELETE is forbidden'
      USING ERRCODE = 'raise_exception';
  END IF;
  IF NEW."amountKopecks"  IS DISTINCT FROM OLD."amountKopecks"
    OR NEW."reference"    IS DISTINCT FROM OLD."reference"
    OR NEW."contentHash"  IS DISTINCT FROM OLD."contentHash"
    OR NEW."currency"     IS DISTINCT FROM OLD."currency"
    OR NEW."statementDate" IS DISTINCT FROM OLD."statementDate"
    OR NEW."valueDate"    IS DISTINCT FROM OLD."valueDate"
    OR NEW."description"  IS DISTINCT FROM OLD."description"
    OR NEW."importBatchId" IS DISTINCT FROM OLD."importBatchId"
    OR NEW."lineNo"       IS DISTINCT FROM OLD."lineNo"
    OR NEW."createdAt"    IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'bank_statement_entries content is immutable: only match verdict fields may change'
      USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bank_statement_entries_immutable
  BEFORE UPDATE OR DELETE ON "bank_statement_entries"
  FOR EACH ROW EXECUTE FUNCTION reconciliation_statement_guard();

-- ── 2. Reconciliation runs and the persisted cursor ──────────────────────────

CREATE TABLE "reconciliation_runs" (
  "id"              TEXT NOT NULL,
  "source"          TEXT NOT NULL DEFAULT 'MT940',
  "importBatchId"   TEXT NOT NULL,
  "statementSha256" TEXT NOT NULL,
  "importedCount"   INTEGER NOT NULL DEFAULT 0,
  "duplicateCount"  INTEGER NOT NULL DEFAULT 0,
  "matchedCount"    INTEGER NOT NULL DEFAULT 0,
  "mismatchCount"   INTEGER NOT NULL DEFAULT 0,
  "unmatchedCount"  INTEGER NOT NULL DEFAULT 0,
  "status"          TEXT NOT NULL DEFAULT 'COMPLETED',
  "startedByUserId" TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt"      TIMESTAMP(3),

  CONSTRAINT "reconciliation_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reconciliation_runs_batch_key" ON "reconciliation_runs" ("importBatchId");
CREATE INDEX "reconciliation_runs_created_idx" ON "reconciliation_runs" ("createdAt");

CREATE TABLE "reconciliation_cursors" (
  "source"          TEXT NOT NULL,
  "lastValueDate"   DATE,
  "lastRunId"       TEXT,
  "lastStatementSha256" TEXT,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "reconciliation_cursors_pkey" PRIMARY KEY ("source")
);

-- ── 3. Bank callback key revocation (immediate, database-backed) ─────────────
-- Key material itself is delivered through the environment/secret manager;
-- the database holds only rotation state that must take effect immediately
-- across every API instance.

CREATE TABLE "bank_key_revocations" (
  "keyId"           TEXT NOT NULL,
  "partnerId"       TEXT NOT NULL DEFAULT 'safe-deals',
  "revokedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedByUserId" TEXT NOT NULL,
  "reason"          TEXT NOT NULL,

  CONSTRAINT "bank_key_revocations_pkey" PRIMARY KEY ("keyId")
);

-- Revocations are permanent: a revoked key can never be silently reinstated.
CREATE OR REPLACE FUNCTION bank_key_revocation_guard() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'bank_key_revocations is append-only: % is forbidden', TG_OP
    USING ERRCODE = 'raise_exception';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bank_key_revocations_append_only
  BEFORE UPDATE OR DELETE ON "bank_key_revocations"
  FOR EACH ROW EXECUTE FUNCTION bank_key_revocation_guard();
