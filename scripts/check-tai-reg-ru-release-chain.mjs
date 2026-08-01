#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { verifyWorkflowJobs } from './verify-tai-upstream-workflow-jobs.mjs';

const paths = {
  preflight: '.github/workflows/tai-reg-ru-preflight.yml',
  activation: '.github/workflows/tai-restricted-qwen-reg-ru-activation.yml',
  deployment: '.github/workflows/tai-reg-ru-deploy.yml',
};
const sources = Object.fromEntries(
  Object.entries(paths).map(([name, path]) => [name, readFileSync(path, 'utf8')]),
);
const autopilotState = JSON.parse(readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
const violations = [];
const requireFragment = (name, fragment) => {
  if (!sources[name].includes(fragment)) {
    violations.push(`${paths[name]}: missing ${JSON.stringify(fragment)}`);
  }
};
const forbid = (name, pattern, message) => {
  if (pattern.test(sources[name])) violations.push(`${paths[name]}: ${message}`);
};

const expectedScopeMappings = {
  'fix/tai-postgres-service-authority-20260801': [
    'scripts/tai-reg-ru-deploy.sh',
    'scripts/check-tai-reg-ru-deploy.mjs',
    'docs/platform-v7/autopilot/scopes/tai-postgres-authority-20260801.json',
  ],
  'fix/tai-reg-ru-release-chain-gate-20260801': [
    '.github/workflows/tai-reg-ru-preflight.yml',
    '.github/workflows/tai-restricted-qwen-reg-ru-activation.yml',
    '.github/workflows/tai-reg-ru-deploy.yml',
    'scripts/check-tai-reg-ru-release-chain.mjs',
    'scripts/verify-tai-upstream-workflow-jobs.mjs',
    'docs/platform-v7/autopilot/autopilot-state.json',
    'docs/platform-v7/autopilot/scopes/tai-reg-ru-release-chain-gate-20260801.json',
  ],
};
for (const [branch, expectedPaths] of Object.entries(expectedScopeMappings)) {
  const actualPaths = autopilotState?.approvedConcurrentScopes?.[branch];
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    violations.push(`docs/platform-v7/autopilot/autopilot-state.json: exact scope mapping missing for ${branch}`);
  }
}

for (const fragment of [
  'upstream_build_gate:',
  '[[ "$UPSTREAM_CONCLUSION" == success ]]',
  '[[ "$UPSTREAM_BRANCH" == main ]]',
  '[[ "$UPSTREAM_EVENT" == push ]]',
  'needs: upstream_build_gate',
  "if: needs.upstream_build_gate.result == 'success'",
  'sudo -n /usr/local/sbin/pc-tai-release-controller preflight',
  '[[ ! -r /etc/pc-release-authority/actions-runner.json ]]',
  "root:pcactions:750",
]) requireFragment('preflight', fragment);
forbid(
  'preflight',
  /open\(['"]\/etc\/pc-release-authority\/actions-runner[.]json/u,
  'the non-root runner must not read the protected root authority marker',
);

for (const fragment of [
  'upstream_preflight_gate:',
  'needs: upstream_preflight_gate',
  "if: needs.upstream_preflight_gate.result == 'success'",
  'actions: read',
  '/attempts/${UPSTREAM_RUN_ATTEMPT}/jobs?per_page=100',
  'node scripts/verify-tai-upstream-workflow-jobs.mjs',
  "'Exact-main REG.RU controller inventory'",
  "'Publish REG.RU preflight status'",
]) requireFragment('activation', fragment);

for (const fragment of [
  'upstream_activation_gate:',
  'needs: upstream_activation_gate',
  "if: needs.upstream_activation_gate.result == 'success'",
  'actions: read',
  '/attempts/${UPSTREAM_RUN_ATTEMPT}/jobs?per_page=100',
  'node scripts/verify-tai-upstream-workflow-jobs.mjs',
  "'Activate through protected REG.RU controller'",
  "'Hosted live public AI acceptance'",
  "'Finalize or roll back activation'",
  "'Publish restricted Qwen activation result'",
]) requireFragment('deployment', fragment);

for (const name of Object.keys(paths)) {
  requireFragment(name, 'node scripts/check-tai-reg-ru-release-chain.mjs');
  forbid(name, /continue-on-error:\s*true/mu, 'continue-on-error is forbidden');
  forbid(name, /pull_request_target:/u, 'pull_request_target is forbidden');
}

const requiredFixtureNames = ['gate', 'contract', 'mutation', 'acceptance', 'publish'];
const successfulJobs = requiredFixtureNames.map((name, index) => ({
  id: index + 1,
  name,
  status: 'completed',
  conclusion: 'success',
}));
verifyWorkflowJobs({ total_count: successfulJobs.length, jobs: successfulJobs }, requiredFixtureNames);
const expectBlocked = (label, report) => {
  try {
    verifyWorkflowJobs(report, requiredFixtureNames);
    violations.push(`workflow jobs fixture ${label} unexpectedly passed`);
  } catch {
    // Expected fail-closed result.
  }
};
expectBlocked('missing', { total_count: successfulJobs.length - 1, jobs: successfulJobs.slice(1) });
expectBlocked('skipped', { total_count: successfulJobs.length, jobs: successfulJobs.map((job) => job.name === 'mutation' ? { ...job, conclusion: 'skipped' } : job) });
expectBlocked('failed', { total_count: successfulJobs.length, jobs: successfulJobs.map((job) => job.name === 'acceptance' ? { ...job, conclusion: 'failure' } : job) });
expectBlocked('duplicate', { total_count: successfulJobs.length + 1, jobs: [...successfulJobs, { ...successfulJobs[2], id: 99 }] });
expectBlocked('malformed', []);
expectBlocked('truncated', { total_count: 101, jobs: successfulJobs });
expectBlocked('count-mismatch', { total_count: successfulJobs.length + 1, jobs: successfulJobs });

if (violations.length) {
  console.error('TAI REG.RU release-chain contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI REG.RU release-chain contract PASS: exact-run preflight and activation statuses are fail-closed before production jobs.');
