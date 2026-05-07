export type PlatformV7PersistentEntity =
  | 'grain_batch'
  | 'market_lot'
  | 'buyer_rfq'
  | 'proposal'
  | 'deal'
  | 'money_record'
  | 'document_record'
  | 'trip'
  | 'support_case'
  | 'dispute'
  | 'rating_record'
  | 'audit_event'
  | 'integration_event'
  | 'idempotency_record'
  | 'reconciliation_record';

export type PlatformV7StorageMode = 'required' | 'append_only' | 'derived_read_model' | 'external_reference';

export type PlatformV7PersistenceContract = {
  readonly entity: PlatformV7PersistentEntity;
  readonly tableName: string;
  readonly storageMode: PlatformV7StorageMode;
  readonly requiresOwnerId: boolean;
  readonly requiresDealId: boolean;
  readonly requiresAuditLink: boolean;
  readonly requiresIdempotencyKey: boolean;
  readonly canBeDeletedByUser: boolean;
  readonly summary: string;
};

export const PLATFORM_V7_PERSISTENCE_CONTRACTS: readonly PlatformV7PersistenceContract[] = [
  { entity: 'grain_batch', tableName: 'platform_v7_grain_batches', storageMode: 'required', requiresOwnerId: true, requiresDealId: false, requiresAuditLink: true, requiresIdempotencyKey: true, canBeDeletedByUser: false, summary: 'Physical grain batch record with owner, volume, quality, storage and readiness fields.' },
  { entity: 'market_lot', tableName: 'platform_v7_market_lots', storageMode: 'required', requiresOwnerId: true, requiresDealId: false, requiresAuditLink: true, requiresIdempotencyKey: true, canBeDeletedByUser: false, summary: 'Published lot backed by a grain batch and sale terms.' },
  { entity: 'buyer_rfq', tableName: 'platform_v7_buyer_rfqs', storageMode: 'required', requiresOwnerId: true, requiresDealId: false, requiresAuditLink: true, requiresIdempotencyKey: true, canBeDeletedByUser: false, summary: 'Buyer demand record with quality, volume, basis, payment and document requirements.' },
  { entity: 'proposal', tableName: 'platform_v7_proposals', storageMode: 'required', requiresOwnerId: true, requiresDealId: false, requiresAuditLink: true, requiresIdempotencyKey: true, canBeDeletedByUser: false, summary: 'Offer or bid record that can lead to a deal draft.' },
  { entity: 'deal', tableName: 'platform_v7_deals', storageMode: 'required', requiresOwnerId: true, requiresDealId: false, requiresAuditLink: true, requiresIdempotencyKey: true, canBeDeletedByUser: false, summary: 'Execution container for price, parties, logistics, documents, money and dispute state.' },
  { entity: 'money_record', tableName: 'platform_v7_money_records', storageMode: 'required', requiresOwnerId: false, requiresDealId: true, requiresAuditLink: true, requiresIdempotencyKey: true, canBeDeletedByUser: false, summary: 'Money state record for reserve, hold, release, manual review and reconciliation boundaries.' },
  { entity: 'document_record', tableName: 'platform_v7_document_records', storageMode: 'required', requiresOwnerId: false, requiresDealId: true, requiresAuditLink: true, requiresIdempotencyKey: true, canBeDeletedByUser: false, summary: 'Document status record with signer, source, requirement, evidence and external reference fields.' },
  { entity: 'trip', tableName: 'platform_v7_trips', storageMode: 'required', requiresOwnerId: true, requiresDealId: true, requiresAuditLink: true, requiresIdempotencyKey: true, canBeDeletedByUser: false, summary: 'Logistics execution record for vehicle, driver, route, checkpoints, weight and incidents.' },
  { entity: 'support_case', tableName: 'platform_v7_support_cases', storageMode: 'required', requiresOwnerId: true, requiresDealId: false, requiresAuditLink: true, requiresIdempotencyKey: true, canBeDeletedByUser: false, summary: 'Support case tied to money, documents, logistics, acceptance, quality, dispute or access blockers.' },
  { entity: 'dispute', tableName: 'platform_v7_disputes', storageMode: 'required', requiresOwnerId: false, requiresDealId: true, requiresAuditLink: true, requiresIdempotencyKey: true, canBeDeletedByUser: false, summary: 'Dispute record with reason, evidence pack, decision state and money impact.' },
  { entity: 'rating_record', tableName: 'platform_v7_rating_records', storageMode: 'required', requiresOwnerId: true, requiresDealId: false, requiresAuditLink: true, requiresIdempotencyKey: true, canBeDeletedByUser: false, summary: 'Counterparty reliability record with source signal, score impact, appeal state and visibility boundary.' },
  { entity: 'audit_event', tableName: 'platform_v7_audit_events', storageMode: 'append_only', requiresOwnerId: false, requiresDealId: false, requiresAuditLink: false, requiresIdempotencyKey: true, canBeDeletedByUser: false, summary: 'Append-only action journal for sensitive events, actor, role, entity and before/after context.' },
  { entity: 'integration_event', tableName: 'platform_v7_integration_events', storageMode: 'append_only', requiresOwnerId: false, requiresDealId: false, requiresAuditLink: true, requiresIdempotencyKey: true, canBeDeletedByUser: false, summary: 'External request and response record with connector, external ID, status, error and manual review flags.' },
  { entity: 'idempotency_record', tableName: 'platform_v7_idempotency_records', storageMode: 'required', requiresOwnerId: false, requiresDealId: false, requiresAuditLink: true, requiresIdempotencyKey: true, canBeDeletedByUser: false, summary: 'Idempotency store that prevents duplicate sensitive actions and money operations.' },
  { entity: 'reconciliation_record', tableName: 'platform_v7_reconciliation_records', storageMode: 'append_only', requiresOwnerId: false, requiresDealId: true, requiresAuditLink: true, requiresIdempotencyKey: true, canBeDeletedByUser: false, summary: 'Money reconciliation record for mismatches, manual review, source amount and resolved state.' },
];

