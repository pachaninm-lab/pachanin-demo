import fs from 'node:fs';
import { createHash } from 'node:crypto';

const policyPath = 'docs/platform-v7/crop-platform/fgis-grain-api-1.0.23.ack-policy.lock.json';
const migrationPath = 'apps/api/prisma/migrations/20260728004500_fgis_grain_outbound_ack/migration.sql';
const schemaPath = 'apps/api/prisma/schema.prisma';
const contractPath = 'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-ack.contract.ts';
const repositoryPath = 'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-ack.repository.ts';

for (const file of [policyPath, migrationPath, schemaPath, contractPath, repositoryPath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing PC-CROP-08I authority file: ${file}`);
}

const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
const policyHash = createHash('sha256').update([
  policy.schemaVersion,
  policy.policyVersion,
  policy.packageSha256,
  policy.catalogSha256,
  policy.transport.operation,
  policy.transport.soapAction,
  ...policy.eligibility.eligibleInboundTransportOperations,
  ...policy.eligibility.ineligibleInboundTransportOperations,
  ...policy.eligibility.eligibleVerificationResponseCodes,
  ...policy.eligibility.ineligibleVerificationResponseCodes,
  policy.boundaries.operationalStatus,
].join('\u001f'), 'utf8').digest('hex');
if (policy.policyHash !== policyHash) throw new Error('ACK policy canonical hash mismatch');
if (policy.packageSha256 !== '085e22c50b6564219585c96e814b0793d906f4c5e401cbb7446a949c26f0bcd7') {
  throw new Error('ACK policy package authority mismatch');
}
if (policy.catalogSha256 !== '4fc7cc075b956f0adca26331a99627d07cde77d63ec2fc017d0cbbc5f701c87a') {
  throw new Error('ACK policy catalog authority mismatch');
}
if (policy.transport.operation !== 'Ack' || policy.transport.soapAction !== 'urn:Ack') {
  throw new Error('ACK transport authority mismatch');
}
if (policy.boundaries.confirmedLive !== false || policy.boundaries.operationalStatus !== 'NOT_ATTESTED') {
  throw new Error('ACK maturity boundary was overstated');
}

const migration = fs.readFileSync(migrationPath, 'utf8');
const schema = fs.readFileSync(schemaPath, 'utf8');
const contract = fs.readFileSync(contractPath, 'utf8');
const repository = fs.readFileSync(repositoryPath, 'utf8');
const requiredMigrationTokens = [
  'CREATE TABLE public."fgis_grain_acknowledgements"',
  'FORCE ROW LEVEL SECURITY',
  'create_fgis_grain_acknowledgement',
  'sync_fgis_grain_ack_transport_acceptance',
  'FGIS_GRAIN_ACK_NOT_REQUIRED',
  'FGIS_GRAIN_ACK_REQUESTED',
  'FGIS_GRAIN_ACK_TRANSPORT_ACCEPTED',
  'ACK_NOT_REQUIRED_ACK_OF_ACK',
  'ACK_PROVIDER_ATTESTATION_INVALID',
  'FGIS_GRAIN_OUTBOUND_DISPATCH_REQUESTED',
];
for (const token of requiredMigrationTokens) {
  if (!migration.includes(token)) throw new Error(`ACK migration missing authority token: ${token}`);
}
for (const token of [
  'model FgisGrainAcknowledgement {',
  '@@map("fgis_grain_acknowledgements")',
  'map: "fgis_grain_ack_exchange_fk"',
  '@relation("FgisGrainAckDispatchOutbox"',
  '@relation("FgisGrainAckEventOutbox"',
]) {
  if (!schema.includes(token)) throw new Error(`ACK Prisma schema missing authority token: ${token}`);
}
if (!contract.includes(policy.policyHash) || !contract.includes("'NOT_ATTESTED'")) {
  throw new Error('ACK TypeScript policy is not pinned to the canonical lock');
}
if (!repository.includes('withTrustedContext') || !repository.includes('TransactionIsolationLevel.Serializable')) {
  throw new Error('ACK repository is not server-authoritative and serializable');
}
if (/CONFIRMED_LIVE|PRODUCTION_APPROVED/u.test([policyPath, migrationPath, contractPath, repositoryPath]
  .map((file) => fs.readFileSync(file, 'utf8')).join('\n'))) {
  throw new Error('ACK slice contains forbidden maturity claims');
}

process.stdout.write(JSON.stringify({
  schemaVersion: 'pc-crop.fgis-grain-ack-acceptance.v1',
  policyHash,
  packageSha256: policy.packageSha256,
  catalogSha256: policy.catalogSha256,
  operationalStatus: 'NOT_ATTESTED',
  productionHosting: 'REG_RU_VPS_ONLY',
  result: 'PASS',
}, null, 2));
process.stdout.write('\n');
