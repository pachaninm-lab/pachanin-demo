import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const governancePath = path.join(root, 'design-governance-v8.json');

function fail(message) {
  console.error(`[design-system-v8] ${message}`);
  process.exitCode = 1;
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function walk(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [relativePath];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.posix.join(relativePath.replaceAll('\\', '/'), entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  });
}

if (!fs.existsSync(governancePath)) {
  fail('Missing design-governance-v8.json.');
  process.exit();
}

const governance = JSON.parse(fs.readFileSync(governancePath, 'utf8'));
const required = [
  governance.tokenSource,
  governance.tokenCss,
  'packages/design-tokens/package.json',
  'packages/design-system-v8/package.json',
  'packages/design-system-v8/src/index.ts',
];

for (const relativePath of required) {
  if (!fs.existsSync(path.join(root, relativePath))) fail(`Missing required artifact: ${relativePath}`);
}

try {
  const tokens = JSON.parse(readText(governance.tokenSource));
  if (!tokens.core || !tokens.semantic || !tokens.component || !tokens.context) {
    fail('Token source must contain core, semantic, component and context layers.');
  }
  if (!tokens.semantic?.action?.primary?.$value) {
    fail('Token source does not expose semantic.action.primary.');
  }
} catch (error) {
  fail(`Token source is invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
}

const extensions = new Set(['.ts', '.tsx', '.css', '.scss']);
const governedFiles = [
  ...governance.governedRoots.flatMap(walk),
  ...governance.migratedFiles,
].filter((relativePath, index, all) => all.indexOf(relativePath) === index && extensions.has(path.extname(relativePath)));

const checks = [
  {
    enabled: governance.rules.forbidInlineStyle,
    label: 'inline style',
    pattern: /\bstyle\s*=\s*\{\{/,
  },
  {
    enabled: governance.rules.forbidDangerousStyleInjection,
    label: 'dangerouslySetInnerHTML style injection',
    pattern: /dangerouslySetInnerHTML/,
  },
  {
    enabled: governance.rules.forbidLiteralColors,
    label: 'literal color',
    pattern: /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/,
  },
  {
    enabled: governance.rules.forbidImportant,
    label: '!important',
    pattern: /!important/,
  },
  {
    enabled: governance.rules.forbidLegacyStyleImports,
    label: 'legacy global style import',
    pattern: /(?:from\s+|import\s+)["']@\/styles\/platform-v7-|(?:from\s+|import\s+)["']@\/app\/v9/,
  },
];

for (const relativePath of governedFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    fail(`Governed file does not exist: ${relativePath}`);
    continue;
  }
  const content = readText(relativePath);
  for (const check of checks) {
    if (check.enabled && check.pattern.test(content)) fail(`${relativePath}: forbidden ${check.label}`);
  }
}

for (const relativePath of governance.migratedFiles) {
  const content = readText(relativePath);
  const consumesDesignSystem = content.includes('@pc/design-system-v8');
  const consumesTransactionUx = /(?:from\s+|import\s+)["']@\/components\/transaction-ux\//.test(content);
  if (!consumesDesignSystem && !consumesTransactionUx) {
    fail(`${relativePath}: migrated file must consume @pc/design-system-v8 or the governed transaction-ux boundary.`);
  }
}

if (!process.exitCode) {
  console.log(`[design-system-v8] PASS: ${governedFiles.length} governed files checked.`);
}
