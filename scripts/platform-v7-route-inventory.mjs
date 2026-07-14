import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const PLATFORM_ROOT = '/platform-v7';

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Required source is missing: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function extractQuotedRoutes(block) {
  return [...block.matchAll(/['"](\/platform-v7[^'"]*)['"]/g)].map((match) => match[1]);
}

function extractBlock(source, pattern, label) {
  const match = source.match(pattern);
  if (!match?.[1]) throw new Error(`Cannot parse ${label}`);
  return match[1];
}

function parseRoutePolicy(repoRoot) {
  const policyPath = path.join(repoRoot, 'apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
  const source = readRequired(policyPath);
  const exact = extractQuotedRoutes(extractBlock(
    source,
    /const DESIGN_SYSTEM_V8_EXACT_ROUTES = new Set\(\[([\s\S]*?)\]\);/,
    'Design System v8 exact routes',
  ));
  const prefixes = extractQuotedRoutes(extractBlock(
    source,
    /const DESIGN_SYSTEM_V8_PREFIX_ROUTES = \[([\s\S]*?)\] as const;/,
    'Design System v8 prefix routes',
  ));
  const aliases = extractQuotedRoutes(extractBlock(
    source,
    /export const LEGACY_ROUTE_ALIAS_INVENTORY_ROUTES = \[([\s\S]*?)\] as const;/,
    'central legacy route aliases',
  ));
  return {
    exact: new Set(exact.map(normalizeRoute)),
    prefixes: prefixes.map(normalizeRoute),
    aliases: new Set(aliases.map(normalizeRoute)),
  };
}

function parseLayoutPolicy(repoRoot) {
  const source = readRequired(path.join(repoRoot, 'apps/web/app/platform-v7/layout.tsx'));
  const auth = extractQuotedRoutes(extractBlock(
    source,
    /const AUTH_PATHS = new Set\(\[([\s\S]*?)\]\);/,
    'public auth routes',
  ));
  const publicExactBlock = extractBlock(
    source,
    /const PUBLIC_EXACT_PATHS = new Set\(\[([\s\S]*?)\]\);/,
    'public exact routes',
  );
  const publicExact = [PLATFORM_ROOT, ...auth, ...extractQuotedRoutes(publicExactBlock)];
  const publicPrefixes = extractQuotedRoutes(extractBlock(
    source,
    /const PUBLIC_PREFIX_PATHS = \[([\s\S]*?)\];/,
    'public prefix routes',
  ));
  const staffPrefix = source.match(/const STAFF_PREFIX = ['"]([^'"]+)['"];?/)?.[1];
  if (!staffPrefix) throw new Error('Cannot parse staff route prefix');
  return {
    exact: new Set(publicExact.map(normalizeRoute)),
    prefixes: publicPrefixes.map(normalizeRoute),
    staffPrefix: normalizeRoute(staffPrefix),
  };
}

function normalizeRoute(value) {
  const route = String(value || '').split('?')[0].replace(/\/$/, '');
  return route || PLATFORM_ROOT;
}

function routeMatches(route, exact, prefixes) {
  const normalized = normalizeRoute(route);
  return exact.has(normalized)
    || prefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

function walkPages(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walkPages(absolute, output);
    else if (entry.isFile() && entry.name === 'page.tsx') output.push(absolute);
  }
  return output;
}

function routeFromPage(appRoot, pagePath) {
  const relative = path.relative(appRoot, pagePath).split(path.sep);
  relative.pop();
  const routeSegments = relative.filter((segment) => {
    if (/^\(.+\)$/.test(segment)) return false;
    if (segment.startsWith('@')) return false;
    return true;
  });
  return normalizeRoute([PLATFORM_ROOT, ...routeSegments].join('/'));
}

function pageClassification({ route, source, v8Policy, layoutPolicy }) {
  if (routeMatches(route, layoutPolicy.exact, layoutPolicy.prefixes)) return 'public';
  if (route === layoutPolicy.staffPrefix || route.startsWith(`${layoutPolicy.staffPrefix}/`)) return 'staff-plane';
  if (/\bredirect\s*\(/.test(source)) return 'alias-redirect';
  if (v8Policy.aliases.has(normalizeRoute(route))) return 'alias-redirect';
  if (routeMatches(route, v8Policy.exact, v8Policy.prefixes)) return 'design-system-v8';
  return 'protected-legacy';
}

export function buildPlatformV7RouteInventory(repoRoot = DEFAULT_REPO_ROOT) {
  const resolvedRoot = path.resolve(repoRoot);
  const appRoot = path.join(resolvedRoot, 'apps/web/app/platform-v7');
  if (!fs.existsSync(appRoot)) throw new Error(`Platform V7 app root is missing: ${appRoot}`);

  const v8Policy = parseRoutePolicy(resolvedRoot);
  const layoutPolicy = parseLayoutPolicy(resolvedRoot);
  const pages = walkPages(appRoot).sort((a, b) => a.localeCompare(b));
  const entries = pages.map((pagePath) => {
    const source = readRequired(pagePath);
    const route = routeFromPage(appRoot, pagePath);
    return {
      route,
      file: path.relative(resolvedRoot, pagePath).replaceAll(path.sep, '/'),
      classification: pageClassification({ route, source, v8Policy, layoutPolicy }),
      clientComponent: /^\s*['"]use client['"];?/m.test(source),
      importsLegacyRuntime: /PlatformV7(?:FullStyleRuntime|ProtectedTemplateRuntime|TemplateGuards|TemplateSwitch)/.test(source),
    };
  });

  const duplicateFiles = entries
    .map((entry) => entry.file)
    .filter((file, index, values) => values.indexOf(file) !== index);
  if (duplicateFiles.length > 0) throw new Error(`Duplicate page files in inventory: ${duplicateFiles.join(', ')}`);
  if (entries.some((entry) => !entry.route.startsWith(PLATFORM_ROOT))) {
    throw new Error('Inventory contains a route outside /platform-v7');
  }

  const counts = Object.fromEntries(
    ['public', 'staff-plane', 'alias-redirect', 'design-system-v8', 'protected-legacy']
      .map((classification) => [classification, entries.filter((entry) => entry.classification === classification).length]),
  );
  const legacyRoutes = entries
    .filter((entry) => entry.classification === 'protected-legacy')
    .map(({ route, file }) => ({ route, file }));

  return {
    schemaVersion: 2,
    generatedFrom: 'apps/web/app/platform-v7/**/page.tsx',
    policySources: [
      'apps/web/app/platform-v7/layout.tsx',
      'apps/web/lib/platform-v7/design-system-v8-route-policy.ts',
    ],
    summary: {
      pageFiles: entries.length,
      ...counts,
      legacyRouteFiles: legacyRoutes.length,
      zeroLegacy: legacyRoutes.length === 0,
    },
    legacyRoutes,
    routes: entries,
  };
}

function parseCli(argv) {
  const options = { repoRoot: DEFAULT_REPO_ROOT, output: null, requireZeroLegacy: false, compact: false };
  for (const argument of argv) {
    if (argument === '--require-zero-legacy') options.requireZeroLegacy = true;
    else if (argument === '--compact') options.compact = true;
    else if (argument.startsWith('--repo-root=')) options.repoRoot = argument.slice('--repo-root='.length);
    else if (argument.startsWith('--output=')) options.output = argument.slice('--output='.length);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseCli(process.argv.slice(2));
    const inventory = buildPlatformV7RouteInventory(options.repoRoot);
    const json = `${JSON.stringify(inventory, null, options.compact ? 0 : 2)}\n`;
    if (options.output) {
      const target = path.resolve(options.repoRoot, options.output);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, json, 'utf8');
    }
    process.stdout.write(json);
    const enforceZeroLegacy = options.requireZeroLegacy || process.env.CI === 'true';
    if (enforceZeroLegacy && !inventory.summary.zeroLegacy) process.exitCode = 1;
  } catch (error) {
    console.error(`[platform-v7-route-inventory] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
