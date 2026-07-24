#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const EXPECTED_SCHEMA = 'platform-v7.concurrent-scope.v1';
const branch = String(process.env.GITHUB_HEAD_REF || '').trim();
const scopeDirectory = path.resolve(
  process.cwd(),
  process.env.P7_SCOPE_DIRECTORY || 'docs/platform-v7/autopilot/scopes',
);

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

if (!branch) process.exit(0);
const manifests = readManifests();
const matches = manifests.filter(({ value }) => value.branch === branch);
if (matches.length > 1) {
  fail(`duplicate manifests for branch ${branch}: ${matches.map(({ filename }) => filename).join(', ')}`);
}
if (matches.length === 0) process.exit(0);
const allowedPaths = validateMatch(matches[0].filename, matches[0].value);
process.stdout.write(`${allowedPaths.join('\n')}\n`);
