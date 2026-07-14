#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'apps/web';
const extensions = new Set(['.ts', '.tsx']);
const excludedDirectories = new Set(['.next', 'node_modules', 'coverage', 'dist', 'out']);
const changed = [];

function filesUnder(directory) {
  const output = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;

    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...filesUnder(path));
    else if (entry.isFile() && [...extensions].some((extension) => entry.name.endsWith(extension))) output.push(path);
  }
  return output;
}

function replaceExact(text, before, after, label) {
  if (!text.includes(before)) return text;
  const next = text.replace(before, after);
  if (next === text) throw new Error(`Failed to apply ${label}`);
  return next;
}

for (const path of filesUnder(ROOT)) {
  let text = readFileSync(path, 'utf8');
  const original = text;

  if (!text.includes('function runtimeAuthHeaders(')) {
    text = text.replace(/(?<!await )runtimeAuthHeaders\(/g, 'await runtimeAuthHeaders(');
  }
  if (!text.includes('function serverAuthHeaders(')) {
    text = text.replace(/(?<!await )serverAuthHeaders\(/g, 'await serverAuthHeaders(');
  }

  text = text.replace(
    /Awaited<Awaited<Awaited<Awaited<ReturnType<typeof cookies>>>>>/g,
    'Awaited<ReturnType<typeof cookies>>',
  );

  if (path === 'apps/web/app/api/auth/platform-v7-cabinet-login/route.ts') {
    text = "export { POST } from '@/app/api/platform-v7/cabinet-lock-login/route';\n";
  }

  if (path === 'apps/web/app/api/staff/[...path]/route.ts') {
    text = replaceExact(
      text,
      "async function proxy(request: NextRequest, context: { params: { path?: string[] } }) {\n  const method = request.method.toUpperCase();\n  const path = normalizePath(context.params.path || []);",
      "async function proxy(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {\n  const method = request.method.toUpperCase();\n  const { path: pathSegments } = await context.params;\n  const path = normalizePath(pathSegments || []);",
      'staff API proxy params',
    );
    text = text.replace(
      /return proxy\(request, \/\* @next-codemod-error[\s\S]*?\*\/\s*context\);/g,
      'return proxy(request, context);',
    );
  }

  if (path === 'apps/web/app/staff/[...path]/route.ts') {
    text = text.replace(
      /return handle\(request, \/\* @next-codemod-error[\s\S]*?\*\/\s*context\);/g,
      'return handle(request, context);',
    );
  }

  if (path === 'apps/web/app/platform-v7/contact/page.tsx') {
    text = text.replace(
      'props: { searchParams?: Promise<Promise<ContactSearchParams> | ContactSearchParams> }',
      'props: { searchParams?: Promise<ContactSearchParams> }',
    );
  }
  if (path === 'apps/web/app/platform-v7/register/page.tsx') {
    text = text.replace(
      'props: { searchParams?: Promise<Promise<RegisterSearchParams> | RegisterSearchParams> }',
      'props: { searchParams?: Promise<RegisterSearchParams> }',
    );
  }
  if (path === 'apps/web/app/platform-v7/support/detail/page.tsx') {
    text = text.replace(
      'searchParams?: Promise<Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>>;',
      'searchParams?: Promise<Record<string, string | string[] | undefined>>;',
    );
  }
  if (path === 'apps/web/app/platform-v7/support/[caseId]/page.tsx') {
    text = text.replace(
      'params: Promise<Promise<{ caseId: string }> | { caseId: string }>;',
      'params: Promise<{ caseId: string }>;',
    );
  }
  if (path === 'apps/web/app/platform-v7/deals/[id]/execution/page.tsx') {
    text = text.replace("'use client';;\nimport { use } from \"react\";", "'use client';\n\nimport { use } from 'react';");
    text = text.replace(
      /export default function PlatformV7DealExecutionPage\(props: \{ params: Promise<\{ id: string \}> \}\) \{\n const params = use\(props\.params\);\n const role = usePlatformV7RStore\(\(state\) => state\.role\);\n return <CanonicalDealWorkspace role=\{role\} dealId=\{params\.id\} \/>;\n\}/,
      "export default function PlatformV7DealExecutionPage(props: { params: Promise<{ id: string }> }) {\n  const params = use(props.params);\n  const role = usePlatformV7RStore((state) => state.role);\n  return <CanonicalDealWorkspace role={role} dealId={params.id} />;\n}",
    );
  }

  if (text !== original) {
    writeFileSync(path, text);
    changed.push(path);
  }
}

const forbidden = [
  'UnsafeUnwrapped',
  '@next-codemod',
  'Awaited<Awaited',
  'Promise<Promise',
  "'use client';;",
];
const violations = [];
for (const path of filesUnder(ROOT)) {
  const text = readFileSync(path, 'utf8');
  for (const marker of forbidden) {
    if (text.includes(marker)) violations.push(`${path}: ${marker}`);
  }
}
if (violations.length > 0) {
  throw new Error(`Next.js 15 codemod cleanup is incomplete:\n${violations.join('\n')}`);
}
if (changed.length === 0) throw new Error('Cleanup script changed no files.');
console.log(`Normalized ${changed.length} files.`);
for (const path of changed) console.log(path);
