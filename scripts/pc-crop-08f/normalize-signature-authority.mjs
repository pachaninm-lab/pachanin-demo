#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(source, expected, replacement, label) {
  const count = source.split(expected).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one marker, found ${count}`);
  return source.replace(expected, replacement);
}

const schemaPath = 'apps/api/prisma/schema.prisma';
let schema = readFileSync(schemaPath, 'utf8');
if (!schema.includes('signatureAlgorithmUri')) {
  schema = replaceOnce(
    schema,
    '  signatureAlgorithm        String?   @db.VarChar(255)\n  signatureKeyReference',
    '  signatureAlgorithm        String?   @db.VarChar(64)\n  signatureAlgorithmUri     String?\n  signatureKeyReference',
    'Prisma signature authority',
  );
} else {
  if (!schema.includes('signatureAlgorithm        String?   @db.VarChar(64)')) {
    throw new Error('legacy signatureAlgorithm width drift');
  }
}
writeFileSync(schemaPath, schema, 'utf8');

const e2ePath = 'apps/api/test/industrial/fgis-grain-sdiz-projection.e2e-spec.ts';
let e2e = readFileSync(e2ePath, 'utf8');
if (!e2e.includes('"signatureAlgorithmUri"')) {
  e2e = replaceOnce(
    e2e,
    '      "signatureAlgorithm", "signatureKeyReference", "signatureKeyVersion",',
    '      "signatureAlgorithm", "signatureAlgorithmUri", "signatureKeyReference", "signatureKeyVersion",',
    'E2E signature columns',
  );
  e2e = replaceOnce(
    e2e,
    "      'urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34102012-gostr34112012-256',\n      'signing-key://fgis/preprod/test', 'v1',",
    e2e.includes("'GOST3410_2012_256'")
      ? (() => { throw new Error('partial E2E signature authority'); })()
      : "      'GOST3410_2012_256',\n      'urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34102012-gostr34112012-256',\n      'signing-key://fgis/preprod/test', 'v1',",
    'E2E signature values',
  );
}
writeFileSync(e2ePath, e2e, 'utf8');

const repositoryPath = 'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-sdiz-projection.repository.ts';
let repository = readFileSync(repositoryPath, 'utf8');
if (!repository.includes('FGIS_GRAIN_1_0_23_SIGNING_POLICY')) {
  repository = replaceOnce(
    repository,
    "} from './fgis-grain-sdiz-projection.contract';\n",
    "} from './fgis-grain-sdiz-projection.contract';\nimport { FGIS_GRAIN_1_0_23_SIGNING_POLICY } from './fgis-grain-1.0.23.signing-policy.generated';\n",
    'repository signing policy import',
  );
  repository = replaceOnce(
    repository,
    '  readonly signatureStatus: string;\n  readonly verificationResult: unknown;',
    '  readonly signatureStatus: string;\n  readonly signatureAlgorithmUri: string | null;\n  readonly verificationResult: unknown;',
    'repository inbox interface',
  );
  repository = replaceOnce(
    repository,
    '                 "occurredAt", "signatureStatus", "verificationResult", "state",',
    '                 "occurredAt", "signatureStatus", "signatureAlgorithmUri",\n                 "verificationResult", "state",',
    'repository inbox select',
  );
  repository = replaceOnce(
    repository,
    "    || inbox.signatureStatus !== 'VERIFIED'\n    || verification.verified !== true",
    "    || inbox.signatureStatus !== 'VERIFIED'\n    || inbox.signatureAlgorithmUri\n      !== FGIS_GRAIN_1_0_23_SIGNING_POLICY.algorithms.signatureAlgorithmUri\n    || verification.verified !== true",
    'repository exact signature URI check',
  );
}
writeFileSync(repositoryPath, repository, 'utf8');
process.stdout.write('Exact two-field signature authority normalized.\n');
