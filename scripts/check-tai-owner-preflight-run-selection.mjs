#!/usr/bin/env node
import { selectTaiOwnerPreflightRun } from './select-tai-owner-preflight-run.mjs';

const SHA = '1'.repeat(40);
const valid = {
  name: 'TAI Owner REG.RU Preflight',
  head_sha: SHA,
  status: 'completed',
  conclusion: 'success',
  id: 42,
  run_attempt: 1,
  created_at: '2026-08-03T00:00:00Z',
  updated_at: '2026-08-03T00:01:00Z',
};
const violations = [];
const expectSelected = (label, runs, expectedId) => {
  try {
    const result = selectTaiOwnerPreflightRun({ workflow_runs: runs }, SHA);
    if (result.id !== expectedId) violations.push(`${label}: selected ${result.id}, expected ${expectedId}`);
  } catch (error) {
    violations.push(`${label}: unexpectedly blocked: ${error instanceof Error ? error.message : String(error)}`);
  }
};
const expectBlocked = (label, runs, sha = SHA) => {
  try {
    selectTaiOwnerPreflightRun({ workflow_runs: runs }, sha);
    violations.push(`${label}: unexpectedly selected a run`);
  } catch {
    // Expected fail-closed result.
  }
};

expectSelected('REST payload without optional repository/branch/event fields', [{ ...valid }], 42);
expectSelected('newest successful exact run wins', [
  { ...valid, id: 40, updated_at: '2026-08-03T00:00:30Z' },
  { ...valid, id: 43, run_attempt: 2, updated_at: '2026-08-03T00:02:00Z' },
], 43);
expectBlocked('wrong workflow name', [{ ...valid, name: 'TAI REG.RU Preflight' }]);
expectBlocked('wrong SHA', [{ ...valid, head_sha: '2'.repeat(40) }]);
expectBlocked('failed run', [{ ...valid, conclusion: 'failure' }]);
expectBlocked('incomplete run', [{ ...valid, status: 'in_progress', conclusion: null }]);
expectBlocked('invalid id', [{ ...valid, id: 0 }]);
expectBlocked('invalid attempt', [{ ...valid, run_attempt: 0 }]);
expectBlocked('malformed report', []);
expectBlocked('invalid requested SHA', [{ ...valid }], 'bad-sha');

if (violations.length) {
  console.error('TAI owner preflight run selection failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI owner preflight run selection PASS: exact successful run discovery tolerates omitted optional list metadata and remains fail-closed.');
