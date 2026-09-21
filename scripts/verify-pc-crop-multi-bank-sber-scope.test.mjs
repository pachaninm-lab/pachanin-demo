import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

const domain = read('packages/domain-core/src/bank-capability.ts');
const port = read('apps/api/src/modules/bank-adapters/bank-adapter.port.ts');
const router = read('apps/api/src/modules/bank-adapters/bank-capability.router.ts');
const receipt = read('apps/api/src/modules/bank-adapters/bank-receipt.contract.ts');
const sber = read('apps/api/src/modules/bank-adapters/sber-reference.adapter.ts');
const alfa = read('apps/api/src/modules/bank-adapters/alfa-reference.adapter.ts');
const tbank = read('apps/api/src/modules/bank-adapters/tbank-reference.adapter.ts');
const workflow = read('.github/workflows/pc-crop-multi-bank-sber.yml');
const envExample = read('config/integration/integration.env.example');
const webProviderRegistry = read('apps/web/lib/platform-v7/integrations/providerRegistry.ts');
const webSberProxy = read('apps/web/lib/sber-server.ts');

for (const forbidden of ['SBER', 'ALFA_BANK', 'T_BANK', 'BANK_PROVIDER', 'bankRef', 'partnerId']) {
  assert.equal(domain.includes(forbidden), false, 'domain core leaked provider vocabulary: ' + forbidden);
}

for (const marker of [
  'SAFE_DEAL_RESERVE_RELEASE',
  'DIRECT_PAYMENT',
  'BILLING',
  'FINANCING_APPLICATION',
  'STATEMENT_READ',
  'STATUS_READ',
  'AUTHENTICATED_CALLBACK',
  'RECONCILIATION',
]) assert.ok(domain.includes(marker), 'missing domain capability ' + marker);

for (const marker of [
  'ACCEPTED_NONFINAL',
  "canonicalFinality: 'NOT_DECIDED_HERE'",
  'REFERENCE_CONFORMANCE_ONLY',
  'liveRequestReady: false',
  'buildReferenceRequestEnvelope',
  'BANK_CAPABILITY_NOT_SUPPORTED',
  'mapReferenceDispatch',
  'buildReceiptCandidate',
  'currency: normalized.currency',
  'sourceVersion: normalized.sourceVersion',
]) assert.ok(port.includes(marker), 'missing adapter-port boundary ' + marker);

for (const marker of [
  'SERVER_HELD_PROVIDER_BINDING_REQUIRED',
  'SERVER_HELD_MATURITY_DOES_NOT_ALLOW_REAL_TRAFFIC',
  'REFERENCE_ADAPTER_HAS_NO_LIVE_TRANSPORT',
  'CREDENTIAL_OR_CALLBACK_TRUST_NOT_VERIFIED',
  'PRODUCTION_ENVIRONMENT_NOT_CONFIRMED',
  'productionEnvironmentConfirmed',
  'SERVER_HELD_CAPABILITY_NOT_AUTHORIZED',
  'authorizedBankCapabilities',
  '!authority.capabilityCode.trim()',
  "authority.maturity !== 'LIVE_ACCEPTED'",
  'authority.mayCarryRealTraffic !== true',
  'authority.productionEnvironmentConfirmed !== true',
]) assert.ok(router.includes(marker), 'missing routing boundary ' + marker);

for (const marker of [
  'PENDING_RECONCILIATION',
  'PROVIDER_EVENT_REPLAY',
  'PAYLOAD_REPLAY',
  'EXTERNAL_RECEIPT_REPLAY',
  'alreadyConsumedExternalReceiptIds',
  'AUTHENTICATION_EVIDENCE_MISSING',
  'AUTHENTICATION_AUTHORITY_MISMATCH',
  'IDEMPOTENCY_MISMATCH',
  'READY_FOR_CANONICAL_RECONCILIATION',
]) assert.ok(receipt.includes(marker), 'missing receipt boundary ' + marker);

assert.ok(sber.includes('readonly liveTransportImplemented = false'));
assert.ok(sber.includes("status === 'DONE'"));
assert.ok(sber.includes("status === 'CREATED' || status === 'PENDING'"));
assert.ok(alfa.includes("'UNKNOWN_EVIDENCE'"));
assert.ok(alfa.includes('no pinned exact Alfa status schema/hash'));
assert.ok(tbank.includes("status === 'PAYMENT_FAILED'"));
assert.ok(tbank.includes("'BILLING'"));
assert.ok(tbank.includes("'FINANCING_APPLICATION'"));

assert.ok(envExample.includes('BANK_MODE='));
assert.ok(envExample.includes('BANK_PROVIDER='));
assert.ok(webProviderRegistry.length > 0);
assert.ok(webSberProxy.length > 0);

const authoritySources = [port, router, receipt].join('\n');
for (const forbidden of [
  'process.env.BANK_MODE',
  'process.env.BANK_PROVIDER',
  'providerRegistry.ts',
  'sber-server.ts',
  'localStorage',
  'sessionStorage',
]) assert.equal(authoritySources.includes(forbidden), false, 'non-authoritative source leaked into bank authority: ' + forbidden);

for (const source of [sber, alfa, tbank]) {
  assert.ok(source.includes('buildReferenceRequestEnvelope'));
  assert.ok(source.includes('mapReferenceDispatch'));
  assert.ok(source.includes('buildReceiptCandidate'));
  assert.doesNotMatch(source, /fetch\s*\(/u);
  assert.doesNotMatch(source, /axios/u);
  assert.doesNotMatch(source, /process\.env/u);
  assert.doesNotMatch(source, /mock/i);
}

assert.doesNotMatch(router, /session/i);

for (const marker of [
  'name: PC-CROP Multi-Bank Reference Adapter Acceptance',
  'pnpm exec vitest run packages/domain-core/src/bank-capability.test.ts',
  'bank-capability.router.spec.ts',
  'bank-receipt.contract.spec.ts',
  'sber-reference.adapter.spec.ts',
  'alfa-reference.adapter.spec.ts',
  'tbank-reference.adapter.spec.ts',
  'multi-bank-reference-adapter.e2e-spec.ts',
  'verify-pc-crop-multi-bank-sber-scope.test.mjs',
]) assert.ok(workflow.includes(marker), 'missing workflow marker ' + marker);

assert.doesNotMatch(workflow, /continue-on-error/u);
assert.doesNotMatch(workflow, /BANK_MODE/u);
assert.doesNotMatch(workflow, /BANK_PROVIDER/u);
assert.doesNotMatch(workflow, /secrets\./u);

console.log('PC-CROP multi-bank reference scope contract PASS');
