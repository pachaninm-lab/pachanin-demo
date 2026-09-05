import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const manifestPath = 'docs/platform-v7/autopilot/scopes/pc-crop-service-marketplace-authority-4997.json';
const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath), 'utf8'));

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function allowed(pathname) {
  return manifest.allowedPaths.some((pattern) =>
    pattern.endsWith('/**') ? pathname.startsWith(pattern.slice(0, -2)) : pathname === pattern);
}

test('scope is exact-head bound and excludes registration and accounting ownership', () => {
  assert.equal(manifest.branch, 'feat/pc-crop-service-marketplace-authority-4997');
  assert.equal(manifest.authorityBaseExactMain, '1088af896c07eafe96cce69753988fc05ac4c8aa');
  assert.equal(manifest.productionHosting, 'REG_RU_VPS_ONLY');
  assert.equal(manifest.newRecurringCostRub, 0);
  for (const entry of manifest.allowedPaths) {
    assert.doesNotMatch(entry, /(?:^|\/)(?:registration|role-eligibility|accounting)(?:\/|$)/u);
  }
});

test('recursive scope entries stay component-bounded', () => {
  assert.equal(allowed('apps/api/src/modules/service-marketplace/controller.ts'), true);
  assert.equal(allowed('apps/api/src/modules/service-marketplace-shadow/controller.ts'), false);
});

test('pull-request diff stays inside the declared contour', { skip: !process.env.PC_CROP_BASE_REF }, () => {
  const changed = execFileSync('git', ['diff', '--name-only', `${process.env.PC_CROP_BASE_REF}...HEAD`], {
    cwd: root,
    encoding: 'utf8',
  }).trim().split('\n').filter(Boolean);
  assert.deepEqual(changed.filter((entry) => !allowed(entry)), []);
});

test('lifecycle and commands are exact and payer consent is a distinct state', () => {
  const domain = source('packages/domain-core/src/service-marketplace.ts');
  for (const status of [
    'REQUESTED', 'QUOTED', 'PROVIDER_SELECTED', 'PAYER_ASSIGNED', 'PAYER_CONFIRMED',
    'EXECUTING', 'EVIDENCE_SUBMITTED', 'ACCEPTED', 'SETTLEMENT_RECORDED',
  ]) assert.match(domain, new RegExp(`'${status}'`, 'u'));
  for (const action of [
    'CREATE_REQUEST', 'SUBMIT_QUOTE', 'SELECT_PROVIDER', 'ASSIGN_PAYER', 'CONFIRM_PAYER',
    'START_EXECUTION', 'SUBMIT_EVIDENCE', 'ACCEPT_SERVICE', 'RECORD_SETTLEMENT',
  ]) assert.match(domain, new RegExp(`'${action}'`, 'u'));
  assert.match(domain, /ASSIGN_PAYER: \{ from: \['PROVIDER_SELECTED', 'PAYER_ASSIGNED'\], to: 'PAYER_ASSIGNED' \}/u);
  assert.match(domain, /CONFIRM_PAYER: \{ from: \['PAYER_ASSIGNED'\], to: 'PAYER_CONFIRMED' \}/u);
});

test('PostgreSQL owns participant authority, immutable quotes and lifecycle evidence', () => {
  const migration = source('apps/api/prisma/migrations/20260905030000_service_marketplace_authority/migration.sql');
  for (const table of ['service_marketplace_requests', 'service_marketplace_quotes', 'service_marketplace_events']) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\."${table}" FORCE ROW LEVEL SECURITY;`, 'u'));
  }
  assert.match(migration, /PC_SERVICE_QUOTE_IMMUTABLE/u);
  assert.match(migration, /PC_SERVICE_REQUEST_EVIDENCE_REQUIRED/u);
  assert.match(migration, /PC_SERVICE_EVENT_AUDIT_MISMATCH/u);
  assert.match(migration, /outbox_entries_service_marketplace_insert/u);
  assert.match(migration, /SECURITY DEFINER SET search_path = pg_catalog, public/u);
  assert.match(migration, /GRANT SELECT, INSERT ON public\."service_marketplace_events" TO %I/u);
  assert.doesNotMatch(migration, /GRANT [^;]*(?:UPDATE|DELETE)[^;]*service_marketplace_events/u);
});

test('commands use CAS, payload-bound replay, audit and outbox atomically', () => {
  const repository = source('apps/api/src/modules/service-marketplace/service-marketplace.repository.ts');
  assert.match(repository, /pg_advisory_xact_lock/u);
  assert.match(repository, /requestFingerprint/u);
  assert.match(repository, /"stateVersion" = "stateVersion" \+ 1/u);
  assert.match(repository, /tx\.auditEvent\.create/u);
  assert.match(repository, /INSERT INTO public\."service_marketplace_events"/u);
  assert.match(repository, /INSERT INTO public\."outbox_entries"/u);
  assert.match(repository, /TransactionIsolationLevel\.Serializable/u);
  assert.match(repository, /SET CONSTRAINTS service_marketplace_request_evidence_guard IMMEDIATE/u);
});

test('quotes pin verified offerings and settlement stays non-financial', () => {
  const migration = source('apps/api/prisma/migrations/20260905030000_service_marketplace_authority/migration.sql');
  const repository = source('apps/api/src/modules/service-marketplace/service-marketplace.repository.ts');
  const contract = source('apps/api/src/modules/service-marketplace/service-marketplace.contract.ts');
  for (const field of ['serviceOfferingId', 'serviceOfferingVersion', 'commercialDecisionId', 'termsHash']) {
    assert.match(contract, new RegExp(field, 'u'));
  }
  assert.match(migration, /offering_row\."status" <> 'ACTIVE'/u);
  assert.match(migration, /capability\."status" = 'ACTIVE' AND provider\."status" = 'ACTIVE'/u);
  assert.match(migration, /selected_quote\."expiresAt" <= clock_timestamp\(\)/u);
  assert.match(repository, /createsFinancialObligation: false/u);
  assert.doesNotMatch(repository, /accounting_(?:obligations|payments|advances)|ledger_entries/iu);
});
