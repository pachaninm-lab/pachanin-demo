import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ASVS_VERSION = '5.0.0';
export const ASVS_SOURCE_COMMIT = '5cf9b032440be53ce345ab3c130fda46ba1ce7a2';
export const ASVS_SOURCE_URL = `https://raw.githubusercontent.com/OWASP/ASVS/${ASVS_SOURCE_COMMIT}/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.flat.json`;
export const ASVS_SOURCE_SHA256 = '8201b20eec2908c3380ac600c91c8ba746346fbb808859366abb232027532311';
export const EXPECTED_REQUIREMENTS = 345;
export const TARGET_LEVEL = 3;
export const MAX_SOURCE_BYTES = 2 * 1024 * 1024;

const CSV_HEADERS = [
  'standard_version',
  'source_commit',
  'asvs_ref',
  'requirement_id',
  'level',
  'applicability',
  'status',
  'evidence_ref',
  'assessment_note',
];

function requirementParts(id) {
  return id.slice(1).split('.').map((part) => Number(part));
}

export function compareRequirementIds(left, right) {
  const a = requirementParts(left.reqId ?? left);
  const b = requirementParts(right.reqId ?? right);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const delta = (a[i] ?? -1) - (b[i] ?? -1);
    if (delta !== 0) return delta;
  }
  return 0;
}

export function validateStandard(payload, { expectedCount = EXPECTED_REQUIREMENTS } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Array.isArray(payload.requirements)) {
    throw new Error('ASVS source schema invalid: top-level requirements array is required');
  }

  const seen = new Set();
  const requirements = payload.requirements.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`ASVS source schema invalid at requirement index ${index}`);
    }

    const chapterId = String(entry.chapter_id ?? '');
    const sectionId = String(entry.section_id ?? '');
    const reqId = String(entry.req_id ?? '');
    const description = String(entry.req_description ?? '');
    const level = Number(entry.L);

    if (!/^V[1-9]\d*$/u.test(chapterId)) {
      throw new Error(`ASVS chapter id invalid at requirement index ${index}`);
    }
    if (!/^V[1-9]\d*\.[1-9]\d*$/u.test(sectionId) || !sectionId.startsWith(`${chapterId}.`)) {
      throw new Error(`ASVS section id invalid at requirement index ${index}`);
    }
    if (!/^V[1-9]\d*\.[1-9]\d*\.[1-9]\d*$/u.test(reqId) || !reqId.startsWith(`${sectionId}.`)) {
      throw new Error(`ASVS requirement id invalid at requirement index ${index}`);
    }
    if (!description.trim()) {
      throw new Error(`ASVS requirement description missing at ${reqId}`);
    }
    if (!Number.isInteger(level) || level < 1 || level > TARGET_LEVEL) {
      throw new Error(`ASVS requirement level invalid at ${reqId}`);
    }
    if (seen.has(reqId)) {
      throw new Error(`ASVS duplicate requirement id: ${reqId}`);
    }
    seen.add(reqId);

    return { reqId, level };
  });

  if (requirements.length !== expectedCount) {
    throw new Error(`ASVS requirement count mismatch: expected ${expectedCount}, got ${requirements.length}`);
  }

  return requirements.sort(compareRequirementIds);
}

export function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function csvRow(values) {
  return values.map(csvCell).join(',');
}

export function buildMatrixCsv(requirements) {
  const rows = [csvRow(CSV_HEADERS)];
  for (const requirement of requirements) {
    rows.push(csvRow([
      ASVS_VERSION,
      ASVS_SOURCE_COMMIT,
      `v${ASVS_VERSION}-${requirement.reqId.slice(1)}`,
      requirement.reqId,
      requirement.level,
      'PENDING_APPLICABILITY_REVIEW',
      'NOT_ASSESSED',
      '',
      'Evidence assessment required; no compliance status inferred.',
    ]));
  }
  return `${rows.join('\n')}\n`;
}

