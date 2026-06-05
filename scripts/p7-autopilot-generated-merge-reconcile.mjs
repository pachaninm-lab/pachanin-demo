#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const repo = process.env.REPO;
if (!repo) throw new Error('Missing REPO');

function out(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

function run(command, args, env = process.env) {
  execFileSync(command, args, { stdio: 'inherit', env });
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
  'number,headRefOid,isDraft',
]));

for (const pr of prs) {
  if (pr.isDraft) continue;
  const prNumber = String(pr.number);
  const headSha = String(pr.headRefOid || '');
  if (!headSha) continue;
  run('node', ['scripts/p7-autopilot-generated-merge-and-advance.mjs'], {
    ...process.env,
    PR_NUMBER: prNumber,
    HEAD_SHA: headSha,
  });
}

console.log(`generated merge reconcile checked ${prs.length} PR(s)`);
