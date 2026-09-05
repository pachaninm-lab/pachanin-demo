import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const manifestPath = 'docs/platform-v7/autopilot/scopes/pc-crop-commercial-rules-authority-4997.json';
const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath), 'utf8'));

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function allowed(pathname) {
  return manifest.allowedPaths.some((pattern) =>
    pattern.endsWith('/**') ? pathname.startsWith(pattern.slice(0, -2)) : pathname === pattern);
}

test('scope is exact-head bound and excludes registration and accounting ownership', () => {
  assert.equal(manifest.branch, 'feat/pc-crop-commercial-rules-authority-4997');
  assert.equal(manifest.authorityBaseExactMain, '21894df096216be0b18fe61856b94f5089e92e0b');
  assert.equal(manifest.productionHosting, 'REG_RU_VPS_ONLY');
  assert.equal(manifest.newRecurringCostRub, 0);
  for (const entry of manifest.allowedPaths) {
    assert.doesNotMatch(entry, /(?:^|\/)(?:registration|role-eligibility|accounting)(?:\/|$)/u);
  }
});

test('recursive scope entries stay component-bounded', () => {
  assert.equal(allowed('apps/api/src/modules/commercial-rules/controller.ts'), true);
  assert.equal(allowed('apps/api/src/modules/commercial-rules-shadow/controller.ts'), false);
});

test('pull-request diff stays inside the declared contour', { skip: !process.env.PC_CROP_BASE_REF }, () => {
  const changed = execFileSync('git', ['diff', '--name-only', `${process.env.PC_CROP_BASE_REF}...HEAD`], {
    cwd: root, encoding: 'utf8',
  }).trim().split('\n').filter(Boolean);
  assert.deepEqual(changed.filter((entry) => !allowed(entry)), []);
});

test('pricing, payer and policy vocabularies are exact', () => {
  const domain = source('packages/domain-core/src/commercial-rules.ts');
  for (const model of ['FREE','SUBSCRIPTION','ACCESS_FEE','FIXED','PER_TON','PER_KM','PER_TRIP','PER_HOUR','PERCENT','SUCCESS_FEE','CAPPED_PERCENT','HYBRID','MANUAL_QUOTE']) {
    assert.match(domain, new RegExp(`'${model}'`, 'u'));
  }
  for (const payer of ['SELLER','BUYER','INITIATOR','DELIVERY_RESPONSIBLE','SPLIT','CONTRACT_RULE','REQUIRES_CONFIRMATION']) {
    assert.match(domain, new RegExp(`'${payer}'`, 'u'));
  }
  for (const kind of ['PRICING','PAYER','TRUST','AVAILABILITY','ELIGIBILITY']) {
    assert.match(domain, new RegExp(`'${kind}'`, 'u'));
  }
  assert.doesNotMatch(domain, /parseFloat|toFixed|Math\.round/u);
});

test('PostgreSQL owns immutable versions, decisions and tenant isolation', () => {
  const migration = source('apps/api/prisma/migrations/20260905010000_commercial_rules_authority/migration.sql');
  for (const table of ['commercial_rule_sets','commercial_rule_packs','commercial_decisions','commercial_rule_events']) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\."${table}" FORCE ROW LEVEL SECURITY;`, 'u'));
  }
  assert.match(migration, /PC_COMMERCIAL_VERSION_CONTENT_IMMUTABLE/u);
  assert.match(migration, /PC_COMMERCIAL_DECISION_IMMUTABLE/u);
  assert.match(migration, /PC_COMMERCIAL_DECISION_PACK_RULE_SET_MISMATCH/u);
  assert.match(migration, /PC_COMMERCIAL_RULE_SET_IN_USE/u);
  assert.match(migration, /PC_COMMERCIAL_EVENT_AUDIT_MISMATCH/u);
  assert.match(migration, /"status" = 'PUBLISHED' OR public\.app_organization_capability_is_org_admin\(\)/u);
  assert.match(migration, /commercial_rule_set_one_published_idx/u);
  assert.match(migration, /commercial_rule_pack_one_published_idx/u);
  assert.match(migration, /GRANT SELECT, INSERT ON public\."commercial_decisions" TO %I/u);
  assert.doesNotMatch(migration, /GRANT [^;]*(?:UPDATE|DELETE)[^;]*commercial_decisions/u);
});

test('commands use durable admin authority, CAS, idempotency, audit and outbox', () => {
  const repository = source('apps/api/src/modules/commercial-rules/commercial-rules.repository.ts');
  assert.match(repository, /app_organization_capability_is_org_admin/u);
  assert.match(repository, /pg_advisory_xact_lock/u);
  assert.match(repository, /requestFingerprint/u);
  assert.match(repository, /tx\.auditEvent\.create/u);
  assert.match(repository, /commercial_rule_events/u);
  assert.match(repository, /INSERT INTO public\."outbox_entries"/u);
  assert.match(repository, /TransactionIsolationLevel\.Serializable/u);
  assert.match(repository, /COMMERCIAL_RULE_SET_IN_USE/u);
});

test('decisions pin exact immutable authority and never create obligations', () => {
  const repository = source('apps/api/src/modules/commercial-rules/commercial-rules.repository.ts');
  const schema = source('apps/api/prisma/schema.prisma');
  for (const field of ['ruleSetVersion','ruleSetContentHash','rulePackVersion','rulePackContentHash','inputHash','outputHash']) {
    assert.match(schema, new RegExp(field, 'u'));
  }
  assert.match(repository, /createsFinancialObligation: false/u);
  assert.match(repository, /RULE_SET_NOT_PINNED_BY_PACK/u);
  assert.match(repository, /COMMERCIAL_DECISION_PAYLOAD_MISMATCH/u);
});
