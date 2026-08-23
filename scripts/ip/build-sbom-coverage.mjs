import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export function workspacePatternMatches(directory, pattern) {
  const normalizedDirectory = String(directory ?? '').replace(/^\.\//u, '').replace(/\/$/u, '');
  const normalizedPattern = String(pattern ?? '').replace(/^\.\//u, '').replace(/\/$/u, '');
  if (!normalizedDirectory || !normalizedPattern) return false;

  const expression = normalizedPattern
    .split('/')
    .map((segment) => {
      if (segment === '*') return '[^/]+';
      if (segment === '**') return '.+';
      return escapeRegex(segment).replaceAll('\\*', '[^/]*');
    })
    .join('/');
  return new RegExp(`^${expression}$`, 'u').test(normalizedDirectory);
}

export function parsePnpmImporters(lockfileText) {
  const importers = new Set();
  let inside = false;
  for (const line of String(lockfileText ?? '').split(/\r?\n/u)) {
    if (!inside) {
      if (line === 'importers:') inside = true;
      continue;
    }
    if (line && !/^\s/u.test(line)) break;
    const match = line.match(/^  (\S[^:]*):\s*$/u);
    if (!match) continue;
    let value = match[1].trim();
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
      value = value.slice(1, -1);
    }
    importers.add(value);
  }
  return importers;
}

export function isDependencyManifest(path) {
  return path === 'package.json'
    || path.endsWith('/package.json')
    || path === 'pyproject.toml'
    || path.endsWith('/pyproject.toml');
}

function packageDirectory(path) {
  return path === 'package.json' ? '.' : dirname(path).replaceAll('\\', '/');
}

function workspacePatterns(rootPackage) {
  if (Array.isArray(rootPackage.workspaces)) return rootPackage.workspaces.map(String);
  if (Array.isArray(rootPackage.workspaces?.packages)) return rootPackage.workspaces.packages.map(String);
  return [];
}

export function classifyCoverage({ trackedPaths, rootPackage, pnpmImporters, dedicatedSboms }) {
  const manifests = [...new Set(trackedPaths.filter(isDependencyManifest))].sort();
  const patterns = workspacePatterns(rootPackage);
  const dedicated = new Map((dedicatedSboms ?? []).map((item) => [item.manifest, item]));

  return manifests.map((manifest) => {
    if (manifest === 'package.json' || manifest.endsWith('/package.json')) {
      const directory = packageDirectory(manifest);
      const inWorkspace = manifest === 'package.json' || patterns.some((pattern) => workspacePatternMatches(directory, pattern));
      if (!inWorkspace) {
        return {
          manifest,
          ecosystem: 'node',
          status: 'UNCOVERED',
          reason: 'PACKAGE_MANIFEST_OUTSIDE_PNPM_WORKSPACE_OR_DEDICATED_SBOM',
          evidence: [],
        };
      }
      const importer = manifest === 'package.json' ? '.' : directory;
      if (!pnpmImporters.has(importer)) {
        return {
          manifest,
          ecosystem: 'node',
          status: 'UNCOVERED',
          reason: 'PNPM_LOCK_IMPORTER_MISSING',
          evidence: [],
        };
      }
      return {
        manifest,
        ecosystem: 'node',
        status: 'COVERED',
        reason: 'PNPM_WORKSPACE_LOCKED_AND_CANONICAL_SBOM_GENERATED',
        evidence: ['sbom/sbom-node.cdx.json', 'sbom/sbom-node.spdx.json'],
      };
    }

    const declaration = dedicated.get(manifest);
    if (!declaration) {
      return {
        manifest,
        ecosystem: 'python',
        status: 'UNCOVERED',
        reason: 'PYTHON_MANIFEST_WITHOUT_DEDICATED_SBOM',
        evidence: [],
      };
    }
    return {
      manifest,
      ecosystem: declaration.ecosystem ?? 'python',
      status: 'COVERED',
      reason: 'DEDICATED_CANONICAL_SBOM_GENERATED',
      evidence: [declaration.cycloneDx, declaration.spdx],
    };
  });
}

export function assertKnownGaps(records, knownGaps) {
  const actual = new Map(records.filter((record) => record.status !== 'COVERED').map((record) => [record.manifest, record.reason]));
  const expected = new Map((knownGaps ?? []).map((gap) => [gap.manifest, gap.reason]));

  const unexpected = [...actual.entries()].filter(([manifest, reason]) => expected.get(manifest) !== reason);
  const stale = [...expected.entries()].filter(([manifest, reason]) => actual.get(manifest) !== reason);
  if (unexpected.length || stale.length) {
    const detail = [
      unexpected.length ? `unexpected=${unexpected.map(([path, reason]) => `${path}:${reason}`).join(',')}` : '',
      stale.length ? `stale=${stale.map(([path, reason]) => `${path}:${reason}`).join(',')}` : '',
    ].filter(Boolean).join(' ');
    throw new Error(`SBOM coverage scope drift: ${detail}`);
  }
}

function requireNonEmptyFile(root, relativePath) {
  const path = join(root, relativePath);
  if (!existsSync(path)) throw new Error(`SBOM coverage evidence missing: ${relativePath}`);
  const metadata = lstatSync(path);
  if (!metadata.isFile() || metadata.size === 0) throw new Error(`SBOM coverage evidence is not a non-empty file: ${relativePath}`);
}

function readTrackedPaths(repoRoot) {
  return execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\u0000')
    .filter(Boolean)
    .map((path) => path.replaceAll('\\', '/'));
}

function sourceSha(repoRoot) {
  const value = process.env.SOURCE_SHA
    || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/u.test(value)) throw new Error(`Invalid source SHA: ${value}`);
  return value;
}

