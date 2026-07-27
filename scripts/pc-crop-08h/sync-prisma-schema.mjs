import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const schemaPath = path.join(root, 'apps/api/prisma/schema.prisma');
const marker = 'model FgisGrainExchange {';
const schema = fs.readFileSync(schemaPath, 'utf8');

if (schema.includes(marker)) {
  process.stdout.write('FgisGrainExchange Prisma model already synchronized.\n');
  process.exit(0);
}

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

  @@unique([tenantId, organizationId, messageId], map: "fgis_grain_exchange_message_key")
  @@unique([tenantId, organizationId, commandId], map: "fgis_grain_exchange_command_key")
  @@index([tenantId, organizationId, state, updatedAt(sort: Desc), id], map: "fgis_grain_exchange_state_idx")
  @@index([correlationId], map: "fgis_grain_exchange_correlation_idx")
  @@index([tenantId, organizationId, providerMessageId], map: "fgis_grain_exchange_provider_message_idx")
  @@map("fgis_grain_exchanges")
}
`;

fs.writeFileSync(schemaPath, `${schema.trimEnd()}${model}`, 'utf8');
process.stdout.write('Appended FgisGrainExchange Prisma model.\n');
