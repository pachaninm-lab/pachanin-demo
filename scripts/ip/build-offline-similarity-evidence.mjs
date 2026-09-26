import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { isReExportOnlyModule } from './reexport-only-module.mjs';

const outDir = process.argv[2] ?? 'artifacts/ip-clean-room';
const corpusInput = String(process.env.IP_SIMILARITY_CORPUS ?? '').trim();
const corpusApprovalRequested = process.env.IP_SIMILARITY_CORPUS_APPROVED === '1';
const corpusApprovalInput = String(process.env.IP_SIMILARITY_CORPUS_APPROVAL ?? '').trim();
mkdirSync(outDir, { recursive: true });
if (!lstatSync(outDir).isDirectory()) throw new Error(`Similarity output path is not a real directory: ${outDir}`);

const boundary = JSON.parse(readFileSync('docs/ip/proprietary-core-boundary.json', 'utf8'));
const protectedRoots = (boundary.protectedRoots ?? []).map((entry) => entry.path);
const textExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.sql', '.prisma', '.css', '.scss']);
const excludedPath = /(^|\/)(tests?|fixtures?|snapshots?|node_modules|dist|build|generated)(\/|$)/i;
const corpusNonRegular = [];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeSource(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|\s)\/\/.*$/gm, '$1 ')
    .replace(/(^|\s)#.*$/gm, '$1 ')
    .replace(/`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '<STRING>')
    .replace(/\b\d+(?:\.\d+)?\b/g, '<NUMBER>')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(source) {
  return normalizeSource(source).match(/[\p{L}_$][\p{L}\p{N}_$]*|<STRING>|<NUMBER>|===|!==|=>|==|!=|<=|>=|&&|\|\||[^\s]/gu) ?? [];
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function winnow(sourceTokens, gramSize = 12, windowSize = 8) {
  if (sourceTokens.length < gramSize) return [];
  const grams = [];
  for (let index = 0; index <= sourceTokens.length - gramSize; index += 1) {
    grams.push(fnv1a(sourceTokens.slice(index, index + gramSize).join('\u0001')));
  }
  if (grams.length <= windowSize) return [...new Set([Math.min(...grams)])];
  const selected = new Set();
  for (let index = 0; index <= grams.length - windowSize; index += 1) {
    selected.add(Math.min(...grams.slice(index, index + windowSize)));
  }
  return [...selected].sort((left, right) => left - right);
}


function fingerprint(path, source) {
  const normalized = normalizeSource(source);
  const sourceTokens = tokens(source);
  const winnowing = winnow(sourceTokens);
  return {
    path,
    bytes: Buffer.byteLength(source),
    tokenCount: sourceTokens.length,
    exactSha256: sha256(source),
    normalizedSha256: sha256(normalized),
    structuralSha256: sha256(winnowing.join(',')),
    winnowing,
  };
}

function csv(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function walk(directory, base = directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute, base));
    else if (entry.isFile()) files.push({ absolute, path: relative(base, absolute).replaceAll('\\', '/') });
    else corpusNonRegular.push(relative(base, absolute).replaceAll('\\', '/'));
  }
  return files;
}

const protectedEntries = git(['ls-files', '-s', '-z', '--', ...protectedRoots])
  .split('\0')
  .filter(Boolean)
  .map((entry) => {
    const match = entry.match(/^(\d+) ([0-9a-f]+) \d+\t([\s\S]+)$/u);
    if (!match) throw new Error(`Cannot parse protected Git index entry: ${entry.slice(0, 160)}`);
    return { mode: match[1], blobSha: match[2], path: match[3] };
  })
  .filter((entry) => !excludedPath.test(entry.path));

const protectedNonRegular = protectedEntries.filter((entry) => !/^100(?:644|755)$/u.test(entry.mode));
const protectedFiles = protectedEntries
  .filter((entry) => /^100(?:644|755)$/u.test(entry.mode))
  .filter((entry) => textExtensions.has(extname(entry.path).toLowerCase()))
  .map((entry) => entry.path);

const reExportOnlySources = [];
const sourceFingerprints = protectedFiles.map((path) => {
  const metadata = lstatSync(path);
  if (!metadata.isFile()) throw new Error(`Protected source is not a regular file: ${path}`);
  const content = readFileSync(path, 'utf8');
  if (isReExportOnlyModule(content)) {
    reExportOnlySources.push(path);
    return null;
  }
  return fingerprint(path, content);
}).filter(Boolean);
const findings = [];
const finalBlockers = [];
if (protectedNonRegular.length) finalBlockers.push(`PROTECTED_NON_REGULAR_FILES:${protectedNonRegular.length}`);
let corpusFiles = 0;
let corpusApproved = false;
let corpusDigestSha256 = '';
let corpusApprovalEvidence = 'NOT_PROVIDED';
let status = 'CORPUS_REQUIRED';

if (!corpusInput) {
  finalBlockers.push('APPROVED_OFFLINE_EXTERNAL_CORPUS_NOT_PROVIDED');
} else {
  const corpusRoot = resolve(corpusInput);
  if (!existsSync(corpusRoot) || !lstatSync(corpusRoot).isDirectory()) {
    throw new Error(`IP_SIMILARITY_CORPUS is not a directory: ${corpusRoot}`);
  }
  if (!corpusApprovalRequested) {
    finalBlockers.push('OFFLINE_CORPUS_PRESENT_BUT_NOT_APPROVED');
    status = 'CORPUS_NOT_APPROVED';
  }

  const corpus = walk(corpusRoot)
    .filter((item) => textExtensions.has(extname(item.path).toLowerCase()))
    .filter((item) => !excludedPath.test(item.path))
    .sort((left, right) => left.path.localeCompare(right.path, 'en'))
    .map((item) => {
      const content = readFileSync(item.absolute, 'utf8');
      return isReExportOnlyModule(content) ? null : fingerprint(item.path, content);
    })
    .filter(Boolean);
  corpusFiles = corpus.length;
  corpusDigestSha256 = sha256(JSON.stringify(corpus.map((item) => [item.path, item.exactSha256])));
  if (corpusNonRegular.length) {
    finalBlockers.push(`OFFLINE_CORPUS_NON_REGULAR_FILES:${corpusNonRegular.length}`);
    status = 'CORPUS_NON_REGULAR_FILES';
  }

  if (!corpusFiles) {
    finalBlockers.push('APPROVED_OFFLINE_EXTERNAL_CORPUS_EMPTY');
    status = 'CORPUS_EMPTY';
  } else if (corpusApprovalRequested && !corpusApprovalInput) {
    finalBlockers.push('OFFLINE_CORPUS_APPROVAL_EVIDENCE_REQUIRED');
    status = 'CORPUS_APPROVAL_REQUIRED';
  } else if (corpusApprovalRequested) {
    const approvalPath = resolve(corpusApprovalInput);
    if (!existsSync(approvalPath) || !lstatSync(approvalPath).isFile()) {
      finalBlockers.push('OFFLINE_CORPUS_APPROVAL_EVIDENCE_INVALID');
      corpusApprovalEvidence = 'NOT_A_REGULAR_FILE';
      status = 'CORPUS_APPROVAL_INVALID';
    } else {
      const approval = JSON.parse(readFileSync(approvalPath, 'utf8'));
      const approvedAt = String(approval.approvedAt ?? '');
      const approvedAtTime = /^\d{4}-\d{2}-\d{2}$/u.test(approvedAt)
        ? Date.parse(`${approvedAt}T00:00:00Z`)
        : Number.NaN;
      const validApprovedAt = Number.isFinite(approvedAtTime)
        && new Date(approvedAtTime).toISOString().slice(0, 10) === approvedAt
        && approvedAtTime <= Date.now();
      const approvalValid = approval.schemaVersion === 1
        && approval.status === 'APPROVED'
        && /^[0-9a-f]{64}$/u.test(String(approval.corpusDigestSha256 ?? ''))
        && approval.corpusDigestSha256 === corpusDigestSha256
        && validApprovedAt
        && String(approval.authorityReference ?? '').trim().length >= 3
        && String(approval.rightsBasis ?? '').trim().length >= 3
        && String(approval.scope ?? '').trim().length >= 3;
      if (approvalValid && corpusNonRegular.length === 0) {
        corpusApproved = true;
        corpusApprovalEvidence = 'VALIDATED_EXACT_DIGEST_AND_AUTHORITY_REFERENCE';
      } else if (approvalValid) {
        corpusApprovalEvidence = 'VALIDATED_BUT_CORPUS_STRUCTURE_BLOCKED';
      } else {
        finalBlockers.push('OFFLINE_CORPUS_APPROVAL_EVIDENCE_INVALID');
        corpusApprovalEvidence = 'INVALID_OR_DIGEST_MISMATCH';
        status = 'CORPUS_APPROVAL_INVALID';
      }
    }
  }

  const exact = new Map();
  const normalized = new Map();
  const structural = new Map();
  const winnowIndex = new Map();
  corpus.forEach((item, index) => {
    if (!exact.has(item.exactSha256)) exact.set(item.exactSha256, []);
    exact.get(item.exactSha256).push(index);
    if (!normalized.has(item.normalizedSha256)) normalized.set(item.normalizedSha256, []);
    normalized.get(item.normalizedSha256).push(index);
    if (item.winnowing.length) {
      if (!structural.has(item.structuralSha256)) structural.set(item.structuralSha256, []);
      structural.get(item.structuralSha256).push(index);
    }
    for (const hash of item.winnowing) {
      if (!winnowIndex.has(hash)) winnowIndex.set(hash, []);
      winnowIndex.get(hash).push(index);
    }
  });

  for (const source of sourceFingerprints) {
    const candidateMethods = new Map();
    for (const index of exact.get(source.exactSha256) ?? []) candidateMethods.set(index, { method: 'EXACT_SHA256', score: 1 });
    for (const index of normalized.get(source.normalizedSha256) ?? []) {
      if (!candidateMethods.has(index)) candidateMethods.set(index, { method: 'NORMALIZED_TOKENS', score: 1 });
    }
    if (source.winnowing.length) {
      for (const index of structural.get(source.structuralSha256) ?? []) {
        if (!candidateMethods.has(index)) candidateMethods.set(index, { method: 'WINNOWING_SIGNATURE', score: 1 });
      }
    }

    const shared = new Map();
    for (const hash of source.winnowing) {
      for (const index of winnowIndex.get(hash) ?? []) shared.set(index, (shared.get(index) ?? 0) + 1);
    }
    for (const [index, intersection] of shared) {
      if (candidateMethods.has(index) || intersection < 5) continue;
      const denominator = source.winnowing.length + corpus[index].winnowing.length - intersection;
      const score = denominator ? intersection / denominator : 0;
      if (score >= 0.65) candidateMethods.set(index, { method: 'WINNOWING_JACCARD', score });
    }

    for (const [index, match] of candidateMethods) {
      findings.push({
        findingId: `SIM-${String(findings.length + 1).padStart(6, '0')}`,
        sourcePath: source.path,
        corpusPath: corpus[index].path,
        method: match.method,
        score: match.score.toFixed(6),
        status: match.method === 'EXACT_SHA256' ? 'POSSIBLE_COPY' : 'POSSIBLE_DERIVATIVE',
        decision: 'REVIEW_REQUIRED',
        evidence: 'Hash/token evidence only; inspect under clean-room controls.',
      });
    }
  }

  if (findings.length) {
    status = 'FINDINGS_REVIEW_REQUIRED';
    finalBlockers.push(`UNRESOLVED_SIMILARITY_FINDINGS:${findings.length}`);
  } else if (corpusApproved) {
    status = 'NO_RELEVANT_MATCH';
  }
}

writeFileSync(join(outDir, 'SIMILARITY_FINDINGS.csv'), [
  'finding_id,source_path,corpus_path,method,score,status,decision,evidence',
  ...findings.map((item) => [item.findingId, item.sourcePath, item.corpusPath, item.method, item.score, item.status, item.decision, item.evidence].map(csv).join(',')),
].join('\n') + '\n');

writeFileSync(join(outDir, 'similarity-fingerprints.json'), JSON.stringify({
  schemaVersion: 1,
  sourceContentIncluded: false,
  networkUsed: false,
  protectedRoots,
  protectedNonRegularFiles: protectedNonRegular,
  files: sourceFingerprints.map(({ winnowing, ...item }) => ({ ...item, winnowingCount: winnowing.length })),
}, null, 2) + '\n');

writeFileSync(join(outDir, 'similarity-summary.json'), JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status,
  finalEligible: status === 'NO_RELEVANT_MATCH' && finalBlockers.length === 0,
  networkUsed: false,
  sourceUploaded: false,
  protectedFiles: sourceFingerprints.length,
  reExportOnlyExcluded: reExportOnlySources.length,
  reExportOnlyExcludedPaths: reExportOnlySources,
  reExportOnlyExclusionBasis: 'Модуль, состоящий только из реэкспортов, самостоятельного выражения не несёт: нормализация заменяет пути на <STRING>, и любой barrel схлопывается в одинаковую последовательность токенов. Исключение узкое — файл с хотя бы одним оператором помимо реэкспортов сравнивается как обычно.',
  protectedNonRegularFiles: protectedNonRegular.length,
  approvedCorpus: corpusApproved,
  corpusDigestSha256,
  corpusApprovalEvidence,
  corpusFiles,
  unresolvedFindings: findings.length,
  finalBlockers,
  methodology: 'Exact SHA-256, normalized-token SHA-256, winnowing signatures and bounded winnowing Jaccard are computed only inside the runner against an explicitly mounted corpus. Final eligibility additionally requires a non-empty corpus and a regular-file approval record whose authority, rights basis, scope, date and exact aggregate corpus digest validate. No source text or source phrase is sent to a public scanner. No match is screening evidence, not absolute proof of originality.',
}, null, 2) + '\n');

console.log(JSON.stringify({ status, protectedFiles: sourceFingerprints.length, corpusFiles, findings: findings.length, finalBlockers }, null, 2));