function markdown(report) {
  const lines = [
    '# SBOM coverage evidence',
    '',
    `Source: \`${report.sourceSha}\``,
    '',
    `Status: **${report.status}**`,
    '',
    `Coverage: **${report.totals.covered}/${report.totals.manifests} (${report.totals.coveragePercent}%)** tracked dependency manifest roots.`,
    '',
    '| Manifest | Ecosystem | Status | Evidence / reason |',
    '| --- | --- | --- | --- |',
    ...report.manifests.map((item) => `| \`${item.manifest}\` | ${item.ecosystem} | ${item.status} | ${item.status === 'COVERED' ? item.evidence.map((path) => `\`${path}\``).join(', ') : item.reason} |`),
    '',
    '## Boundaries',
    '',
    ...report.boundaries.map((boundary) => `- ${boundary}`),
    '',
  ];
  return lines.join('\n');
}

export function buildCoverageReport({ repoRoot, outDir, config }) {
  const trackedPaths = readTrackedPaths(repoRoot);
  const rootPackage = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  const lockfile = readFileSync(join(repoRoot, 'pnpm-lock.yaml'), 'utf8');
  const pnpmImporters = parsePnpmImporters(lockfile);
  const records = classifyCoverage({
    trackedPaths,
    rootPackage,
    pnpmImporters,
    dedicatedSboms: config.dedicatedSboms,
  });

  if (!records.length) throw new Error('SBOM coverage inventory is empty');
  assertKnownGaps(records, config.knownGaps);

  requireNonEmptyFile(outDir, config.nodeWorkspaceSbom.cycloneDx);
  requireNonEmptyFile(outDir, config.nodeWorkspaceSbom.spdx);
  for (const declaration of config.dedicatedSboms ?? []) {
    if (!records.some((record) => record.manifest === declaration.manifest)) {
      throw new Error(`Dedicated SBOM declaration is stale or untracked: ${declaration.manifest}`);
    }
    requireNonEmptyFile(outDir, declaration.cycloneDx);
    requireNonEmptyFile(outDir, declaration.spdx);
  }

  const covered = records.filter((record) => record.status === 'COVERED').length;
  const uncovered = records.length - covered;
  const coveragePercent = Number(((covered / records.length) * 100).toFixed(2));
  return {
    schemaVersion: 1,
    sourceSha: sourceSha(repoRoot),
    generatedAt: new Date().toISOString(),
    scopeId: config.scopeId,
    definition: config.definition,
    status: uncovered === 0 ? 'COMPLETE' : 'BASELINE_WITH_KNOWN_GAPS',
    totals: {
      manifests: records.length,
      covered,
      uncovered,
      coveragePercent,
    },
    manifests: records,
    knownGaps: config.knownGaps ?? [],
    boundaries: config.boundaries ?? [],
  };
}

function main() {
  const repoRoot = resolve(process.cwd());
  const outDir = resolve(process.argv[2] ?? 'artifacts/ip-clean-room');
  const configPath = resolve(process.argv[3] ?? 'docs/ip/sbom-coverage-scope.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  if (config.schemaVersion !== 1) throw new Error(`Unsupported SBOM coverage scope schema: ${config.schemaVersion}`);

  const report = buildCoverageReport({ repoRoot, outDir, config });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'SBOM_COVERAGE.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(outDir, 'SBOM_COVERAGE.md'), markdown(report));
  console.log(`SBOM coverage ${report.totals.covered}/${report.totals.manifests} (${report.totals.coveragePercent}%): ${report.status}`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) main();
