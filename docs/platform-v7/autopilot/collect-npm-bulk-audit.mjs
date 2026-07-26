#!/usr/bin/env node
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
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

// Bounds on what the registry may hand back. A scanner that reads an unbounded response
// can be made to exhaust the runner instead of reporting a vulnerability, so both the
// bytes on the wire and the bytes after inflation are capped, and exceeding either fails
// the audit rather than truncating it.
const MAX_COMPRESSED_BYTES = 32 * 1024 * 1024;
const MAX_DECOMPRESSED_BYTES = 128 * 1024 * 1024;

// gzip member header. RFC 1952 section 2.3.1.
const GZIP_MAGIC = [0x1f, 0x8b];

function looksGzipped(bytes) {
  return bytes.length >= 2 && bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1];
}

class ResponseTooLargeError extends Error {}

/**
 * Read a response body under a hard byte cap.
 *
 * `arrayBuffer()` cannot do this: it materialises the whole body first, so a size check
 * afterwards documents the limit without enforcing it — the memory is already spent by
 * the time the number is compared. The cap has to hold while the bytes are still
 * arriving, which means reading the stream chunk by chunk and abandoning it the moment
 * the running total crosses the line.
 *
 * `Content-Length` is used only to refuse early. It is a claim by the sender, so it can
 * be absent, wrong, or deliberately understated; the running total is the authority and
 * is what actually stops the read.
 */
async function readBoundedBody(response, limit) {
  const declared = Number(response.headers?.get?.('content-length') ?? Number.NaN);
  if (Number.isFinite(declared) && declared > limit) {
    throw new ResponseTooLargeError(
      `npm Bulk Advisory response declared ${declared} bytes, over the ${limit} byte limit`,
    );
  }

  // No stream means no way to bound the read. Falling back to arrayBuffer() here would
  // reintroduce exactly the unbounded path this function exists to remove.
  const reader = response.body?.getReader?.();
  if (!reader) {
    throw new Error('npm Bulk Advisory response had no readable body stream');
  }

  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > limit) {
      // Stop the transfer before taking another byte, then fail.
      await reader.cancel();
      throw new ResponseTooLargeError(
        `npm Bulk Advisory response exceeded ${limit} compressed bytes`,
      );
    }
    chunks.push(value);
  }

  // Only now, with the total known to be inside the limit, is it safe to materialise.
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/**
 * Turn raw response bytes into text.
 *
 * The registry returned a gzip payload with no `Content-Encoding`, so undici did not
 * inflate it and `response.text()` produced mojibake starting with the gzip magic bytes.
 * `JSON.parse` then failed, and the security gate read that as a failed audit — a
 * transport bug wearing the costume of a vulnerability report.
 *
 * Detection is by magic bytes rather than by `Content-Encoding`, because that header is
 * exactly what proved unreliable: a proxy may strip it, or may inflate the body and leave
 * it in place. Magic bytes describe what actually arrived. They also make double
 * decompression impossible — JSON never begins 1f 8b, so an already-inflated body is
 * never inflated again.
 */
function decodeResponseBody(bytes) {
  if (bytes.length > MAX_COMPRESSED_BYTES) {
    throw new ResponseTooLargeError(
      `npm Bulk Advisory response exceeded ${MAX_COMPRESSED_BYTES} compressed bytes`,
    );
  }
  if (!looksGzipped(bytes)) {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  let inflated;
  try {
    inflated = gunzipSync(bytes, { maxOutputLength: MAX_DECOMPRESSED_BYTES });
  } catch (error) {
    // A body that inflates past the cap surfaces as ERR_BUFFER_TOO_LARGE, whose message
    // names a Buffer rather than the audit. Translate it so a zip bomb reads as one in CI.
    if (error?.code === 'ERR_BUFFER_TOO_LARGE') {
      throw new ResponseTooLargeError(
        `npm Bulk Advisory response exceeded ${MAX_DECOMPRESSED_BYTES} decompressed bytes`,
      );
    }
    // Never echo the bytes: a corrupt or hostile body must not reach the log.
    throw new Error(
      `npm Bulk Advisory gzip response could not be decompressed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(inflated);
}

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
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };

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
      const requiredStrings = ['url', 'vulnerable_versions', 'title'];
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
      if (!Object.prototype.hasOwnProperty.call(counts, severity)) {
        throw new Error(`Bulk Advisory item ${id} has unsupported severity: ${severity}`);
      }

      const findingKey = `${packageName}:${id}`;
      advisories[findingKey] = {
        ...advisory,
        id,
        name: packageName,
        module_name: packageName,
        severity,
      };
      counts[severity] += 1;
    }
  }

  return {
    auditReportVersion: 3,
    advisories,
    metadata: {
      vulnerabilities: counts,
      dependencies: submittedPackageCount,
      devDependencies: 0,
      optionalDependencies: 0,
      totalDependencies: submittedPackageCount,
    },
    transport: {
      type: 'npm-bulk-advisory',
      version: 1,
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
          // Ask for no transport encoding. The registry may ignore this, which is why the
          // body is still sniffed below rather than trusted.
          'accept-encoding': 'identity',
          'user-agent': `prozrachnaya-cena-security-gate/1 node/${process.version}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });
      const bytes = await readBoundedBody(response, MAX_COMPRESSED_BYTES);
      if (!response.ok) {
        const error = new Error(`npm Bulk Advisory endpoint returned HTTP ${response.status}`);
        error.status = response.status;
        // Only decode for the error excerpt if it is plausibly text. A binary body is
        // summarised by length, never echoed.
        error.responseBody = looksGzipped(bytes)
          ? `<gzip payload, ${bytes.length} bytes>`
          : new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 2_000));
        throw error;
      }
      const text = decodeResponseBody(bytes);
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

// Exported so the transport can be tested directly. The regression this guards against
// is not reachable from the CLI without a live registry.
export { decodeResponseBody, looksGzipped, postBulkAdvisories, readBoundedBody };
export const LIMITS = { MAX_COMPRESSED_BYTES, MAX_DECOMPRESSED_BYTES };

// Run only when invoked as a script, so importing for tests neither reads the dependency
// tree nor contacts the registry.
const invokedDirectly =
  process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
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
  const advisoryCount = Object.keys(report.advisories).length;
  console.log(
    `npm Bulk Advisory audit collected ${advisoryCount} advisory item(s) across ${submittedPackageCount} production package(s).`,
  );
} catch (error) {
  fail('npm Bulk Advisory collection failed', {
    inputPath: INPUT_PATH,
    cause: error instanceof Error ? error.message : String(error),
    status: Number(error?.status ?? 0) || null,
    responseBody: typeof error?.responseBody === 'string' ? error.responseBody : undefined,
  });
}
}
