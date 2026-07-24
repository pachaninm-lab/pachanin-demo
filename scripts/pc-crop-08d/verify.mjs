import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const evidenceDir = process.env.EVIDENCE_DIR || 'artifacts/pc-crop-08d';
const exactHead = process.env.EXACT_HEAD || '';
const failures = [];

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (name) => fs.existsSync(path.join(root, evidenceDir, name));
for (const name of [
  'scope-guard.ok',
  'policy-authority.ok',
  'api-typecheck.ok',
  'unit-contracts.ok',
  'postgresql-acceptance.ok',
]) {
  if (!exists(name)) failures.push(`missing evidence marker: ${name}`);
}
if (!/^[a-f0-9]{40}$/u.test(exactHead)) failures.push('invalid exact head');

const lock = JSON.parse(read('docs/platform-v7/crop-platform/fgis-grain-api-1.0.23.signing-policy.lock.json'));
const manifest = JSON.parse(read('docs/platform-v7/crop-platform/fgis-grain-api-1.0.23.signing-policy.json'));
const generated = read('apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.signing-policy.generated.ts');
const contract = read('apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.dispatch.contract.ts');
const handler = read('apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-outbox-dispatch.handler.ts');
const repository = read('apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-dispatch.repository.ts');
const failClosed = read('apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.dispatch.fail-closed.ts');
const apiModule = read('apps/api/src/modules/regulatory-integration/regulatory-integration.module.ts');
const workerModule = read('apps/api/src/outbox-worker.module.ts');
const e2e = read('apps/api/test/industrial/fgis-grain-dispatch.e2e-spec.ts');
const scope = JSON.parse(read('docs/platform-v7/autopilot/scopes/pc-crop-08d-fgis-signing-transport.json'));

if (lock.status !== 'PINNED' || lock.operationalStatus !== 'NOT_ATTESTED') {
  failures.push('signing policy lock is not pinned and NOT_ATTESTED');
}
if (lock.packageSha256 !== '085e22c50b6564219585c96e814b0793d906f4c5e401cbb7446a949c26f0bcd7') {
  failures.push('official package pin mismatch');
}
if (lock.protocolDocumentSha256 !== 'b195a9928970761dde282c4789ebe71b6095435973028688fefbb1beb8e1de9a') {
  failures.push('official protocol document pin mismatch');
}
if (manifest.schemaVersion !== 'pc-crop.fgis-grain-signing-policy.v1') {
  failures.push('signing policy manifest schema mismatch');
}
for (const identifier of Object.values(lock.requiredIdentifiers || {})) {
  if (typeof identifier !== 'string' || !generated.includes(identifier)) {
    failures.push(`generated policy missing identifier: ${String(identifier)}`);
  }
}

