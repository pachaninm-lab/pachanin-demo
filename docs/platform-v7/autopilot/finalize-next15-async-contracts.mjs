#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['apps/web/app', 'apps/web/lib'];
const excluded = new Set(['.next', 'node_modules', 'coverage', 'dist', 'out']);
const extensions = /\.(?:ts|tsx|js|jsx)$/;
const changed = [];

function sourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && excluded.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (entry.isFile() && extensions.test(entry.name)) files.push(path);
  }
  return files;
}

function awaitHeaderHelpers(source) {
  const lines = source.split('\n');
  return lines.map((line) => {
    if (/function\s+(?:runtimeAuthHeaders|serverAuthHeaders)\s*\(/.test(line)) return line;
    return line
      .replace(/(?<!await\s)runtimeAuthHeaders\s*\(/g, 'await runtimeAuthHeaders(')
      .replace(/(?<!await\s)serverAuthHeaders\s*\(/g, 'await serverAuthHeaders(');
  }).join('\n');
}

for (const file of roots.flatMap(sourceFiles)) {
  const original = readFileSync(file, 'utf8');
  let source = original;

  source = source
    .replace(/Promise<Promise<RegisterSearchParams> \| RegisterSearchParams>/g, 'Promise<RegisterSearchParams>')
    .replace(/Promise<Promise<ContactSearchParams> \| ContactSearchParams>/g, 'Promise<ContactSearchParams>')
    .replace(/Promise<Promise<\{ caseId: string \}> \| \{ caseId: string \}>/g, 'Promise<{ caseId: string }>')
    .replace(/Promise<Promise<Record<string, string \| string\[\] \| undefined>> \| Record<string, string \| string\[\] \| undefined>>/g, 'Promise<Record<string, string | string[] | undefined>>')
    .replace(/const searchParams = await props\.searchParams;\n\s*const params = await Promise\.resolve\(searchParams \?\? \{\}\);/g, 'const params = (await props.searchParams) ?? {};')
    .replace(/const params = await props\.params;\n\s*const \{ caseId \} = await Promise\.resolve\(params\);/g, 'const { caseId } = await props.params;')
    .replace(/'use client';;/g, "'use client';")
    .replace(/Awaited<Awaited<Awaited<Awaited<ReturnType<typeof cookies>>>>>/g, 'Awaited<ReturnType<typeof cookies>>')
    .replace(/Awaited<Awaited<Awaited<Awaited<ReturnType<typeof cookies>>>>/g, 'Awaited<ReturnType<typeof cookies>>');

  source = awaitHeaderHelpers(source);

  if (source !== original) {
    writeFileSync(file, source);
    changed.push(file);
  }
}

const violations = [];
for (const file of roots.flatMap(sourceFiles)) {
  const source = readFileSync(file, 'utf8');
  for (const marker of ['@next-codemod-error', 'UnsafeUnwrapped', 'Awaited<Awaited<', 'Promise<Promise<', "'use client';;"]) {
    if (source.includes(marker)) violations.push(`${file}: ${marker}`);
  }
  if (/headers:\s*(?:runtimeAuthHeaders|serverAuthHeaders)\s*\(/.test(source)) {
    violations.push(`${file}: unawaited headers helper`);
  }
  if (/=\s*(?:runtimeAuthHeaders|serverAuthHeaders)\s*\(/.test(source)) {
    violations.push(`${file}: unawaited assigned headers helper`);
  }
}

if (violations.length > 0) {
  throw new Error(`Next.js 15 async contract cleanup incomplete:\n${violations.join('\n')}`);
}

console.log(`Normalized ${changed.length} files.`);
for (const file of changed) console.log(file);
