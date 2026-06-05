#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const repo = process.env.REPO;
if (!repo) throw new Error('Missing REPO');

const forbiddenPattern = /^(apps\/landing|apps\/web\/app\/platform-v7|apps\/web\/components\/platform-v7|apps\/web\/components\/v7r|apps\/web\/lib\/platform-v7|apps\/web\/app\/api|package\.json|package-lock\.json|pnpm-lock\.yaml)(\/|$)/;
const allowedPattern = /^(apps\/web\/tests\/e2e\/platform-v7-agent-generated-smoke.*\.spec\.ts|docs\/platform-v7\/autopilot\/|docs\/platform-v7\/execution-queue\.md)$/;
const ignoredStatusContext = 'deploy/pachaninm-lab/pachanin-demo';

function out(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
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

const prs = JSON.parse(out('gh', [
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
]));

for (const pr of prs) {
  if (pr.isDraft) continue;
  if (pr.mergeable === 'CONFLICTING') continue;
  const prNumber = String(pr.number);
  const headSha = String(pr.headRefOid || '');
  if (!headSha) continue;
  assertGeneratedScope(prNumber);
  assertStatuses(headSha);
  run('node', ['scripts/p7-autopilot-generated-merge-and-advance.mjs'], {
    ...process.env,
    PR_NUMBER: prNumber,
    HEAD_SHA: headSha,
  });
}

console.log(`generated merge reconcile checked ${prs.length} PR(s)`);
