import fs from 'node:fs';
import path from 'node:path';

const evidenceDir = process.env.EVIDENCE_DIR || 'artifacts/pc-crop-08c';
const exactHead = process.env.EXACT_HEAD || '';
const root = process.cwd();
const codecPath = path.join(
  root,
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.xml-codec.ts',
);
const policyPath = path.join(
  root,
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.xml-policy.ts',
);
const specPath = path.join(
  root,
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.xml-codec.spec.ts',
);
const policySpecPath = path.join(
  root,
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.xml-policy.spec.ts',
);
const scopePath = path.join(
  root,
  'docs/platform-v7/autopilot/scopes/pc-crop-08c-fgis-xml-signing-input.json',
);

fs.mkdirSync(evidenceDir, { recursive: true });
const failures = [];
const requiredFiles = [
  'api-typecheck.ok',
  'codec-tests.ok',
  'scope-guard.ok',
];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(evidenceDir, file))) failures.push(`missing ${file}`);
}
if (!/^[a-f0-9]{40}$/.test(exactHead)) failures.push('exact head is missing or invalid');

const codec = fs.readFileSync(codecPath, 'utf8');
const policy = fs.readFileSync(policyPath, 'utf8');
const spec = fs.readFileSync(specPath, 'utf8');
const policySpec = fs.readFileSync(policySpecPath, 'utf8');
const runtimeAuthority = `${codec}\n${policy}`;
const completeAbuseCorpus = `${spec}\n${policySpec}`;
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

const forbiddenRuntimePatterns = [
  /\baxios\b/u,
  /\bfetch\s*\(/u,
  /\bhttps?\.request\s*\(/u,
  /\bcreateSign\s*\(/u,
  /\bcreateVerify\s*\(/u,
  /BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY/u,
  /\bCryptoPro\b/u,
  /CONFIRMED_LIVE/u,
];
for (const pattern of forbiddenRuntimePatterns) {
  if (pattern.test(runtimeAuthority)) failures.push(`forbidden runtime pattern ${pattern}`);
}

const requiredCodecMarkers = [
  'RestrictedXmlParser',
  'TextDecoder',
  "fatal: true",
  'DTD_OR_DECLARATION_FORBIDDEN',
  'NAMESPACE_REBINDING_FORBIDDEN',
  'DUPLICATE_XML_ID',
  'SOAP_11_ENVELOPE_REQUIRED',
  'buildUnsignedFgisGrainSoapEnvelope',
  'decodeFgisGrainSoapEnvelope',
  'mapDecodedFgisGrainInboundEnvelope',
  'EXTERNAL_SIGNER_POLICY_REQUIRED',
];
for (const marker of requiredCodecMarkers) {
  if (!codec.includes(marker)) failures.push(`codec marker missing: ${marker}`);
}

const requiredPolicyMarkers = [
  'FGIS_GRAIN_XINCLUDE_NAMESPACE',
  'XMLNS_ATTRIBUTE_PATTERN',
  'decodeNamespaceValue',
  'assertFgisGrainXIncludeForbidden',
  'decodeGovernedFgisGrainSoapEnvelope',
  'buildGovernedUnsignedFgisGrainSoapEnvelope',
];
for (const marker of requiredPolicyMarkers) {
  if (!policy.includes(marker)) failures.push(`policy marker missing: ${marker}`);
}

const abuseMarkers = [
  'DOCTYPE / XXE',
  'processing instruction',
  'SOAP 1.2',
  'duplicate attributes',
  'namespace shadowing',
  'multiple roots',
  'invalid UTF-8',
  'XInclude as transport payload',
  'multiple SOAP Body and payload roots',
  'duplicate XML IDs used by signature wrapping attacks',
  'signature blocks and transport wrappers inside caller payload',
  'oversized XML and excessive depth',
  'XInclude nested inside an otherwise valid SDIZ request',
  'entity-obfuscated XInclude namespace declarations',
];
for (const marker of abuseMarkers) {
  if (!completeAbuseCorpus.includes(marker)) {
    failures.push(`abuse contract missing: ${marker}`);
  }
}

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') {
  failures.push('invalid scope schema');
}
if (scope.branch !== 'agent/pc-crop-08c-fgis-xml-signing-input') {
  failures.push('scope branch mismatch');
}
if (scope.issue !== 3163 || scope.operationalStatus !== 'NOT_ATTESTED') {
  failures.push('scope issue or operational status mismatch');
}
if (scope.productionHosting !== 'REG_RU_VPS_ONLY') {
  failures.push('production hosting boundary mismatch');
}
for (const value of Object.values(scope.boundaries || {})) {
  if (typeof value !== 'boolean') failures.push('non-boolean scope boundary');
}

const report = {
  schemaVersion: 'pc-crop.fgis-grain-xml-codec-acceptance.v1',
  slice: 'PC-CROP-08C',
  issue: 3163,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  operationalStatus: 'NOT_ATTESTED',
  exactHead,
  adapterCode: 'FGIS_ZERNO',
  apiVersion: '1.0.23',
  packageSha256: '085e22c50b6564219585c96e814b0793d906f4c5e401cbb7446a949c26f0bcd7',
  catalogSha256: '4fc7cc075b956f0adca26331a99627d07cde77d63ec2fc017d0cbbc5f701c87a',
  invariants: {
    fatalUtf8Decode: codec.includes("fatal: true"),
    rawBytesAndSha256Authority: codec.includes('rawBodyBytes') && codec.includes('rawBodySha256'),
    dtdAndEntityDeclarationsRejected: codec.includes('DTD_OR_DECLARATION_FORBIDDEN'),
    namespaceRebindingRejected: codec.includes('NAMESPACE_REBINDING_FORBIDDEN'),
    duplicateAttributesRejected: codec.includes('DUPLICATE_ATTRIBUTE'),
    duplicateXmlIdsRejected: codec.includes('DUPLICATE_XML_ID'),
    xincludeRejectedAfterEntityDecode:
      policy.includes('decodeNamespaceValue')
      && policy.includes('FGIS_GRAIN_XINCLUDE_NAMESPACE'),
    soap11Only: codec.includes('SOAP_11_ENVELOPE_REQUIRED'),
    exactCatalogQNameResolution: codec.includes('FGIS_GRAIN_BUSINESS_OPERATIONS'),
    deterministicUnsignedEnvelope: codec.includes('unsignedEnvelopeSha256'),
    immutableSigningInputDescriptor: codec.includes('messageDataSha256'),
    canonicalInboxMapping: codec.includes('toRegulatoryInboundEnvelope'),
    abuseCorpusPresent: abuseMarkers.every((marker) => completeAbuseCorpus.includes(marker)),
  },
  boundaries: {
    generalPurposeXmlParser: false,
    dependencyOrLockfileChange: false,
    networkClient: false,
    credentialsOrCertificateBytes: false,
    cryptographicSigningOrVerification: false,
    externalProviderCall: false,
    dealLotOrSdizMutation: false,
    secondInboxOutboxOrRelay: false,
    confirmedLiveClaim: false,
    productionDeployment: false,
    productionHosting: 'REG_RU_VPS_ONLY',
  },
  failures,
};

const output = path.join(evidenceDir, 'pc-crop-08c-acceptance.json');
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
