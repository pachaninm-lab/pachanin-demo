import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const branch = 'feat/pc-crop-inventory-reservation-authority-4997';
const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
const manifestPath = 'docs/platform-v7/autopilot/scopes/pc-crop-inventory-reservation-authority-4997.json';
const base = process.env.PC_CROP_BASE_REF;
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

test('inventory implementation has a finite, non-registration scope', () => {
  assert.equal(manifest.branch, branch);
  assert.equal(manifest.productionHosting, 'REG_RU_VPS_ONLY');
  assert.equal(manifest.newRecurringCostRub, 0);
  assert.equal(manifest.allowedPaths.length, 18);
  assert.equal(new Set(manifest.allowedPaths).size, 18);
  for (const path of manifest.allowedPaths) {
    assert.ok(!path.includes('*'));
    assert.doesNotMatch(path, /(?:registration|role-eligibility|accounting|lockfile|pnpm-lock|apps\/web)/u);
  }
});

test('changed files match approval loaded from the immutable base', { skip: !base }, () => {
  const state = JSON.parse(execFileSync('git', ['show', `${base}:${statePath}`], { encoding: 'utf8' }));
  const approved = state.approvedConcurrentScopes?.[branch];
  assert.deepEqual(approved, manifest.allowedPaths);
  const changed = execFileSync('git', ['diff', '--no-renames', '--name-only', `${base}...HEAD`], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  assert.deepEqual(changed.filter((path) => !approved.includes(path)), []);
  assert.ok(!changed.includes(manifestPath));
});

test('PostgreSQL acceptance is wired into the actual exploitation command', () => {
  const script = fs.readFileSync('scripts/platform-v7-one-deal-e2e.sh', 'utf8');
  assert.ok(script.includes('--runTestsByPath test/industrial/inventory-reservation-authority.e2e-spec.ts'));
  assert.ok(script.includes('GRANT EXECUTE ON FUNCTION inventory.execute_command(jsonb)'));
  const workflow = fs.readFileSync('.github/workflows/pc-crop-inventory.yml', 'utf8');
  assert.ok(workflow.includes('pg_dump'));
  assert.ok(workflow.includes('pg_restore'));
  assert.ok(workflow.includes('--exit-code'));
});
