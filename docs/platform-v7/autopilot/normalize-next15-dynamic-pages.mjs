#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const ROOT = resolve('.');
const APP_ROOT = resolve('apps/web/app');
const REPORT_PATH = resolve(process.env.NEXT15_DYNAMIC_REPORT ?? 'artifacts/next15/dynamic-pages.json');

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.name === 'page.tsx' || entry.name === 'page.ts') files.push(absolute);
  }
  return files;
}

function repositoryPath(absolute) {
  return relative(ROOT, absolute).split(sep).join('/');
}

function dynamicPage(absolute) {
  return repositoryPath(absolute).split('/').some((segment) => segment.startsWith('[') && segment.endsWith(']'));
}

function addUseParamsImport(source) {
  const existing = /import\s*\{([^}]*)\}\s*from\s*['"]next\/navigation['"];?/m.exec(source);
  if (existing) {
    const names = existing[1].split(',').map((value) => value.trim()).filter(Boolean);
    if (!names.includes('useParams')) names.push('useParams');
    return source.replace(existing[0], `import { ${names.join(', ')} } from 'next/navigation';`);
  }

  const directive = /^(['"]use client['"];?\s*)/m.exec(source);
  if (!directive) throw new Error('Client page has no use-client directive.');
  return source.replace(directive[0], `${directive[0].trimEnd()}\n\nimport { useParams } from 'next/navigation';\n`);
}

function normalizeType(typeBody) {
  return typeBody.replace(/\s+/g, ' ').trim().replace(/;$/, '');
}

function transformDestructured(source, isClient) {
  const pattern = /export\s+default\s+(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(\s*\{\s*params\s*\}\s*:\s*\{\s*params\s*:\s*\{([^{}]+)\}\s*;?\s*\}\s*\)\s*\{/m;
  const match = pattern.exec(source);
  if (!match) return null;

  const name = match[2];
  const typeBody = normalizeType(match[3]);
  if (isClient) {
    let next = addUseParamsImport(source);
    next = next.replace(pattern, `export default function ${name}() {\n  const params = useParams<{ ${typeBody} }>();`);
    return next;
  }

  let next = source.replace(
    pattern,
    `export default async function ${name}({ params }: { params: Promise<{ ${typeBody} }> }) {\n  const resolvedParams = await params;`,
  );
  const signatureEnd = next.indexOf('const resolvedParams = await params;') + 'const resolvedParams = await params;'.length;
  next = `${next.slice(0, signatureEnd)}${next.slice(signatureEnd).replace(/\bparams\./g, 'resolvedParams.')}`;
  return next;
}

function transformNamedProps(source, isClient) {
  const pattern = /export\s+default\s+(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(\s*([A-Za-z_$][\w$]*)\s*:\s*\{\s*params\s*:\s*\{([^{}]+)\}\s*;?\s*\}\s*\)\s*\{/m;
  const match = pattern.exec(source);
  if (!match) return null;

  const name = match[2];
  const propsName = match[3];
  const typeBody = normalizeType(match[4]);
  if (isClient) {
    let next = addUseParamsImport(source);
    next = next.replace(pattern, `export default function ${name}() {\n  const params = useParams<{ ${typeBody} }>();`);
    const signatureEnd = next.indexOf(`const params = useParams<{ ${typeBody} }>();`) + `const params = useParams<{ ${typeBody} }>();`.length;
    next = `${next.slice(0, signatureEnd)}${next.slice(signatureEnd).replace(new RegExp(`\\b${propsName}\\.params\\.`, 'g'), 'params.')}`;
    return next;
  }

  let next = source.replace(
    pattern,
    `export default async function ${name}(${propsName}: { params: Promise<{ ${typeBody} }> }) {\n  const params = await ${propsName}.params;`,
  );
  const signatureEnd = next.indexOf(`const params = await ${propsName}.params;`) + `const params = await ${propsName}.params;`.length;
  next = `${next.slice(0, signatureEnd)}${next.slice(signatureEnd).replace(new RegExp(`\\b${propsName}\\.params\\.`, 'g'), 'params.')}`;
  return next;
}

function hasSynchronousDefaultParams(source) {
  return /export\s+default\s+(?:async\s+)?function[\s\S]{0,360}?\bparams\s*:\s*\{/.test(source);
}

const changed = [];
const unresolved = [];
const inspected = [];

for (const absolute of walk(APP_ROOT).filter(dynamicPage)) {
  const file = repositoryPath(absolute);
  inspected.push(file);
  const original = readFileSync(absolute, 'utf8');
  if (!hasSynchronousDefaultParams(original)) continue;

  const isClient = /^\s*['"]use client['"];?/m.test(original);
  const transformed = transformDestructured(original, isClient) ?? transformNamedProps(original, isClient);
  if (!transformed || transformed === original || hasSynchronousDefaultParams(transformed)) {
    unresolved.push(file);
    continue;
  }

  writeFileSync(absolute, transformed);
  changed.push({ file, mode: isClient ? 'useParams' : 'promise-await' });
}

for (const absolute of walk(APP_ROOT).filter(dynamicPage)) {
  const file = repositoryPath(absolute);
  const source = readFileSync(absolute, 'utf8');
  if (hasSynchronousDefaultParams(source) && !unresolved.includes(file)) unresolved.push(file);
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  inspectedCount: inspected.length,
  changedCount: changed.length,
  changed,
  unresolved,
  passed: unresolved.length === 0,
};
mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify(report, null, 2));
if (unresolved.length > 0) {
  console.error(`Unresolved synchronous dynamic page params: ${unresolved.join(', ')}`);
  process.exit(1);
}

if (!existsSync(resolve('apps/web/package.json'))) process.exit(1);
