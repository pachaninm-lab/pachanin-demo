#!/usr/bin/env node
import { selectTaiOwnerPreflightStatus } from './select-tai-owner-preflight-status.mjs';

const sha = '1'.repeat(40);
const repository = 'pachaninm-lab/pachanin-demo';
const status = (overrides = {}) => ({
  id: 100,
  context: 'TAI REG.RU Preflight',
  state: 'success',
  target_url: 'https://github.com/pachaninm-lab/pachanin-demo/actions/runs/30780893878',
  created_at: '2026-08-03T03:00:00Z',
  updated_at: '2026-08-03T03:00:01Z',
  ...overrides,
});
const report = (statuses, overrides = {}) => ({ sha, statuses, ...overrides });

const selected = selectTaiOwnerPreflightStatus(report([status()]), sha, repository);
if (selected.runId !== 30780893878 || selected.context !== 'TAI REG.RU Preflight') {
  throw new Error('Positive exact-status fixture did not select the expected preflight run.');
}

const expectBlocked = (label, value, targetSha = sha, repo = repository) => {
  try {
    selectTaiOwnerPreflightStatus(value, targetSha, repo);
    throw new Error(`${label} unexpectedly passed`);
  } catch (error) {
    if (error instanceof Error && error.message === `${label} unexpectedly passed`) throw error;
  }
};

expectBlocked('malformed-report', []);
expectBlocked('invalid-sha', report([status()]), 'bad');
expectBlocked('wrong-report-sha', report([status()], { sha: '2'.repeat(40) }));
expectBlocked('invalid-repository', report([status()]), sha, 'bad');
expectBlocked('missing-context', report([status({ context: 'Other' })]));
expectBlocked('latest-failure', report([
  status({ id: 101, state: 'failure', updated_at: '2026-08-03T03:01:00Z' }),
  status({ id: 100, state: 'success', updated_at: '2026-08-03T03:00:00Z' }),
]));
expectBlocked('foreign-repository-url', report([status({
  target_url: 'https://github.com/attacker/repo/actions/runs/30780893878',
})]));
expectBlocked('external-host', report([status({
  target_url: 'https://example.com/pachaninm-lab/pachanin-demo/actions/runs/30780893878',
})]));
expectBlocked('query-string', report([status({
  target_url: 'https://github.com/pachaninm-lab/pachanin-demo/actions/runs/30780893878?redirect=1',
})]));
expectBlocked('non-run-url', report([status({
  target_url: 'https://github.com/pachaninm-lab/pachanin-demo/actions',
})]));
expectBlocked('zero-run-id', report([status({
  target_url: 'https://github.com/pachaninm-lab/pachanin-demo/actions/runs/0',
})]));

const newerSuccess = selectTaiOwnerPreflightStatus(report([
  status({ id: 101, target_url: 'https://github.com/pachaninm-lab/pachanin-demo/actions/runs/30780893879', updated_at: '2026-08-03T03:01:00Z' }),
  status({ id: 100, target_url: 'https://github.com/pachaninm-lab/pachanin-demo/actions/runs/30780893878', updated_at: '2026-08-03T03:00:00Z' }),
]), sha, repository);
if (newerSuccess.runId !== 30780893879) {
  throw new Error('Newest successful exact-context status was not selected deterministically.');
}

console.log('TAI owner preflight commit-status selection PASS: latest exact context, exact SHA and canonical repository run URL are fail-closed.');
