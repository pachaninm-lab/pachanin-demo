#!/usr/bin/env node
// Builds the SBOM coverage evidence artifact.
//
// The denominator is discovered from the tracked tree. Two discovery passes are
// needed because a manifest list alone is not the set of dependency roots:
// a component can import third-party packages while declaring none.

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  classifyComponent,
  componentOf,
  declaresNoDependencies,
  ecosystemFor,
  isDependencyManifest,
  summarise,
} from './sbom-coverage-model.mjs';

export { isDependencyManifest, componentOf, ecosystemFor };

const NUL = String.fromCharCode(0);

const PY_STDLIB = new Set([
  '__future__', 'abc', 'argparse', 'ast', 'asyncio', 'base64', 'collections', 'contextlib', 'copy',
  'csv', 'dataclasses', 'datetime', 'decimal', 'enum', 'functools', 'glob', 'hashlib', 'hmac', 'http',
  'importlib', 'inspect', 'io', 'ipaddress', 'itertools', 'json', 'logging', 'math', 'os', 'pathlib',
  'pickle', 'platform', 'random', 're', 'secrets', 'shutil', 'signal', 'socket', 'sqlite3', 'statistics',
  'string', 'subprocess', 'sys', 'tempfile', 'textwrap', 'threading', 'time', 'traceback', 'types',
  'typing', 'unittest', 'urllib', 'uuid', 'warnings', 'weakref', 'xml', 'zipfile', 'zoneinfo',
  'concurrent', 'email', 'fcntl', 'grp', 'html', 'imaplib', 'mimetypes', 'posixpath', 'pwd',
  'shlex', 'smtplib', 'ssl', 'stat', 'struct', 'unicodedata', 'binascii', 'base64', 'gzip',
  'tarfile', 'select', 'errno', 'operator', 'copyreg', 'queue', 'heapq', 'bisect', 'calendar',
  'difflib', 'filecmp', 'fnmatch', 'getpass', 'gettext', 'locale', 'numbers', 'pprint', 'shelve',
]);

function git(args, repoRoot) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

function trackedPaths(repoRoot) {
  return git(['ls-files', '-z'], repoRoot).split(NUL).filter(Boolean).sort();
}

function readJson(repoRoot, relative) {
  try {
    return JSON.parse(readFileSync(join(repoRoot, relative), 'utf8'));
  } catch {
    return null;
  }
}

/** Top-level third-party imports, so a component with no manifest is still visible. */
export function thirdPartyImports(sources) {
  const found = new Set();
  for (const { path, text } of sources) {
    const localRoot = path.split('/').slice(0, -1).join('/');
    for (const match of String(text).matchAll(/^\s*(?:import|from)\s+([A-Za-z_][A-Za-z0-9_]*)/gmu)) {
      const module = match[1];
      if (PY_STDLIB.has(module)) continue;
      if (sources.some((source) => source.path.startsWith(`${localRoot}/${module}`))) continue;
      found.add(module);
    }
  }
  return [...found].sort();
}

/**
 * A component is a deployable unit, not a file. Grouping `scripts/a.py` and
 * `scripts/b.py` separately would inflate the denominator with fifteen
 * pseudo-components and bury the one that matters.
 */
export function pythonComponentOf(path) {
  const parts = String(path).split('/');
  if (parts.length <= 1) return '.';
  if (['apps', 'packages', 'infra'].includes(parts[0])) {
    return parts.length >= 3 ? parts.slice(0, 2).join('/') : parts[0];
  }
  return parts[0];
}

/**
 * Path-aware, because a bare substring test is wrong here: the component
 * `scripts` matches `--ignore-scripts` in every install line, which would
 * report a build reference that does not exist.
 */
function referencesComponentPath(repoRoot, path, component) {
  let text;
  try {
    text = readFileSync(join(repoRoot, path), 'utf8');
  } catch {
    return false;
  }
  return new RegExp(`(?:^|[\\s"'=:(,/])${component.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}/`, 'u').test(text);
}

/**
 * A component cannot execute in an image that has no interpreter for its
 * ecosystem. The runtime stages here are distroless Node images, so Python
 * files copied into the build stage are never runnable in production.
 */
function runtimeLacksInterpreter(repoRoot, dockerfiles, ecosystem) {
  if (ecosystem !== 'python') return null;
  if (dockerfiles.length === 0) {
    return {
      condition: 'no production runtime image can execute this component',
      holds: true,
      evidence: 'no container image copies this component',
    };
  }
  const runtimeBases = [];
  for (const path of dockerfiles) {
    let text;
    try {
      text = readFileSync(join(repoRoot, path), 'utf8');
    } catch {
      continue;
    }
    const stages = [...text.matchAll(/^FROM\s+(\S+)(?:\s+AS\s+(\S+))?/gmu)];
    const runtime = stages.filter((stage) => /runtime|final|prod/iu.test(stage[2] ?? '')).map((stage) => stage[1]);
    runtimeBases.push(...(runtime.length > 0 ? runtime : [stages.at(-1)?.[1]].filter(Boolean)));
  }
  const withPython = runtimeBases.filter((base) => /python/iu.test(base));
  return {
    condition: 'no production runtime image can execute this component',
    holds: runtimeBases.length > 0 && withPython.length === 0,
    evidence: withPython.length === 0
      ? `runtime bases: ${[...new Set(runtimeBases)].sort().join(', ')}`
      : `python-capable runtime bases: ${withPython.join(', ')}`,
  };
}

