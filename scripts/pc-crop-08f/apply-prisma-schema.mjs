#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const schemaPath = 'apps/api/prisma/schema.prisma';
let schema = readFileSync(schemaPath, 'utf8');

function replaceOnce(source, expected, replacement, label) {
  const count = source.split(expected).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one source marker, found ${count}`);
  return source.replace(expected, replacement);
}

if (schema.includes('model FgisGrainProviderConfiguration')) {
  const required = [
    'model FgisGrainProviderAttestation',
    'model FgisGrainSdizProjectionBatch',
    'model FgisGrainSdizProjection',
    'signatureAlgorithm        String?   @db.VarChar(255)',
  ];
  for (const marker of required) {
    if (!schema.includes(marker)) throw new Error(`partial Prisma authority: ${marker}`);
  }
  process.stdout.write('Prisma FGIS authority already present.\n');
  process.exit(0);
}

schema = replaceOnce(
  schema,
  `  users                             UserOrg[]
  dealParticipants                  DealParticipant[]
  regulatoryIntegrationInboxEntries RegulatoryIntegrationInboxEntry[]`,
  `  users                               UserOrg[]
  dealParticipants                    DealParticipant[]
  regulatoryIntegrationInboxEntries   RegulatoryIntegrationInboxEntry[]
  fgisGrainProviderConfigurations      FgisGrainProviderConfiguration[]
  fgisGrainProviderAttestations        FgisGrainProviderAttestation[]
  fgisGrainSdizProjectionBatches       FgisGrainSdizProjectionBatch[]
  fgisGrainSdizProjections             FgisGrainSdizProjection[]`,
  'Organization relations',
);

schema = replaceOnce(
  schema,
  `  orgs             UserOrg[]
  ukepCerts        UkepCertificate[]
  dealParticipants DealParticipant[]`,
  `  orgs                                  UserOrg[]
  ukepCerts                             UkepCertificate[]
  dealParticipants                      DealParticipant[]
  fgisProviderConfigurationsCreated     FgisGrainProviderConfiguration[] @relation("FgisProviderConfigurationCreatedBy")
  fgisProviderConfigurationsUpdated     FgisGrainProviderConfiguration[] @relation("FgisProviderConfigurationUpdatedBy")
  fgisGrainProviderAttestations          FgisGrainProviderAttestation[]`,
  'User relations',
);

schema = replaceOnce(
  schema,
  `  runtimeSnapshot                     DealWorkspaceRuntimeSnapshot?        @relation("RuntimeSnapshotOutbox")
  redriveEvents                       OutboxRedriveEvent[]
  publicOrganizationConnectionRequest PublicOrganizationConnectionRequest?
  regulatoryIntegrationInboxEntries   RegulatoryIntegrationInboxEntry[]`,
  `  runtimeSnapshot                     DealWorkspaceRuntimeSnapshot?        @relation("RuntimeSnapshotOutbox")
  redriveEvents                       OutboxRedriveEvent[]
  publicOrganizationConnectionRequest PublicOrganizationConnectionRequest?
  regulatoryIntegrationInboxEntries   RegulatoryIntegrationInboxEntry[]
  fgisGrainSdizProjectionBatch        FgisGrainSdizProjectionBatch?`,
  'OutboxEntry relations',
);

schema = replaceOnce(
  schema,
  `  dispute                            Dispute?                             @relation(fields: [disputeId], references: [id])
  runtimeSnapshot                    DealWorkspaceRuntimeSnapshot?        @relation("RuntimeSnapshotAudit")
  publicOrganizationConnectionRequest PublicOrganizationConnectionRequest?`,
  `  dispute                            Dispute?                             @relation(fields: [disputeId], references: [id])
  runtimeSnapshot                    DealWorkspaceRuntimeSnapshot?        @relation("RuntimeSnapshotAudit")
  publicOrganizationConnectionRequest PublicOrganizationConnectionRequest?
  fgisGrainSdizProjectionBatch        FgisGrainSdizProjectionBatch?`,
  'AuditEvent relations',
);

schema = replaceOnce(
  schema,
  '  signatureAlgorithm        String?   @db.VarChar(64)',
  '  signatureAlgorithm        String?   @db.VarChar(255)',
  'exact GOST algorithm storage width',
);

schema = replaceOnce(
  schema,
  `  organization Organization                         @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  outboxEntry  OutboxEntry?                         @relation(fields: [outboxEntryId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  conflicts    RegulatoryIntegrationInboxConflict[]`,
  `  organization                 Organization                         @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  outboxEntry                  OutboxEntry?                         @relation(fields: [outboxEntryId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  conflicts                    RegulatoryIntegrationInboxConflict[]
  fgisGrainSdizProjectionBatch FgisGrainSdizProjectionBatch?
  fgisGrainSdizProjections     FgisGrainSdizProjection[]`,
  'RegulatoryIntegrationInboxEntry relations',
);

const models = `

// ── FGIS Grain provider and SDIZ authority ────────────────────────────────────

model FgisGrainProviderConfiguration {
  id                       String   @id
  tenantId                 String
  organizationId           String
  adapterCode              String   @default("FGIS_ZERNO")
  apiVersion               String   @default("1.0.23")
  mappingVersion           String   @default("fgis-zerno-1.0.23-catalog.v1")
  signingPolicyVersion     String   @default("fgis-zerno-1.0.23-signing-policy.v1")
  environment              String
  endpointReference        String
  tlsPolicyReference       String
  credentialReference      String
  signingKeyReference      String
  payloadStoreReference    String
  status                   String   @default("DRAFT")
  version                  BigInt   @default(0)
  createdByUserId          String
  updatedByUserId          String
  createdAt                DateTime @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)
  updatedAt                DateTime @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)

  organization             Organization                   @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_provider_config_org_fk")
  createdByUser            User                           @relation("FgisProviderConfigurationCreatedBy", fields: [createdByUserId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_provider_config_created_user_fk")
  updatedByUser            User                           @relation("FgisProviderConfigurationUpdatedBy", fields: [updatedByUserId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_provider_config_updated_user_fk")
  attestations             FgisGrainProviderAttestation[]

  @@unique([tenantId, organizationId, adapterCode, environment], map: "fgis_grain_provider_config_tenant_org_env_key")
  @@index([tenantId, organizationId, status], map: "fgis_grain_provider_config_status_idx")
  @@index([updatedAt(sort: Desc), id], map: "fgis_grain_provider_config_updated_idx")
  @@map("fgis_grain_provider_configurations")
}

model FgisGrainProviderAttestation {
  id                   String   @id
  configurationId      String
  tenantId             String
  organizationId       String
  gate                 String
  decision             String
  configurationVersion BigInt
  actorUserId          String
  actorRole            String
  mfaVerified          Boolean
  justification        String
  evidenceReference    String
  validUntil           DateTime @db.Timestamptz(6)
  idempotencyKey       String   @unique
  correlationId        String
  hash                 String
  prevHash             String?
  createdAt            DateTime @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)

  configuration        FgisGrainProviderConfiguration @relation(fields: [configurationId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_provider_attestation_config_fk")
  organization         Organization                   @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_provider_attestation_org_fk")
  actorUser            User                           @relation(fields: [actorUserId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_provider_attestation_user_fk")

  @@index([configurationId, configurationVersion, gate, createdAt(sort: Desc), id(sort: Desc)], map: "fgis_grain_provider_attestation_config_idx")
  @@index([validUntil], map: "fgis_grain_provider_attestation_expiry_idx")
  @@index([actorUserId, createdAt(sort: Desc)], map: "fgis_grain_provider_attestation_actor_idx")
  @@map("fgis_grain_provider_attestations")
}

model FgisGrainSdizProjectionBatch {
  id                         String   @id
  tenantId                   String
  organizationId             String
  sourceInboxEntryId         String   @unique
  sourceRawBodySha256        String
  sourceEvidenceReference    String
  providerMessageId          String
  providerReferenceMessageId String?
  providerOccurredAt         DateTime @db.Timestamptz(6)
  batchFingerprint           String
  recordCount                Int
  auditEventId               String   @unique
  outboxEntryId              String   @unique
  createdAt                  DateTime @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)

  organization               Organization                      @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_sdiz_batch_org_fk")
  sourceInboxEntry           RegulatoryIntegrationInboxEntry   @relation(fields: [sourceInboxEntryId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_sdiz_batch_inbox_fk")
  auditEvent                 AuditEvent                        @relation(fields: [auditEventId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_sdiz_batch_audit_fk")
  outboxEntry                OutboxEntry                       @relation(fields: [outboxEntryId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_sdiz_batch_outbox_fk")
  projections                FgisGrainSdizProjection[]

  @@unique([tenantId, organizationId, sourceInboxEntryId, batchFingerprint], map: "fgis_grain_sdiz_batch_identity_key")
  @@index([tenantId, organizationId, providerMessageId], map: "fgis_grain_sdiz_batch_provider_message_idx")
  @@index([createdAt(sort: Desc), id], map: "fgis_grain_sdiz_batch_created_idx")
  @@map("fgis_grain_sdiz_projection_batches")
}

model FgisGrainSdizProjection {
  id                         String   @id
  tenantId                   String
  organizationId             String
  sdizId                     String
  sdizNumber                 String
  lotNumber                  String?
  createLotNumber            String?
  correctedBySdizNumber      String?
  correctedSdizNumber        String?
  extinctionId               String?
  extinctionRefusalId        String?
  status                     String
  providerMessageId          String
  providerReferenceMessageId String?
  providerOccurredAt         DateTime @db.Timestamptz(6)
  payloadFingerprint         String
  sourceInboxEntryId         String
  projectionBatchId          String
  version                    BigInt   @default(0)
  createdAt                  DateTime @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)
  updatedAt                  DateTime @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)

  organization               Organization                    @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_sdiz_projection_org_fk")
  sourceInboxEntry           RegulatoryIntegrationInboxEntry @relation(fields: [sourceInboxEntryId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_sdiz_projection_inbox_fk")
  projectionBatch            FgisGrainSdizProjectionBatch    @relation(fields: [projectionBatchId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_sdiz_projection_batch_fk")

  @@unique([tenantId, organizationId, sdizId], map: "fgis_grain_sdiz_projection_identity_key")
  @@unique([tenantId, organizationId, sdizNumber], map: "fgis_grain_sdiz_projection_number_key")
  @@index([tenantId, organizationId, lotNumber], map: "fgis_grain_sdiz_projection_lot_idx")
  @@index([tenantId, organizationId, status, providerOccurredAt(sort: Desc)], map: "fgis_grain_sdiz_projection_status_idx")
  @@index([sourceInboxEntryId, projectionBatchId], map: "fgis_grain_sdiz_projection_source_idx")
  @@index([updatedAt(sort: Desc), id], map: "fgis_grain_sdiz_projection_freshness_idx")
  @@map("fgis_grain_sdiz_projections")
}
`;

schema = `${schema.trimEnd()}${models}`;
writeFileSync(schemaPath, schema, 'utf8');
process.stdout.write('Prisma FGIS authority applied.\n');
