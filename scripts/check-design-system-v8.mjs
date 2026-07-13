import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function walk(path) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) {
    fail(`Missing required path: ${path}`);
    return [];
  }
  const result = [];
  for (const name of readdirSync(absolute)) {
    const child = resolve(absolute, name);
    const stats = statSync(child);
    if (stats.isDirectory()) result.push(...walk(relative(root, child)));
    else result.push(relative(root, child).replaceAll('\\', '/'));
  }
  return result;
}

const governedSources = [
  ...walk('packages/design-system-v8/src'),
  ...walk('apps/web/components/transaction-ux'),
].filter((path) => ['.ts', '.tsx', '.css'].includes(extname(path)));

const literalColor = /(?:#[0-9a-fA-F]{3,8}\b|\brgba?\s*\()/g;
const inlineStyle = /\bstyle\s*=\s*\{\{/g;
const unsafeStyleInjection = /dangerouslySetInnerHTML/g;

for (const path of governedSources) {
  const source = read(path);
  if (inlineStyle.test(source)) fail(`${path}: inline React style is forbidden in v8 governed code`);
  inlineStyle.lastIndex = 0;
  if (unsafeStyleInjection.test(source)) fail(`${path}: dangerouslySetInnerHTML is forbidden in v8 governed code`);
  unsafeStyleInjection.lastIndex = 0;
  if (literalColor.test(source)) fail(`${path}: literal HEX/RGB color is forbidden; use @pc/design-tokens`);
  literalColor.lastIndex = 0;
}

const protectedShellPath = 'apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx';
const protectedShell = read(protectedShellPath);
if (!protectedShell.includes("@/components/transaction-ux/TransactionAppShell")) {
  fail(`${protectedShellPath}: canonical TransactionAppShell must be mounted`);
}
if (/AppShellV[1-9]|components\/v7r\/AppShell|components\/v9\/layout\/AppShell/.test(protectedShell)) {
  fail(`${protectedShellPath}: legacy AppShell import is forbidden`);
}

const fullStyleRuntimePath = 'apps/web/components/platform-v7/PlatformV7FullStyleRuntime.tsx';
const fullStyleRuntime = read(fullStyleRuntimePath);
if (!fullStyleRuntime.includes("@pc/design-system-v8/styles.css")) {
  fail(`${fullStyleRuntimePath}: Design System v8 stylesheet must be loaded`);
}

const canonicalShellPath = 'apps/web/components/transaction-ux/TransactionAppShell.tsx';
const canonicalShell = read(canonicalShellPath);
for (const forbidden of ['setRole(', 'role=', 'localStorage.getItem(\'role\')', 'localStorage.getItem("role")']) {
  if (canonicalShell.includes(forbidden)) fail(`${canonicalShellPath}: role switching/client role authority is forbidden (${forbidden})`);
}
if (!canonicalShell.includes('PLATFORM_V7_ROLE_NAVIGATION')) {
  fail(`${canonicalShellPath}: navigation must use the canonical role-navigation contract`);
}

const allowedShellFiles = new Set([
  'apps/web/components/app-shell.tsx',
  'apps/web/components/v7r/AppShell.tsx',
  'apps/web/components/v7r/AppShellV2.tsx',
  'apps/web/components/v7r/AppShellV3.tsx',
  'apps/web/components/v7r/AppShellV4.tsx',
  'apps/web/components/v9/layout/AppShell.tsx',
  canonicalShellPath,
]);

for (const path of walk('apps/web/components')) {
  if (!/AppShell.*\.tsx$|\/app-shell\.tsx$/.test(path)) continue;
  if (!allowedShellFiles.has(path)) fail(`${path}: new competing App Shell implementation is forbidden`);
}

const tokenPath = 'packages/design-tokens/src/tokens.json';
const tokens = JSON.parse(read(tokenPath));
if (tokens.$schema !== 'https://tr.designtokens.org/format/') {
  fail(`${tokenPath}: DTCG schema marker is missing`);
}
for (const density of ['compact', 'comfortable', 'field']) {
  if (!tokens?.size?.control?.[density]?.$value) fail(`${tokenPath}: missing ${density} density control token`);
}
if (tokens?.size?.control?.field?.$value?.value !== 48) {
  fail(`${tokenPath}: field touch target must remain 48px`);
}

const requiredExports = [
  'Button',
  'Surface',
  'StatusBadge',
  'KeyFactGrid',
  'NextActionPanel',
  'EmptyState',
  'AiTransparency',
  'WorkbenchTemplate',
  'AppFrame',
];
const designSystemEntry = read('packages/design-system-v8/src/index.tsx');
for (const component of requiredExports) {
  if (!designSystemEntry.includes(`export function ${component}`)) {
    fail(`packages/design-system-v8/src/index.tsx: missing required export ${component}`);
  }
}

if (failures.length) {
  console.error('Design System v8 gate failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Design System v8 gate passed (${governedSources.length} governed source files).`);
