#!/usr/bin/env node
// Builds the deposit materials for state registration of a computer program
// under Article 1262 of the Russian Civil Code.
//
// Rospatent accepts identifying materials of at most 70 pages. When the
// protected core is larger than that - it is - the accepted practice is to
// deposit the first half and the last half of the listing with the elision
// declared in the middle, so the deposit identifies the whole work rather
// than one arbitrary corner of it.
//
// The listing is derived from git-tracked source only, so it reproduces from
// any checkout of the recorded commit and cannot drift with an untracked
// working file.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// The deposit is generated, not stored. It embeds the commit it was built from,
// so a copy committed to the repository would name the commit before its own and
// be wrong the moment it lands - and it is 126 KB of source that already lives in
// the tree. It belongs with the other evidence artifacts, rebuilt at filing time
// from whatever commit is actually being filed.
const OUT_DIR = process.argv[2] ?? 'artifacts/ip-clean-room/rospatent';
const LINES_PER_PAGE = 46;
const MAX_PAGES = 70;
const PROGRAM_NAME = 'Прозрачная Цена';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 256 });
}

const gitHead = git(['rev-parse', 'HEAD']).trim();

const boundary = JSON.parse(fs.readFileSync('docs/ip/proprietary-core-boundary.json', 'utf8'));
const crownRoots = boundary.protectedRoots
  .filter((r) => r.criticality === 'CROWN_JEWEL')
  .map((r) => r.path)
  .sort();

const SOURCE_RE = /\.(ts|tsx|js|jsx|mjs|cjs|py)$/;
const TEST_RE = /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)tests?\//;

const tracked = git(['ls-files', '-z', ...crownRoots]).split('\0').filter(Boolean);
const sources = tracked
  .filter((p) => SOURCE_RE.test(p) && !TEST_RE.test(p))
  .sort();

if (sources.length === 0) {
  console.error('rospatent: no crown-jewel source files resolved; refusing to emit an empty deposit');
  process.exit(1);
}

// A deposit that leaks a credential is worse than no deposit. Fail closed.
const SECRET_RE = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:aws_secret_access_key|client_secret|api[_-]?secret)\s*[:=]\s*['"][^'"]{8,}/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9]{30,}\b/,
  /\bsk-[A-Za-z0-9]{32,}\b/,
];

const fileRecords = [];
const listingLines = [];
for (const file of sources) {
  const body = git(['show', `HEAD:${file}`]);
  for (const re of SECRET_RE) {
    if (re.test(body)) {
      console.error(`rospatent: refusing to deposit ${file}: matches secret pattern ${re}`);
      process.exit(1);
    }
  }
  const lines = body.split('\n');
  if (lines.at(-1) === '') lines.pop();
  const blob = git(['rev-parse', `HEAD:${file}`]).trim();
  fileRecords.push({ path: file, lines: lines.length, blobSha: blob });
  listingLines.push(`/* ==== ${file} ==== */`);
  listingLines.push(...lines);
  listingLines.push('');
}

const totalPagesUnabridged = Math.ceil(listingLines.length / LINES_PER_PAGE);

const ELISION = [
  '',
  '/* ============================================================== */',
  '/*                                                                */',
  '/*   ПРОПУСК СРЕДНЕЙ ЧАСТИ ЛИСТИНГА                               */',
  '/*                                                                */',
  `/*   Полный объём исходного текста охраняемого ядра составляет   */`,
  `/*   ${String(listingLines.length).padEnd(6)} строк (${String(totalPagesUnabridged).padEnd(4)} страниц машинописного текста).      */`,
  '/*   В соответствии с предельным объёмом идентифицирующих        */',
  '/*   материалов депонируются первая и последняя части листинга.   */',
  '/*   Средняя часть исключена из депонирования; она не изъята из   */',
  '/*   произведения и охраняется в полном объёме.                   */',
  '/*                                                                */',
  '/* ============================================================== */',
  '',
];

