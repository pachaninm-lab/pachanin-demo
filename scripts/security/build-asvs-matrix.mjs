import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { APPLICABILITY, STATUS, applyDecisions, summariseDecisions } from './asvs-decisions.mjs';
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

export function buildMatrixCsv(records) {
  const rows = [csvRow(CSV_HEADERS)];
  for (const record of records) {
    rows.push(csvRow([
      ASVS_VERSION,
      ASVS_SOURCE_COMMIT,
      `v${ASVS_VERSION}-${record.reqId.slice(1)}`,
      record.reqId,
      record.level,
      record.applicability,
      record.status,
      record.evidenceRef ?? '',
      record.note ?? '',
    ]));
  }
  return `${rows.join('\n')}\n`;
}

/**
 * A tracked .ts file can be data rather than code. The presentation PDF is
 * committed as base64 string literals - 265 KB of them - and a substring scan
 * over that is noise, not evidence: `jwks` occurs inside part-12 and `sgx`
 * inside parts 04, 07 and 08 purely by chance, which silently revoked V9.1.3
 * and V11.7.1 (#4764). Patterns and file text are both lowercased below, so
 * every case variant collides; on a payload that size a four-character pattern
 * is near certain to match something.
 *
 * Excluding such files by path would let anyone hide real code under a blessed
 * directory. A file is skipped only when its entire body is proven to be one
 * exported opaque literal - no import, no call, no logic, nothing executable -
 * so this rule cannot be used as a hiding place. Anything else in the file and
 * it is scanned like any other source.
 */
/**
 * Written as successive single-pass strips rather than one pattern. An earlier
 * head expressed this as a single regex whose literal group carried a nested
 * quantifier; CodeQL rejected it, and rather than guess which alert fired -
 * there is no way to read the alert text from here - the whole class is removed.
 * Every expression below is one non-nested quantifier over a character class or
 * a lazily bounded block, so none of them can backtrack super-linearly.
 *
 * Order matters and is not cosmetic. String literals are stripped before line
 * comments because base64 contains `/`, so a payload can hold `//` inside a
 * literal and stripping comments first would eat the rest of that line. Block
 * comments go first so a documented payload still reduces cleanly.
 */
const DATA_SKELETON = /^exportconst[A-Za-z_$][\w$]*(?::string)?=;?$/u;

export function isOpaqueDataModule(text) {
  const skeleton = String(text ?? '')
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/'[A-Za-z0-9+/=\s]*'/gu, ' ')
    .replace(/"[A-Za-z0-9+/=\s]*"/gu, ' ')
    .replace(/`[A-Za-z0-9+/=\s]*`/gu, ' ')
    .replace(/\/\/[^\n]*/gu, ' ')
    .replace(/[\s+]/gu, '');
  return DATA_SKELETON.test(skeleton);
}

/**
 * Conditions are evaluated here rather than trusted from the decision file, so
 * a decision cannot keep standing on a fact that has since changed.
 */