export function buildSummary(requirements, matrixCsv, { sourceBytes, repositorySourceSha = null } = {}) {
  if (!Buffer.isBuffer(sourceBytes) || sourceBytes.length === 0) {
    throw new Error('ASVS source bytes are required for source digest evidence');
  }
  const normalizedRepositorySha = /^[0-9a-f]{40}$/u.test(String(repositorySourceSha ?? ''))
    ? String(repositorySourceSha)
    : null;
  const levelCounts = { '1': 0, '2': 0, '3': 0 };
  for (const requirement of requirements) levelCounts[String(requirement.level)] += 1;

  return {
    schemaVersion: 'pc-crop.asvs-evidence.v1',
    standard: 'OWASP ASVS',
    standardVersion: ASVS_VERSION,
    sourceCommit: ASVS_SOURCE_COMMIT,
    sourceUrl: ASVS_SOURCE_URL,
    sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
    sourceMode: 'PINNED_PUBLIC_STANDARD_DOWNLOAD',
    repositorySourceSha: normalizedRepositorySha,
    targetLevel: TARGET_LEVEL,
    requirements: requirements.length,
    levelCounts,
    applicabilityCounts: { PENDING_APPLICABILITY_REVIEW: requirements.length },
    statusCounts: { NOT_ASSESSED: requirements.length },
    matrixSha256: createHash('sha256').update(matrixCsv, 'utf8').digest('hex'),
    proprietarySourceUploaded: false,
    outputContainsRequirementDescriptions: false,
    finalPass: false,
    blockers: [
      `NOT_ASSESSED:${requirements.length}`,
      `PENDING_APPLICABILITY_REVIEW:${requirements.length}`,
    ],
  };
}

export function verifyPinnedSourceDigest(sourceBytes) {
  const digest = createHash('sha256').update(sourceBytes).digest('hex');
  if (digest !== ASVS_SOURCE_SHA256) {
    throw new Error(`ASVS source digest mismatch: expected ${ASVS_SOURCE_SHA256}, got ${digest}`);
  }
  return digest;
}

export async function fetchPinnedStandard(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation unavailable');
  const response = await fetchImpl(ASVS_SOURCE_URL, {
    method: 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`ASVS source download failed: HTTP ${response.status}`);

  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SOURCE_BYTES) {
    throw new Error(`ASVS source too large: declared ${declaredLength} bytes`);
  }

  const sourceBytes = Buffer.from(await response.arrayBuffer());
  if (sourceBytes.length === 0 || sourceBytes.length > MAX_SOURCE_BYTES) {
    throw new Error(`ASVS source size invalid: ${sourceBytes.length} bytes`);
  }

  verifyPinnedSourceDigest(sourceBytes);

  let payload;
  try {
    payload = JSON.parse(sourceBytes.toString('utf8'));
  } catch {
    throw new Error('ASVS source is not valid JSON');
  }
  return { payload, sourceBytes };
}

export async function generateEvidence(outDir, { fetchImpl = globalThis.fetch, repositorySourceSha = process.env.SOURCE_SHA } = {}) {
  const { payload, sourceBytes } = await fetchPinnedStandard(fetchImpl);
  const requirements = validateStandard(payload);
  const matrixCsv = buildMatrixCsv(requirements);
  const summary = buildSummary(requirements, matrixCsv, { sourceBytes, repositorySourceSha });

  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, 'ASVS_MATRIX.csv'), matrixCsv, 'utf8');
  await writeFile(resolve(outDir, 'ASVS_SUMMARY.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return summary;
}

const invokedAsScript = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedAsScript) {
  const outDir = resolve(process.argv[2] ?? 'artifacts/ip-clean-room/security/asvs');
  try {
    const summary = await generateEvidence(outDir);
    console.log(`ASVS evidence inventory: ${summary.requirements}/${EXPECTED_REQUIREMENTS} requirements; finalPass=${summary.finalPass}; source=${ASVS_SOURCE_COMMIT}`);
  } catch (error) {
    console.error(`ASVS evidence generation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
