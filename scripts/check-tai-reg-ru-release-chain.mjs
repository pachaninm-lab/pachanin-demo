#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { verifyWorkflowJobs, verifyWorkflowRun } from './verify-tai-upstream-workflow-jobs.mjs';

const paths = {
  preflight: '.github/workflows/tai-reg-ru-preflight.yml',
  command: '.github/workflows/tai-owner-qwen-activation-command.yml',
  activation: '.github/workflows/tai-restricted-qwen-reg-ru-activation.yml',
  deployment: '.github/workflows/tai-reg-ru-deploy.yml',
};
const sources = Object.fromEntries(
  Object.entries(paths).map(([name, path]) => [name, readFileSync(path, 'utf8')]),
);
const autopilotState = JSON.parse(readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
const violations = [];
const requireFragment = (name, fragment) => {
  if (!sources[name].includes(fragment)) violations.push(`${paths[name]}: missing ${JSON.stringify(fragment)}`);
};
const forbid = (name, pattern, message) => {
  if (pattern.test(sources[name])) violations.push(`${paths[name]}: ${message}`);
};

const productionLifecycleGroup = 'pc-crop-registration-lifecycle';
const lifecycleConcurrencyBlock = (pullRequestGroup) => [
  'concurrency:',
  `  group: \${{ github.event_name == 'pull_request' && format('${pullRequestGroup}-pr-{0}', github.event.pull_request.number) || '${productionLifecycleGroup}' }}`,
  '  cancel-in-progress: false',
  '  queue: max',
].join('\n');
const verifyLifecycleConcurrency = (source, pullRequestGroup) => {
  const errors = [];
  const blocks = [...source.matchAll(/^concurrency:\r?\n((?:^[ \t].*(?:\r?\n|$))*)/gmu)];
  if (blocks.length !== 1) {
    errors.push(`expected exactly one top-level concurrency block, found ${blocks.length}`);
    return errors;
  }
  const actual = `concurrency:\n${blocks[0][1].replaceAll('\r\n', '\n').trimEnd()}`;
  const expected = lifecycleConcurrencyBlock(pullRequestGroup);
  if (actual !== expected) {
    errors.push('concurrency must use one exact production lifecycle group, a distinct per-PR group, non-cancelling FIFO semantics and queue max');
  }
  return errors;
};
const requireLifecycleConcurrency = (name, pullRequestGroup) => {
  for (const error of verifyLifecycleConcurrency(sources[name], pullRequestGroup)) {
    violations.push(`${paths[name]}: ${error}`);
  }
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
  if (JSON.stringify(autopilotState?.approvedConcurrentScopes?.[branch]) !== JSON.stringify(expectedPaths)) {
    violations.push(`docs/platform-v7/autopilot/autopilot-state.json: exact scope mapping missing for ${branch}`);
  }
}
const pcCropScopeGuard = readFileSync('scripts/pc-crop-10a/verify.mjs', 'utf8');
for (const fragment of [
  'approvedConcurrentScopes', 'GITHUB_HEAD_REF', 'exact concurrent scope authority is missing',
  'concurrent scope map differs from scope authority', 'PC-CROP-10A or an exact approved concurrent scope',
]) {
  if (!pcCropScopeGuard.includes(fragment)) violations.push(`scripts/pc-crop-10a/verify.mjs: missing ${JSON.stringify(fragment)}`);
}

for (const fragment of [
  'upstream_build_gate:', '[[ "$UPSTREAM_CONCLUSION" == success ]]', '[[ "$UPSTREAM_BRANCH" == main ]]',
  '[[ "$UPSTREAM_EVENT" == push ]]', '[[ "$UPSTREAM_REPOSITORY" == "$GITHUB_REPOSITORY" ]]',
  '[[ "$CONFIRMATION" == PREFLIGHT-TAI-REG-RU ]]', 'needs: upstream_build_gate',
  "if: needs.upstream_build_gate.result == 'success'", 'sudo -n /usr/local/sbin/pc-tai-release-controller preflight',
  '[[ ! -r /etc/pc-release-authority/actions-runner.json ]]', 'root:pcactions:750',
]) requireFragment('preflight', fragment);
forbid('preflight', /open\(['"]\/etc\/pc-release-authority\/actions-runner[.]json/u,
  'the non-root runner must not read the protected root authority marker');

for (const fragment of [
  'name: TAI Owner Qwen Activation Command', 'issue_comment:', 'github.event.issue.number == 3365',
  "github.event.comment.body == '/tai activate current-main'", '[[ "$COMMENTER" == "$OWNER" ]]',
  '[[ "$ACTOR" == "$OWNER" ]]', '[[ "$TRIGGERING_ACTOR" == "$OWNER" ]]',
  'commits/${target_sha}/status', 'node scripts/select-tai-owner-preflight-status.mjs',
  'node scripts/verify-tai-upstream-workflow-jobs.mjs --run',
  'node scripts/verify-tai-upstream-workflow-jobs.mjs --jobs', 'permissions:\n      actions: write',
  'actions/workflows/tai-restricted-qwen-reg-ru-activation.yml/dispatches',
  "'confirmation':'ACTIVATE-RESTRICTED-QWEN-REG-RU'", 'event=workflow_dispatch&branch=main&per_page=30',
  'activation_run_id=$activation_run_id', 'issues: write', 'name: Publish redacted terminal command evidence',
  'name: Confirm owner activation dispatch',
]) requireFragment('command', fragment);
forbid('command', /actions\/workflows\/tai-reg-ru-preflight-owner-command[.]yml\/runs\?/u,
  'owner activation must resolve preflight from exact commit status, not workflow-list discovery');

for (const fragment of [
  'workflow_dispatch:', 'upstream_preflight_gate:',
  'TARGET_SHA: ${{ inputs.target_sha }}', 'UPSTREAM_RUN_ID: ${{ inputs.upstream_run_id }}',
  'UPSTREAM_RUN_ATTEMPT: ${{ inputs.upstream_run_attempt }}', '[[ "$EVENT_NAME" == workflow_dispatch ]]',
  '[[ "$CURRENT_REF" == refs/heads/main ]]', '[[ "$CONFIRMATION" == ACTIVATE-RESTRICTED-QWEN-REG-RU ]]',
  "[[ \"$ACTOR\" == 'github-actions[bot]' ]]", "[[ \"$TRIGGERING_ACTOR\" == 'github-actions[bot]' ]]",
  'node scripts/verify-tai-upstream-workflow-jobs.mjs --run',
  '/attempts/${UPSTREAM_RUN_ATTEMPT}/jobs?per_page=100',
  'node scripts/verify-tai-upstream-workflow-jobs.mjs --jobs',
  "'Exact-main REG.RU controller inventory'", "'Publish REG.RU preflight status'",
  "'Confirm REG.RU preflight chain result'", 'needs: [upstream_preflight_gate, contract]',
]) requireFragment('activation', fragment);
requireLifecycleConcurrency('activation', 'tai-restricted-qwen-reg-ru-activation');
forbid('activation', /^\s{2}issue_comment:/mu, 'production activation must not listen to issue_comment');
forbid('activation', /^\s{2}workflow_run:/mu, 'production activation must not listen to workflow_run');

for (const fragment of [
  'upstream_activation_gate:',
  'needs: upstream_activation_gate', "if: needs.upstream_activation_gate.result == 'success'", 'actions: read',
  "if: github.event_name == 'workflow_run'",
  'ref: ${{ github.event_name == \'pull_request\' && github.sha || github.event.repository.default_branch }}',
  '[[ "$UPSTREAM_REPOSITORY" == "$GITHUB_REPOSITORY" ]]', 'inputs.upstream_run_id',
  'inputs.upstream_run_attempt', "[[ \"$CONFIRMATION\" == DEPLOY-TAI-REG-RU ]]",
  'node scripts/verify-tai-upstream-workflow-jobs.mjs --run',
  '/attempts/${UPSTREAM_RUN_ATTEMPT}/jobs?per_page=100',
  'node scripts/verify-tai-upstream-workflow-jobs.mjs --jobs',
  "'Activate through protected REG.RU controller'", "'Hosted live public AI acceptance'",
  "'Finalize or roll back activation'", "'Publish restricted Qwen activation result'",
  "'Confirm restricted Qwen activation chain result'",
]) requireFragment('deployment', fragment);
requireLifecycleConcurrency('deployment', 'tai-reg-ru-deployment');
forbid('deployment', /ref:\s*\$\{\{\s*github[.]event[.]workflow_run[.]head_sha/u,
  'workflow_run code must execute from the trusted default branch, not the upstream head SHA');
const repositoryGate = sources.deployment.indexOf('Reject an untrusted upstream repository before checkout');
const firstCheckout = sources.deployment.indexOf('- uses: actions/checkout@v4');
if (repositoryGate < 0 || firstCheckout < 0 || repositoryGate > firstCheckout) {
  violations.push(`${paths.deployment}: upstream repository authority must be validated before checkout`);
}

for (const [name, fragment] of [
  ['preflight', 'name: Confirm REG.RU preflight chain result'],
  ['command', 'name: Confirm owner activation dispatch'],
  ['activation', 'name: Confirm restricted Qwen activation chain result'],
  ['deployment', 'name: Confirm standalone TAI deployment chain result'],
]) requireFragment(name, fragment);
for (const name of Object.keys(paths)) {
  forbid(name, /continue-on-error:\s*true/mu, 'continue-on-error is forbidden');
  forbid(name, /pull_request_target:/u, 'pull_request_target is forbidden');
}
for (const name of ['preflight', 'command', 'activation', 'deployment']) {
  requireFragment(name, 'node scripts/check-tai-reg-ru-release-chain.mjs');
}

const validConcurrencyFixture = lifecycleConcurrencyBlock('fixture');
if (verifyLifecycleConcurrency(validConcurrencyFixture, 'fixture').length !== 0) {
  violations.push('valid lifecycle concurrency fixture unexpectedly failed');
}
const expectConcurrencyBlocked = (label, source, pullRequestGroup = 'fixture') => {
  if (verifyLifecycleConcurrency(source, pullRequestGroup).length === 0) {
    violations.push(`lifecycle concurrency fixture ${label} unexpectedly passed`);
  }
};
expectConcurrencyBlocked('legacy-activation-production-group', [
  'concurrency:',
  "  group: tai-restricted-qwen-reg-ru-activation-${{ github.event.pull_request.number || 'production' }}",
  '  cancel-in-progress: false',
  '  queue: max',
].join('\n'), 'tai-restricted-qwen-reg-ru-activation');
expectConcurrencyBlocked('legacy-deployment-production-group', [
  'concurrency:',
  "  group: tai-reg-ru-deployment-${{ github.event.pull_request.number || 'production' }}",
  '  cancel-in-progress: false',
  '  queue: max',
].join('\n'), 'tai-reg-ru-deployment');
expectConcurrencyBlocked(
  'dynamic-production-group',
  validConcurrencyFixture.replace(
    `'${productionLifecycleGroup}'`,
    `format('${productionLifecycleGroup}-{0}', github.run_id)`,
  ),
);
expectConcurrencyBlocked(
  'cancel-in-progress',
  validConcurrencyFixture.replace('cancel-in-progress: false', 'cancel-in-progress: true'),
);
expectConcurrencyBlocked(
  'missing-queue-max',
  validConcurrencyFixture.replace('\n  queue: max', ''),
);

const requiredFixtureNames = ['gate', 'contract', 'mutation', 'acceptance', 'publish'];
const successfulJobs = requiredFixtureNames.map((name, index) => ({ id: index + 1, name, status: 'completed', conclusion: 'success' }));
verifyWorkflowJobs({ total_count: successfulJobs.length, jobs: successfulJobs }, requiredFixtureNames);
const expectBlocked = (label, report) => {
  try { verifyWorkflowJobs(report, requiredFixtureNames); violations.push(`workflow jobs fixture ${label} unexpectedly passed`); }
  catch { /* expected */ }
};
expectBlocked('missing', { total_count: successfulJobs.length - 1, jobs: successfulJobs.slice(1) });
expectBlocked('skipped', { total_count: successfulJobs.length, jobs: successfulJobs.map((job) => job.name === 'mutation' ? { ...job, conclusion: 'skipped' } : job) });
expectBlocked('failed', { total_count: successfulJobs.length, jobs: successfulJobs.map((job) => job.name === 'acceptance' ? { ...job, conclusion: 'failure' } : job) });
expectBlocked('duplicate', { total_count: successfulJobs.length + 1, jobs: [...successfulJobs, { ...successfulJobs[2], id: 99 }] });
expectBlocked('malformed', []);
expectBlocked('truncated', { total_count: 101, jobs: successfulJobs });
expectBlocked('count-mismatch', { total_count: successfulJobs.length + 1, jobs: successfulJobs });

const successfulRun = {
  name: 'TAI Owner REG.RU Preflight', head_repository: { full_name: 'pachaninm-lab/pachanin-demo' },
  head_sha: '1'.repeat(40), head_branch: 'main', run_attempt: 2, status: 'completed', conclusion: 'success',
};
verifyWorkflowRun(successfulRun, '1'.repeat(40), '2', 'TAI Owner REG.RU Preflight', 'pachaninm-lab/pachanin-demo');
const expectRunBlocked = (label, report, sha = '1'.repeat(40), attempt = '2', name = 'TAI Owner REG.RU Preflight', repository = 'pachaninm-lab/pachanin-demo') => {
  try { verifyWorkflowRun(report, sha, attempt, name, repository); violations.push(`workflow run fixture ${label} unexpectedly passed`); }
  catch { /* expected */ }
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
console.log('TAI REG.RU release-chain contract PASS: exact-run authority and rollback remain fail-closed, while production activation and deployment share the complete registration lifecycle lock.');