export function evaluateCondition(condition, { tracked, readFile }) {
  const patterns = (condition?.patterns ?? []).map((pattern) => String(pattern).toLowerCase());
  if (patterns.length === 0) return { ...condition, holds: false, evidence: 'condition declares no patterns' };

  if (condition.check === 'ABSENT_IN_TREE') {
    const roots = condition.roots ?? [];
    const candidates = tracked.filter((path) => (
      roots.some((root) => path.startsWith(`${root}/`))
      && /\.(?:ts|tsx|js|jsx|mjs|cjs)$/u.test(path)
    ));
    const hits = candidates.filter((path) => {
      const raw = readFile(path) ?? '';
      if (isOpaqueDataModule(raw)) return false;
      const text = raw.toLowerCase();
      return patterns.some((pattern) => text.includes(pattern));
    });
    return {
      condition: condition.condition,
      holds: hits.length === 0,
      evidence: hits.length === 0
        ? `${candidates.length} source files scanned, no match`
        : `matched in ${hits.slice(0, 3).join(', ')}`,
    };
  }

  if (condition.check === 'ABSENT_IN_MANIFESTS') {
    const manifests = tracked.filter((path) => path === 'package.json' || path.endsWith('/package.json'));
    const hits = manifests.filter((path) => {
      const text = (readFile(path) ?? '').toLowerCase();
      return patterns.some((pattern) => text.includes(pattern));
    });
    return {
      condition: condition.condition,
      holds: hits.length === 0,
      evidence: hits.length === 0 ? `${manifests.length} manifests scanned, no match` : `declared in ${hits.join(', ')}`,
    };
  }

  // NO_RUNTIME_CALLER answers a question the other checks cannot: is this
  // control ever actually invoked? A policy can be written in full, covered by
  // tests, and reachable from nothing. That is not a control - it is code that
  // resembles one, and reading the module alone cannot tell the difference.
  //
  // This exists because that distinction was missed once already. A decision
  // note credited a second-approval policy whose functions had no callers
  // outside their own tests, so the note described a protection that never runs.
  // Tests are excluded from the search deliberately: a symbol referenced only by
  // its own tests is exactly the case being detected.
  if (condition.check === 'NO_RUNTIME_CALLER') {
    const roots = condition.roots ?? [];
    const definedAt = condition.definedAt ?? [];
    const isTest = (path) => (
      /\.(?:spec|test)\.[cm]?[jt]sx?$/u.test(path)
      || /(?:^|\/)(?:tests?|__tests__)\//u.test(path)
    );
    const candidates = tracked.filter((path) => (
      roots.some((root) => path.startsWith(`${root}/`))
      && /\.(?:ts|tsx|js|jsx|mjs|cjs)$/u.test(path)
      && !isTest(path)
      && !definedAt.includes(path)
    ));
    const hits = candidates.filter((path) => {
      const raw = readFile(path) ?? '';
      if (isOpaqueDataModule(raw)) return false;
      const text = raw.toLowerCase();
      return patterns.some((pattern) => text.includes(pattern));
    });
    return {
      condition: condition.condition,
      holds: hits.length === 0,
      evidence: hits.length === 0
        ? `${candidates.length} runtime files scanned, no caller`
        : `called from ${hits.slice(0, 3).join(', ')}`,
    };
  }

  // PRESENT_AT_PATH and ABSENT_AT_PATH tie a decision to named files rather than
  // to the tree as a whole. PRESENT_AT_PATH backs a PASS: the control has to be
  // where the decision says it is. ABSENT_AT_PATH backs a FAIL and makes it
  // self-revoking - the moment somebody closes the gap, the condition stops
  // holding, the decision is rejected, and the requirement returns to
  // assessment. A FAIL cannot rust in the matrix after it has been fixed.
  // PRESENT_ALL_AT_PATH exists because the two checks above match their
  // patterns with .some(): several patterns in one condition are alternatives,
  // not combined evidence. That is right when the patterns are spellings of one
  // control (a DI token and its class name), and wrong when a condition means
  // "the check AND the rejection are both still here" - there, dropping the
  // rejection leaves the other pattern matching and the decision standing on a
  // control that is half gone. This check requires every pattern in every named
  // path, so a condition can say which of the two it meant instead of leaving a
  // reader to guess from the prose.
  if (
    condition.check === 'PRESENT_AT_PATH'
    || condition.check === 'ABSENT_AT_PATH'
    || condition.check === 'PRESENT_ALL_AT_PATH'
  ) {
    const paths = condition.paths ?? [];
    if (paths.length === 0) {
      return { condition: condition.condition, holds: false, evidence: 'condition declares no paths' };
    }
    const missing = paths.filter((path) => !tracked.includes(path));
    if (missing.length > 0) {
      // A path that has moved or gone invalidates the decision rather than
      // quietly passing: the evidence it named no longer exists.
      return {
        condition: condition.condition,
        holds: false,
        evidence: `path not tracked: ${missing.join(', ')}`,
      };
    }
    const requireEveryPattern = condition.check === 'PRESENT_ALL_AT_PATH';
    const hits = paths.filter((path) => {
      const text = (readFile(path) ?? '').toLowerCase();
      return requireEveryPattern
        ? patterns.every((pattern) => text.includes(pattern))
        : patterns.some((pattern) => text.includes(pattern));
    });
    const wantPresent = condition.check !== 'ABSENT_AT_PATH';
    // PRESENT requires every named path to carry the control; ABSENT requires
    // none of them to. Neither is satisfied by a partial result.
    const holds = wantPresent ? hits.length === paths.length : hits.length === 0;
    return {
      condition: condition.condition,
      holds,
      evidence: wantPresent
        ? `${hits.length}/${paths.length} paths carry ${requireEveryPattern ? 'every pattern' : 'the control'}`
        : (hits.length === 0 ? `${paths.length} paths scanned, gap still open` : `gap closed in ${hits.join(', ')}`),
    };
  }

  return { condition: condition?.condition, holds: false, evidence: `unsupported check ${String(condition?.check)}` };
}

