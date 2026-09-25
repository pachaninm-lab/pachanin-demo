import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const manifestPath = 'docs/platform-v7/autopilot/scopes/pc-crop-provider-registry-authority-4997.json';
const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath), 'utf8'));

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function allowed(pathname) {
  return manifest.allowedPaths.some((pattern) =>
    pattern.endsWith('/**') ? pathname.startsWith(pattern.slice(0, -3)) : pathname === pattern);
}

test('scope is exact-main bound and excludes registration authority', () => {
  assert.equal(manifest.branch, 'feat/pc-crop-provider-registry-authority-4997');
  assert.match(manifest.authorityBaseExactMain, /^[0-9a-f]{40}$/u);
  assert.equal(manifest.productionHosting, 'REG_RU_VPS_ONLY');
  assert.equal(manifest.newRecurringCostRub, 0);
  for (const entry of manifest.allowedPaths) {
    assert.doesNotMatch(entry, /(?:^|\/)(?:registration|role-eligibility)(?:\/|$)/u);
  }
});

test('pull-request diff stays inside the declared contour', { skip: !process.env.PC_CROP_BASE_REF }, () => {
  const changed = execFileSync(
    'git',
    ['diff', '--name-only', `${process.env.PC_CROP_BASE_REF}...HEAD`],
    { cwd: root, encoding: 'utf8' },
  ).trim().split('\n').filter(Boolean);
  assert.deepEqual(changed.filter((entry) => !allowed(entry)), []);
});

test('fictional catalog, default bank and client evidence authority are absent', () => {
  const domain = source('packages/domain-core/src/service-provider-registry.ts');
  const service = source('apps/api/src/modules/service-providers/service-providers.service.ts');
  const controller = source('apps/api/src/modules/service-providers/service-providers.controller.ts');
  const combined = `${domain}\n${service}\n${controller}`;
  for (const forbidden of [
    'prov-bank-sber',
    'ТамбовЛогистик',
    'СберБизнес',
    'АгроСтрах',
    'ФедЛаб',
    "@Query('labAccreditation')",
    "@Query('bankWhitelist') bankWhitelist",
    "@Query('legalRole')",
    'as ProviderRegistryEvidence',
  ]) {
    assert.equal(combined.includes(forbidden), false, `forbidden authority remains: ${forbidden}`);
  }
  assert.match(service, /bankDefault: null/u);
  assert.match(service, /evidenceAuthority: 'SERVER_REGISTRY'/u);
});

test('all provider authority tables use forced RLS and app evidence is select-only', () => {
  const migration = source(
    'apps/api/prisma/migrations/20260904210000_provider_registry_authority/migration.sql',
  );
  for (const table of [
    'providers',
    'provider_capabilities',
    'service_offerings',
    'provider_registry_evidence',
    'provider_registry_events',
  ]) {
    assert.match(
      migration,
      new RegExp(`ALTER TABLE public\\."${table}" FORCE ROW LEVEL SECURITY;`, 'u'),
    );
  }
  assert.match(
    migration,
    /GRANT SELECT ON public\."provider_registry_evidence" TO %I/u,
  );
  assert.doesNotMatch(
    migration,
    /GRANT [^;]*(?:INSERT|UPDATE|DELETE)[^;]*provider_registry_evidence/u,
  );
  assert.match(migration, /PC_PROVIDER_CAPABILITY_SELF_ACTIVATION_FORBIDDEN/u);
  assert.match(migration, /PC_SERVICE_OFFERING_SELF_ACTIVATION_FORBIDDEN/u);
});

test('commands require PostgreSQL organization capability and atomic evidence', () => {
  const repository = source(
    'apps/api/src/modules/service-providers/provider-registry.repository.ts',
  );
  assert.match(repository, /organization_capability_assignments/u);
  assert.match(repository, /ORGANIZATION_CAPABILITY_REQUIRED/u);
  assert.match(repository, /tx\.auditEvent\.create/u);
  assert.match(repository, /provider_registry_events/u);
  assert.match(repository, /INSERT INTO public\."outbox_entries"/u);
  assert.match(repository, /TransactionIsolationLevel\.Serializable/u);
});
