#!/usr/bin/env node
// Source comparison only. This module cannot authorize a production operation.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA = /^[0-9a-f]{40}$/;
const PRISMA_ROOT = 'apps/api/prisma/';
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_ENTRIES = 20000;
const utf8 = new TextDecoder('utf-8', { fatal: true });
const gitEnv = {
  PATH: '/usr/bin:/bin', LC_ALL: 'C',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_NO_REPLACE_OBJECTS: '1', GIT_GRAFT_FILE: '/dev/null', GIT_TERMINAL_PROMPT: '0',
  GIT_NO_LAZY_FETCH: '1', GIT_ALLOW_PROTOCOL: '', GIT_PROTOCOL_FROM_USER: '0',
};

class SourceError extends Error {}
function requireCondition(condition, code) {
  if (!condition) throw new SourceError(code);
}

function git(repository, args) {
  const result = spawnSync('/usr/bin/git', ['--no-optional-locks',
    '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null',
    '-c', 'protocol.allow=never', ...args], {
    cwd: repository, env: gitEnv, encoding: 'buffer',
    timeout: 4000, killSignal: 'SIGKILL', maxBuffer: MAX_BYTES,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  requireCondition(!result.error && result.status === 0 && !result.signal,
    'GIT_OBSERVATION_FAILED');
  requireCondition(result.stdout.length <= MAX_BYTES && result.stderr.length <= MAX_BYTES,
    'GIT_OUTPUT_BOUND');
  return result.stdout;
}

function identity(repository, ref) {
  return utf8.decode(git(repository, ['rev-parse', '--verify', ref])).trim();
}

function readTree(repository, commit) {
  const raw = git(repository, ['ls-tree', '--full-tree', '-r', '-z', commit, '--']);
  requireCondition(raw.length > 0 && raw.at(-1) === 0, 'TREE_FRAMING');
  const records = utf8.decode(raw).split('\0');
  records.pop();
  requireCondition(records.length <= MAX_ENTRIES, 'TREE_ENTRY_BOUND');
  const entries = new Map();
  for (const record of records) {
    const tab = record.indexOf('\t');
    requireCondition(tab > 0, 'TREE_FRAMING');
    const header = record.slice(0, tab).match(/^(100644|100755|120000|160000) (blob|commit) ([0-9a-f]{40})$/);
    const path = record.slice(tab + 1);
    requireCondition(header && path && path.length <= 4096 && !entries.has(path), 'TREE_ENTRY');
    requireCondition(!path.startsWith('/') && !path.split('/').some(p => !p || p === '.' || p === '..'), 'TREE_PATH');
    requireCondition(header[1] !== '160000' && header[2] === 'blob', 'SUBMODULE_NOT_ADMITTED');
    entries.set(path, { path, mode: header[1], sha: header[3] });
  }
  return entries;
}

function protectedSet(entries) {
  const selected = [...entries.values()].filter(entry =>
    entry.path.startsWith(PRISMA_ROOT) || /\.(sql|prisma)$/i.test(entry.path));
  requireCondition(entries.has(`${PRISMA_ROOT}schema.prisma`), 'PRISMA_SCHEMA_MISSING');
  requireCondition(selected.some(entry => entry.path.startsWith(`${PRISMA_ROOT}migrations/`) && /\/migration\.sql$/.test(entry.path)), 'MIGRATION_SET_MISSING');
  requireCondition(selected.every(entry => entry.mode === '100644'), 'SCHEMA_MODE_NOT_REGULAR');
  selected.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  return selected;
}

function checkoutIdentity(repository, target) {
  requireCondition(identity(repository, 'HEAD^{commit}') === target, 'CHECKOUT_TARGET_MISMATCH');
  requireCondition(identity(repository, 'refs/remotes/origin/main^{commit}') === target, 'CURRENT_MAIN_MISMATCH');
}

export function verifySourceParity({ repository, baseline, target }) {
  const receipt = {
    schema: 'pc.api-schema-source-parity.v1',
    result: 'HOLD', reason: 'UNVERIFIED',
    source_parity: 'NOT_PROVEN',
    checkout_worktree: 'NOT_ATTESTED',
    runtime_baseline_binding: 'CALLER_REQUIRED_NOT_PROVEN',
    database_compatibility: 'NOT_PROVEN',
    deployment_authorized: false,
  };
  try {
    requireCondition(typeof repository === 'string' && repository.length > 0, 'REPOSITORY_REQUIRED');
    requireCondition(typeof baseline === 'string' && SHA.test(baseline) &&
      typeof target === 'string' && SHA.test(target), 'EXACT_COMMIT_REQUIRED');
    requireCondition(identity(repository, `${baseline}^{commit}`) === baseline &&
      identity(repository, `${target}^{commit}`) === target, 'COMMIT_IDENTITY');
    checkoutIdentity(repository, target);
    git(repository, ['merge-base', '--is-ancestor', baseline, target]);
    const before = protectedSet(readTree(repository, baseline));
    const after = protectedSet(readTree(repository, target));
    requireCondition(JSON.stringify(before) === JSON.stringify(after), 'SCHEMA_SOURCE_CHANGED');
    checkoutIdentity(repository, target);
    return { ...receipt, result: 'SOURCE_PARITY_ONLY', reason: 'NONE',
      source_parity: 'IDENTICAL', baseline_sha: baseline, target_sha: target,
      schema_entries: after.length,
      schema_manifest_sha256: createHash('sha256').update(JSON.stringify(after)).digest('hex'),
    };
  } catch (error) {
    return { ...receipt, reason: error instanceof SourceError ? error.message : 'OBSERVATION_UNAVAILABLE' };
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const result = verifySourceParity({ repository: process.cwd(),
    baseline: args.length === 2 ? args[0] : undefined, target: args[1] });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.result === 'SOURCE_PARITY_ONLY' ? 0 : 1;
}
