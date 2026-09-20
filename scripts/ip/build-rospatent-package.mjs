#!/usr/bin/env node
/**
 * Rospatent deposit package for the program «Прозрачная Цена».
 *
 * Государственная регистрация программы для ЭВМ (ГК РФ ст. 1261, 1262) requires
 * identifying materials: a source listing of at most 70 pages, 46 lines per page.
 * The core is far larger than that, so the listing is abridged -- first and last
 * parts deposited with the omission declared, which is the accepted practice and
 * must be stated rather than hidden.
 *
 * An artifact of this shape already existed in the tree, generated at an older
 * commit, and its manifest pointed at this filename. The script itself was never
 * committed, so the registration package could not be reproduced or audited. This
 * file restores that reproducibility and keeps the manifest schema compatible.
 *
 * It also adds a safeguard the previous artifact did not have.
 *
 * A registration application declares who authored the program. Filing one while a
 * third party's unassigned authorship survives inside the deposited material would
 * put a false declaration on a state register. So this script computes filing
 * readiness from the provenance evidence and refuses to mark a package filing-ready
 * while any covered file is of unresolved origin: the listing is watermarked ЧЕРНОВИК
 * and the manifest records BLOCKED with the reason. It still builds -- the draft is
 * useful for review -- but it will not tell you it is ready when it is not.
 *
 * Usage: node scripts/ip/build-rospatent-package.mjs [outDir] [--provenance <path>]
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { abridgeListing, computeFilingReadiness } from './rospatent-deposit.mjs';

const outDir = process.argv[2] ?? 'artifacts/ip-clean-room/rospatent';
const provenanceIndex = process.argv.indexOf('--provenance');
const provenancePath = provenanceIndex > -1
  ? process.argv[provenanceIndex + 1]
  : 'artifacts/ip-clean-room/FILE_PROVENANCE.json';

mkdirSync(outDir, { recursive: true });

const PROGRAM_NAME = 'Прозрачная Цена';
const MAX_PAGES = 70;
const LINES_PER_PAGE = 46;

function git(args, maxBuffer = 256 * 1024 * 1024) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer });
}

const head = git(['rev-parse', 'HEAD']).trim();

const boundary = JSON.parse(readFileSync('docs/ip/proprietary-core-boundary.json', 'utf8'));
const coveredRoots = boundary.protectedRoots
  .filter((root) => root.criticality === 'CROWN_JEWEL')
  .map((root) => root.path)
  .sort();

const sourceExtensions = new Set(['.ts', '.tsx', '.py']);
const excludedRe = /(^|\/)(tests?|__tests__|fixtures?|snapshots?|node_modules|dist|build|generated)(\/|$)|\.(test|spec)\.[tj]sx?$/iu;

const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean);
const covered = tracked
  .filter((path) => coveredRoots.some((root) => path === root || path.startsWith(`${root}/`)))
  .filter((path) => sourceExtensions.has(path.slice(path.lastIndexOf('.'))))
  .filter((path) => !excludedRe.test(path))
  .sort();

// Fail closed on secrets. A deposit is filed with a state body and published in part;
// anything matching these patterns must stop the build rather than be redacted quietly.
const SECRET_PATTERNS = [
  '-----BEGIN [A-Z ]*PRIVATE KEY-----',
  '\\b(?:aws_secret_access_key|client_secret|api[_-]?secret)\\s*[:=]\\s*[\'"][^\'"]{8,}',
  '\\bAKIA[0-9A-Z]{16}\\b',
  '\\bghp_[A-Za-z0-9]{30,}\\b',
  '\\bsk-[A-Za-z0-9]{32,}\\b',
];
const secretRe = new RegExp(SECRET_PATTERNS.join('|'), 'u');

const files = [];
const bodyLines = [];
let secretHits = 0;

for (const path of covered) {
  const content = readFileSync(path, 'utf8');
  if (secretRe.test(content)) {
    secretHits += 1;
    process.stderr.write(`SECRET_PATTERN_MATCH: ${path}\n`);
    continue;
  }
  const lines = content.split(/\r?\n/u);
  if (lines.at(-1) === '') lines.pop();
  files.push({
    path,
    lines: lines.length,
    blobSha: git(['hash-object', path]).trim(),
  });
  bodyLines.push(`/* ==== ${path} ==== */`, ...lines, '');
}

if (secretHits > 0) {
  console.error(`Rospatent deposit build FAILED CLOSED: ${secretHits} file(s) matched a secret pattern.`);
  process.exit(9);
}

// Filing readiness, computed from the provenance evidence rather than asserted.
let provenanceDocument = null;
try {
  provenanceDocument = JSON.parse(readFileSync(provenancePath, 'utf8'));
} catch {
  provenanceDocument = null;
}
const { filingReadiness, filingBlockers } = computeFilingReadiness(
  provenanceDocument,
  files.map((entry) => entry.path),
  head,
);
const draft = filingReadiness !== 'READY_FOR_LEGAL_REVIEW';

const unabridgedLines = bodyLines.length;
const unabridgedPages = Math.ceil(unabridgedLines / LINES_PER_PAGE);

const titleBlock = [
  '',
  '',
  '                    ПРОГРАММА ДЛЯ ЭВМ',
  '',
  `                      «${PROGRAM_NAME}»`,
  '',
  '            ИДЕНТИФИЦИРУЮЩИЕ МАТЕРИАЛЫ (ИСХОДНЫЙ ТЕКСТ)',
  '',
  '',
  '  Правообладатель:      см. заявление',
  '  Состояние исходного',
  `  текста (commit):      ${head}`,
  `  Файлов в листинге:    ${files.length}`,
  `  Строк в ядре:         ${unabridgedLines}`,
  `  Депонируется страниц: ${Math.min(MAX_PAGES, unabridgedPages)}`,
  '  Языки:                TypeScript, Python',
  '',
];
if (draft) {
  titleBlock.push(
    '  ЧЕРНОВИК — НЕ ДЛЯ ПОДАЧИ',
    `  Причина: ${filingBlockers.join('; ')}`,
    '',
  );
}

// Abridgement: keep the head and the tail, declare the omission in the middle.
const titlePageLines = LINES_PER_PAGE;
const availableLines = MAX_PAGES * LINES_PER_PAGE - titlePageLines;
const omissionNotice = (omitted) => [
  '',
  '  . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .',
  '',
  `  ПРОПУСК: ${omitted} строк исходного текста`,
  '  не приводятся в связи с ограничением объёма идентифицирующих',
  '  материалов. Депонируются начальная и конечная части листинга.',
  '',
  '  . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .',
  '',
];
const { lines: deposited, abridged } = abridgeListing(bodyLines, availableLines, omissionNotice);

const allLines = [...titleBlock.slice(0, titlePageLines), ...deposited];
const pages = Math.min(MAX_PAGES, Math.ceil(allLines.length / LINES_PER_PAGE));

const rendered = [];
for (let page = 0; page < pages; page += 1) {
  const label = `${PROGRAM_NAME} — идентифицирующие материалы — лист ${page + 1} из ${pages}`;
  rendered.push(label, '-'.repeat(label.length));
  rendered.push(...allLines.slice(page * LINES_PER_PAGE, (page + 1) * LINES_PER_PAGE));
}
const listing = `${rendered.join('\n')}\n`;

const listingPath = join(outDir, 'deposit-listing.txt');
writeFileSync(listingPath, listing);

const manifest = {
  schemaVersion: 'pc-crop.rospatent-deposit.v1',
  generatedAt: new Date().toISOString(),
  gitHead: head,
  programName: PROGRAM_NAME,
  legalBasis: 'ГК РФ ст. 1261, ст. 1262',
  filingReadiness,
  filingBlockers,
  filingReadinessNote: 'READY_FOR_LEGAL_REVIEW means every deposited file carries evidenced first-party origin. It is not legal advice, not a filing decision, and not a statement that the application will be accepted.',
  deposit: {
    file: listingPath,
    sha256: createHash('sha256').update(listing).digest('hex'),
    pages,
    maxPagesAllowed: MAX_PAGES,
    linesPerPage: LINES_PER_PAGE,
    abridged,
    abridgementBasis: abridged
      ? 'Полный листинг ядра превышает предельный объём идентифицирующих материалов; депонируются первая и последняя части с объявленным пропуском середины.'
      : null,
    unabridgedLines,
    unabridgedPages,
    draftWatermark: draft,
  },
  coveredRoots,
  files,
  secretScan: { patterns: SECRET_PATTERNS, result: 'NO_MATCH', behaviour: 'FAIL_CLOSED' },
  reproduce: `git checkout ${head} && node scripts/ip/build-rospatent-package.mjs ${outDir}`,
};

writeFileSync(join(outDir, 'deposit-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

process.stdout.write(`${JSON.stringify({
  gitHead: head,
  files: files.length,
  unabridgedLines,
  unabridgedPages,
  pages,
  abridged,
  filingReadiness,
  filingBlockers,
}, null, 2)}\n`);
