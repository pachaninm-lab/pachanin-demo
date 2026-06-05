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

run('gh', ['pr', 'merge', prNumber, '--repo', repo, '--squash', '--delete-branch']);
run('git', ['fetch', 'origin', 'main']);
run('git', ['checkout', 'main']);
run('git', ['reset', '--hard', 'origin/main']);
run('git', ['config', 'user.name', 'p7-state']);
run('git', ['config', 'user.email', 'p7-state@users.noreply.github.com']);

const branch = `p7-state/${prNumber}`;
run('git', ['checkout', '-B', branch]);
run('node', ['scripts/p7-autopilot-generated-state-advance.mjs'], {
  env: { ...env, MERGE_SHA: headSha },
});

const status = output('git', ['status', '--porcelain']);
if (!status) process.exit(0);

run('git', ['add', 'docs/platform-v7/autopilot', 'docs/platform-v7/execution-queue.md']);
run('git', ['commit', '-m', 'docs(platform-v7): advance after generated PR']);
run('git', ['push', 'origin', `HEAD:${branch}`]);

let statePr = output('gh', ['pr', 'list', '--repo', repo, '--head', branch, '--json', 'number', '--jq', '.[0].number // ""']);
if (!statePr) {
  run('gh', ['pr', 'create', '--repo', repo, '--title', 'p7 advance after generated PR', '--body', 'Automated SOT advance.', '--head', branch, '--base', 'main']);
  statePr = output('gh', ['pr', 'list', '--repo', repo, '--head', branch, '--json', 'number', '--jq', '.[0].number // ""']);
}
if (statePr) {
  run('gh', ['pr', 'edit', statePr, '--repo', repo, '--add-label', 'platform-v7']);
  run('gh', ['pr', 'edit', statePr, '--repo', repo, '--add-label', 'automerge']);
}
