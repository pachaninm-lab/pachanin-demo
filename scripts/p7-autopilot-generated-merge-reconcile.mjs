#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const repo = process.env.REPO;
if (!repo) throw new Error('Missing REPO');

const forbiddenPattern = /^(apps\/landing|apps\/web\/app\/platform-v7|apps\/web\/components\/platform-v7|apps\/web\/components\/v7r|apps\/web\/lib\/platform-v7|apps\/web\/app\/api|package\.json|package-lock\.json|pnpm-lock\.yaml)(\/|$)/;
const allowedPattern = /^(apps\/web\/tests\/e2e\/platform-v7-agent-generated-smoke.*\.spec\.ts|docs\/platform-v7\/autopilot\/.*|docs\/platform-v7\/execution-queue\.md)$/;
const ignoredStatusContext = 'deploy/pachaninm-lab/pachanin-demo';

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

function assertGeneratedScope(prNumber) {
  const files = out('gh', ['pr', 'diff', prNumber, '--repo', repo, '--name-only'])
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);

  for (const file of files) {
    if (forbiddenPattern.test(file)) throw new Error(`forbidden generated PR file: ${file}`);
    if (!allowedPattern.test(file)) throw new Error(`generated PR file outside scope: ${file}`);
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
    if (state !== 'success') throw new Error(`generated PR status is not green: ${context}:${state}`);
  }
}

function assertCheckRollup(prNumber) {
  const value = json('gh', ['pr', 'view', String(prNumber), '--repo', repo, '--json', 'statusCheckRollup', '--jq', '.statusCheckRollup']);
  const checks = Array.isArray(value) ? value : [];
  for (const check of checks) {
    const name = check.context || check.name || check.workflowName || check.title || '';
    if (name === ignoredStatusContext) continue;
    const status = String(check.status || '').toUpperCase();
    const conclusion = String(check.conclusion || check.state || '').toUpperCase();
    if (status && status !== 'COMPLETED') throw new Error(`generated PR check is not completed: ${name}:${status}`);
    if (conclusion && !['SUCCESS', 'SKIPPED', 'NEUTRAL'].includes(conclusion)) {
      throw new Error(`generated PR check is not green: ${name}:${conclusion}`);
    }
  }
}

function currentSliceNumber() {
  const state = JSON.parse(readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
  const match = String(state.current || '').match(/Autopilot Product Slice\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function titleSliceNumber(title) {
  const match = String(title || '').match(/autopilot product slice\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function openStateAdvanceRecovery(prNumber, headSha) {
  const branch = `p7-state/${prNumber}-reconcile`;
  const existingPr = out('gh', ['pr', 'list', '--repo', repo, '--state', 'open', '--head', branch, '--json', 'number', '--jq', '.[0].number // ""']);
  if (existingPr) {
    console.log(`state advance PR already open for generated PR #${prNumber}: #${existingPr}`);
    return false;
  }

  run('git', ['fetch', 'origin', 'main']);
  run('git', ['checkout', '-B', 'main', 'origin/main']);
  run('git', ['config', 'user.name', 'p7-state']);
  run('git', ['config', 'user.email', 'p7-state@users.noreply.github.com']);
  run('git', ['checkout', '-B', branch]);
  run('node', ['scripts/p7-autopilot-generated-state-advance.mjs'], {
    ...process.env,
    PR_NUMBER: String(prNumber),
    MERGE_SHA: String(headSha),
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
      `Automated SOT advance recovery after generated PR #${prNumber}.`,
      '--head',
      branch,
      '--base',
      'main',
    ]);
    statePr = out('gh', ['pr', 'list', '--repo', repo, '--head', branch, '--json', 'number', '--jq', '.[0].number // ""']);
  }

  if (statePr) {
    run('gh', ['pr', 'edit', statePr, '--repo', repo, '--add-label', 'platform-v7']);
    run('gh', ['pr', 'edit', statePr, '--repo', repo, '--add-label', 'automerge']);
  }
  return true;
}

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
  'number,headRefOid,isDraft,mergeable',
]);

for (const pr of openPrs) {
  if (pr.isDraft) continue;
  if (pr.mergeable === 'CONFLICTING') continue;
  const prNumber = String(pr.number);
  const headSha = String(pr.headRefOid || '');
  if (!headSha) continue;
  try {
    assertGeneratedScope(prNumber);
    assertCheckRollup(prNumber);
    assertStatuses(headSha);
  } catch (error) {
    console.log(`generated PR #${prNumber} is not ready for guarded merge: ${error.message}`);
    continue;
  }
  run('node', ['scripts/p7-autopilot-generated-merge-and-advance.mjs'], {
    ...process.env,
    PR_NUMBER: prNumber,
    HEAD_SHA: headSha,
  });
}

const slice = currentSliceNumber();
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
  '10',
]);

let recovered = 0;
for (const pr of closedPrs) {
  if (!pr.mergedAt) continue;
  if (titleSliceNumber(pr.title) !== slice) continue;
  const prNumber = String(pr.number);
  const headSha = String(pr.headRefOid || '');
  if (!headSha) continue;
  assertGeneratedScope(prNumber);
  try {
    assertCheckRollup(prNumber);
  } catch (error) {
    console.log(`merged generated PR #${prNumber} check rollup mismatch during SOT recovery: ${error.message}`);
  }
  assertStatuses(headSha);
  if (openStateAdvanceRecovery(prNumber, headSha)) recovered += 1;
  break;
}

console.log(`generated merge reconcile checked ${openPrs.length} open PR(s), recovered ${recovered} merged PR state advance(s)`);
