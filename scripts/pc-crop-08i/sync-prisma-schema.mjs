import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const schemaPath = path.join(root, 'apps/api/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');
const modelMarker = 'model FgisGrainAcknowledgement {';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function locateModel(modelName) {
  const marker = `model ${modelName} {`;
  const start = schema.indexOf(marker);
  if (start < 0) return null;
  const nextModel = schema.indexOf('\nmodel ', start + marker.length);
  const end = nextModel < 0 ? schema.length : nextModel;
  return { start, end, block: schema.slice(start, end) };
}

function fieldCount(modelName, fieldName) {
  const model = locateModel(modelName);
  if (!model) return 0;
  const pattern = new RegExp(`^\\s*${escapeRegExp(fieldName)}\\s+`, 'gmu');
  return [...model.block.matchAll(pattern)].length;
}

function insertAfterField(modelName, anchorField, lines, label) {
  const model = locateModel(modelName);
  if (!model) throw new Error(`${label}: model ${modelName} is absent`);
  const pattern = new RegExp(
    `^(\\s*${escapeRegExp(anchorField)}\\s+[^\\n]*\\n)`,
    'gmu',
  );
  const matches = [...model.block.matchAll(pattern)];
  if (matches.length !== 1) {
    throw new Error(`${label}: expected exactly one ${anchorField} anchor, found ${matches.length}`);
  }
  const match = matches[0];
  const insertion = model.start + (match.index ?? 0) + match[0].length;
  schema = `${schema.slice(0, insertion)}${lines}${schema.slice(insertion)}`;
}

if (fieldCount('Organization', 'fgisGrainAcknowledgements') === 0) {
  insertAfterField(
    'Organization',
    'fgisGrainExchanges',
    '  fgisGrainAcknowledgements FgisGrainAcknowledgement[]\n',
    'Organization ACK backrelation',
  );
}

if (fieldCount('OutboxEntry', 'fgisGrainAckDispatch') === 0) {
  if (fieldCount('OutboxEntry', 'fgisGrainAckEvent') !== 0) {
    throw new Error('Outbox ACK backrelations are partially synchronized');
  }
  insertAfterField(
    'OutboxEntry',
    'fgisGrainOutboundExchange',
    '  fgisGrainAckDispatch FgisGrainAcknowledgement? @relation("FgisGrainAckDispatchOutbox")\n  fgisGrainAckEvent    FgisGrainAcknowledgement? @relation("FgisGrainAckEventOutbox")\n',
    'Outbox ACK backrelations',
  );
}

if (fieldCount('AuditEvent', 'fgisGrainAcknowledgement') === 0) {
  insertAfterField(
    'AuditEvent',
    'fgisGrainSdizProjectionBatch',
    '  fgisGrainAcknowledgement FgisGrainAcknowledgement?\n',
    'AuditEvent ACK backrelation',
  );
}

if (fieldCount('RegulatoryIntegrationInboxEntry', 'fgisGrainAcknowledgement') === 0) {
  insertAfterField(
    'RegulatoryIntegrationInboxEntry',
    'fgisGrainResponseExchange',
    '  fgisGrainAcknowledgement FgisGrainAcknowledgement?\n',
    'Inbox ACK backrelation',
  );
}

if (fieldCount('FgisGrainExchange', 'acknowledgement') === 0) {
  insertAfterField(
    'FgisGrainExchange',
    'responseInboxEntry',
    '  acknowledgement FgisGrainAcknowledgement?\n',
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

const requiredFields = [
  ['Organization', 'fgisGrainAcknowledgements'],
  ['OutboxEntry', 'fgisGrainAckDispatch'],
  ['OutboxEntry', 'fgisGrainAckEvent'],
  ['AuditEvent', 'fgisGrainAcknowledgement'],
  ['RegulatoryIntegrationInboxEntry', 'fgisGrainAcknowledgement'],
  ['FgisGrainExchange', 'acknowledgement'],
];
for (const [modelName, fieldName] of requiredFields) {
  const count = fieldCount(modelName, fieldName);
  if (count !== 1) {
    throw new Error(`${modelName}.${fieldName}: expected exactly one field, found ${count}`);
  }
}
if ((schema.match(/^model FgisGrainAcknowledgement \{/gmu) ?? []).length !== 1) {
  throw new Error('FgisGrainAcknowledgement model authority is duplicated');
}

fs.writeFileSync(schemaPath, schema, 'utf8');
process.stdout.write('FGIS Grain ACK Prisma schema synchronized.\n');
