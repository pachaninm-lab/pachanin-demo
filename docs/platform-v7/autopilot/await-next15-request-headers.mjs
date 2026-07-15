#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'apps/web';
const SOURCE_EXTENSIONS = /\.(?:ts|tsx)$/;
const changed = [];

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return SOURCE_EXTENSIONS.test(entry.name) ? [absolute] : [];
  });
}

function awaitHelperCalls(source, helper) {
  return source.replace(new RegExp(`(?<!\\bawait\\s)(?<!function\\s)\\b${helper}\\s*\\(`, 'g'), `await ${helper}(`);
}

for (const path of sourceFiles(ROOT)) {
  let source = readFileSync(path, 'utf8');
  const original = source;

  if (!path.endsWith('/runtime-auth-helpers.ts')) {
    source = awaitHelperCalls(source, 'runtimeAuthHeaders');
  }
  if (!path.endsWith('/server-api.ts')) {
    source = awaitHelperCalls(source, 'serverAuthHeaders');
  }

  if (/from ['"]next\/headers['"]/.test(source)) {
    source = source.replace(/(?<!\bawait\s)\bheaders\s*\(\s*\)/g, 'await headers()');
  }

  if (source !== original) {
    writeFileSync(path, source);
    changed.push(path);
  }
}

const violations = [];
for (const path of sourceFiles(ROOT)) {
  const source = readFileSync(path, 'utf8');
  for (const helper of ['runtimeAuthHeaders', 'serverAuthHeaders']) {
    if (
      (path.endsWith('/runtime-auth-helpers.ts') && helper === 'runtimeAuthHeaders')
      || (path.endsWith('/server-api.ts') && helper === 'serverAuthHeaders')
    ) {
      continue;
    }
    const calls = source.match(new RegExp(`\\b${helper}\\s*\\(`, 'g'))?.length ?? 0;
    const awaited = source.match(new RegExp(`\\bawait\\s+${helper}\\s*\\(`, 'g'))?.length ?? 0;
    if (calls !== awaited) violations.push(`${path}: ${helper} calls=${calls}, awaited=${awaited}`);
  }
  if (/from ['"]next\/headers['"]/.test(source)) {
    const headerCalls = source.match(/\bheaders\s*\(\s*\)/g)?.length ?? 0;
    const awaitedHeaderCalls = source.match(/\bawait\s+headers\s*\(\s*\)/g)?.length ?? 0;
    if (headerCalls !== awaitedHeaderCalls) {
      violations.push(`${path}: headers calls=${headerCalls}, awaited=${awaitedHeaderCalls}`);
    }
  }
}

if (violations.length > 0) {
  throw new Error(`Next.js 15 request-header migration is incomplete:\n${violations.join('\n')}`);
}
if (changed.length === 0) throw new Error('Header migration changed no files.');

console.log(`Awaited request-header APIs in ${changed.length} files.`);
for (const path of changed) console.log(path);
