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
  for (const marker of required) if (!schema.includes(marker)) throw new Error(`partial Prisma authority: ${marker}`);
  process.stdout.write('Prisma FGIS authority already present.\n');
  process.exit(0);
}

schema = replaceOnce(
  schema,
  '  regulatoryIntegrationInboxEntries Organization[]',
  '  regulatoryIntegrationInboxEntries Organization[]',
  'unreachable marker guard',
);
