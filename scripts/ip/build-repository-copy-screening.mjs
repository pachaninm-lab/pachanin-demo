#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Asks the copy question of the whole repository instead of the protected core.
 *
 * Both existing screenings look only inside docs/ip/proprietary-core-boundary.json:
 * 688 files, of which 660 have a parser. The repository tracks 4675 files in the
 * same languages. The other ~3987 - the application shell, the web routes, the
 * scripts, the migrations, everything outside the crown jewels - have never been
 * compared against anything at all, while the chain-of-title register covers all
 * 6175 of them. That asymmetry is a gap in the wrong direction: third-party code
 * pasted into a file nobody calls a crown jewel is exactly as much of a rights
 * problem, and rather more likely.
 *
 * This screening is deliberately narrower in method and wider in reach. It asks
 * only the decisive question - is this file a copy - by comparing digests:
 *
 *   - exact SHA-256 of the bytes,
 *   - SHA-256 of the normalized form, which survives comment removal,
 *     reindenting and reflowing, renamed strings and changed numbers, and
 *   - SHA-256 of the token sequence, which additionally survives respacing.
 *
 * The third exists because the second does not reach as far as it reads. The
 * normalisation collapses runs of whitespace rather than removing them, so a
 * formatter that puts spaces around an operator changes the normalized digest.
 * That was found by a unit test written on the wrong premise, and the test was
 * kept for the right one.
 *
 * All three are O(files): there is no pairwise comparison, so the whole
 * repository against the whole corpus costs one pass. What it does not do is find partial
 * derivatives; the protected core gets that treatment from the winnowing and
 * shape screenings, and the record says plainly which files got which.
 *
 * It also enumerates what a screening cannot read. A tracked symlink is not a
 * file to compare, and an absolute one does not resolve on any machine but the
 * one it was committed from, so both are reported rather than passed over.
 */

const outDir = process.argv[2] ?? 'artifacts/ip-clean-room/repository-copy';
const corpusInput = String(process.env.IP_SIMILARITY_CORPUS ?? '').trim();

const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.sql', '.prisma', '.css', '.scss']);
/** The corpus side only. Our own tree is screened whole - a copy pasted into a
 *  test fixture is still a copy, and excluding our own directories by name is how
 *  a screening ends up reporting on a subset it never names. */
const corpusExcluded = /(^|\/)(tests?|fixtures?|snapshots?|node_modules|dist|build|generated)(\/|$)/i;

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

