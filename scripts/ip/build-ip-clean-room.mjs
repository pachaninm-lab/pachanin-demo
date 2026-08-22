import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const outDir = process.argv[2] ?? 'artifacts/ip-clean-room';
mkdirSync(outDir, { recursive: true });

function git(args, maxBuffer = 512 * 1024 * 1024) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer });
}

function csv(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function contributorId(name, email) {
  const cleanName = String(name || 'UNKNOWN').replace(/\s+/g, ' ').trim() || 'UNKNOWN';
  const emailHash = sha256(String(email || 'UNKNOWN').trim().toLowerCase()).slice(0, 16);
  return `${cleanName}#${emailHash}`;
}

const indexEntries = git(['ls-files', '-s', '-z']).split('\0').filter(Boolean).map((entry) => {
  const match = entry.match(/^(\d+) ([0-9a-f]+) \d+\t([\s\S]+)$/u);
  if (!match) throw new Error(`Cannot parse Git index entry: ${entry.slice(0, 160)}`);
  return { mode: match[1], blobSha: match[2], path: match[3] };
});
const tracked = indexEntries.map((entry) => entry.path).sort((left, right) => left.localeCompare(right, 'en'));
const trackedSet = new Set(tracked);
const indexByPath = new Map(indexEntries.map((entry) => [entry.path, entry]));

const firstByPath = new Map();
const contributorsByPath = new Map();
const allContributors = new Map();
const historicalVendor = new Map();
const historicalDeleted = new Map();
const renameEvents = [];

const vendorRe = /(^|\/)(vendor|vendors|third[_-]?party|external|externals|node_modules|deps?)(\/|$)/i;
const generatedRe = /(^|\/)(dist|build|generated|coverage|artifacts?)(\/|$)/i;
const archiveRe = /\.(?:zip|tar|tgz|gz|bz2|xz|7z|rar|jar|war|whl|egg)$/i;

function rememberContributor(path, commit) {
  const id = contributorId(commit.authorName, commit.authorEmail);
  if (!contributorsByPath.has(path)) contributorsByPath.set(path, new Set());
  contributorsByPath.get(path).add(id);
  const existing = allContributors.get(id) ?? {
    contributorId: id,
    displayName: commit.authorName || 'UNKNOWN',
    emailSha256: sha256(String(commit.authorEmail || 'UNKNOWN').trim().toLowerCase()),
    commits: new Set(),
    firstSeen: commit.authoredAt,
    lastSeen: commit.authoredAt,
  };
  existing.commits.add(commit.sha);
  if (commit.authoredAt < existing.firstSeen) existing.firstSeen = commit.authoredAt;
  if (commit.authoredAt > existing.lastSeen) existing.lastSeen = commit.authoredAt;
  allContributors.set(id, existing);
}

const history = git([
  'log', '--all', '--reverse', '--find-renames=80%',
  '--format=@@%H\t%aN\t%aE\t%aI', '--name-status',
]);

let commit = null;
for (const rawLine of history.split(/\r?\n/u)) {
  const line = rawLine.trimEnd();
  if (!line) continue;
  if (line.startsWith('@@')) {
    const [sha, authorName, authorEmail, authoredAt] = line.slice(2).split('\t');
    commit = { sha, authorName, authorEmail, authoredAt };
    rememberContributor(`@commit:${sha}`, commit);
    continue;
  }
  if (!commit) continue;

  const parts = line.split('\t');
  const status = parts[0];
  const paths = /^[RC]\d+/u.test(status) ? parts.slice(1, 3) : parts.slice(1, 2);
  for (const path of paths.filter(Boolean)) {
    rememberContributor(path, commit);
    if (vendorRe.test(path) && !historicalVendor.has(path)) {
      historicalVendor.set(path, { path, ...commit, status });
    }
  }

  if (/^R\d+/u.test(status) && parts.length >= 3) {
    const oldPath = parts[1];
    const newPath = parts[2];
    const origin = firstByPath.get(oldPath) ?? { path: oldPath, ...commit, originPath: oldPath };
    if (!firstByPath.has(newPath)) firstByPath.set(newPath, { ...origin, path: newPath, renamedFrom: oldPath });
    const oldContributors = contributorsByPath.get(oldPath) ?? new Set();
    if (!contributorsByPath.has(newPath)) contributorsByPath.set(newPath, new Set(oldContributors));
    contributorsByPath.get(newPath).add(contributorId(commit.authorName, commit.authorEmail));
    renameEvents.push({ oldPath, newPath, commit: commit.sha, date: commit.authoredAt, contributor: contributorId(commit.authorName, commit.authorEmail), status });
    continue;
  }
  if (/^C\d+/u.test(status) && parts.length >= 3) {
    const oldPath = parts[1];
    const newPath = parts[2];
    const origin = firstByPath.get(oldPath) ?? { path: oldPath, ...commit, originPath: oldPath };
    if (!firstByPath.has(newPath)) firstByPath.set(newPath, { ...origin, path: newPath, copiedFrom: oldPath });
    const oldContributors = contributorsByPath.get(oldPath) ?? new Set();
    if (!contributorsByPath.has(newPath)) contributorsByPath.set(newPath, new Set(oldContributors));
    contributorsByPath.get(newPath).add(contributorId(commit.authorName, commit.authorEmail));
    continue;
  }

  const path = parts[1];
  if (path && !firstByPath.has(path) && /^[AM]/u.test(status)) {
    firstByPath.set(path, { path, ...commit, originPath: path });
  }
  if (path && /^D/u.test(status) && !historicalDeleted.has(path)) {
    historicalDeleted.set(path, { path, commit: commit.sha, date: commit.authoredAt, contributor: contributorId(commit.authorName, commit.authorEmail) });
  }
}

for (const path of tracked) {
  if (firstByPath.has(path)) continue;
  try {
    const fallback = git([
      'log', 'HEAD', '--reverse', '--follow', '--diff-filter=ACMR',
      '--format=%H\t%aN\t%aE\t%aI', '--', path,
    ], 16 * 1024 * 1024).trim().split(/\r?\n/u).find(Boolean);
    if (!fallback) continue;
    const [sha, authorName, authorEmail, authoredAt] = fallback.split('\t');
    firstByPath.set(path, { path, sha, authorName, authorEmail, authoredAt, originPath: path });
    rememberContributor(path, { sha, authorName, authorEmail, authoredAt });
  } catch {
    // The row remains explicitly UNKNOWN; final mode fails on it.
  }
}

const boundary = JSON.parse(readFileSync('docs/ip/proprietary-core-boundary.json', 'utf8'));
const protectedRoots = boundary.protectedRoots ?? [];
function protectedEntry(path) {
  return protectedRoots.find((entry) => path === entry.path || path.startsWith(`${entry.path}/`));
}

const textExtensions = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.txt', '.yml', '.yaml',
  '.toml', '.py', '.sql', '.sh', '.css', '.scss', '.html', '.xml', '.graphql', '.prisma',
  '.properties', '.conf', '.ini', '.example', '.csv', '.svg',
]);
const ipControlRe = /^(LICENSE|LICENSE-PROPRIETARY\.md|NOTICE|COPYRIGHT|IP_POLICY\.md|OPEN_SOURCE_POLICY\.md|CONTRIBUTOR_IP_POLICY\.md|THIRD_PARTY_NOTICES\.md|docs\/ip\/|scripts\/ip\/|docs\/platform-v7\/autopilot\/scopes\/ip-clean-room-baseline-4459\.json$|\.github\/CODEOWNERS$|\.github\/workflows\/sbom-scan\.yml$)/u;
const lockfileRe = /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|poetry\.lock|Pipfile\.lock|uv\.lock)$/u;
const directLicenseRe = /SPDX-License-Identifier\s*:\s*([^\s*<]+)/i;
const namedLicenseRe = /(GNU\s+(?:Affero\s+)?General\s+Public\s+License|MIT\s+License|Apache\s+License|Mozilla\s+Public\s+License|Eclipse\s+Public\s+License)/i;
const copyrightRe = /Copyright\s*(?:\(c\)|©)?[^\r\n]{0,220}/i;

