#!/usr/bin/env node
import fs from 'node:fs';

const path = '.github/workflows/production-p0-reviewer-preflight-observer.yml';
const workflow = fs.readFileSync(path, 'utf8');

const required = [
  'pull_request:',
  "workflow_run:",
  "workflows: ['Production P0 Reviewer Preflight']",
  'types: [completed]',
  "name: Validate reviewer-preflight observer contract",
  "if: github.event_name == 'pull_request'",
  'node scripts/check-production-p0-reviewer-preflight-observer.mjs',
  "github.event_name == 'workflow_run'",
  "github.event.workflow_run.event == 'issue_comment'",
  "github.event.workflow_run.conclusion != 'success'",
  'github.event.workflow_run.head_repository.full_name == github.repository',
  'github.event.workflow_run.head_branch == github.event.repository.default_branch',
  'github.event.workflow_run.actor.login == github.repository_owner',
  'github.event.workflow_run.triggering_actor.login == github.repository_owner',
  'actions: read',
  'contents: read',
  'issues: write',
  'SOURCE_RUN_ID: ${{ github.event.workflow_run.id }}',
  'SOURCE_RUN_URL: ${{ github.event.workflow_run.html_url }}',
  'SOURCE_HEAD_SHA: ${{ github.event.workflow_run.head_sha }}',
  'SOURCE_CONCLUSION: ${{ github.event.workflow_run.conclusion }}',
  'actions/runs/$SOURCE_RUN_ID/jobs?per_page=100',
  'Publish bounded terminal failure to release authority',
  'gh issue comment "$RELEASE_ISSUE_NUMBER"',
  'production mutation: \\`NONE\\`',
  'secrets / PII published: \\`NONE\\`',
];

for (const marker of required) {
  if (!workflow.includes(marker)) {
    console.error(`Missing required observer marker: ${marker}`);
    process.exit(1);
  }
}

const forbidden = [
  /secrets\./,
  /\bssh\b/i,
  /STAFF_DATABASE_URL/,
  /DATABASE_URL/,
  /docker\s+(?:exec|compose|run)/i,
  /bootstrap-platform-owner/,
  /BOOTSTRAP_PLATFORM_OWNER_/,
  /PC_PROD_P0_STAFF_/,
  /PC_PROD_P0_REVIEWER_/,
  /PC_PROD_P0_MAILBOX_/,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\s+(?:auth\.|public\.)/i,
  /\bDELETE\s+FROM\b/i,
  /\bCREATE\s+(?:ROLE|USER|TABLE|FUNCTION)\b/i,
  /\bALTER\s+(?:ROLE|USER|TABLE)\b/i,
  /\bDROP\s+(?:ROLE|USER|TABLE|FUNCTION)\b/i,
  /^\s*push:\s*$/m,
  /^\s*issue_comment:\s*$/m,
];

for (const pattern of forbidden) {
  if (pattern.test(workflow)) {
    console.error(`Observer violates read-only bounded contract: ${pattern}`);
    process.exit(1);
  }
}

const publishBlock = workflow.split(/\n  publish-terminal-failure:\n/)[1] ?? '';
if (!publishBlock) {
  console.error('Observer must have a dedicated publish-terminal-failure job.');
  process.exit(1);
}
if (!/permissions:\n\s+actions: read\n\s+contents: read\n\s+issues: write/.test(publishBlock)) {
  console.error('Only the workflow_run publication job may have issues:write.');
  process.exit(1);
}

const contractBlock = workflow.split(/\n  contract:\n/)[1]?.split(/\n  publish-terminal-failure:\n/)[0] ?? '';
if (!contractBlock || /issues:\s*write/.test(contractBlock)) {
  console.error('PR validation job must not have issue write authority.');
  process.exit(1);
}

const issueNumber = workflow.match(/RELEASE_ISSUE_NUMBER:\s*(\d+)/)?.[1];
if (issueNumber !== '3072') {
  console.error('Observer must publish only to release issue #3072.');
  process.exit(1);
}

console.log('PASS: reviewer preflight observer is owner-bound, terminal-only, read-only and least-privilege.');