export const PLATFORM_V7_APPEND_ONLY_ENTITIES = PLATFORM_V7_PERSISTENCE_CONTRACTS.filter(
  (contract) => contract.storageMode === 'append_only',
).map((contract) => contract.entity);

export const PLATFORM_V7_ENTITY_OWNERSHIP_REQUIRED = PLATFORM_V7_PERSISTENCE_CONTRACTS.filter(
  (contract) => contract.requiresOwnerId,
).map((contract) => contract.entity);

export function getPlatformV7PersistenceContract(entity: PlatformV7PersistentEntity) {
  return PLATFORM_V7_PERSISTENCE_CONTRACTS.find((contract) => contract.entity === entity);
}

export function canPlatformV7EntityBeDeletedByUser(entity: PlatformV7PersistentEntity): boolean {
  return getPlatformV7PersistenceContract(entity)?.canBeDeletedByUser === true;
}

export function requiresPlatformV7Idempotency(entity: PlatformV7PersistentEntity): boolean {
  return getPlatformV7PersistenceContract(entity)?.requiresIdempotencyKey === true;
}

export function requiresPlatformV7AuditLink(entity: PlatformV7PersistentEntity): boolean {
  return getPlatformV7PersistenceContract(entity)?.requiresAuditLink === true;
}

export function getPlatformV7PersistenceReadinessSummary() {
  const appendOnly = PLATFORM_V7_APPEND_ONLY_ENTITIES;
  const ownerBound = PLATFORM_V7_ENTITY_OWNERSHIP_REQUIRED;
  const idempotent = PLATFORM_V7_PERSISTENCE_CONTRACTS.filter((contract) => contract.requiresIdempotencyKey).map(
    (contract) => contract.entity,
  );
  const userDeletable = PLATFORM_V7_PERSISTENCE_CONTRACTS.filter((contract) => contract.canBeDeletedByUser).map(
    (contract) => contract.entity,
  );

  return {
    total: PLATFORM_V7_PERSISTENCE_CONTRACTS.length,
    appendOnly,
    ownerBound,
    idempotent,
    userDeletable,
    mode: 'contract_only_requires_backend_wiring' as const,
  };
}
