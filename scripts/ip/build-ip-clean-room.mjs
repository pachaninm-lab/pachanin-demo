import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const outDir = process.argv[2] ?? 'artifacts/ip-clean-room';
mkdirSync(outDir, { recursive: true });

function git(args, maxBuffer = 256 * 1024 * 1024) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer });
}

function csv(value) {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean);
const trackedSet = new Set(tracked);
const provenance = new Map();
const allAuthors = new Map();
const historicalVendor = new Map();

const vendorRe = /(^|\/)(vendor|vendors|third[_-]?party|external|externals|node_modules|dist|build|generated|deps?)(\/|$)/i;
const history = git([
  'log', '--all', 'HEAD', '--reverse', '--find-renames=80%',
  '--format=@@%H\t%aN\t%aE\t%aI', '--name-status',
]);

let commit = null;
for (const rawLine of history.split(/\r?\n/)) {
  const line = rawLine.trimEnd();
  if (!line) continue;
  if (line.startsWith('@@')) {
    const [sha, authorName, authorEmail, authoredAt] = line.slice(2).split('\t');
    commit = { sha, authorName, authorEmail, authoredAt };
    const key = `${authorName}\u0000${authorEmail}`;
    const item = allAuthors.get(key) ?? { authorName, authorEmail, commits: 0, firstSeen: authoredAt, lastSeen: authoredAt };
    item.commits += 1;
    if (authoredAt < item.firstSeen) item.firstSeen = authoredAt;
    if (authoredAt > item.lastSeen) item.lastSeen = authoredAt;
    allAuthors.set(key, item);
    continue;
  }
  if (!commit) continue;

  const parts = line.split('\t');
  const status = parts[0];
  let paths = [];
  if (/^[RC]\d+/.test(status)) paths = parts.slice(1, 3);
  else paths = parts.slice(1, 2);

  for (const path of paths) {
    if (vendorRe.test(path) && !historicalVendor.has(path)) {
      historicalVendor.set(path, { path, ...commit, status });
    }
  }

  if (/^R\d+/.test(status) && parts.length >= 3) {
    const oldPath = parts[1];
    const newPath = parts[2];
    const origin = provenance.get(oldPath) ?? { path: oldPath, ...commit, originPath: oldPath };
    if (!provenance.has(newPath)) provenance.set(newPath, { ...origin, path: newPath, renamedFrom: oldPath });
    continue;
  }
  if (/^C\d+/.test(status) && parts.length >= 3) {
    const oldPath = parts[1];
    const newPath = parts[2];
    const origin = provenance.get(oldPath) ?? { path: oldPath, ...commit, originPath: oldPath };
    if (!provenance.has(newPath)) provenance.set(newPath, { ...origin, path: newPath, copiedFrom: oldPath });
    continue;
  }
  const path = parts[1];
  if (path && !provenance.has(path) && /^[AM]/.test(status)) {
    provenance.set(path, { path, ...commit, originPath: path });
  }
}

for (const path of tracked) {
  if (provenance.has(path)) continue;
  try {
    const fallback = git([
      'log', 'HEAD', '--reverse', '--follow', '--diff-filter=ACMR',
      '--format=%H\t%aN\t%aE\t%aI', '--', path,
    ], 8 * 1024 * 1024).trim().split(/\r?\n/).find(Boolean);
    if (!fallback) continue;
    const [sha, authorName, authorEmail, authoredAt] = fallback.split('\t');
    provenance.set(path, { path, sha, authorName, authorEmail, authoredAt, originPath: path });
  } catch {
    // Keep UNKNOWN if Git cannot resolve an origin for an unusual tracked object.
  }
}

const textExtensions = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.txt', '.yml', '.yaml',
  '.toml', '.py', '.sql', '.sh', '.css', '.scss', '.html', '.xml', '.graphql', '.prisma',
  '.properties', '.conf', '.ini', '.env', '.example', '.csv',
]);
const directHeaderRe = /(SPDX-License-Identifier\s*:|Copyright\s*(?:\(c\)|©)?)/i;
const namedLicenseRe = /(GNU\s+(?:Affero\s+)?General\s+Public\s+License|MIT\s+License|Apache\s+License|Mozilla\s+Public\s+License|Eclipse\s+Public\s+License)/i;
const policyRe = /^(LICENSE|NOTICE|docs\/ip\/|scripts\/ip\/|\.github\/|package\.json$|pnpm-lock\.yaml$)/;

