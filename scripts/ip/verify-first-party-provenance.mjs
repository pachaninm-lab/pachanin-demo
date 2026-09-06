/**
 * Гейт по показателям первопартийности.
 *
 * Проверяет не наличие документов, а измеряемые свойства дерева. Показатель,
 * который нельзя опровергнуть изменением кода, показателем не является, поэтому
 * каждый из четырёх считается заново по текущему состоянию репозитория.
 *
 * UNRESOLVED_FIRST_PARTY_PROVENANCE — единственный, который кодом не закрывается:
 * он падает до нуля только после подписания правоустанавливающего документа и
 * внесения его в реестр исполненных. Пока документ не подписан, гейт обязан
 * показывать ненулевое значение, а не молчать.
 *
 * Режим --baseline предназначен для CI. Три закрытых показателя в нём обязаны
 * оставаться нулевыми — любой возврат к ненулю валит сборку. Четвёртый
 * сравнивается с зафиксированным пределом: он не может вырасти, но и не держит
 * репозиторий в красном до чужой подписи. Гейт, который обязательно красный по
 * причине, недостижимой из кода, перестают читать, и вместе с ним перестают
 * читать три показателя, которые действительно защищают дерево.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const artifact = 'artifacts/ip-clean-room/FIRST_PARTY_PROVENANCE_SUMMARY.json';
if (!existsSync(artifact)) {
  console.error('FIRST_PARTY_PROVENANCE: артефакт отсутствует; сначала node scripts/ip/build-first-party-provenance.mjs');
  process.exit(1);
}
const summary = JSON.parse(readFileSync(artifact, 'utf8'));
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (summary.gitHead !== head) {
  console.error(`FIRST_PARTY_PROVENANCE: артефакт собран на ${summary.gitHead}, дерево на ${head}; пересоберите`);
  process.exit(1);
}

const executed = existsSync('docs/ip/legal/executed-instruments.json')
  ? JSON.parse(readFileSync('docs/ip/legal/executed-instruments.json', 'utf8'))
  : { instruments: [] };
const closedContributors = new Set(
  (executed.instruments ?? [])
    .filter((entry) => entry.status === 'EXECUTED' && String(entry.signedAt ?? '').length >= 10)
    .map((entry) => entry.contributor),
);

const kpi = summary.kpi;
const pending = (summary.humanContributorsBesidesPrincipal ?? [])
  .filter((entry) => !closedContributors.has(entry.contributor));
const unresolvedAfterInstruments = pending.reduce((sum, entry) => sum + entry.survivingFiles, 0);

const checks = [
  ['THIRD_PARTY_PRODUCT_CODE', kpi.THIRD_PARTY_PRODUCT_CODE],
  ['UNKNOWN_PRODUCT_CODE', kpi.UNKNOWN_PRODUCT_CODE],
  ['UNRESOLVED_LICENSES', kpi.UNRESOLVED_LICENSES],
  ['UNRESOLVED_FIRST_PARTY_PROVENANCE', unresolvedAfterInstruments],
];

const BASELINE_PATH = 'docs/ip/first-party-provenance-baseline.json';
const baselineMode = process.argv.includes('--baseline');
const updateBaseline = process.argv.includes('--update-baseline');
const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : null;

let failed = 0;
for (const [name, value] of checks) {
  const ok = value === 0;
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'OPEN'}  ${name}=${value}`);
}

if (pending.length > 0) {
  console.log('');
  console.log('Ожидают правоустанавливающего документа:');
  for (const entry of pending) {
    console.log(`  ${entry.contributor}: ${entry.survivingFiles} файлов, ${entry.survivingLines} строк; ядро ${entry.crownJewelFiles}/${entry.crownJewelLines}`);
    console.log(`    документ: docs/ip/legal/02-assignment-agreement-${entry.contributor.toLowerCase()}.md или 04-employee-work-confirmation-${entry.contributor.toLowerCase()}.md`);
    console.log(`    перечень: docs/ip/legal/appendix-${entry.contributor.toLowerCase()}-covered-works.md`);
  }
}

console.log('');
console.log(`FIRST_PARTY_PROVENANCE: ${failed === 0 ? 'ALL_KPI_PASS' : `${failed} показателя(ей) открыто`}`);

if (updateBaseline) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify({
    schemaVersion: 'pc-crop.first-party-provenance-baseline.v1',
    recordedAt: new Date().toISOString(),
    gitHead: head,
    rationale: 'Предел для CI. Три закрытых показателя обязаны оставаться нулевыми. Четвёртый закрывается подписью, а не кодом, поэтому фиксируется как предел, который нельзя превысить.',
    maxUnresolvedFirstPartyProvenance: unresolvedAfterInstruments,
    pendingContributors: pending.map((entry) => ({
      contributor: entry.contributor,
      files: entry.survivingFiles,
      lines: entry.survivingLines,
      crownJewelFiles: entry.crownJewelFiles,
      crownJewelLines: entry.crownJewelLines,
    })),
  }, null, 2)}\n`);
  console.log(`Предел записан: ${BASELINE_PATH} (${unresolvedAfterInstruments})`);
  process.exit(0);
}

if (!baselineMode) process.exit(failed === 0 ? 0 : 1);

// Baseline mode from here down.
const hardFailures = checks
  .filter(([name, value]) => name !== 'UNRESOLVED_FIRST_PARTY_PROVENANCE' && value !== 0);
if (hardFailures.length > 0) {
  console.error('');
  for (const [name, value] of hardFailures) {
    console.error(`  РЕГРЕССИЯ: ${name}=${value}, обязан быть 0`);
  }
  process.exit(1);
}
if (!baseline) {
  console.error('');
  console.error(`  Предел отсутствует: ${BASELINE_PATH}. Записать: node scripts/ip/verify-first-party-provenance.mjs --update-baseline`);
  process.exit(1);
}
const limit = baseline.maxUnresolvedFirstPartyProvenance;
if (unresolvedAfterInstruments > limit) {
  console.error('');
  console.error(`  РЕГРЕССИЯ: UNRESOLVED_FIRST_PARTY_PROVENANCE=${unresolvedAfterInstruments} превысил предел ${limit}`);
  console.error('  В дерево попал вклад неоформленного контрибьютора. Предел поднимать нельзя: оформите документ.');
  process.exit(1);
}
console.log(`Предел: ${unresolvedAfterInstruments} <= ${limit} — не превышен.`);
if (unresolvedAfterInstruments < limit) {
  console.log(`Предел можно опустить до ${unresolvedAfterInstruments}: node scripts/ip/verify-first-party-provenance.mjs --update-baseline`);
}
process.exit(0);