let deposited;
let abridged = false;
if (totalPagesUnabridged <= MAX_PAGES) {
  deposited = listingLines;
} else {
  abridged = true;
  const bodyPages = MAX_PAGES - 1; // one page is spent on the title page
  const headPages = Math.floor(bodyPages / 2);
  const tailPages = bodyPages - headPages;
  const head = listingLines.slice(0, headPages * LINES_PER_PAGE - ELISION.length);
  const tail = listingLines.slice(-(tailPages * LINES_PER_PAGE));
  deposited = [...head, ...ELISION, ...tail];
}

const titlePage = [
  '',
  '',
  `                    ПРОГРАММА ДЛЯ ЭВМ`,
  '',
  `                      «${PROGRAM_NAME}»`,
  '',
  '            ИДЕНТИФИЦИРУЮЩИЕ МАТЕРИАЛЫ (ИСХОДНЫЙ ТЕКСТ)',
  '',
  '',
  `  Правообладатель:      Пачанин М. (см. заявление)`,
  '  Состояние исходного',
  `  текста (commit):      ${gitHead}`,
  `  Файлов в листинге:    ${fileRecords.length}`,
  `  Строк в ядре:         ${listingLines.length}`,
  `  Депонируется страниц: ${MAX_PAGES}`,
  `  Языки:                TypeScript, Python`,
  '',
  '',
];

const pages = [];
const pageBody = [...deposited];
let pageNo = 1;
pages.push({ no: pageNo, lines: titlePage });
for (let i = 0; i < pageBody.length && pageNo < MAX_PAGES; i += LINES_PER_PAGE) {
  pageNo += 1;
  pages.push({ no: pageNo, lines: pageBody.slice(i, i + LINES_PER_PAGE) });
}

const rendered = pages
  .map((p) => {
    const header = `${PROGRAM_NAME} — идентифицирующие материалы — лист ${p.no} из ${pages.length}`;
    return [header, '-'.repeat(header.length), ...p.lines].join('\n');
  })
  .join('\n\f\n');

fs.mkdirSync(OUT_DIR, { recursive: true });
const listingPath = path.join(OUT_DIR, 'deposit-listing.txt');
fs.writeFileSync(listingPath, `${rendered}\n`);

const listingSha = createHash('sha256').update(fs.readFileSync(listingPath)).digest('hex');

const manifest = {
  schemaVersion: 'pc-crop.rospatent-deposit.v1',
  generatedAt: new Date().toISOString(),
  gitHead,
  programName: PROGRAM_NAME,
  legalBasis: 'ГК РФ ст. 1261, ст. 1262',
  deposit: {
    file: path.relative(process.cwd(), listingPath),
    sha256: listingSha,
    pages: pages.length,
    maxPagesAllowed: MAX_PAGES,
    linesPerPage: LINES_PER_PAGE,
    abridged,
    abridgementBasis: abridged
      ? 'Полный листинг ядра превышает предельный объём идентифицирующих материалов; депонируются первая и последняя части с объявленным пропуском середины.'
      : null,
    unabridgedLines: listingLines.length,
    unabridgedPages: totalPagesUnabridged,
  },
  coveredRoots: crownRoots,
  coveredFiles: fileRecords,
  secretScan: {
    patterns: SECRET_RE.map((r) => r.source),
    result: 'NO_MATCH',
    behaviour: 'FAIL_CLOSED',
  },
  reproduce: `git checkout ${gitHead} && node scripts/ip/build-rospatent-package.mjs ${OUT_DIR}`,
};

const manifestPath = path.join(OUT_DIR, 'deposit-manifest.json');
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Роспатент: депонируемый листинг ${pages.length} стр., ${fileRecords.length} файлов, ${listingLines.length} строк ядра`);
console.log(`  ${listingPath}  sha256=${listingSha}`);
console.log(`  ${manifestPath}`);