const forbiddenRuntimePatterns = [
  /\bfetch\s*\(/u,
  /\baxios\b/u,
  /\bHttpService\b/u,
  /\bcreateSign\s*\(/u,
  /\bcreateVerify\s*\(/u,
  /BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY/u,
  /CONFIRMED_LIVE/u,
];
for (const [name, source] of Object.entries({ contract, handler, repository, failClosed })) {
  for (const pattern of forbiddenRuntimePatterns) {
    if (pattern.test(source)) failures.push(`${name} contains forbidden runtime pattern ${pattern}`);
  }
}
if (!contract.includes('FGIS_GRAIN_OUTBOUND_DISPATCH_REQUESTED')) {
  failures.push('versioned FGIS outbox event missing');
}
if (!contract.includes('RAW_XML_OR_SECRET_FIELD_FORBIDDEN')) {
  failures.push('raw XML/secret rejection contract missing');
}
if (!handler.includes('registerHandler') || !handler.includes('FGIS_GRAIN_OUTBOX_EVENT_TYPE')) {
  failures.push('type-specific durable worker handler registration missing');
}
if (!handler.includes('findSignatureInsertion')) {
  failures.push('exact generated signature insertion authority missing');
}
if (!repository.includes('withTrustedContext')
  || !repository.includes('public."audit_events"')
  || !repository.includes('public."outbox_entries"')
  || !repository.includes('TransactionIsolationLevel.Serializable')) {
  failures.push('atomic server-authoritative PostgreSQL enqueue missing');
}
if (repository.includes('JSON.stringify(parsed) === JSON.stringify(expected)')) {
  failures.push('order-sensitive replay comparison is forbidden');
}
if (!repository.includes('actual.unsignedEnvelopeSha256 === expected.unsignedEnvelopeSha256')) {
  failures.push('field-by-field replay authority missing');
}
if (!apiModule.includes('FgisGrainDispatchRepository')) {
  failures.push('API module does not expose dispatch repository');
}
for (const marker of [
  'FgisGrainOutboxDispatchHandler',
  'FailClosedFgisGrainProviderConfigurationPort',
  'FailClosedFgisGrainCanonicalizationPort',
  'FailClosedFgisGrainSigningProviderPort',
  'FailClosedFgisGrainSoapTransportPort',
]) {
  if (!workerModule.includes(marker)) failures.push(`worker module missing ${marker}`);
}
for (const marker of [
  'atomically persists one immutable audit and canonical outbox row',
  'rejects a reused idempotency key',
  'isolates the same client key',
  'confirmedAt: null',
]) {
  if (!e2e.includes(marker)) failures.push(`PostgreSQL acceptance missing: ${marker}`);
}
if (scope.issue !== 3168 || scope.operationalStatus !== 'NOT_ATTESTED') {
  failures.push('scope issue/status mismatch');
}
if (scope.productionHosting !== 'REG_RU_VPS_ONLY') {
  failures.push('production hosting boundary mismatch');
}

const report = {
  schemaVersion: 'pc-crop.fgis-grain-signing-dispatch-acceptance.v1',
  slice: 'PC-CROP-08D',
  issue: 3168,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  exactHead,
  postgresql: '16',
  adapterCode: 'FGIS_ZERNO',
  apiVersion: '1.0.23',
  operationalStatus: 'NOT_ATTESTED',
  officialAuthority: {
    packageSha256: lock.packageSha256,
    protocolDocumentSha256: lock.protocolDocumentSha256,
    policyManifestSha256: lock.policyManifestSha256,
    generatedTypescriptSha256: lock.generatedTypescriptSha256,
  },
  invariants: {
    officialZipAndDocxPinned: lock.status === 'PINNED',
    byteIdenticalPolicyAuthority: exists('policy-authority.ok'),
    referenceOnlyConfiguration: contract.includes('endpointReference')
      && contract.includes('credentialReference')
      && contract.includes('signingKeyReference'),
    rawXmlAndSecretsRejected: contract.includes('RAW_XML_OR_SECRET_FIELD_FORBIDDEN'),
    failClosedDefaultPorts: failClosed.includes('PROVIDER_CONFIG_NOT_CONFIGURED')
      && failClosed.includes('CANONICALIZATION_UNAVAILABLE')
      && failClosed.includes('SIGNING_PROVIDER_UNAVAILABLE')
      && failClosed.includes('TRANSPORT_UNAVAILABLE'),
    canonicalOutboxOnly: repository.includes('public."outbox_entries"'),
    atomicAuditAndOutbox: repository.includes('public."audit_events"')
      && repository.includes('TransactionIsolationLevel.Serializable'),
    serverDerivedTenantOrg: repository.includes('context.tenantId')
      && repository.includes('context.orgId'),
    deterministicReplay: repository.includes('samePayload')
      && !repository.includes('JSON.stringify(parsed) === JSON.stringify(expected)'),
    typeSpecificWorkerHandler: handler.includes('registerHandler'),
    providerConfirmationNotInvented: e2e.includes('confirmedAt: null'),
    postgresqlAcceptance: exists('postgresql-acceptance.ok'),
  },
  boundaries: {
    secondInboxOutboxOrRelay: false,
    rawXmlSignatureKeyOrCertificateInOutbox: false,
    canonicalizationOrSmevImplementation: false,
    gostSigningOrVerificationImplementation: false,
    networkClient: false,
    externalProviderCall: false,
    directDealLotOrSdizMutation: false,
    confirmedLiveClaim: false,
    productionDeployment: false,
    productionHosting: 'REG_RU_VPS_ONLY',
  },
  failures,
};

fs.mkdirSync(path.join(root, evidenceDir), { recursive: true });
fs.copyFileSync(
  path.join(root, 'scripts/p7-autopilot-guard.sh'),
  path.join(root, evidenceDir, 'p7-autopilot-guard.sh'),
);
fs.writeFileSync(
  path.join(root, evidenceDir, 'pc-crop-08d-acceptance.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
