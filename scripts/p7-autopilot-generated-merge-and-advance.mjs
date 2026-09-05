#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const env = process.env;
const repo = env.REPO;
const prNumber = env.PR_NUMBER;
const headSha = env.HEAD_SHA;
if (!repo || !prNumber || !headSha) throw new Error('Missing REPO, PR_NUMBER or HEAD_SHA');

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: 'inherit', ...options });
}

function output(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

function json(command, args) {
  const raw = output(command, args);
  return raw ? JSON.parse(raw) : {};
}

function assertExactHeadMergeGate() {
  run('node', ['docs/platform-v7/autopilot/verify-pr-review-gate.mjs'], {
    env: {
      ...env,
      REPO: repo,
      PR_NUMBER: String(prNumber),
      HEAD_SHA: String(headSha),
      REQUIRE_GREEN_CI: '1',
    },
  });
}

function mergeGeneratedPr() {
  const before = json('gh', ['pr', 'view', prNumber, '--repo', repo, '--json', 'mergedAt,mergeCommit']);
  if (before.mergedAt) {
    const existing = before.mergeCommit?.oid || '';
    if (!existing) throw new Error(`generated PR #${prNumber} is merged but merge commit is unavailable`);
    return existing;
  }

  // Re-read review threads, review state, CI rollup and live PR head immediately
  // before the SHA-bound merge. Workflow-level preflights are not merge authority.
  assertExactHeadMergeGate();

  const mergeResult = json('gh', [
    'api',
    '--method',
    'PUT',
    `repos/${repo}/pulls/${prNumber}/merge`,
    '-f',
    'merge_method=squash',
    '-f',
    `sha=${headSha}`,
  ]);

  const mergeSha = mergeResult.sha || '';
  if (!mergeResult.merged || !mergeSha) throw new Error(`generated PR #${prNumber} merge did not produce a merge commit`);
  return mergeSha;
}

function openStateAdvancePr(mergeSha) {
  const branch = `p7-state/${prNumber}`;
  const existingPr = output('gh', ['pr', 'list', '--repo', repo, '--state', 'open', '--head', branch, '--json', 'number', '--jq', '.[0].number // ""']);
  if (existingPr) {
    console.log(`state advance PR already open for generated PR #${prNumber}: #${existingPr}`);
    return;
  }

  run('git', ['fetch', 'origin', 'main']);
  run('git', ['checkout', '-B', 'main', 'origin/main']);
  run('git', ['config', 'user.name', 'p7-state']);
  run('git', ['config', 'user.email', 'p7-state@users.noreply.github.com']);
  run('git', ['checkout', '-B', branch]);
  run('node', ['scripts/p7-autopilot-generated-state-advance.mjs'], {
    env: { ...env, PR_NUMBER: prNumber, MERGE_SHA: mergeSha },
  });

  const status = output('git', ['status', '--porcelain']);
  if (!status) {
    console.log(`state advance already applied for generated PR #${prNumber}`);
    return;
  }

  run('git', ['add', 'docs/platform-v7/autopilot', 'docs/platform-v7/execution-queue.md']);
  run('git', ['commit', '-m', 'docs(platform-v7): advance after generated PR']);
  run('git', ['push', 'origin', `HEAD:${branch}`]);

  let statePr = output('gh', ['pr', 'list', '--repo', repo, '--head', branch, '--json', 'number', '--jq', '.[0].number // ""']);
  if (!statePr) {
    run('gh', [
      'pr',
      'create',
      '--repo',
      repo,
      '--title',
      'p7 advance after generated PR',
      '--body',
      `Automated SOT advance after generated PR #${prNumber}. Merge remains owned by the platform-v7 generated merge gate and requires exact-head review plus terminal green CI.`,
      '--head',
      branch,
      '--base',
      'main',
    ]);
    statePr = output('gh', ['pr', 'list', '--repo', repo, '--head', branch, '--json', 'number', '--jq', '.[0].number // ""']);
  }

  if (statePr) {
    run('gh', ['pr', 'edit', statePr, '--repo', repo, '--add-label', 'platform-v7']);
    console.log(`state advance PR ready for generated merge gate: #${statePr}`);
  }
}

const mergeSha = mergeGeneratedPr();
openStateAdvancePr(mergeSha);
