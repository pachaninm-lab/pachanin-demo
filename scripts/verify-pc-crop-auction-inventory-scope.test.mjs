import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const branch = 'feat/pc-crop-auction-inventory-authority-4997';
const acceptedScopeSha = '3f7eacf1a2a9cba7a9b7019a04d7b9b418f610be';
const manifestPath = 'docs/platform-v7/autopilot/scopes/pc-crop-auction-inventory-authority-4997.json';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const approved = JSON.parse(git('show', `${acceptedScopeSha}:${manifestPath}`));
const base = process.env.PC_CROP_BASE_REF;

test('Auction inventory scope comes from its independently merged finite approval', () => {
  assert.equal(approved.branch, branch);
  assert.equal(approved.productionHosting, 'REG_RU_VPS_ONLY');
  assert.equal(approved.newRecurringCostRub, 0);
  assert.equal(approved.terminalCredit, 0);
  assert.equal(approved.allowedPaths.length, 19);
  assert.equal(new Set(approved.allowedPaths).size, 19);
  for (const path of approved.allowedPaths) {
    assert.doesNotMatch(path, /\*|(?:^|\/)\.\.(?:\/|$)|\\/u);
    assert.doesNotMatch(path, /registration|role-eligibility|accounting|lockfile|pnpm-lock|apps\/web/u);
  }
  assert.deepEqual(JSON.parse(readFileSync(manifestPath, 'utf8')), approved);
  if (process.env.GITHUB_HEAD_REF === branch) assert.match(base ?? '', /^[a-f0-9]{40}$/u);
});

test('actual diff cannot authorize itself or exceed immutable approved paths', { skip: !base }, () => {
  assert.match(base, /^[a-f0-9]{40}$/u);
  git('merge-base', '--is-ancestor', acceptedScopeSha, base);
  assert.deepEqual(JSON.parse(git('show', `${base}:${manifestPath}`)), approved);
  const changed = git('diff', '--no-renames', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean);
  assert.deepEqual(changed.filter((path) => !approved.allowedPaths.includes(path)), []);
  assert.ok(!changed.includes(manifestPath));
});

test('restricted PostgreSQL, preserved-owner restore and shared exploitation remain blocking', () => {
  const workflow = readFileSync('.github/workflows/auction-atomic-acceptance.yml', 'utf8');
  const shared = readFileSync('scripts/platform-v7-one-deal-e2e.sh', 'utf8');
  assert.ok(workflow.includes('AUCTION_INVENTORY_RESTORE_PROOF'));
  assert.ok(workflow.includes('inventory-restore-jest.json'));
  assert.ok(workflow.includes('pg_dump'));
  assert.ok(workflow.includes('pg_restore --exit-on-error'));
  assert.doesNotMatch(workflow, /--no-owner|--no-acl|continue-on-error:\s*true|\|\|\s*true/u);
  assert.ok(shared.includes('--runTestsByPath test/industrial/auction-inventory-authority.e2e-spec.ts'));
  assert.ok(shared.includes('GRANT EXECUTE ON FUNCTION auction.register_inventory_lot(jsonb)'));
});
