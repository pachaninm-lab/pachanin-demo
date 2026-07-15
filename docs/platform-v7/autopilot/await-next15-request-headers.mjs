#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['apps/web/app', 'apps/web/lib', 'apps/web/components'];
const SOURCE_EXTENSIONS = /\.(?:ts|tsx)$/;
const changed = [];

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink()) return [];
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return SOURCE_EXTENSIONS.test(entry.name) ? [absolute] : [];
  });
}

function allSourceFiles() {
  return ROOTS.flatMap(sourceFiles);
}

function awaitHelperCalls(source, helper) {
  return source.replace(new RegExp(`(?<!\\bawait\\s)(?<!function\\s)\\b${helper}\\s*\\(`, 'g'), `await ${helper}(`);
}

function normalizeGeneratedTypes(source) {
  return source
    .replace(/Promise<Promise<RegisterSearchParams> \| RegisterSearchParams>/g, 'Promise<RegisterSearchParams>')
    .replace(/Promise<Promise<ContactSearchParams> \| ContactSearchParams>/g, 'Promise<ContactSearchParams>')
    .replace(/Promise<Promise<\{ caseId: string \}> \| \{ caseId: string \}>/g, 'Promise<{ caseId: string }>')
    .replace(/Promise<Promise<Record<string, string \| string\[\] \| undefined>> \| Record<string, string \| string\[\] \| undefined>>/g, 'Promise<Record<string, string | string[] | undefined>>')
    .replace(/const searchParams = await props\.searchParams;\n\s*const params = await Promise\.resolve\(searchParams \?\? \{\}\);/g, 'const params = (await props.searchParams) ?? {};')
    .replace(/const params = await props\.params;\n\s*const \{ caseId \} = await Promise\.resolve\(params\);/g, 'const { caseId } = await props.params;')
    .replace(/Awaited<Awaited<(?:Awaited<)*ReturnType<typeof cookies>(?:>)*/g, 'Awaited<ReturnType<typeof cookies>>')
    .replace(/'use client';;/g, "'use client';");
}

for (const path of allSourceFiles()) {
  let source = readFileSync(path, 'utf8');
  const original = source;

  source = normalizeGeneratedTypes(source);
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
for (const path of allSourceFiles()) {
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
  for (const marker of ['@next-codemod-error', 'UnsafeUnwrapped', 'Awaited<Awaited<', 'Promise<Promise<', "'use client';;"]) {
    if (source.includes(marker)) violations.push(`${path}: ${marker}`);
  }
}

if (violations.length > 0) {
  throw new Error(`Next.js 15 migration is incomplete:\n${violations.join('\n')}`);
}
if (changed.length === 0) throw new Error('Next.js 15 migration changed no files.');

console.log(`Normalized Next.js 15 contracts in ${changed.length} files.`);
for (const path of changed) console.log(path);