export function evaluateDecisions(decisions, context) {
  return (decisions ?? []).map((decision) => ({
    ...decision,
    conditions: (decision.conditions ?? []).map((condition) => evaluateCondition(condition, context)),
  }));
}

export function buildSummary(requirements, matrixCsv, { sourceBytes, repositorySourceSha = null, decided = null, rejected = [] } = {}) {
  if (!Buffer.isBuffer(sourceBytes) || sourceBytes.length === 0) {
    throw new Error('ASVS source bytes are required for source digest evidence');
  }
  const normalizedRepositorySha = /^[0-9a-f]{40}$/u.test(String(repositorySourceSha ?? ''))
    ? String(repositorySourceSha)
    : null;
  const levelCounts = { '1': 0, '2': 0, '3': 0 };
  for (const requirement of requirements) levelCounts[String(requirement.level)] += 1;

  const records = decided ?? requirements.map((requirement) => ({
    reqId: requirement.reqId,
    level: requirement.level,
    applicability: APPLICABILITY.PENDING,
    status: STATUS.NOT_ASSESSED,
  }));
  const rollup = summariseDecisions(records);

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
    applicabilityCounts: rollup.applicabilityCounts,
    statusCounts: rollup.statusCounts,
    decisionsApplied: decided ? decided.filter((record) => record.applicability !== 'PENDING_APPLICABILITY_REVIEW' || record.status !== 'NOT_ASSESSED').length : 0,
    decisionsRejected: rejected.length,
    rejectedDecisions: rejected,
    matrixSha256: createHash('sha256').update(matrixCsv, 'utf8').digest('hex'),
    proprietarySourceUploaded: false,
    outputContainsRequirementDescriptions: false,
    // A rejected decision must never be silently downgraded to "pending":
    // it means the decision file says something the tree does not support.
    finalPass: rejected.length === 0 && rollup.finalPass,
    blockers: rejected.length > 0
      ? [...rollup.blockers, `REJECTED_DECISIONS:${rejected.length}`]
      : rollup.blockers,
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

export async function generateEvidence(outDir, { fetchImpl = globalThis.fetch, repositorySourceSha = process.env.SOURCE_SHA, decisionsPath = 'docs/security/asvs-applicability-decisions.json' } = {}) {
  const { payload, sourceBytes } = await fetchPinnedStandard(fetchImpl);
  const requirements = validateStandard(payload);

  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    .split('\n')
    .filter(Boolean);
  const fileCache = new Map();
  const readFile = (path) => {
    if (!fileCache.has(path)) {
      try {
        fileCache.set(path, readFileSync(path, 'utf8'));
      } catch {
        fileCache.set(path, null);
      }
    }
    return fileCache.get(path);
  };

  let declared = [];
  try {
    declared = JSON.parse(readFileSync(decisionsPath, 'utf8')).decisions ?? [];
  } catch {
    declared = [];
  }

  const evaluated = evaluateDecisions(declared, { tracked, readFile });
  const { records, rejected } = applyDecisions(requirements, evaluated);
  const matrixCsv = buildMatrixCsv(records);
  const summary = buildSummary(requirements, matrixCsv, { sourceBytes, repositorySourceSha, decided: records, rejected });

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
