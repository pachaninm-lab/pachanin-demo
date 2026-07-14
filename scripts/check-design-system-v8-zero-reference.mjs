import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const symbol = (...parts) => parts.join('');

const forbiddenFiles = [
  ['apps/web/components/platform-v7/', symbol('PlatformV7', 'FullStyleRuntime'), '.tsx'].join(''),
  ['apps/web/components/platform-v7/', symbol('PlatformV7', 'ProtectedTemplateRuntime'), '.tsx'].join(''),
  ['apps/web/components/platform-v7/', symbol('PlatformV7', 'TemplateGuards'), '.tsx'].join(''),
  ['apps/web/components/platform-v7/', symbol('PlatformV7', 'TemplateSwitch'), '.tsx'].join(''),
  ['apps/web/components/platform-v7/', symbol('PlatformV7', 'ProductionCopyPatch'), '.tsx'].join(''),
  ['apps/web/components/platform-v7/', symbol('PlatformV7', 'ScrollRestorationGuard'), '.tsx'].join(''),
  ['apps/web/components/v7r/', symbol('Shell', 'CopyNormalizer'), '.tsx'].join(''),
  ['apps/web/components/platform-v7/', symbol('PlatformV7', 'ViewportRuntimeGuard'), '.tsx'].join(''),
  ['apps/web/components/platform-v7/', symbol('PlatformV7', 'UniversalAdaptiveStyle'), '.tsx'].join(''),
  ['apps/web/components/platform-v7/', symbol('PlatformV7', 'BlankScreenGuard'), '.tsx'].join(''),
  ['apps/web/components/platform-v7/', symbol('PlatformV7', 'InteractionFixes'), '.tsx'].join(''),
  ['apps/web/components/platform-v7/', symbol('PlatformV7', 'MobileFinalGuard'), '.tsx'].join(''),
  ['apps/web/components/platform-v7/', symbol('PlatformV7', 'RoleLockFix'), '.tsx'].join(''),
  ['apps/web/components/platform-v7/', symbol('Viewport', 'StabilityGuard'), '.tsx'].join(''),
  ['apps/web/components/platform-v7/', symbol('Mobile', 'LogoutSoftExit'), '.tsx'].join(''),
  ['apps/web/components/platform-v7/', symbol('Login', 'MobileStabilityStyle'), '.tsx'].join(''),
  ['apps/web/components/platform-v7/', symbol('Login', 'HeaderLogoGuard'), '.tsx'].join(''),
  'apps/web/styles/platform-v7-dark-role-fixes.css',
];

const forbiddenTokens = [
  symbol('PlatformV7', 'FullStyleRuntime'),
  symbol('PlatformV7', 'ProtectedTemplateRuntime'),
  symbol('PlatformV7', 'TemplateGuards'),
  symbol('PlatformV7', 'TemplateSwitch'),
  symbol('PlatformV7', 'ProductionCopyPatch'),
  symbol('PlatformV7', 'ScrollRestorationGuard'),
  symbol('Shell', 'CopyNormalizer'),
  symbol('PlatformV7', 'ViewportRuntimeGuard'),
  symbol('PlatformV7', 'UniversalAdaptiveStyle'),
  symbol('PlatformV7', 'BlankScreenGuard'),
  symbol('PlatformV7', 'InteractionFixes'),
  symbol('PlatformV7', 'MobileFinalGuard'),
  symbol('PlatformV7', 'RoleLockFix'),
  symbol('Viewport', 'StabilityGuard'),
  symbol('Mobile', 'LogoutSoftExit'),
  symbol('Login', 'MobileStabilityStyle'),
  symbol('Login', 'HeaderLogoGuard'),
  symbol('NORMALIZED_', 'RUNTIME_COPY'),
  symbol('stabilize', 'DarkSurfaces'),
  symbol('data-p7-', 'dark-fixed'),
  'platform-v7-dark-role-fixes.css',
];

const productionRoots = [
  'apps/web/app/platform-v7',
  'apps/web/components/platform-v7',
  'apps/web/components/v7r',
];
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css']);
const violations = [];

for (const relativePath of forbiddenFiles) {
  if (fs.existsSync(path.join(repoRoot, relativePath))) {
    violations.push(`${relativePath}: forbidden legacy runtime artifact still exists`);
  }
}

function walk(relativeDirectory) {
  const absoluteDirectory = path.join(repoRoot, relativeDirectory);
  if (!fs.existsSync(absoluteDirectory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...walk(relativePath));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(relativePath);
  }
  return files;
}

for (const relativePath of productionRoots.flatMap(walk)) {
  const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  for (const token of forbiddenTokens) {
    if (source.includes(token)) violations.push(`${relativePath}: forbidden legacy token ${token}`);
  }
}

const criticalShellFiles = [
  'apps/web/app/platform-v7/layout.tsx',
  'apps/web/app/platform-v7/template.tsx',
  'apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx',
  'apps/web/components/platform-v7/PlatformV7LayoutClient.tsx',
  'apps/web/components/platform-v7/PlatformV7DesignSystemV8Runtime.tsx',
];
const forbiddenCriticalPatterns = [
  'MutationObserver',
  'ResizeObserver',
  'visualViewport',
  'requestAnimationFrame',
  'createTreeWalker',
  'getComputedStyle',
  'style.setProperty',
];

for (const relativePath of criticalShellFiles) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) continue;
  const source = fs.readFileSync(absolutePath, 'utf8');
  for (const token of forbiddenCriticalPatterns) {
    if (source.includes(token)) violations.push(`${relativePath}: forbidden shell patch primitive ${token}`);
  }
}

if (violations.length) {
  console.error('[platform-v7-legacy-runtime-zero] FAIL');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`[platform-v7-legacy-runtime-zero] PASS: ${forbiddenFiles.length} forbidden artifacts absent; production references are zero.`);