function detectHeader(content) {
  const lines = content.split(/\r?\n/).slice(0, 40);
  for (const line of lines.slice(0, 30)) {
    const direct = line.match(directHeaderRe);
    if (direct) return direct[0];
  }
  for (const line of lines.slice(0, 20)) {
    if (!/^\s*(?:\/\/|#|\/\*|\*|<!--)/.test(line)) continue;
    const named = line.match(namedLicenseRe);
    if (named) return named[0];
  }
  return '';
}

const rows = [];
const currentHeaderCandidates = [];
for (const path of tracked.sort()) {
  const origin = provenance.get(path) ?? { sha: 'UNKNOWN', authorName: 'UNKNOWN', authorEmail: 'UNKNOWN', authoredAt: 'UNKNOWN', originPath: path };
  const extension = extname(path).toLowerCase();
  let header = '';
  let status = policyRe.test(path) ? 'POLICY_OR_METADATA' : 'PROPRIETARY_NO_EXTERNAL_HEADER';
  let license = 'Proprietary / UNLICENSED (repository policy)';

  if (vendorRe.test(path)) status = 'REVIEW_VENDOR_OR_GENERATED';

  if (textExtensions.has(extension) || !extension) {
    try {
      const content = readFileSync(path, 'utf8');
      header = detectHeader(content).replace(/\s+/g, ' ').slice(0, 240);
      if (header && !policyRe.test(path)) {
        status = 'REVIEW_EXTERNAL_LICENSE_HEADER';
        license = 'Header/license candidate — review required';
        currentHeaderCandidates.push({ path, marker: header });
      }
    } catch {
      // Binary/undecodable files are represented by path and Git provenance only.
    }
  }

  rows.push({
    path,
    originPath: origin.originPath ?? path,
    firstCommit: origin.sha,
    firstSeenAt: origin.authoredAt,
    authorName: origin.authorName,
    authorEmail: origin.authorEmail,
    license,
    status,
    marker: header,
  });
}

const historyHeaderText = git([
  'log', '--all', 'HEAD',
  '-G', 'SPDX-License-Identifier|Copyright|GNU (Affero )?General Public License|MIT License|Apache License|Mozilla Public License|Eclipse Public License',
  '--format=@@COMMIT %H | %aN <%aE> | %aI | %s', '--name-only',
]);

writeFileSync(join(outDir, 'file-provenance.csv'), [
  'path,origin_path,first_commit,first_seen_at,author_name,author_email,license,status,marker',
  ...rows.map((r) => [r.path, r.originPath, r.firstCommit, r.firstSeenAt, r.authorName, r.authorEmail, r.license, r.status, r.marker].map(csv).join(',')),
].join('\n') + '\n');

writeFileSync(join(outDir, 'authors.csv'), [
  'author_name,author_email,commit_count,first_seen,last_seen,rights_evidence_status',
  ...[...allAuthors.values()].sort((a, b) => b.commits - a.commits).map((a) => [
    a.authorName, a.authorEmail, a.commits, a.firstSeen, a.lastSeen, 'CONTRACTUAL_CHAIN_OF_TITLE_REQUIRED',
  ].map(csv).join(',')),
].join('\n') + '\n');

writeFileSync(join(outDir, 'current-header-candidates.csv'), [
  'path,marker',
  ...currentHeaderCandidates.map((x) => [x.path, x.marker].map(csv).join(',')),
].join('\n') + '\n');

writeFileSync(join(outDir, 'history-header-candidates.txt'), historyHeaderText || 'NO_HISTORY_HEADER_CANDIDATES\n');

writeFileSync(join(outDir, 'history-vendor-candidates.csv'), [
  'path,first_candidate_commit,first_seen_at,author_name,author_email,status',
  ...[...historicalVendor.values()].sort((a, b) => a.path.localeCompare(b.path)).map((x) => [
    x.path, x.sha, x.authoredAt, x.authorName, x.authorEmail, x.status,
  ].map(csv).join(',')),
].join('\n') + '\n');

const summary = {
  generatedAt: new Date().toISOString(),
  gitHead: git(['rev-parse', 'HEAD']).trim(),
  trackedFiles: trackedSet.size,
  identifiedOrigins: rows.filter((r) => r.firstCommit !== 'UNKNOWN').length,
  distinctCommitAuthors: allAuthors.size,
  currentHeaderCandidates: currentHeaderCandidates.length,
  historicalVendorPathCandidates: historicalVendor.size,
  statusCounts: rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {}),
  caveat: 'Git provenance identifies commit authorship, not contractual ownership or assignment of exclusive rights.',
};
writeFileSync(join(outDir, 'clean-room-summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
