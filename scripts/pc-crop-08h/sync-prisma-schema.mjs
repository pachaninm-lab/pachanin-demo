import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const schemaPath = path.join(root, 'apps/api/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');
let changed = false;

function ensureInModel(modelName, anchor, insertion, evidence) {
  const marker = `model ${modelName} {`;
  const start = schema.indexOf(marker);
  if (start < 0) {
    throw new Error(`Prisma model ${modelName} is absent`);
  }
  const next = schema.indexOf('\nmodel ', start + marker.length);
  const end = next < 0 ? schema.length : next;
  const block = schema.slice(start, end);
  if (block.includes(evidence)) return;

  const first = block.indexOf(anchor);
  const last = block.lastIndexOf(anchor);
  if (first < 0 || first !== last) {
    throw new Error(`Unable to synchronize ${modelName}: anchor is missing or ambiguous`);
  }

  const updated = block.slice(0, first) + insertion + block.slice(first + anchor.length);
  schema = schema.slice(0, start) + updated + schema.slice(end);
  changed = true;
}

if (!schema.includes('model FgisGrainExchange {')) {
  const model = String.raw`

model FgisGrainExchange {
  id                          String    @id
  tenantId                    String
  organizationId              String
  outboundOutboxEntryId       String    @unique
  commandId                   String
  messageId                   String
  correlationId               String
  transportOperation          String
  businessOperationCode       String?
  dispatchPayloadFingerprint  String    @db.Char(64)
  state                       String    @default("DISPATCH_PENDING")
  providerMessageId           String?
  transportResponseCode       String?
  httpStatus                  Int?
  transportResponseBodySha256 String?   @db.Char(64)
  transportAcceptedAt         DateTime? @db.Timestamptz(6)
  responseInboxEntryId        String?   @unique
  responseProviderMessageId   String?
  responseReferenceMessageId  String?
  responseFingerprint         String?   @db.Char(64)
  responseOccurredAt          DateTime? @db.Timestamptz(6)
  reconciliationReason        String?
  reconciliationDetectedAt    DateTime? @db.Timestamptz(6)
  version                     BigInt    @default(0)
  createdAt                   DateTime  @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)
  updatedAt                   DateTime  @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)

  organization        Organization                     @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_exchange_org_fk")
  outboundOutboxEntry OutboxEntry                      @relation(fields: [outboundOutboxEntryId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_exchange_outbox_fk")
  responseInboxEntry  RegulatoryIntegrationInboxEntry? @relation(fields: [responseInboxEntryId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_exchange_response_inbox_fk")

  @@unique([tenantId, organizationId, messageId], map: "fgis_grain_exchange_message_key")
  @@unique([tenantId, organizationId, commandId], map: "fgis_grain_exchange_command_key")
  @@index([tenantId, organizationId, state, updatedAt(sort: Desc), id], map: "fgis_grain_exchange_state_idx")
  @@index([correlationId], map: "fgis_grain_exchange_correlation_idx")
  @@index([tenantId, organizationId, providerMessageId], map: "fgis_grain_exchange_provider_message_idx")
  @@map("fgis_grain_exchanges")
}
`;
  schema = `${schema.trimEnd()}${model}`;
  changed = true;
}

ensureInModel(
  'Organization',
  '  fgisGrainSdizProjections          FgisGrainSdizProjection[]\n',
  '  fgisGrainSdizProjections          FgisGrainSdizProjection[]\n  fgisGrainExchanges                FgisGrainExchange[]\n',
  'fgisGrainExchanges                FgisGrainExchange[]',
);

ensureInModel(
  'OutboxEntry',
  '  fgisGrainSdizProjectionBatch        FgisGrainSdizProjectionBatch?\n',
  '  fgisGrainSdizProjectionBatch        FgisGrainSdizProjectionBatch?\n  fgisGrainOutboundExchange           FgisGrainExchange?\n',
  'fgisGrainOutboundExchange           FgisGrainExchange?',
);

ensureInModel(
  'RegulatoryIntegrationInboxEntry',
  '  fgisGrainSdizProjections     FgisGrainSdizProjection[]\n',
  '  fgisGrainSdizProjections     FgisGrainSdizProjection[]\n  fgisGrainResponseExchange    FgisGrainExchange?\n',
  'fgisGrainResponseExchange    FgisGrainExchange?',
);

if (changed) {
  fs.writeFileSync(schemaPath, schema, 'utf8');
  process.stdout.write('Synchronized FgisGrainExchange Prisma model and relation authority.\n');
} else {
  process.stdout.write('FgisGrainExchange Prisma model and relation authority already synchronized.\n');
}
