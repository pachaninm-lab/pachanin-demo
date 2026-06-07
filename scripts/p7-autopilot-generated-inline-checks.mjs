#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ref = process.env.P7_GENERATED_HEAD_REF;
if (!ref) throw new Error('Missing P7_GENERATED_HEAD_REF');
if (!ref.startsWith('p7-agent/')) throw new Error(`Unexpected generated branch: ${ref}`);

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: 'inherit', env: process.env, ...options });
}

function out(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', env: process.env, ...options }).trim();
}

function normalizePath(value) {
  return String(value || '').trim().replace(/\\/g, '/');
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function changedFiles() {
  return out('git', ['diff', '--name-only', `origin/main...origin/${ref}`])
    .split('\n')
    .map(normalizePath)
    .filter(Boolean);
}

function matchesScope(scope, filePath) {
  const scopeValue = normalizePath(scope);
  const fileValue = normalizePath(filePath);
  if (scopeValue === fileValue) return true;
  if (scopeValue.endsWith('/**')) return fileValue.startsWith(scopeValue.slice(0, -3));
  return fileValue.startsWith(`${scopeValue}/`);
}

function runGeneratedScopeGuard(worktree) {
  const state = JSON.parse(readFileSync(path.join(worktree, 'docs/platform-v7/autopilot/autopilot-state.json'), 'utf8'));
  const allowedCurrent = Array.isArray(state.allowedCurrentScope) ? state.allowedCurrentScope : [];
  const forbidden = Array.isArray(state.forbiddenZones) ? state.forbiddenZones : [];
  const files = changedFiles();

  for (const file of files) {
    if (forbidden.some((scope) => file === normalizePath(scope) || file.startsWith(`${normalizePath(scope)}/`))) {
      fail(`forbidden generated file: ${file}`);
    }
    if (!allowedCurrent.some((scope) => matchesScope(scope, file))) {
      fail(`generated file outside current scope: ${file}`);
    }
  }

  const runMatch = ref.match(/^p7-agent\/(\d+)-/);
  if (!runMatch) fail(`cannot infer run id from generated branch: ${ref}`);
  const runId = runMatch[1];
  const smoke = files.filter((file) => /^apps\/web\/tests\/e2e\/platform-v7-agent-generated-smoke-\d+\.spec\.ts$/.test(file));
  if (smoke.length !== 1) fail(`expected exactly one generated smoke file, got ${smoke.length}`);

  const auditPath = `docs/platform-v7/autopilot/audit/agent-engine-${runId}.json`;
  if (!files.includes(auditPath)) fail(`missing generated audit file: ${auditPath}`);
  const fullAuditPath = path.join(worktree, auditPath);
  if (!existsSync(fullAuditPath)) fail(`audit file missing from checkout: ${auditPath}`);

  const record = JSON.parse(readFileSync(fullAuditPath, 'utf8'));
  if (record.runId !== runId) fail(`audit runId mismatch: expected ${runId}, got ${record.runId}`);
  if (!['openai', 'fallback'].includes(record.engine)) fail(`invalid audit engine: ${record.engine}`);
  if (record.engine === 'fallback' && record.fallbackUsed !== true) fail('fallback audit must set fallbackUsed=true');
  if (record.engine === 'fallback' && record.openaiRealCodingProven !== false) fail('fallback audit must set openaiRealCodingProven=false');
  if (record.engine === 'openai' && record.fallbackUsed !== false) fail('openai audit must set fallbackUsed=false');
  if (record.engine === 'openai' && record.openaiRealCodingProven !== true) fail('openai audit must set openaiRealCodingProven=true');
  console.log(`generated inline scope/audit guard passed for ${ref}: engine=${record.engine}`);
}

const parent = mkdtempSync(path.join(tmpdir(), 'p7-inline-'));
const worktree = path.join(parent, 'checkout');
try {
  run('git', ['fetch', 'origin', 'main']);
  run('git', ['fetch', 'origin', ref]);
  run('git', ['worktree', 'add', '--detach', worktree, `origin/${ref}`]);
  runGeneratedScopeGuard(worktree);
  run('corepack', ['enable'], { cwd: worktree });
  run('pnpm', ['install', '--frozen-lockfile'], { cwd: worktree });
  run('pnpm', ['run', 'typecheck'], { cwd: worktree });
  run('pnpm', ['test'], { cwd: worktree });
  run('pnpm', ['build'], { cwd: worktree });
  console.log(`generated inline checks passed for ${ref}`);
} finally {
  try {
    run('git', ['worktree', 'remove', '--force', worktree]);
  } catch {
    // Ignore cleanup errors.
  }
  rmSync(parent, { recursive: true, force: true });
}
