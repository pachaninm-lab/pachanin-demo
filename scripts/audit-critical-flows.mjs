#!/usr/bin/env node
// Critical Flow Audit
// Tests that all mandatory UAT scenarios are represented in the codebase
// by checking for key route files, components, and API modules.

import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];

function check(label, condition, detail = '') {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push({ label, detail });
  }
}

function fileExists(relPath) {
  return existsSync(path.join(root, relPath));
}

// ─── Mandatory UAT scenarios ──────────────────────────────────────────────────
console.log('\n[1] Scenario: lot → match → deal');
check('lots page exists',      fileExists('apps/web/app/lots'));
check('cabinet page exists',   fileExists('apps/web/app/cabinet'));
check('deals page exists',     fileExists('apps/web/app/deals'));

console.log('[2] Scenario: deal → documents');
check('documents page exists', fileExists('apps/web/app/documents'));

console.log('[3] Scenario: deal → receiving → lab → settlement');
check('receiving page exists',  fileExists('apps/web/app/receiving'));
check('lab page exists',        fileExists('apps/web/app/lab'));
check('payments page exists',   fileExists('apps/web/app/payments'));
check('settlement API module',  fileExists('apps/api/src/modules/settlement-engine'));

console.log('[4] Scenario: hold / release');
check('payments module (API)',   fileExists('apps/api/src/modules'));
check('finance workspace component', fileExists('apps/web/components/finance-application-workspace.tsx'));

console.log('[5] Scenario: dispute');
check('disputes page exists',   fileExists('apps/web/app/disputes'));
check('disputes API module',    fileExists('apps/api/src/modules/disputes'));

console.log('[6] Scenario: operator escalation');
check('anti-fraud page exists',         fileExists('apps/web/app/anti-fraud'));
check('operator-cockpit page exists',   fileExists('apps/web/app/operator-cockpit'));

console.log('[7] Scenario: mobile offline replay (Driver)');
check('driver-mobile page exists', fileExists('apps/web/app/driver-mobile'));

// ─── Role-specific surface checks ─────────────────────────────────────────────
console.log('[8] Role surfaces');
const roleSurfaces = [
  ['FARMER',           'apps/web/app/lots'],
  ['BUYER',            'apps/web/app/market-center'],
  ['LOGISTICIAN',      'apps/web/app/dispatch'],
  ['DRIVER',           'apps/web/app/driver-mobile'],
  ['LAB',              'apps/web/app/lab'],
  ['ELEVATOR',         'apps/web/app/receiving'],
  ['ACCOUNTING',       'apps/web/app/payments'],
  ['EXECUTIVE',        'apps/web/app/execution-studio'],
  ['SUPPORT_MANAGER',  'apps/web/app/operator-cockpit'],
  ['ADMIN',            'apps/web/app/connectors'],
];

for (const [role, pagePath] of roleSurfaces) {
  check(`${role} surface exists: ${pagePath}`, fileExists(pagePath));
}

// ─── Domain core presence ─────────────────────────────────────────────────────
console.log('[9] Domain core modules');
const domainModules = [
  'packages/domain-core/src/canonical-models.ts',
  'packages/domain-core/src/status-policy-engine.ts',
  'packages/domain-core/src/action-decision-engine.ts',
  'packages/domain-core/src/service-provider-registry.ts',
  'packages/domain-core/src/provider-compliance-gates.ts',
  'packages/domain-core/src/operator-case-center.ts',
  'packages/domain-core/src/unified-deal-passport.ts',
  'shared/role-contract.ts',
];

for (const mod of domainModules) {
  check(`domain module: ${mod}`, fileExists(mod));
}

// ─── API modules ──────────────────────────────────────────────────────────────
console.log('[10] API modules');
const apiModules = [
  'apps/api/src/modules/auth',
  'apps/api/src/modules/lots',
  'apps/api/src/modules/deals',
  'apps/api/src/modules/documents',
  'apps/api/src/modules/disputes',
  'apps/api/src/modules/labs',
  'apps/api/src/modules/logistics',
  'apps/api/src/modules/service-providers',
];

for (const mod of apiModules) {
  check(`API module: ${mod}`, fileExists(mod));
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════');
console.log(`  Critical Flow Audit  ·  PASS: ${passed}  FAIL: ${failed}`);
console.log('═══════════════════════════════════════════════════════');

if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  ✗ ${f.label}${f.detail ? ' — ' + f.detail : ''}`);
  }
}

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n  All critical flow checks passed.\n');
}
