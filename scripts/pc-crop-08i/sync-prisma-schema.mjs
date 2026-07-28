import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const schemaPath = path.join(root, 'apps/api/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');
const modelMarker = 'model FgisGrainAcknowledgement {';

function replaceOnce(anchor, replacement, label) {
  const first = schema.indexOf(anchor);
  const last = schema.lastIndexOf(anchor);
  if (first < 0 || first !== last) {
    throw new Error(`${label}: expected exactly one anchor, found ${first < 0 ? 0 : 'multiple'}`);
  }
  schema = schema.slice(0, first) + replacement + schema.slice(first + anchor.length);
}

if (!schema.includes('  fgisGrainAcknowledgements       FgisGrainAcknowledgement[]\n')) {
  replaceOnce(
    '  fgisGrainExchanges                FgisGrainExchange[]\n',
    '  fgisGrainExchanges                FgisGrainExchange[]\n  fgisGrainAcknowledgements       FgisGrainAcknowledgement[]\n',
    'Organization ACK backrelation',
  );
}

if (!schema.includes('  fgisGrainAckDispatch                FgisGrainAcknowledgement?')) {
  replaceOnce(
    '  fgisGrainOutboundExchange           FgisGrainExchange?\n',
    '  fgisGrainOutboundExchange           FgisGrainExchange?\n  fgisGrainAckDispatch                FgisGrainAcknowledgement? @relation("FgisGrainAckDispatchOutbox")\n  fgisGrainAckEvent                   FgisGrainAcknowledgement? @relation("FgisGrainAckEventOutbox")\n',
    'Outbox ACK backrelations',
  );
}

if (!schema.includes('  fgisGrainAcknowledgement              FgisGrainAcknowledgement?\n')) {
  replaceOnce(
    '  publicOrganizationConnectionRequest PublicOrganizationConnectionRequest?\n  fgisGrainSdizProjectionBatch        FgisGrainSdizProjectionBatch?\n',
    '  publicOrganizationConnectionRequest PublicOrganizationConnectionRequest?\n  fgisGrainSdizProjectionBatch        FgisGrainSdizProjectionBatch?\n  fgisGrainAcknowledgement              FgisGrainAcknowledgement?\n',
    'AuditEvent ACK backrelation',
  );
}

if (!schema.includes('  fgisGrainAcknowledgement  FgisGrainAcknowledgement?\n')) {
  replaceOnce(
    '  fgisGrainResponseExchange    FgisGrainExchange?\n',
    '  fgisGrainResponseExchange    FgisGrainExchange?\n  fgisGrainAcknowledgement  FgisGrainAcknowledgement?\n',
    'Inbox ACK backrelation',
  );
}

if (!schema.includes('  acknowledgement     FgisGrainAcknowledgement?\n')) {
  replaceOnce(
    '  responseInboxEntry  RegulatoryIntegrationInboxEntry? @relation(fields: [responseInboxEntryId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_exchange_response_inbox_fk")\n',
    '  responseInboxEntry  RegulatoryIntegrationInboxEntry? @relation(fields: [responseInboxEntryId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_exchange_response_inbox_fk")\n  acknowledgement     FgisGrainAcknowledgement?\n',
    'Exchange ACK backrelation',
  );
}

if (!schema.includes(modelMarker)) {
  const model = String.raw`

model FgisGrainAcknowledgement {
  id                             String    @id
  tenantId                       String
  organizationId                 String
  inboxEntryId                   String    @unique
  inboundTransportOperation      String
  inboundMessageId               String
  inboundReferenceMessageId      String?
  inboundResponseCode            String
  verifiedPayloadFingerprint     String    @db.Char(64)
  ackPolicyVersion               String
  ackPolicyHash                  String    @db.Char(64)
  decision                       String
  reasonCode                     String
  commandId                      String?
  messageId                      String?
  referenceMessageId             String?
  ackEnvelopeReference           String?
  ackEnvelopeSha256              String?   @db.Char(64)
  ackEnvelopeSizeBytes           Int?
  ackMessageDataId               String?
  providerConfigurationReference String?
  outboundOutboxEntryId          String?   @unique
  exchangeId                     String?   @unique
  auditEventId                   String?   @unique
  eventOutboxEntryId             String?   @unique
  state                          String
  reconciliationReason           String?
  reconciliationDetectedAt       DateTime? @db.Timestamptz(6)
  version                        BigInt    @default(0)
  createdAt                      DateTime  @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)
  updatedAt                      DateTime  @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)

  organization        Organization                     @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_ack_org_fk")
  inboxEntry          RegulatoryIntegrationInboxEntry @relation(fields: [inboxEntryId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_ack_inbox_fk")
  outboundOutboxEntry OutboxEntry?                     @relation("FgisGrainAckDispatchOutbox", fields: [outboundOutboxEntryId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_ack_dispatch_outbox_fk")
  exchange            FgisGrainExchange?               @relation(fields: [exchangeId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_ack_exchange_fk")
  auditEvent          AuditEvent?                      @relation(fields: [auditEventId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_ack_audit_fk")
  eventOutboxEntry    OutboxEntry?                     @relation("FgisGrainAckEventOutbox", fields: [eventOutboxEntryId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_ack_event_outbox_fk")

  @@unique([tenantId, organizationId, inboxEntryId], map: "fgis_grain_ack_tenant_org_inbox_key")
  @@index([tenantId, organizationId, state, updatedAt(sort: Desc), id], map: "fgis_grain_ack_state_idx")
  @@index([tenantId, organizationId, inboundMessageId], map: "fgis_grain_ack_inbound_message_idx")
  @@index([inboxEntryId, exchangeId], map: "fgis_grain_ack_correlation_idx")
  @@map("fgis_grain_acknowledgements")
}
`;
  schema = `${schema.trimEnd()}${model}`;
}

fs.writeFileSync(schemaPath, schema, 'utf8');
process.stdout.write('FGIS Grain ACK Prisma schema synchronized.\n');
