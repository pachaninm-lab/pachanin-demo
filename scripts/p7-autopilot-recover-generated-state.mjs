#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const repo = process.env.REPO;
if (!repo) throw new Error('Missing REPO');
const out = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim();
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...options });
const parse = (text) => (text ? JSON.parse(text) : null);
const slice = (value) => {
  const match = String(value || '').match(/autopilot product slice\s+(\d+)/i);
  return match ? `Autopilot Product Slice ${String(Number(match[1])).padStart(2, '0')}` : '';
};

run('git', ['fetch', 'origin', 'main']);
run('git', ['checkout', 'main']);
run('git', ['reset', '--hard', 'origin/main']);

const state = JSON.parse(readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
const current = slice(state.current);
if (!current) process.exit(0);

const prs = parse(out('gh', [
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
  '--limit',
  '20',
  '--json',
  'number,title,mergedAt,mergeCommit',
])) || [];

const source = prs
  .filter((pr) => pr.mergedAt && slice(pr.title) === current)
  .sort((a, b) => String(b.mergedAt).localeCompare(String(a.mergedAt)))[0];
if (!source) process.exit(0);

const branch = `p7-state/${source.number}`;
const mergeSha = source.mergeCommit?.oid || '';
run('git', ['checkout', '-B', branch, 'origin/main']);
run('node', ['scripts/p7-autopilot-generated-state-advance.mjs'], {
  env: { ...process.env, PR_NUMBER: String(source.number), MERGE_SHA: mergeSha },
});
if (!out('git', ['status', '--porcelain'])) process.exit(0);

run('git', ['config', 'user.name', 'p7-state']);
run('git', ['config', 'user.email', 'p7-state@users.noreply.github.com']);
run('git', ['add', 'docs/platform-v7/autopilot', 'docs/platform-v7/execution-queue.md']);
run('git', ['commit', '-m', 'docs(platform-v7): advance after generated PR']);
run('git', ['push', 'origin', `HEAD:${branch}`]);

let statePr = out('gh', ['pr', 'list', '--repo', repo, '--head', branch, '--json', 'number', '--jq', '.[0].number // ""']);
if (!statePr) {
  run('gh', ['pr', 'create', '--repo', repo, '--title', 'p7 advance after generated PR', '--body', 'Automated SOT advance.', '--head', branch, '--base', 'main']);
  statePr = out('gh', ['pr', 'list', '--repo', repo, '--head', branch, '--json', 'number', '--jq', '.[0].number // ""']);
}
if (statePr) {
  run('gh', ['pr', 'edit', statePr, '--repo', repo, '--add-label', 'platform-v7']);
  run('gh', ['pr', 'edit', statePr, '--repo', repo, '--add-label', 'automerge']);
}
