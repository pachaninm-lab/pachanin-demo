-- Optional manual SQL to mirror the Prisma index hardening added in schema.prisma.
-- Apply only after reviewing on the target PostgreSQL environment.

CREATE INDEX IF NOT EXISTS idx_org_restriction_checked_at ON "Organization" ("restrictionStatus", "reputationLastCheckedAt");
CREATE INDEX IF NOT EXISTS idx_org_rep_event_org_decision_checked ON "OrganizationReputationCheckEvent" ("organizationId", "decision", "checkedAt");
CREATE INDEX IF NOT EXISTS idx_bid_buyer_status_created ON "Bid" ("buyerUserId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS idx_document_lot_type ON "Document" ("lotId", "type");
CREATE INDEX IF NOT EXISTS idx_document_uploaded_created ON "Document" ("uploadedByUserId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_audit_actor_created ON "AuditEntry" ("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_audit_action_created ON "AuditEntry" ("action", "createdAt");
CREATE INDEX IF NOT EXISTS idx_notification_org_read_created ON "Notification" ("organizationId", "isRead", "createdAt");
CREATE INDEX IF NOT EXISTS idx_notification_user_read_created ON "Notification" ("userId", "isRead", "createdAt");
CREATE INDEX IF NOT EXISTS idx_notification_channel_created ON "Notification" ("channel", "createdAt");
CREATE INDEX IF NOT EXISTS idx_sync_org_status_created ON "ExternalSyncJob" ("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS idx_sync_deal_status_created ON "ExternalSyncJob" ("dealId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS idx_sync_shipment_status_created ON "ExternalSyncJob" ("shipmentId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS idx_sync_entity_status ON "ExternalSyncJob" ("entityType", "entityId", "status");
CREATE INDEX IF NOT EXISTS idx_outbox_status_next_attempt ON "OutboxEvent" ("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS idx_outbox_topic_status_created ON "OutboxEvent" ("topic", "status", "createdAt");
CREATE INDEX IF NOT EXISTS idx_runtime_event_topic_aggregate_created ON "RuntimeEventRecord" ("topic", "aggregateType", "aggregateId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_runtime_command_status_updated ON "RuntimeCommandRecord" ("status", "updatedAt");
CREATE INDEX IF NOT EXISTS idx_runtime_tx_boundary_status_started ON "RuntimeTransactionRecord" ("boundary", "status", "startedAt");
CREATE INDEX IF NOT EXISTS idx_runtime_metric_name_scope_recorded ON "RuntimeMetricRecord" ("name", "scope", "recordedAt");
