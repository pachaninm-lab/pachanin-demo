\set ON_ERROR_STOP on

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rls_test') THEN
    CREATE ROLE app_rls_test NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$role$;

GRANT USAGE ON SCHEMA public TO app_rls_test;
GRANT SELECT ON TABLE
  public."organizations",
  public."deals",
  public."disputes",
  public."audit_events",
  public."outbox_entries",
  public."deal_workspace_runtime_snapshots",
  public."deal_workspace_runtime_transaction_attempts"
TO app_rls_test;

INSERT INTO public."organizations" ("id", "inn", "name", "status", "tenantId") VALUES
  ('org-a-seller', '7700000001', 'Tenant A Seller', 'VERIFIED', 'tenant-a'),
  ('org-a-buyer',  '7700000002', 'Tenant A Buyer',  'VERIFIED', 'tenant-a'),
  ('org-b-seller', '7700000003', 'Tenant B Seller', 'VERIFIED', 'tenant-b'),
  ('org-b-buyer',  '7700000004', 'Tenant B Buyer',  'VERIFIED', 'tenant-b')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO public."deals" (
  "id", "dealNumber", "status", "tenantId", "sellerOrgId", "buyerOrgId",
  "totalKopecks", "currency", "createdAt", "updatedAt"
) VALUES
  ('deal-a', 'RLS-A-001', 'EXECUTION', 'tenant-a', 'org-a-seller', 'org-a-buyer', 10000000, 'RUB', NOW(), NOW()),
  ('deal-b', 'RLS-B-001', 'EXECUTION', 'tenant-b', 'org-b-seller', 'org-b-buyer', 20000000, 'RUB', NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO public."outbox_entries" (
  "id", "type", "dealId", "payload", "status", "idempotencyKey",
  "correlationId", "auditId", "runtimeSnapshotId", "runtimeIdempotencyKey"
) VALUES
  ('outbox-a', 'runtime.persisted', 'deal-a', '{"tenant":"a"}', 'PENDING', 'outbox-idem-a', 'corr-a', 'audit-business-a', 'runtime-a', 'runtime-idem-a'),
  ('outbox-b', 'runtime.persisted', 'deal-b', '{"tenant":"b"}', 'PENDING', 'outbox-idem-b', 'corr-b', 'audit-business-b', 'runtime-b', 'runtime-idem-b')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO public."audit_events" (
  "id", "action", "actorUserId", "actorRole", "tenantId", "orgId", "dealId",
  "objectType", "objectId", "afterState", "outcome", "hash",
  "correlationId", "runtimeSnapshotId", "runtimeIdempotencyKey"
) VALUES
  ('audit-a', 'runtime.persisted', 'user-a', 'FARMER', 'tenant-a', 'org-a-seller', 'deal-a', 'runtime_snapshot', 'runtime-a', '{"tenant":"a"}', 'SUCCESS', 'hash-a', 'corr-a', 'runtime-a', 'runtime-idem-a'),
  ('audit-b', 'runtime.persisted', 'user-b', 'FARMER', 'tenant-b', 'org-b-seller', 'deal-b', 'runtime_snapshot', 'runtime-b', '{"tenant":"b"}', 'SUCCESS', 'hash-b', 'corr-b', 'runtime-b', 'runtime-idem-b')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO public."deal_workspace_runtime_snapshots" (
  "id", "runtimeSnapshotId", "idempotencyKey", "dealId", "intentId", "state",
  "snapshotState", "statusLabel", "runtimeStoreRecordId", "runtimeStoreVersion",
  "actorId", "actorRole", "correlationId", "auditId", "contractHash", "payload",
  "outboxEntryId", "auditEventId", "version", "createdAt", "updatedAt"
) VALUES
  ('snapshot-record-a', 'runtime-a', 'runtime-idem-a', 'deal-a', 'start_document_review', 'fully_linked', 'updated', 'started', 'store-a', 'v1', 'user-a', 'FARMER', 'corr-a', 'audit-business-a', 'contract-a', '{"tenant":"a"}', 'outbox-a', 'audit-a', 1, NOW(), NOW()),
  ('snapshot-record-b', 'runtime-b', 'runtime-idem-b', 'deal-b', 'start_document_review', 'fully_linked', 'updated', 'started', 'store-b', 'v1', 'user-b', 'FARMER', 'corr-b', 'audit-business-b', 'contract-b', '{"tenant":"b"}', 'outbox-b', 'audit-b', 1, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO public."deal_workspace_runtime_transaction_attempts" (
  "id", "transactionId", "snapshotId", "idempotencyKey", "correlationId", "auditId",
  "stage", "outcome", "isReplay", "startedAt", "completedAt", "metadata"
) VALUES
  ('attempt-a', 'tx-a', 'snapshot-record-a', 'runtime-idem-a', 'corr-a', 'audit-business-a', 'committed', 'persisted', FALSE, NOW(), NOW(), '{"tenant":"a"}'),
  ('attempt-b', 'tx-b', 'snapshot-record-b', 'runtime-idem-b', 'corr-b', 'audit-business-b', 'committed', 'persisted', FALSE, NOW(), NOW(), '{"tenant":"b"}')
ON CONFLICT ("id") DO NOTHING;