function readTextCandidate(path) {
  const extension = extname(path).toLowerCase();
  if (!textExtensions.has(extension) && extension && !/^Dockerfile(?:\.|$)/u.test(path.split('/').at(-1) ?? '')) return '';
  try {
    const metadata = lstatSync(path);
    if (!metadata.isFile() || metadata.size > 5 * 1024 * 1024) return '';
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

function detectMarkers(content) {
  const lines = content.split(/\r?\n/u).slice(0, 50);
  const headerPrefix = /^\s*(?:(?:\/\/|#|\/\*|\*|<!--)\s*)?/u;
  const spdxLine = lines.find((line) => new RegExp(`${headerPrefix.source}SPDX-License-Identifier\\s*:`, 'iu').test(line)) ?? '';
  const namedLine = lines.find((line) => new RegExp(`${headerPrefix.source}(?:GNU\\s+(?:Affero\\s+)?General\\s+Public\\s+License|MIT\\s+License|Apache\\s+License|Mozilla\\s+Public\\s+License|Eclipse\\s+Public\\s+License)`, 'iu').test(line)) ?? '';
  const copyrightLine = lines.find((line) => new RegExp(`${headerPrefix.source}Copyright\\b`, 'iu').test(line)) ?? '';
  const spdx = spdxLine.match(directLicenseRe)?.[1] ?? '';
  const named = namedLine.match(namedLicenseRe)?.[1] ?? '';
  const copyright = copyrightLine.match(copyrightRe)?.[0]?.replace(/\s+/g, ' ').trim() ?? '';
  return { license: spdx || named, copyright };
}

function classify(path, markers, criticality) {
  if (ipControlRe.test(path)) {
    return {
      originClass: 'AI_ASSISTED_FIRST_PARTY',
      originSource: 'OWNER_SPECIFICATION_ISSUE_4459_AND_REPOSITORY_HISTORY',
      license: 'PROPRIETARY / UNLICENSED',
      rightsBasis: 'OWNER_SPECIFICATION_ISSUE_4459; HUMAN_CHAIN_OF_TITLE_CONFIRMATION_REQUIRED',
      aiInvolvement: 'DECLARED_AI_ASSISTED',
      decision: 'KEEP_FIRST_PARTY_CONTROL',
      status: 'TECHNICAL_ORIGIN_RECORDED',
    };
  }
  if (vendorRe.test(path)) {
    return {
      originClass: 'VENDORED_THIRD_PARTY', originSource: 'REPOSITORY_PATH_AND_HISTORY',
      license: markers.license || 'UNKNOWN', rightsBasis: 'THIRD_PARTY_LICENSE_REVIEW_REQUIRED',
      aiInvolvement: 'UNKNOWN', decision: 'QUARANTINE_REVIEW_REQUIRED', status: 'UNRESOLVED',
    };
  }
  if (lockfileRe.test(path)) {
    return {
      originClass: 'GENERATED_FIRST_PARTY', originSource: 'PACKAGE_MANAGER_RESOLUTION',
      license: 'MIXED — SEE SBOM AND THIRD-PARTY REGISTER', rightsBasis: 'THIRD_PARTY_LICENSES',
      aiInvolvement: 'NONE_EXPECTED_GENERATED_FILE', decision: 'KEEP_AS_INFRASTRUCTURE_EVIDENCE', status: 'INFRASTRUCTURE_GENERATED',
    };
  }
  return {
    originClass: 'UNKNOWN',
    originSource: 'REPOSITORY_HISTORY_ONLY',
    license: markers.license || 'UNRESOLVED',
    rightsBasis: criticality === 'CROWN_JEWEL' ? 'CROWN_JEWEL_CHAIN_OF_TITLE_REQUIRED' : 'CHAIN_OF_TITLE_REQUIRED',
    aiInvolvement: 'UNKNOWN',
    decision: criticality === 'CROWN_JEWEL' ? 'CROWN_JEWEL_ORIGIN_REVIEW_REQUIRED' : 'ORIGIN_REVIEW_REQUIRED',
    status: 'UNRESOLVED',
  };
}

const records = [];
const currentLicenseCandidates = [];
for (const path of tracked) {
  const origin = firstByPath.get(path) ?? {
    sha: 'UNKNOWN', authorName: 'UNKNOWN', authorEmail: 'UNKNOWN', authoredAt: 'UNKNOWN', originPath: path,
  };
  const entry = indexByPath.get(path);
  const content = readTextCandidate(path);
  const markers = detectMarkers(content);
  const protection = protectedEntry(path);
  const criticality = protection?.criticality ?? (protection ? 'CROWN_JEWEL' : 'STANDARD');
  const classification = classify(path, markers, criticality);
  const contributors = [...(contributorsByPath.get(path) ?? new Set([contributorId(origin.authorName, origin.authorEmail)]))]
    .sort((left, right) => left.localeCompare(right, 'en'));
  if (markers.license || markers.copyright) {
    currentLicenseCandidates.push({ path, licenseMarker: markers.license, copyrightMarker: markers.copyright, decision: ipControlRe.test(path) ? 'FIRST_PARTY_POLICY_MARKER' : 'REVIEW_REQUIRED' });
  }
  records.push({
    path,
    blob_sha: entry?.blobSha ?? 'UNKNOWN',
    first_commit: origin.sha,
    first_date: origin.authoredAt,
    original_contributor: contributorId(origin.authorName, origin.authorEmail),
    material_contributors: `ALL_RECORDED_NOT_MATERIALITY_ADJUDICATED:${contributors.join(';')}`,
    origin_class: classification.originClass,
    origin_source: `${classification.originSource};origin_path=${origin.originPath ?? path}`,
    license: classification.license,
    copyright: markers.copyright || 'NOT_DETECTED',
    rights_basis: classification.rightsBasis,
    ai_involvement: classification.aiInvolvement,
    criticality,
    decision: classification.decision,
    evidence: `git:first=${origin.sha};blob=${entry?.blobSha ?? 'UNKNOWN'};contributors=${contributors.length}`,
    status: classification.status,
  });
}

const sourceSha = git(['rev-parse', 'HEAD']).trim();

const provenanceColumns = [
  'path', 'blob_sha', 'first_commit', 'first_date', 'original_contributor', 'material_contributors',
  'origin_class', 'origin_source', 'license', 'copyright', 'rights_basis', 'ai_involvement',
  'criticality', 'decision', 'evidence', 'status',
];
writeFileSync(join(outDir, 'FILE_PROVENANCE.csv'), [
  provenanceColumns.join(','),
  ...records.map((record) => provenanceColumns.map((column) => csv(record[column])).join(',')),
].join('\n') + '\n');
writeFileSync(join(outDir, 'FILE_PROVENANCE.json'), JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), gitHead: sourceSha, trackedFiles: records.length, records }, null, 2) + '\n');

writeFileSync(join(outDir, 'CONTRIBUTORS.csv'), [
  'contributor_id,display_name,email_sha256,commit_count,first_seen,last_seen,rights_evidence_status',
  ...[...allContributors.values()]
    .sort((left, right) => right.commits.size - left.commits.size || left.contributorId.localeCompare(right.contributorId, 'en'))
    .map((item) => [item.contributorId, item.displayName, item.emailSha256, item.commits.size, item.firstSeen, item.lastSeen, 'CHAIN_OF_TITLE_REFERENCE_REQUIRED'].map(csv).join(',')),
].join('\n') + '\n');

writeFileSync(join(outDir, 'CURRENT_LICENSE_HEADER_CANDIDATES.csv'), [
  'path,license_marker,copyright_marker,decision',
  ...currentLicenseCandidates.map((item) => [item.path, item.licenseMarker, item.copyrightMarker, item.decision].map(csv).join(',')),
].join('\n') + '\n');

const historyHeaderText = git([
  'log', '--all',
  '-G', 'SPDX-License-Identifier|Copyright|GNU (Affero )?General Public License|MIT License|Apache License|Mozilla Public License|Eclipse Public License',
  '--format=@@COMMIT %H | %aI | %s', '--name-only',
]);
writeFileSync(join(outDir, 'HISTORY_LICENSE_HEADER_CANDIDATES.txt'), historyHeaderText || 'NO_HISTORY_HEADER_CANDIDATES\n');

writeFileSync(join(outDir, 'HISTORY_VENDOR_CANDIDATES.csv'), [
  'path,first_candidate_commit,first_seen_at,contributor_id,status',
  ...[...historicalVendor.values()].sort((left, right) => left.path.localeCompare(right.path, 'en')).map((item) => [
    item.path, item.sha, item.authoredAt, contributorId(item.authorName, item.authorEmail), item.status,
  ].map(csv).join(',')),
].join('\n') + '\n');

writeFileSync(join(outDir, 'HISTORICAL_DELETED_FILES.csv'), [
  'path,deletion_commit,deletion_date,contributor_id',
  ...[...historicalDeleted.values()].sort((left, right) => left.path.localeCompare(right.path, 'en')).map((item) => [item.path, item.commit, item.date, item.contributor].map(csv).join(',')),
].join('\n') + '\n');

writeFileSync(join(outDir, 'RENAME_EVENTS.csv'), [
  'old_path,new_path,commit,date,contributor_id,status',
  ...renameEvents.map((item) => [item.oldPath, item.newPath, item.commit, item.date, item.contributor, item.status].map(csv).join(',')),
].join('\n') + '\n');

const refs = git(['for-each-ref', '--format=%(refname)\t%(objectname)', 'refs/heads', 'refs/remotes', 'refs/tags'])
  .trim().split(/\r?\n/u).filter(Boolean).map((line) => {
    const [ref, object] = line.split('\t');
    return { ref, object };
  });
const categoryCounts = {};
function category(path, mode) {
  if (mode === '120000') return 'symlink';
  if (mode === '160000') return 'submodule';
  if (archiveRe.test(path)) return 'archive';
  if (/(^|\/)migrations?(\/|$)/i.test(path)) return 'migration';
  if (/(^|\/)\.github\/workflows\//i.test(path)) return 'workflow';
  if (/(^|\/)Dockerfile(?:\.|$)/i.test(path)) return 'dockerfile';
  if (/(^|\/)(helm|k8s|kubernetes)(\/|$)/i.test(path)) return 'kubernetes_helm';
  if (/(^|\/)scripts?(\/|$)/i.test(path)) return 'script';
  if (/(^|\/)(models?|tokenizers?|datasets?|knowledge-sources|rag)(\/|$)/i.test(path)) return 'model_data_rag';
  if (/\.(?:woff2?|ttf|otf|png|jpe?g|webp|gif|svg|ico|pdf)$/i.test(path)) return 'asset';
  if (generatedRe.test(path)) return 'generated_candidate';
  if (/\.(?:ts|tsx|js|jsx|mjs|cjs|py|sql|prisma)$/i.test(path)) return 'source';
  if (/\.(?:md|txt|rst)$/i.test(path)) return 'documentation';
  return 'configuration_or_other';
}
for (const entry of indexEntries) {
  const value = category(entry.path, entry.mode);
  categoryCounts[value] = (categoryCounts[value] ?? 0) + 1;
}

const originClassCounts = records.reduce((counts, item) => {
  counts[item.origin_class] = (counts[item.origin_class] ?? 0) + 1;
  return counts;
}, {});
const statusCounts = records.reduce((counts, item) => {
  counts[item.status] = (counts[item.status] ?? 0) + 1;
  return counts;
}, {});
const summary = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  gitHead: sourceSha,
  trackedFiles: trackedSet.size,
  recordedFiles: records.length,
  repositoryHistoryCommits: Number(git(['rev-list', '--all', '--count']).trim()),
  distinctContributors: allContributors.size,
  originClassCounts,
  statusCounts,
  unknownOriginFiles: originClassCounts.UNKNOWN ?? 0,
  unresolvedRightsFiles: records.filter((item) => /REQUIRED|UNRESOLVED/u.test(item.rights_basis) || item.status === 'UNRESOLVED').length,
  crownJewelFiles: records.filter((item) => item.criticality === 'CROWN_JEWEL').length,
  crownJewelUnknownOrigin: records.filter((item) => item.criticality === 'CROWN_JEWEL' && item.origin_class === 'UNKNOWN').length,
  unresolvedLicenseMarkers: currentLicenseCandidates.filter((item) => item.decision === 'REVIEW_REQUIRED').length,
  historicalVendorPathCandidates: historicalVendor.size,
  historicalDeletedPaths: historicalDeleted.size,
  renameEvents: renameEvents.length,
  caveats: [
    'Git provenance records repository history, not contractual ownership or assignment of exclusive rights.',
    'UNKNOWN is deliberate and blocks final proprietary-clean status until evidence-backed review or clean-room replacement.',
    'Contributor identifiers hash email addresses; contracts and identity mapping remain outside Git.',
  ],
};
writeFileSync(join(outDir, 'PROVENANCE_SUMMARY.json'), JSON.stringify(summary, null, 2) + '\n');

writeFileSync(join(outDir, 'REPOSITORY_INVENTORY.json'), JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  gitHead: summary.gitHead,
  trackedFiles: trackedSet.size,
  categories: categoryCounts,
  symlinks: indexEntries.filter((entry) => entry.mode === '120000').map((entry) => entry.path),
  submodules: indexEntries.filter((entry) => entry.mode === '160000').map((entry) => ({ path: entry.path, object: entry.blobSha })),
  archives: tracked.filter((path) => archiveRe.test(path)),
  refs,
  branchRefs: refs.filter((item) => item.ref.startsWith('refs/heads/') || item.ref.startsWith('refs/remotes/')).length,
  tags: refs.filter((item) => item.ref.startsWith('refs/tags/')).length,
  historicalDeletedPaths: historicalDeleted.size,
  renameEvents: renameEvents.length,
  generatedCandidates: tracked.filter((path) => generatedRe.test(path)),
  historicalVendorCandidates: historicalVendor.size,
}, null, 2) + '\n');

console.log(JSON.stringify(summary, null, 2));
