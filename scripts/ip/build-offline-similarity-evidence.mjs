import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const outDir = process.argv[2] ?? 'artifacts/ip-clean-room';
const corpusInput = String(process.env.IP_SIMILARITY_CORPUS ?? '').trim();
const corpusApproved = process.env.IP_SIMILARITY_CORPUS_APPROVED === '1';
mkdirSync(outDir, { recursive: true });

const boundary = JSON.parse(readFileSync('docs/ip/proprietary-core-boundary.json', 'utf8'));
const protectedRoots = (boundary.protectedRoots ?? []).map((entry) => entry.path);
const textExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.sql', '.prisma', '.css', '.scss']);
const excludedPath = /(^|\/)(tests?|fixtures?|snapshots?|node_modules|dist|build|generated)(\/|$)/i;

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
  }
  return files;
}

const protectedFiles = git(['ls-files', '-z', '--', ...protectedRoots])
  .split('\0')
  .filter(Boolean)
  .filter((path) => textExtensions.has(extname(path).toLowerCase()))
  .filter((path) => !excludedPath.test(path));

const sourceFingerprints = protectedFiles.map((path) => fingerprint(path, readFileSync(path, 'utf8')));
const findings = [];
const finalBlockers = [];
let corpusFiles = 0;
let status = 'CORPUS_REQUIRED';

if (!corpusInput) {
  finalBlockers.push('APPROVED_OFFLINE_EXTERNAL_CORPUS_NOT_PROVIDED');
} else {
  const corpusRoot = resolve(corpusInput);
  if (!existsSync(corpusRoot) || !statSync(corpusRoot).isDirectory()) {
    throw new Error(`IP_SIMILARITY_CORPUS is not a directory: ${corpusRoot}`);
  }
  if (!corpusApproved) {
    finalBlockers.push('OFFLINE_CORPUS_PRESENT_BUT_NOT_APPROVED');
    status = 'CORPUS_NOT_APPROVED';
  }

  const corpus = walk(corpusRoot)
    .filter((item) => textExtensions.has(extname(item.path).toLowerCase()))
    .filter((item) => !excludedPath.test(item.path))
    .map((item) => fingerprint(item.path, readFileSync(item.absolute, 'utf8')));
  corpusFiles = corpus.length;

  const exact = new Map();
  const normalized = new Map();
  const structural = new Map();
  const winnowIndex = new Map();
  corpus.forEach((item, index) => {
    if (!exact.has(item.exactSha256)) exact.set(item.exactSha256, []);
    exact.get(item.exactSha256).push(index);
    if (!normalized.has(item.normalizedSha256)) normalized.set(item.normalizedSha256, []);
    normalized.get(item.normalizedSha256).push(index);
    if (!structural.has(item.structuralSha256)) structural.set(item.structuralSha256, []);
    structural.get(item.structuralSha256).push(index);
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
    for (const index of structural.get(source.structuralSha256) ?? []) {
      if (!candidateMethods.has(index)) candidateMethods.set(index, { method: 'WINNOWING_SIGNATURE', score: 1 });
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
  approvedCorpus: corpusApproved,
  corpusFiles,
  unresolvedFindings: findings.length,
  finalBlockers,
  methodology: 'Exact SHA-256, normalized-token SHA-256, winnowing signatures and bounded winnowing Jaccard are computed only inside the runner against an explicitly mounted corpus. No source text or source phrase is sent to a public scanner. No match is screening evidence, not absolute proof of originality.',
}, null, 2) + '\n');

console.log(JSON.stringify({ status, protectedFiles: sourceFingerprints.length, corpusFiles, findings: findings.length, finalBlockers }, null, 2));
