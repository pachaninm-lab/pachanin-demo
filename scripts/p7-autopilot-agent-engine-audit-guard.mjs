#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

function out(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

function normalizePath(value) {
  return String(value || '').trim().replace(/\\/g, '/');
}

function changedFiles() {
  try {
    out('git', ['fetch', 'origin', 'main', '--depth=1']);
  } catch {
    // Full checkout already exists in the guard workflow; continue with local refs.
  }

  const base = existsSync('.git/FETCH_HEAD') ? 'FETCH_HEAD' : 'origin/main';
  return out('git', ['diff', '--name-only', `${base}...HEAD`])
    .split('\n')
    .map(normalizePath)
    .filter(Boolean);
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

const headRef = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || '';
const isAgentGeneratedBranch = headRef.startsWith('p7-agent/');

if (!isAgentGeneratedBranch) {
  console.log('agent engine audit guard skipped: PR head is not p7-agent/*.');
  process.exit(0);
}

const match = headRef.match(/^p7-agent\/(\d+)-/);
if (!match) fail(`cannot infer run id from generated branch: ${headRef}`);
const runId = match[1];

const files = changedFiles();
const generatedSmokeFiles = files.filter((file) => /^apps\/web\/tests\/e2e\/platform-v7-agent-generated-smoke-\d+\.spec\.ts$/.test(file));
if (generatedSmokeFiles.length === 0) {
  console.log('agent engine audit guard skipped: no generated smoke file changed.');
  process.exit(0);
}

const auditPath = `docs/platform-v7/autopilot/audit/agent-engine-${runId}.json`;
if (!files.includes(auditPath)) {
  fail(`generated PR changed ${generatedSmokeFiles.join(', ')} but did not include ${auditPath}`);
}
if (!existsSync(auditPath)) fail(`expected audit file is missing from checkout: ${auditPath}`);

const record = JSON.parse(readFileSync(auditPath, 'utf8'));
if (record.runId !== runId) fail(`audit runId mismatch: expected ${runId}, got ${record.runId}`);
if (!['openai', 'fallback'].includes(record.engine)) fail(`audit engine must be openai or fallback, got ${record.engine}`);
if (record.engine === 'openai' && record.openaiRealCodingProven !== true) fail('openai audit must set openaiRealCodingProven=true');
if (record.engine === 'openai' && record.fallbackUsed !== false) fail('openai audit must set fallbackUsed=false');
if (record.engine === 'fallback' && record.fallbackUsed !== true) fail('fallback audit must set fallbackUsed=true');
if (record.engine === 'fallback' && record.openaiRealCodingProven !== false) fail('fallback audit must set openaiRealCodingProven=false');

console.log(`agent engine audit guard passed: ${auditPath} engine=${record.engine}`);
