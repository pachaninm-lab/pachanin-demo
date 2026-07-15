#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const INPUT_PATH = resolve(
  process.env.NPM_BULK_AUDIT_INPUT
    ?? 'artifacts/security/pnpm-production-dependencies.json',
);
const OUTPUT_PATH = resolve(
  process.env.PNPM_AUDIT_JSON
    ?? 'artifacts/security/pnpm-audit.json',
);
const REGISTRY = String(
  process.env.NPM_REGISTRY_URL ?? 'https://registry.npmjs.org',
).replace(/\/+$/, '');
const ENDPOINT = `${REGISTRY}/-/npm/v1/security/advisories/bulk`;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const DEPENDENCY_FIELDS = ['dependencies', 'optionalDependencies'];

function writeJson(value) {
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function fail(message, details = {}) {
  writeJson({
    error: {
      code: 'NPM_BULK_AUDIT_FAILURE',
      message,
      endpoint: ENDPOINT,
      ...details,
    },
  });
  console.error(message);
  process.exit(2);
}

function parseJsonFile(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${label} is missing or invalid JSON`, {
      path,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

function isExternalNode(node) {
  if (!node || typeof node !== 'object') return false;
  if (typeof node.path !== 'string' || node.path.length === 0) return true;
  return node.path.includes('/node_modules/') || node.path.includes('\\node_modules\\');
}

function collectProductionPayload(projects) {
  const packages = new Map();
  const visited = new Set();

  function addVersion(name, version) {
    if (typeof name !== 'string' || !SEMVER.test(String(version ?? ''))) return;
    if (!packages.has(name)) packages.set(name, new Set());
    packages.get(name).add(String(version));
  }

  function visitMap(dependencies) {
    if (!dependencies || typeof dependencies !== 'object') return;
    for (const [name, node] of Object.entries(dependencies)) visitNode(name, node);
  }

  function visitNode(name, node) {
    if (!node || typeof node !== 'object') return;
    const identity = `${name}:${String(node.version ?? '')}:${String(node.path ?? '')}`;
    if (visited.has(identity)) return;
    visited.add(identity);

    if (isExternalNode(node)) addVersion(name, node.version);
    for (const field of DEPENDENCY_FIELDS) visitMap(node[field]);
  }

  const roots = Array.isArray(projects) ? projects : [projects];
  for (const root of roots) {
    if (!root || typeof root !== 'object') continue;
    for (const field of DEPENDENCY_FIELDS) visitMap(root[field]);
  }

  return Object.fromEntries(
    [...packages.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, versions]) => [name, [...versions].sort()]),
  );
}

function normalizeAuditResponse(response, submittedPackageCount) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('Bulk Advisory response must be a JSON object');
  }

  const advisories = {};
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };

  for (const [packageName, packageAdvisories] of Object.entries(response)) {
    if (!Array.isArray(packageAdvisories)) {
      throw new Error(`Bulk Advisory entry for ${packageName} is not an array`);
    }

    for (const advisory of packageAdvisories) {
      if (!advisory || typeof advisory !== 'object') {
        throw new Error(`Bulk Advisory item for ${packageName} is not an object`);
      }
      const id = advisory.id;
      const severity = String(advisory.severity ?? '').toLowerCase();
      const requiredStrings = ['name', 'url', 'vulnerable_versions', 'title'];
      const missing = requiredStrings.filter(
        (field) => typeof advisory[field] !== 'string' || advisory[field].trim() === '',
      );
      if ((typeof id !== 'string' && typeof id !== 'number') || missing.length > 0) {
        throw new Error(
          `Bulk Advisory item for ${packageName} is missing required fields: ${[
            ...(typeof id === 'string' || typeof id === 'number' ? [] : ['id']),
            ...missing,
          ].join(', ')}`,
        );
      }
      if (!Object.prototype.hasOwnProperty.call(counts, severity) || severity === 'total') {
        throw new Error(`Bulk Advisory item ${id} has unsupported severity: ${severity}`);
      }

      const findingKey = `${packageName}:${id}`;
      advisories[findingKey] = {
        ...advisory,
        id,
        module_name: packageName,
        severity,
      };
      counts[severity] += 1;
      counts.total += 1;
    }
  }

  return {
    auditReportVersion: 3,
    advisories,
    metadata: {
      vulnerabilities: counts,
      dependencies: submittedPackageCount,
    },
    transport: {
      type: 'npm-bulk-advisory',
      endpoint: ENDPOINT,
    },
  };
}

async function postBulkAdvisories(payload) {
  const attempts = 3;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'npm-command': 'audit',
          'npm-in-ci': 'true',
          'user-agent': `prozrachnaya-cena-security-gate/1 node/${process.version}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });
      const text = await response.text();
      if (!response.ok) {
        const error = new Error(`npm Bulk Advisory endpoint returned HTTP ${response.status}`);
        error.status = response.status;
        error.responseBody = text.slice(0, 2_000);
        throw error;
      }
      try {
        return JSON.parse(text);
      } catch (error) {
        throw new Error(
          `npm Bulk Advisory endpoint returned invalid JSON: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } catch (error) {
      lastError = error;
      const status = Number(error?.status ?? 0);
      const retryable = status === 429 || status >= 500 || status === 0;
      if (!retryable || attempt === attempts) break;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 1_000));
    }
  }

  throw lastError ?? new Error('npm Bulk Advisory request failed without an error');
}

const dependencyTree = parseJsonFile(INPUT_PATH, 'pnpm production dependency tree');
const payload = collectProductionPayload(dependencyTree);
const submittedPackageCount = Object.keys(payload).length;
if (submittedPackageCount === 0) {
  fail('No external production package versions were collected for dependency audit', {
    inputPath: INPUT_PATH,
  });
}

try {
  const response = await postBulkAdvisories(payload);
  const report = normalizeAuditResponse(response, submittedPackageCount);
  writeJson(report);
  console.log(
    `npm Bulk Advisory audit collected ${report.metadata.vulnerabilities.total} advisory item(s) across ${submittedPackageCount} production package(s).`,
  );
} catch (error) {
  fail('npm Bulk Advisory collection failed', {
    inputPath: INPUT_PATH,
    cause: error instanceof Error ? error.message : String(error),
    status: Number(error?.status ?? 0) || null,
    responseBody: typeof error?.responseBody === 'string' ? error.responseBody : undefined,
  });
}