// Character-identical to normalizeSource in build-offline-similarity-evidence.mjs.
// The suite asserts that by comparing the two function texts, because two
// normalisers that drift apart silently produce two different meanings of "clean".
export function normalizeSource(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|\s)\/\/.*$/gm, '$1 ')
    .replace(/(^|\s)#.*$/gm, '$1 ')
    .replace(/`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '<STRING>')
    .replace(/\b\d+(?:\.\d+)?\b/g, '<NUMBER>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Character-identical to tokens in build-offline-similarity-evidence.mjs, and
// guarded by the same test. The normalized digest collapses whitespace runs but
// does not remove them, so it survives reindenting and reflowing and does NOT
// survive respacing around an operator - measured, not assumed. Hashing the token
// sequence instead removes whitespace entirely, which is what makes the claim
// "this file is a copy" hold against a formatter as well as against an editor.
export function tokens(source) {
  return normalizeSource(source).match(/[\p{L}_$][\p{L}\p{N}_$]*|<STRING>|<NUMBER>|===|!==|=>|==|!=|<=|>=|&&|\|\||[^\s]/gu) ?? [];
}

/**
 * A file whose normalized form carries no code is not evidence of anything: every
 * barrel of re-exports normalises to the same text, and so does every module that
 * is one docstring. Both screenings before this one spent their entire finding
 * list on exactly those two shapes. They are counted and set aside by measurement
 * rather than dropped silently.
 */
export function isStructurallyEmpty(normalized) {
  const withoutPlaceholders = normalized.replaceAll('<STRING>', '').replaceAll('<NUMBER>', '');
  const words = withoutPlaceholders.match(/[\p{L}_$][\p{L}\p{N}_$]*/gu) ?? [];
  const meaningful = words.filter((word) => !['export', 'from', 'import', 'as', 'default'].includes(word));
  return meaningful.length === 0;
}

export function parseSymlink(mode, target) {
  if (mode !== '120000') return null;
  return { target, absolute: target.startsWith('/') };
}

function walkCorpus(root) {
  const files = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) { stack.push(absolute); continue; }
      if (!entry.isFile()) continue;
      const path = relative(root, absolute).replaceAll('\\', '/');
      if (corpusExcluded.test(path)) continue;
      if (!TEXT_EXTENSIONS.has(extname(path).toLowerCase())) continue;
      files.push({ absolute, path });
    }
  }
  return files;
}

function csv(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function main() {
  mkdirSync(outDir, { recursive: true });

  const entries = git(['ls-files', '-s', '-z'])
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(\d+) ([0-9a-f]+) \d+\t([\s\S]+)$/u);
      if (!match) throw new Error(`Cannot parse Git index entry: ${entry.slice(0, 160)}`);
      return { mode: match[1], blobSha: match[2], path: match[3] };
    });

  const symlinks = [];
  for (const entry of entries) {
    const link = parseSymlink(entry.mode, entry.mode === '120000' ? git(['cat-file', '-p', entry.blobSha]).trim() : '');
    if (link) symlinks.push({ path: entry.path, ...link });
  }

  const candidates = entries
    .filter((entry) => /^100(?:644|755)$/u.test(entry.mode))
    .filter((entry) => TEXT_EXTENSIONS.has(extname(entry.path).toLowerCase()));

  const repository = candidates.map((entry) => {
    const source = readFileSync(entry.path, 'utf8');
    const normalized = normalizeSource(source);
    return {
      path: entry.path,
      bytes: Buffer.byteLength(source),
      exactSha256: sha256(source),
      normalizedSha256: sha256(normalized),
      tokenSha256: sha256(tokens(source).join('\u0001')),
      structurallyEmpty: isStructurallyEmpty(normalized),
    };
  });

  const byExact = new Map();
  const byNormalized = new Map();
  const byToken = new Map();
  const addTo = (index, key, file) => {
    const bucket = index.get(key);
    if (bucket) bucket.push(file);
    else index.set(key, [file]);
  };
  for (const file of repository) {
    addTo(byExact, file.exactSha256, file);
    addTo(byNormalized, file.normalizedSha256, file);
    addTo(byToken, file.tokenSha256, file);
  }

  const findings = [];
  const blockers = [];
  let corpusFiles = 0;
  let status = 'CORPUS_REQUIRED';
  if (!corpusInput) {
    blockers.push('OFFLINE_CORPUS_NOT_PROVIDED');
  } else {
    const corpusRoot = resolve(corpusInput);
    if (!existsSync(corpusRoot) || !lstatSync(corpusRoot).isDirectory()) {
      blockers.push('OFFLINE_CORPUS_NOT_A_DIRECTORY');
    } else {
      for (const entry of walkCorpus(corpusRoot)) {
        corpusFiles += 1;
        let source = null;
        try { source = readFileSync(entry.absolute, 'utf8'); } catch { continue; }
        const exact = sha256(source);
        for (const file of byExact.get(exact) ?? []) {
          findings.push({ path: file.path, corpus: entry.path, method: 'EXACT_SHA256', structurallyEmpty: file.structurallyEmpty });
        }
        const normalized = sha256(normalizeSource(source));
        for (const file of byNormalized.get(normalized) ?? []) {
          if (file.exactSha256 === exact) continue;
          findings.push({ path: file.path, corpus: entry.path, method: 'NORMALIZED_SHA256', structurallyEmpty: file.structurallyEmpty });
        }
        const tokenDigest = sha256(tokens(source).join('\u0001'));
        for (const file of byToken.get(tokenDigest) ?? []) {
          if (file.exactSha256 === exact || file.normalizedSha256 === normalized) continue;
          findings.push({ path: file.path, corpus: entry.path, method: 'TOKEN_SHA256', structurallyEmpty: file.structurallyEmpty });
        }
      }
      status = findings.length ? 'FINDINGS_REVIEW_REQUIRED' : 'NO_WHOLE_FILE_COPIES';
    }
  }

  const substantive = findings.filter((finding) => !finding.structurallyEmpty);
  const absoluteSymlinks = symlinks.filter((link) => link.absolute);
  if (substantive.length) blockers.push(`WHOLE_FILE_COPIES:${substantive.length}`);
  if (absoluteSymlinks.length) blockers.push(`TRACKED_ABSOLUTE_SYMLINKS:${absoluteSymlinks.length}`);

  const rows = ['finding_id,repository_path,corpus_path,method,structurally_empty'];
  findings.forEach((finding, position) => {
    rows.push([
      `REP-${String(position + 1).padStart(6, '0')}`,
      csv(finding.path), csv(finding.corpus), finding.method, finding.structurallyEmpty ? 'yes' : 'no',
    ].join(','));
  });
  writeFileSync(join(outDir, 'REPOSITORY_COPY_FINDINGS.csv'), `${rows.join('\n')}\n`);

  const summary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status,
    networkUsed: false,
    trackedFiles: entries.length,
    screenedFiles: repository.length,
    structurallyEmptyFiles: repository.filter((file) => file.structurallyEmpty).length,
    // Byte-identical files inside our own tree. Not a rights question, but the
    // register counts every path as a file with an origin, so a duplicated file
    // is counted twice and looks like twice the first-party work.
    duplicatesInsideRepository: [...byExact.values()]
      .filter((group) => group.length > 1)
      .map((group) => group.map((file) => file.path).sort()),
    trackedSymlinks: symlinks.length,
    trackedAbsoluteSymlinks: absoluteSymlinks,
    corpusFiles,
    findings: findings.length,
    substantiveFindings: substantive.length,
    blockers,
    methodology: 'Three digests of every tracked file in a comparable language, against every corpus file: the exact bytes, the normalized text, and the token sequence. The normalized digest collapses whitespace runs without removing them, so it survives reindenting and reflowing but not respacing around an operator; the token digest removes whitespace entirely and covers that. Digest comparison finds whole-file copies however they were reformatted; it does not find partial derivatives, which the protected core gets from the winnowing and shape screenings and the rest of the repository does not.',
  };
  writeFileSync(join(outDir, 'repository-copy-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({
    status, trackedFiles: summary.trackedFiles, screenedFiles: summary.screenedFiles,
    corpusFiles, findings: findings.length, substantiveFindings: substantive.length,
    trackedAbsoluteSymlinks: absoluteSymlinks.length, blockers,
  }, null, 2));
  return blockers.length ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