/**
 * Conditions are re-evaluated on every run. The exclusion only stands while all
 * of them still hold, so a component cannot quietly become deployable again.
 */
function buildExclusion({ repoRoot, component, tracked, rootScripts, optionalRuntime, ecosystem }) {
  const declared = (optionalRuntime?.contours ?? []).find((contour) => contour.path === component);

  const dockerRefs = tracked
    .filter((path) => /(^|\/)Dockerfile[^/]*$/u.test(path))
    .filter((path) => referencesComponentPath(repoRoot, path, component));

  const deployRefs = tracked
    .filter((path) => /^infra\/(k8s|helm)\//u.test(path))
    .filter((path) => referencesComponentPath(repoRoot, path, component));

  const builtByRoot = Object.values(rootScripts ?? {}).some((script) => new RegExp(`(?:^|[\\s"'=:(,])${component}/`, 'u').test(String(script)));

  const interpreter = runtimeLacksInterpreter(repoRoot, dockerRefs, ecosystem);

  const conditions = [];

  // For an interpreted ecosystem, "cannot execute" is the honest test and it
  // subsumes the file-copy question: being copied into a build stage does not
  // make a Python file runnable in a distroless Node runtime. For everything
  // else, presence in an image is itself the signal.
  if (interpreter) {
    conditions.push(interpreter);
  } else {
    conditions.push({
      condition: 'no container image builds this component',
      holds: dockerRefs.length === 0,
      evidence: dockerRefs.length === 0 ? 'no Dockerfile references the component' : `referenced by ${dockerRefs.join(', ')}`,
    });
  }

  conditions.push(
    {
      condition: 'no root build script produces this component',
      holds: !builtByRoot,
      evidence: builtByRoot ? 'referenced by a root package.json script' : 'absent from all root scripts',
    },
    {
      condition: 'no deployment manifest ships this component',
      holds: deployRefs.length === 0,
      evidence: deployRefs.length === 0 ? 'absent from infra/k8s and infra/helm' : `referenced by ${deployRefs.join(', ')}`,
    },
  );

  if (declared) {
    conditions.push({
      condition: 'declared NOT_DEPLOYABLE in the source-controlled optional-runtime inventory',
      holds: declared.status === 'NOT_DEPLOYABLE' && declared.releaseAuthority !== true,
      evidence: `optional-runtime-inventory contour ${declared.id} status=${declared.status}`,
    });
  }

  return {
    reason: declared ? 'DECLARED_NOT_DEPLOYABLE_OPTIONAL_RUNTIME' : 'NOT_BUILT_NOT_DEPLOYED_NOT_IN_WORKSPACE',
    authority: declared
      ? 'docs/platform-v7/autopilot/optional-runtime-inventory.json'
      : 'AGENTS.md and the absence of build, container and deployment paths',
    conditions,
  };
}

export function buildCoverage({ repoRoot, sbomMap }) {
  const tracked = trackedPaths(repoRoot);
  const rootPackage = readJson(repoRoot, 'package.json') ?? {};
  const optionalRuntime = readJson(repoRoot, 'docs/platform-v7/autopilot/optional-runtime-inventory.json');

  const manifests = tracked.filter(isDependencyManifest);
  const manifestComponents = new Set(manifests.map(componentOf));
  const records = [];

  for (const manifest of manifests) {
    const component = componentOf(manifest);
    const ecosystem = ecosystemFor(manifest);
    let dependencyBearing = true;

    if (ecosystem === 'npm') {
      dependencyBearing = !declaresNoDependencies(readJson(repoRoot, manifest));
    }

    const covering = sbomMap[manifest] ?? [];
    const exclusion = covering.length === 0 && dependencyBearing
      ? buildExclusion({ repoRoot, component, tracked, rootScripts: rootPackage.scripts, optionalRuntime, ecosystem })
      : null;

    records.push(classifyComponent({ component, manifest, ecosystem, dependencyBearing, coveringSbom: covering, exclusion }));
  }

  const pythonRoots = new Map();
  for (const path of tracked) {
    if (!path.endsWith('.py')) continue;
    const top = pythonComponentOf(path);
    if (manifestComponents.has(top)) continue;
    if (!pythonRoots.has(top)) pythonRoots.set(top, []);
    pythonRoots.get(top).push(path);
  }

  for (const [component, paths] of [...pythonRoots.entries()].sort()) {
    const sources = paths.map((path) => {
      try {
        return { path, text: readFileSync(join(repoRoot, path), 'utf8') };
      } catch {
        return { path, text: '' };
      }
    });
    const external = thirdPartyImports(sources);
    if (external.length === 0) continue;

    const covering = sbomMap[component] ?? [];
    const exclusion = covering.length === 0
      ? buildExclusion({ repoRoot, component, tracked, rootScripts: rootPackage.scripts, optionalRuntime, ecosystem: 'python' })
      : null;

    records.push({
      ...classifyComponent({ component, manifest: null, ecosystem: 'python', dependencyBearing: true, coveringSbom: covering, exclusion }),
      undeclaredImports: external,
    });
  }

  return summarise(records);
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(report, sourceSha) {
  const columns = ['source_sha', 'component', 'manifest', 'ecosystem', 'status', 'reason', 'covering_sbom', 'exclusion_authority'];
  const rows = report.records.map((record) => [
    sourceSha,
    record.component,
    record.manifest ?? '',
    record.ecosystem ?? '',
    record.status,
    record.reason,
    (record.coveringSbom ?? []).join(' '),
    record.justification?.authority ?? '',
  ].map(csvCell).join(','));
  return `${[columns.join(','), ...rows].join('\n')}\n`;
}

function requireNonEmptyFile(root, relativePath) {
  const path = join(root, relativePath);
  if (!existsSync(path)) throw new Error(`SBOM coverage evidence missing: ${relativePath}`);
  const metadata = lstatSync(path);
  if (!metadata.isFile() || metadata.size === 0) throw new Error(`SBOM coverage evidence is not a non-empty file: ${relativePath}`);
}

const NODE_SBOM = ['sbom/sbom-node.cdx.json', 'sbom/sbom-node.spdx.json'];
const TAI_SBOM = ['sbom/sbom-tai.cdx.json', 'sbom/sbom-tai.spdx.json'];

export const CANONICAL_SBOM_MAP = {
  'package.json': NODE_SBOM,
  'apps/api/package.json': NODE_SBOM,
  'apps/web/package.json': NODE_SBOM,
  'apps/tai/pyproject.toml': TAI_SBOM,
};

function main() {
  const outDir = process.argv[2] ?? 'artifacts/ip-clean-room';
  const repoRoot = process.cwd();
  mkdirSync(outDir, { recursive: true });

  const sourceSha = git(['rev-parse', 'HEAD'], repoRoot).trim();

  // The canonical map lives in source control so the mapping itself is
  // reviewable, rather than being a constant only this script knows about.
  const scopePath = process.argv[3] ?? 'docs/ip/sbom-coverage-scope.json';
  const scope = readJson(repoRoot, scopePath);
  if (!scope || scope.schemaVersion !== 2 || !Array.isArray(scope.canonicalSboms)) {
    console.error(`SBOM_COVERAGE: FAIL_CLOSED - unusable coverage scope at ${scopePath}`);
    return 1;
  }
  const sbomMap = Object.fromEntries(scope.canonicalSboms.map((entry) => [entry.manifest, entry.artifacts]));
  const report = buildCoverage({ repoRoot, sbomMap });

  if (process.argv.includes('--strict')) {
    for (const artifact of [...new Set(Object.values(sbomMap).flat())]) requireNonEmptyFile(outDir, artifact);
  }

  const payload = {
    schemaVersion: 2,
    sourceSha,
    scopeNote: scope.definition,
    boundaries: scope.boundaries ?? [],
    totals: report.totals,
    complete: report.complete,
    records: report.records,
  };

  writeFileSync(join(outDir, 'SBOM_COVERAGE.json'), `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(join(outDir, 'SBOM_COVERAGE.csv'), toCsv(report, sourceSha));

  const lines = [
    '# SBOM Coverage',
    '',
    `Source SHA: \`${sourceSha}\``,
    '',
    `- dependency roots: **${report.totals.total}**`,
    `- covered: **${report.totals.covered}** (${report.totals.coveragePercent}%)`,
    `- uncovered: **${report.totals.uncovered}**`,
    `- unknown: **${report.totals.unknown}**`,
    `- complete: **${report.complete}**`,
    '',
    '| Component | Ecosystem | Status | Reason |',
    '|---|---|---|---|',
    ...report.records.map((r) => `| \`${r.component}\` | ${r.ecosystem ?? '-'} | ${r.status} | ${r.reason} |`),
  ];
  writeFileSync(join(outDir, 'SBOM_COVERAGE.md'), `${lines.join('\n')}\n`);

  console.log(`SBOM coverage ${report.totals.covered}/${report.totals.total} (${report.totals.coveragePercent}%) complete=${report.complete} unknown=${report.totals.unknown}`);
  for (const record of report.records) {
    console.log(`  ${record.status.padEnd(31)} ${record.component} [${record.ecosystem ?? '-'}] ${record.reason}`);
  }

  if (report.totals.unknown > 0) {
    console.error('SBOM_COVERAGE: FAIL_CLOSED - unknown dependency roots present');
    return 1;
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
