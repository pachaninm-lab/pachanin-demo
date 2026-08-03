#!/usr/bin/env node
import { selectTaiRestrictedQwenActivationStatus } from './select-tai-restricted-qwen-activation-status.mjs';

const sha = '1'.repeat(40);
const repository = 'pachaninm-lab/pachanin-demo';
const status = (overrides = {}) => ({
  id: 100,
  context: 'TAI Restricted Qwen REG.RU Activation',
  state: 'success',
  target_url: 'https://github.com/pachaninm-lab/pachanin-demo/actions/runs/30789592504',
  created_at: '2026-08-03T06:20:00Z',
  updated_at: '2026-08-03T06:20:01Z',
  ...overrides,
});
const report = (statuses, overrides = {}) => ({ sha, statuses, ...overrides });

const selected = selectTaiRestrictedQwenActivationStatus(report([status()]), sha, repository);
if (selected.runId !== 30789592504 || selected.context !== 'TAI Restricted Qwen REG.RU Activation') {
  throw new Error('Positive exact activation-status fixture did not select the expected run.');
}

const expectBlocked = (label, value, targetSha = sha, repo = repository) => {
  try {
    selectTaiRestrictedQwenActivationStatus(value, targetSha, repo);
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
  status({ id: 101, state: 'failure', updated_at: '2026-08-03T06:21:00Z' }),
  status({ id: 100, state: 'success', updated_at: '2026-08-03T06:20:00Z' }),
]));
expectBlocked('foreign-repository-url', report([status({
  target_url: 'https://github.com/attacker/repo/actions/runs/30789592504',
})]));
expectBlocked('external-host', report([status({
  target_url: 'https://example.com/pachaninm-lab/pachanin-demo/actions/runs/30789592504',
})]));
expectBlocked('query-string', report([status({
  target_url: 'https://github.com/pachaninm-lab/pachanin-demo/actions/runs/30789592504?x=1',
})]));
expectBlocked('non-run-url', report([status({
  target_url: 'https://github.com/pachaninm-lab/pachanin-demo/actions',
})]));
expectBlocked('zero-run-id', report([status({
  target_url: 'https://github.com/pachaninm-lab/pachanin-demo/actions/runs/0',
})]));

const newest = selectTaiRestrictedQwenActivationStatus(report([
  status({ id: 101, target_url: 'https://github.com/pachaninm-lab/pachanin-demo/actions/runs/30789592505', updated_at: '2026-08-03T06:21:00Z' }),
  status({ id: 100, target_url: 'https://github.com/pachaninm-lab/pachanin-demo/actions/runs/30789592504', updated_at: '2026-08-03T06:20:00Z' }),
]), sha, repository);
if (newest.runId !== 30789592505) throw new Error('Newest successful activation status was not selected.');

console.log('TAI owner deployment status selection PASS: latest exact activation status and canonical repository run URL are fail-closed.');
