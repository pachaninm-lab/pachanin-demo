#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { verifyWorkflowJobs, verifyWorkflowRun } from './verify-tai-upstream-workflow-jobs.mjs';

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
    'scripts/pc-crop-10a/verify.mjs',
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
const pcCropScopeGuard = readFileSync('scripts/pc-crop-10a/verify.mjs', 'utf8');
for (const fragment of [
  'approvedConcurrentScopes',
  'GITHUB_HEAD_REF',
  'exact concurrent scope authority is missing',
  'concurrent scope map differs from scope authority',
  'PC-CROP-10A or an exact approved concurrent scope',
]) {
  if (!pcCropScopeGuard.includes(fragment)) {
    violations.push(`scripts/pc-crop-10a/verify.mjs: missing ${JSON.stringify(fragment)}`);
  }
}

for (const fragment of [
  'upstream_build_gate:',
  '[[ "$UPSTREAM_CONCLUSION" == success ]]',
  '[[ "$UPSTREAM_BRANCH" == main ]]',
  '[[ "$UPSTREAM_EVENT" == push ]]',
  '[[ "$UPSTREAM_REPOSITORY" == "$GITHUB_REPOSITORY" ]]',
  '[[ "$CONFIRMATION" == PREFLIGHT-TAI-REG-RU ]]',
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
  "group: tai-restricted-qwen-reg-ru-activation-${{ github.event.pull_request.number || 'production' }}",
  'needs: upstream_preflight_gate',
  "if: needs.upstream_preflight_gate.result == 'success'",
  'actions: read',
  "if: github.event_name == 'workflow_run'",
  'ref: ${{ github.event_name == \'pull_request\' && github.sha || github.event.repository.default_branch }}',
  '[[ "$UPSTREAM_REPOSITORY" == "$GITHUB_REPOSITORY" ]]',
  'inputs.upstream_run_id',
  'inputs.upstream_run_attempt',
  "[[ \"$CONFIRMATION\" == ACTIVATE-RESTRICTED-QWEN-REG-RU ]]",
  'node scripts/verify-tai-upstream-workflow-jobs.mjs --run',
  '/attempts/${UPSTREAM_RUN_ATTEMPT}/jobs?per_page=100',
  'node scripts/verify-tai-upstream-workflow-jobs.mjs --jobs',
  "'Exact-main REG.RU controller inventory'",
  "'Publish REG.RU preflight status'",
  "'Confirm REG.RU preflight chain result'",
]) requireFragment('activation', fragment);
forbid(
  'activation',
  /ref:\s*\$\{\{\s*github[.]event[.]workflow_run[.]head_sha/u,
  'workflow_run code must execute from the trusted default branch, not the upstream head SHA',
);

for (const fragment of [
  'upstream_activation_gate:',
  "group: tai-reg-ru-deployment-${{ github.event.pull_request.number || 'production' }}",
  'needs: upstream_activation_gate',
  "if: needs.upstream_activation_gate.result == 'success'",
  'actions: read',
  "if: github.event_name == 'workflow_run'",
  'ref: ${{ github.event_name == \'pull_request\' && github.sha || github.event.repository.default_branch }}',
  '[[ "$UPSTREAM_REPOSITORY" == "$GITHUB_REPOSITORY" ]]',
  'inputs.upstream_run_id',
  'inputs.upstream_run_attempt',
  "[[ \"$CONFIRMATION\" == DEPLOY-TAI-REG-RU ]]",
  'node scripts/verify-tai-upstream-workflow-jobs.mjs --run',
  '/attempts/${UPSTREAM_RUN_ATTEMPT}/jobs?per_page=100',
  'node scripts/verify-tai-upstream-workflow-jobs.mjs --jobs',
  "'Activate through protected REG.RU controller'",
  "'Hosted live public AI acceptance'",
  "'Finalize or roll back activation'",
  "'Publish restricted Qwen activation result'",
  "'Confirm restricted Qwen activation chain result'",
]) requireFragment('deployment', fragment);
forbid(
  'deployment',
  /ref:\s*\$\{\{\s*github[.]event[.]workflow_run[.]head_sha/u,
  'workflow_run code must execute from the trusted default branch, not the upstream head SHA',
);

for (const name of ['activation', 'deployment']) {
  const repositoryGate = sources[name].indexOf('Reject an untrusted upstream repository before checkout');
  const firstCheckout = sources[name].indexOf('- uses: actions/checkout@v4');
  if (repositoryGate < 0 || firstCheckout < 0 || repositoryGate > firstCheckout) {
    violations.push(`${paths[name]}: upstream repository authority must be validated before checkout`);
  }
}

for (const [name, fragment] of [
  ['preflight', 'name: Confirm REG.RU preflight chain result'],
  ['activation', 'name: Confirm restricted Qwen activation chain result'],
  ['deployment', 'name: Confirm standalone TAI deployment chain result'],
]) requireFragment(name, fragment);

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
const successfulRun = {
  name: 'TAI REG.RU Preflight',
  head_repository: { full_name: 'pachaninm-lab/pachanin-demo' },
  head_sha: '1'.repeat(40),
  head_branch: 'main',
  run_attempt: 2,
  status: 'completed',
  conclusion: 'success',
};
verifyWorkflowRun(successfulRun, '1'.repeat(40), '2', 'TAI REG.RU Preflight', 'pachaninm-lab/pachanin-demo');
const expectRunBlocked = (
  label,
  report,
  sha = '1'.repeat(40),
  attempt = '2',
  name = 'TAI REG.RU Preflight',
  repository = 'pachaninm-lab/pachanin-demo',
) => {
  try {
    verifyWorkflowRun(report, sha, attempt, name, repository);
    violations.push(`workflow run fixture ${label} unexpectedly passed`);
  } catch {
    // Expected fail-closed result.
  }
};
expectRunBlocked('wrong-name', { ...successfulRun, name: 'Other' });
expectRunBlocked('wrong-repository', { ...successfulRun, head_repository: { full_name: 'attacker/fork' } });
expectRunBlocked('wrong-sha', { ...successfulRun, head_sha: '2'.repeat(40) });
expectRunBlocked('wrong-branch', { ...successfulRun, head_branch: 'feature' });
expectRunBlocked('wrong-attempt', { ...successfulRun, run_attempt: 1 });
expectRunBlocked('incomplete', { ...successfulRun, status: 'in_progress', conclusion: null });
expectRunBlocked('failed', { ...successfulRun, conclusion: 'failure' });
expectRunBlocked('malformed-run', []);

if (violations.length) {
  console.error('TAI REG.RU release-chain contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI REG.RU release-chain contract PASS: exact workflow attempts and critical jobs are fail-closed before production jobs.');
