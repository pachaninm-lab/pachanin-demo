#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const repo = process.env.REPO;
if (!repo) throw new Error('Missing REPO');

const forbiddenPattern = /^(apps\/landing|apps\/web\/app\/platform-v7|apps\/web\/components\/platform-v7|apps\/web\/components\/v7r|apps\/web\/lib\/platform-v7|apps\/web\/app\/api|package\.json|package-lock\.json|pnpm-lock\.yaml)(\/|$)/;
const ignoredStatusContext = 'deploy/pachaninm-lab/pachanin-demo';
const ignoredCheckNames = new Set([
  'platform-v7 autopilot generated merge',
  'Repo automations',
  ignoredStatusContext,
]);
const requiredWorkflows = [
  { name: 'CI', file: 'ci.yml' },
  { name: 'Node CI', file: 'node-ci.yml' },
  { name: 'platform-v7 autopilot guard', file: 'platform-v7-autopilot-guard.yml' },
];

function out(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

function json(command, args) {
  const raw = out(command, args);
  return raw ? JSON.parse(raw) : [];
}

function run(command, args, env = process.env) {
  execFileSync(command, args, { stdio: 'inherit', env });
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function normalizePath(input) {
  return String(input || '').trim().replace(/\\/g, '/');
}

function readState() {
  return JSON.parse(readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
}

function currentSliceNumber() {
  const state = readState();
  const match = String(state.current || '').match(/Autopilot Product Slice\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function currentAgentWritableFile() {
  const state = readState();
  const writable = Array.isArray(state.agentWritableScope) ? state.agentWritableScope.map(normalizePath) : [];
  if (writable.length !== 1) throw new Error(`expected exactly one agentWritableScope file, got ${writable.length}`);
  return writable[0];
}

function titleSliceNumber(title) {
  const match = String(title || '').match(/autopilot product slice\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function prFiles(prNumber) {
  return out('gh', ['pr', 'diff', String(prNumber), '--repo', repo, '--name-only'])
    .split('\n')
    .map(normalizePath)
    .filter(Boolean);
}

function assertGeneratedScope(prNumber, exactWritableFile) {
  const files = prFiles(prNumber);
  const allowedDocsPattern = /^(docs\/platform-v7\/autopilot\/.*|docs\/platform-v7\/execution-queue\.md)$/;

  for (const file of files) {
    if (forbiddenPattern.test(file)) throw new Error(`forbidden generated PR file: ${file}`);
    if (file === exactWritableFile) continue;
    if (allowedDocsPattern.test(file)) continue;
    throw new Error(`generated PR file outside exact scope: ${file}`);
  }

  if (!files.includes(exactWritableFile)) {
    throw new Error(`generated PR did not change exact agentWritableScope file: ${exactWritableFile}`);
  }
}

function assertStateAdvanceScope(prNumber) {
  const files = prFiles(prNumber);
  const allowedPattern = /^(docs\/platform-v7\/autopilot\/.*|docs\/platform-v7\/execution-queue\.md)$/;

  for (const file of files) {
    if (forbiddenPattern.test(file)) throw new Error(`forbidden SOT advance PR file: ${file}`);
    if (!allowedPattern.test(file)) throw new Error(`SOT advance PR file outside scope: ${file}`);
  }
}

function assertStatuses(headSha) {
  const rows = out('gh', ['api', `repos/${repo}/commits/${headSha}/status`, '--jq', '.statuses[] | [.context,.state] | @tsv'])
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean);

  for (const row of rows) {
    const [context, state] = row.split('\t');
    if (context === ignoredStatusContext) continue;
    if (state !== 'success') throw new Error(`commit status is not green: ${context}:${state}`);
  }
}

function assertCheckRollup(prNumber) {
  const value = json('gh', ['pr', 'view', String(prNumber), '--repo', repo, '--json', 'statusCheckRollup', '--jq', '.statusCheckRollup']);
  const checks = Array.isArray(value) ? value : [];
  for (const check of checks) {
    const name = check.context || check.name || check.workflowName || check.title || '';
    if (ignoredCheckNames.has(name)) continue;
    const status = String(check.status || '').toUpperCase();
    const conclusion = String(check.conclusion || check.state || '').toUpperCase();
    if (status && status !== 'COMPLETED') throw new Error(`check is not completed: ${name}:${status}`);
    if (conclusion && !['SUCCESS', 'SKIPPED', 'NEUTRAL'].includes(conclusion)) {
      throw new Error(`check is not green: ${name}:${conclusion}`);
    }
  }
}

function runsForSha(headSha) {
  const runs = json('gh', [
    'api',
    '--method',
    'GET',
    `repos/${repo}/actions/runs`,
    '-f',
    `head_sha=${headSha}`,
    '-f',
    'per_page=100',
    '--jq',
    '.workflow_runs',
  ]);
  return Array.isArray(runs) ? runs : [];
}

function latestRun(runs, workflowName) {
  return runs
    .filter((runItem) => runItem.name === workflowName)
    .sort((left, right) => Date.parse(right.created_at || '') - Date.parse(left.created_at || ''))[0] || null;
}

function ensureRequiredWorkflows(headSha, headRefName) {
  const runs = runsForSha(headSha);
  let dispatched = 0;

  for (const workflow of requiredWorkflows) {
    const runItem = latestRun(runs, workflow.name);
    if (!runItem) {
      run('gh', ['workflow', 'run', workflow.file, '--repo', repo, '--ref', headRefName]);
      dispatched += 1;
      continue;
    }

    if (runItem.status !== 'completed') {
      throw new Error(`required workflow is still running: ${workflow.name}:${runItem.status}`);
    }

    if (!['success', 'skipped', 'neutral'].includes(String(runItem.conclusion || '').toLowerCase())) {
      throw new Error(`required workflow is not green: ${workflow.name}:${runItem.conclusion}`);
    }
  }

  if (dispatched > 0) {
    throw new Error(`dispatched ${dispatched} required workflow(s); waiting for completion`);
  }
}

function isWaitableReadinessError(error) {
  const message = String(error?.message || error);
  const normalized = message.toLowerCase();
  return (
    message.includes('dispatched ') ||
    message.includes('mergeability is not ready') ||
    message.includes('SOT advance PR discovery pending') ||
    message.includes('required workflow is still running') ||
    message.includes('check is not completed') ||
    normalized.includes(':pending')
  );
}

function waitForReadiness(label, callback) {
  const deadline = Date.now() + 16 * 60 * 1000;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      callback();
      return;
    } catch (error) {
      lastError = error;
      if (!isWaitableReadinessError(error)) throw error;
      console.log(`${label} waiting for gate readiness: ${error.message}`);
      sleep(30 * 1000);
    }
  }

  throw lastError || new Error(`${label} did not become ready before timeout`);
}

function waitForMergeablePr(prNumber, label) {
  let latest = null;
  waitForReadiness(label, () => {
    latest = json('gh', [
      'pr',
      'view',
      String(prNumber),
      '--repo',
      repo,
      '--json',
      'isDraft,mergeable,headRefOid,headRefName',
    ]);

    if (latest.isDraft) throw new Error(`${label} is draft`);
    if (latest.mergeable === 'MERGEABLE') return;
    if (latest.mergeable === 'CONFLICTING') throw new Error(`${label} is conflicting`);
    throw new Error(`${label} mergeability is not ready: ${latest.mergeable || 'UNKNOWN'}`);
  });
  return latest;
}

function mergePr(prNumber, headSha, message) {
  run('gh', [
    'api',
    '--method',
    'PUT',
    `repos/${repo}/pulls/${prNumber}/merge`,
    '-f',
    'merge_method=squash',
    '-f',
    `sha=${headSha}`,
    '-f',
    `commit_title=${message}`,
  ]);
}

function existingStateAdvancePr(prNumber) {
  for (const branch of [`p7-state/${prNumber}`, `p7-state/${prNumber}-reconcile`]) {
    const found = out('gh', ['pr', 'list', '--repo', repo, '--state', 'open', '--head', branch, '--json', 'number', '--jq', '.[0].number // ""']);
    if (found) return found;
  }
  return '';
}

function openStateAdvanceRecovery(prNumber, mergeSha) {
  const existingPr = existingStateAdvancePr(prNumber);
  if (existingPr) {
    console.log(`state advance PR already open for generated PR #${prNumber}: #${existingPr}`);
    return false;
  }

  const branch = `p7-state/${prNumber}`;
  run('git', ['fetch', 'origin', 'main']);
  run('git', ['checkout', '-B', 'main', 'origin/main']);
  run('git', ['config', 'user.name', 'p7-state']);
  run('git', ['config', 'user.email', 'p7-state@users.noreply.github.com']);
  run('git', ['checkout', '-B', branch]);
  run('node', ['scripts/p7-autopilot-generated-state-advance.mjs'], {
    ...process.env,
    PR_NUMBER: String(prNumber),
    MERGE_SHA: String(mergeSha),
  });

  const status = out('git', ['status', '--porcelain']);
  if (!status) return false;

  run('git', ['add', 'docs/platform-v7/autopilot', 'docs/platform-v7/execution-queue.md']);
  run('git', ['commit', '-m', 'docs(platform-v7): advance after generated PR']);
  run('git', ['push', 'origin', `HEAD:${branch}`]);

  let statePr = out('gh', ['pr', 'list', '--repo', repo, '--head', branch, '--json', 'number', '--jq', '.[0].number // ""']);
  if (!statePr) {
    run('gh', [
      'pr',
      'create',
      '--repo',
      repo,
      '--title',
      'p7 advance after generated PR',
      '--body',
      `Automated SOT advance recovery after generated PR #${prNumber}. Merge remains owned by the platform-v7 generated merge gate.`,
      '--head',
      branch,
      '--base',
      'main',
    ]);
    statePr = out('gh', ['pr', 'list', '--repo', repo, '--head', branch, '--json', 'number', '--jq', '.[0].number // ""']);
  }

  if (statePr) run('gh', ['pr', 'edit', statePr, '--repo', repo, '--add-label', 'platform-v7']);
  return true;
}

function mergedPrCommitSha(prNumber) {
  const pr = json('gh', ['pr', 'view', String(prNumber), '--repo', repo, '--json', 'mergeCommit', '--jq', '.mergeCommit']);
  return pr?.oid || '';
}

function mergeOpenGeneratedPrs() {
  const slice = currentSliceNumber();
  const exactWritableFile = currentAgentWritableFile();
  const openPrs = json('gh', [
    'pr',
    'list',
    '--repo',
    repo,
    '--state',
    'open',
    '--label',
    'platform-v7',
    '--label',
    'agent-generated',
    '--label',
    'automerge',
    '--json',
    'number,headRefOid,headRefName,isDraft,mergeable,title',
  ]);

  let merged = 0;
  for (const pr of openPrs) {
    const prNumber = String(pr.number);
    if (titleSliceNumber(pr.title) !== slice) {
      console.log(`generated PR #${prNumber} is stale for current slice ${slice}; skipped`);
      continue;
    }

    try {
      const readyPr = waitForMergeablePr(prNumber, `generated PR #${prNumber}`);
      const headSha = String(readyPr.headRefOid || '');
      const headRefName = String(readyPr.headRefName || '');
      if (!headSha || !headRefName) throw new Error(`generated PR #${prNumber} is missing head metadata`);

      assertGeneratedScope(prNumber, exactWritableFile);
      waitForReadiness(`generated PR #${prNumber}`, () => {
        ensureRequiredWorkflows(headSha, headRefName);
        assertCheckRollup(prNumber);
        assertStatuses(headSha);
      });

      run('node', ['scripts/p7-autopilot-generated-merge-and-advance.mjs'], {
        ...process.env,
        PR_NUMBER: prNumber,
        HEAD_SHA: headSha,
      });
      merged += 1;
    } catch (error) {
      console.log(`generated PR #${prNumber} is not ready for guarded merge: ${error.message}`);
      continue;
    }
  }

  return { checked: openPrs.length, merged };
}

function stateAdvancePrs() {
  return json('gh', [
    'pr',
    'list',
    '--repo',
    repo,
    '--state',
    'open',
    '--label',
    'platform-v7',
    '--json',
    'number,headRefOid,headRefName,isDraft,mergeable,title',
    '--limit',
    '50',
  ]).filter((pr) => String(pr.headRefName || '').startsWith('p7-state/') && String(pr.title || '') === 'p7 advance after generated PR');
}

function waitForStateAdvanceDiscovery() {
  waitForReadiness('SOT advance PR discovery', () => {
    if (stateAdvancePrs().length === 0) throw new Error('SOT advance PR discovery pending');
  });
}

function mergeOpenStateAdvancePrs() {
  const prs = stateAdvancePrs();

  let merged = 0;
  for (const pr of prs) {
    const prNumber = String(pr.number);

    try {
      const readyPr = waitForMergeablePr(prNumber, `SOT advance PR #${prNumber}`);
      const headSha = String(readyPr.headRefOid || '');
      const headRefName = String(readyPr.headRefName || '');
      if (!headSha || !headRefName) throw new Error(`SOT advance PR #${prNumber} is missing head metadata`);

      assertStateAdvanceScope(prNumber);
      waitForReadiness(`SOT advance PR #${prNumber}`, () => {
        ensureRequiredWorkflows(headSha, headRefName);
        assertCheckRollup(prNumber);
        assertStatuses(headSha);
      });

      mergePr(prNumber, headSha, `docs(platform-v7): advance SOT after generated PR`);
      merged += 1;
    } catch (error) {
      console.log(`SOT advance PR #${prNumber} is not ready for guarded merge: ${error.message}`);
      continue;
    }
  }

  return { checked: prs.length, merged };
}

function recoverMergedGeneratedPr() {
  const slice = currentSliceNumber();
  const exactWritableFile = currentAgentWritableFile();
  const closedPrs = json('gh', [
    'pr',
    'list',
    '--repo',
    repo,
    '--state',
    'closed',
    '--label',
    'platform-v7',
    '--label',
    'agent-generated',
    '--json',
    'number,headRefOid,mergedAt,title',
    '--limit',
    '20',
  ]);

  for (const pr of closedPrs) {
    if (!pr.mergedAt) continue;
    if (titleSliceNumber(pr.title) !== slice) continue;

    const prNumber = String(pr.number);
    const headSha = String(pr.headRefOid || '');
    if (!headSha) continue;

    assertGeneratedScope(prNumber, exactWritableFile);
    try {
      assertCheckRollup(prNumber);
    } catch (error) {
      console.log(`merged generated PR #${prNumber} check rollup mismatch during SOT recovery: ${error.message}`);
    }
    assertStatuses(headSha);

    const mergeSha = mergedPrCommitSha(prNumber) || headSha;
    return openStateAdvanceRecovery(prNumber, mergeSha) ? 1 : 0;
  }

  return 0;
}

const generated = mergeOpenGeneratedPrs();
if (generated.merged > 0) waitForStateAdvanceDiscovery();
const stateBeforeRecovery = mergeOpenStateAdvancePrs();
const recovered = stateBeforeRecovery.merged > 0 ? 0 : recoverMergedGeneratedPr();
const stateAfterRecovery = recovered > 0 ? mergeOpenStateAdvancePrs() : { checked: 0, merged: 0 };

console.log([
  `generated merge reconcile checked ${generated.checked} open generated PR(s), merged ${generated.merged}`,
  `checked ${stateBeforeRecovery.checked + stateAfterRecovery.checked} open SOT advance PR(s), merged ${stateBeforeRecovery.merged + stateAfterRecovery.merged}`,
  `recovered ${recovered} merged generated PR state advance(s)`,
].join('; '));
