#!/usr/bin/env node
// Keeps the legal instruments consistent with the measurement they describe.
//
// Every one of these documents names a tree state and a set of counts, and every
// one of those was typed. A typed commit hash in an assignment agreement is not
// a small problem: the agreement transfers rights to "the works listed in
// Appendix 1 as of tree state X", and if the appendix was regenerated at Y while
// the agreement still says X, the two describe different sets and the appendix
// is no longer the exhaustive list the agreement says it is.
//
// The appendix is generated, so it is the authority here. This script checks
// every instrument against it and, with --write, rewrites the drifted values.
//
//   node scripts/ip/verify-legal-instrument-consistency.mjs
//   node scripts/ip/verify-legal-instrument-consistency.mjs --write

import fs from 'node:fs';

const APPENDIX_JSON = 'docs/ip/legal/appendix-platon-covered-works.json';
const WRITE = process.argv.includes('--write');

const INSTRUMENTS = [
  'docs/ip/legal/01-declaration-of-authorship-principal.md',
  'docs/ip/legal/02-assignment-agreement-platon.md',
  'docs/ip/legal/03-acceptance-act-platon.md',
  'docs/ip/legal/04-employee-work-confirmation-platon.md',
  'docs/ip/legal/05-ai-tool-provenance-statement.md',
];

if (!fs.existsSync(APPENDIX_JSON)) {
  console.error(`Приложение отсутствует: ${APPENDIX_JSON}. Собрать: node scripts/ip/build-contributor-assignment-appendix.mjs`);
  process.exit(1);
}
const appendix = JSON.parse(fs.readFileSync(APPENDIX_JSON, 'utf8'));
const head = appendix.gitHead;
const totals = appendix.totals;

if (!/^[0-9a-f]{40}$/u.test(head ?? '')) {
  console.error(`Приложение не содержит состояния дерева: ${APPENDIX_JSON}`);
  process.exit(1);
}

// A non-breaking space, so a number never wraps across a line in a signed document.
const nbsp = ' ';
const spaced = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/gu, nbsp);
const anyDigits = '\\d[\\d  ]*';

const COUNTS = [
  [new RegExp(`\\*\\*(${anyDigits}) файла, (${anyDigits}) строк\\*\\*`, 'u'), () => [totals.filesWithSurvivingLines, totals.survivingLines], (m) => `**${spaced(totals.filesWithSurvivingLines)} файла, ${spaced(totals.survivingLines)} строк**`],
  [new RegExp(`\\*\\*(${anyDigits}) файла / (${anyDigits}) строка\\*\\*`, 'u'), () => [totals.crownJewelFiles, totals.crownJewelLines], () => `**${spaced(totals.crownJewelFiles)} файла / ${spaced(totals.crownJewelLines)} строка**`],
  [new RegExp(`\\*\\*(${anyDigits}) коммитов\\*\\*`, 'u'), () => [totals.commits], () => `**${spaced(totals.commits)} коммитов**`],
];

const problems = [];
let rewritten = 0;

for (const file of INSTRUMENTS) {
  if (!fs.existsSync(file)) {
    problems.push(`ОТСУТСТВУЕТ: ${file}`);
    continue;
  }
  let text = fs.readFileSync(file, 'utf8');
  const before = text;

  const heads = [...new Set(text.match(/`[0-9a-f]{40}`/gu) ?? [])].map((h) => h.slice(1, -1));
  for (const found of heads) {
    if (found === head) continue;
    if (WRITE) text = text.split(`\`${found}\``).join(`\`${head}\``);
    else problems.push(`СОСТОЯНИЕ ДЕРЕВА: ${file} — указано ${found.slice(0, 12)}…, приложение собрано на ${head.slice(0, 12)}…`);
  }
  if (heads.length === 0) {
    problems.push(`СОСТОЯНИЕ ДЕРЕВА НЕ УКАЗАНО: ${file}`);
  }

  for (const [pattern, expected, render] of COUNTS) {
    const match = text.match(pattern);
    if (!match) continue;
    const want = expected();
    const got = match.slice(1).map((g) => Number(String(g).replace(/[^\d]/gu, '')));
    if (got.some((value, i) => value !== want[i])) {
      if (WRITE) text = text.replace(pattern, render());
      else problems.push(`СЧЁТЧИКИ: ${file} — «${match[0]}», приложение даёт ${want.join(' / ')}`);
    }
  }

  if (WRITE && text !== before) {
    fs.writeFileSync(file, text);
    rewritten += 1;
  }
}

console.log(`Правовые документы: ${INSTRUMENTS.length} шт., состояние дерева ${head.slice(0, 12)}…`);
console.log(`  приложение: ${totals.filesWithSurvivingLines} файлов, ${totals.survivingLines} строк; ядро ${totals.crownJewelFiles}/${totals.crownJewelLines}; ${totals.commits} коммитов`);

if (WRITE) {
  console.log(`  приведено в соответствие: ${rewritten} документ(ов)`);
  process.exit(0);
}

if (problems.length > 0) {
  console.error('');
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('');
  console.error(`Расхождений: ${problems.length}. Привести в соответствие: node ${process.argv[1]} --write`);
  process.exit(1);
}
console.log('  расхождений с приложением нет');
