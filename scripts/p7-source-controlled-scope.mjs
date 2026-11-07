#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const EXPECTED_SCHEMA = 'platform-v7.concurrent-scope.v1';
const branch = String(process.env.GITHUB_HEAD_REF || '').trim();
const scopeDirectory = path.resolve(
  process.cwd(),
  process.env.P7_SCOPE_DIRECTORY || 'docs/platform-v7/autopilot/scopes',
);
const acceptedSourceManifests = {
  'fix/pc-crop-predecessor-5580-20261011': 'pc-crop-predecessor-5580-20261011.json',
  'fix/pc-crop-07b-routing-5580-20261011': 'pc-crop-07b-routing-5580-20261011.json',
  'fix/protected-entry-locale-5580-20261011': 'protected-entry-locale-5580-20261011.json',
};

function fail(message) {
  throw new Error(`P7_SOURCE_CONTROLLED_SCOPE:${message}`);
}

function asObject(value, file) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`scope manifest must be an object: ${file}`);
  }
  return value;
}

function readManifests() {
  let entries;
  try {
    entries = fs.readdirSync(scopeDirectory, { withFileTypes: true });
  } catch (error) {
    fail(`cannot read scope directory ${scopeDirectory}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map((filename) => {
      const file = path.join(scopeDirectory, filename);
      let parsed;
      try {
        parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (error) {
        fail(`malformed JSON ${filename}: ${error instanceof Error ? error.message : String(error)}`);
      }
      return { filename, value: asObject(parsed, filename) };
    });
}

function validateMatch(filename, scope) {
  if (scope.schemaVersion !== EXPECTED_SCHEMA) {
    fail(`unsupported schema for ${filename}: ${String(scope.schemaVersion)}`);
  }
  if (scope.status !== 'active') {
    fail(`matching scope is not active: ${filename}`);
  }
  if (!Array.isArray(scope.allowedPaths) || scope.allowedPaths.length === 0) {
    fail(`matching scope has no allowedPaths: ${filename}`);
  }
  const normalized = scope.allowedPaths.map((entry, index) => {
    if (typeof entry !== 'string') {
      fail(`allowedPaths[${index}] is not a string: ${filename}`);
    }
    const value = entry.trim();
    if (!value || value.includes('\\') || value === '..' || value.startsWith('../') || value.includes('/../')) {
      fail(`unsafe allowed path ${JSON.stringify(entry)}: ${filename}`);
    }
    return value.replace(/\/+$/u, '');
  });
  if (new Set(normalized).size !== normalized.length) {
    fail(`duplicate allowedPaths: ${filename}`);
  }
  return [...normalized].sort((left, right) => left.localeCompare(right, 'en'));
}

function acceptedSourceScope(filename) {
  const git = (...args) => execFileSync('git', args, {
    encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const file = 'docs/platform-v7/autopilot/scopes/' + filename;
  const base = git('rev-parse', '--verify', '--end-of-options',
    (process.env.BASE_REF || 'origin/main') + '^{commit}').trim();
  const head = git('rev-parse', '--verify', '--end-of-options',
    (process.env.HEAD_REF || 'HEAD') + '^{commit}').trim();
  if (!/^[a-f0-9]{40}$/u.test(base) || !/^[a-f0-9]{40}$/u.test(head)) fail('invalid source refs');
  if (git('rev-parse', 'HEAD').trim() !== head) fail('source checkout differs from exact HEAD');
  git('merge-base', '--is-ancestor', base, head);
  const entry = git('ls-tree', base, '--', file).trim();
  const match = /^100644 blob ([a-f0-9]{40})\t/u.exec(entry);
  if (!match || entry !== '100644 blob ' + match[1] + '\t' + file
      || git('ls-tree', head, '--', file).trim() !== entry || !fs.lstatSync(file).isFile()) {
    fail('source authority must remain a regular unchanged accepted-base manifest');
  }
  const bytes = fs.readFileSync(file);
  const blob = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
  if (blob !== match[1]) fail('working-tree source authority differs from accepted base');
  const scope = asObject(JSON.parse(git('show', base + ':' + file)), filename);
  if (scope.branch !== branch) fail('accepted source branch mismatch');
  const allowed = validateMatch(filename, scope);
  const changed = git('diff', '--no-renames', '--name-only', '-z', base, head)
    .split('\0').filter(Boolean).sort((left, right) => left.localeCompare(right, 'en'));
  if (JSON.stringify(changed) !== JSON.stringify(allowed)) fail('source diff must equal the exact accepted paths');
  for (const source of allowed) {
    if (!/^100644 blob [a-f0-9]{40}\t/u.test(git('ls-tree', head, '--', source).trim())) {
      fail('source leaf must be a regular100644 file');
    }
  }
  return allowed;
}

if (!branch) process.exit(0);
if (Object.hasOwn(acceptedSourceManifests, branch)) {
  try {
    const allowed = acceptedSourceScope(acceptedSourceManifests[branch]);
    process.stdout.write(allowed.join('\n') + '\n');
  } catch {
    fail('accepted source authority or complete diff rejected');
  }
  process.exit(0);
}
const manifests = readManifests();
const matches = manifests.filter(({ value }) => value.branch === branch);
if (matches.length > 1) {
  fail(`duplicate manifests for branch ${branch}: ${matches.map(({ filename }) => filename).join(', ')}`);
}
if (matches.length === 0) process.exit(0);
const allowedPaths = validateMatch(matches[0].filename, matches[0].value);
process.stdout.write(`${allowedPaths.join('\n')}\n`);
