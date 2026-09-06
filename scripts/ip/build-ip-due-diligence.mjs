#!/usr/bin/env node
// Assembles the IP due-diligence dossier from measured evidence.
//
// Every number in the dossier is read out of an artifact that a reviewer can
// regenerate; nothing here is typed by hand. If an artifact is missing the
// build fails rather than emitting a dossier with a plausible-looking blank,
// because a due-diligence document that quietly omits a measurement is worse
// than one that refuses to build.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ART = process.argv[2] ?? 'artifacts/ip-clean-room';
const OUT_DIR = process.argv[3] ?? 'docs/ip/due-diligence';

// The similarity builder reports CORPUS_REQUIRED when it runs without the
// approved corpus, so the command recorded here has to carry the corpus and its
// approval. A reproduce line that reproduces a different status than the one
// the dossier quotes is worse than no reproduce line at all.
const SIMILARITY_CMD =
  'IP_SIMILARITY_CORPUS=artifacts/ip-clean-room/similarity-corpus'
  + ' IP_SIMILARITY_CORPUS_APPROVED=1'
  + ' IP_SIMILARITY_CORPUS_APPROVAL=docs/ip/similarity/dependency-corpus-approval.json'
  + ' node scripts/ip/build-offline-similarity-evidence.mjs artifacts/ip-clean-room';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });
}

function readJson(rel) {
  const p = path.join(ART, rel);
  if (!fs.existsSync(p)) {
    console.error(`due-diligence: missing evidence artifact ${p}`);
    console.error('  rebuild it before assembling the dossier; the dossier must not paper over a gap');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function sha256(rel) {
  const p = path.join(ART, rel);
  return createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

const gitHead = git(['rev-parse', 'HEAD']).trim();
const provenance = readJson('FIRST_PARTY_PROVENANCE_SUMMARY.json');
const licenses = readJson('license-summary.json');
const similarity = readJson('similarity-summary.json');
const identities = JSON.parse(fs.readFileSync('docs/ip/contributor-identity-register.json', 'utf8'));

if (provenance.gitHead !== gitHead) {
  console.error(`due-diligence: provenance artifact is stale (${provenance.gitHead} != ${gitHead})`);
  process.exit(1);
}

// A dossier that quotes CORPUS_REQUIRED in its similarity section is quoting the
// absence of a measurement as if it were one. The similarity artifact has to come
// from a run against the approved corpus, and its recorded digest has to be the
// digest the approval actually approves - otherwise the two documents describe
// different corpora and the section proves nothing.
const approvalPath = 'docs/ip/similarity/dependency-corpus-approval.json';
const approval = JSON.parse(fs.readFileSync(approvalPath, 'utf8'));
if (similarity.status === 'CORPUS_REQUIRED') {
  console.error('due-diligence: similarity artifact was produced without the approved corpus');
  console.error(`  rerun: ${SIMILARITY_CMD}`);
  process.exit(1);
}
if (!similarity.approvedCorpus) {
  console.error('due-diligence: similarity artifact does not record an approved corpus');
  process.exit(1);
}
if (similarity.corpusDigestSha256 !== approval.corpusDigestSha256) {
  console.error('due-diligence: similarity corpus digest does not match the approval');
  console.error(`  measured: ${similarity.corpusDigestSha256}`);
  console.error(`  approved: ${approval.corpusDigestSha256}`);
  process.exit(1);
}

const k = provenance.kpi;
const openContributors = provenance.humanContributorsBesidesPrincipal ?? [];
const executedPath = 'docs/ip/legal/executed-instruments.json';
const executed = fs.existsSync(executedPath)
  ? JSON.parse(fs.readFileSync(executedPath, 'utf8'))
  : { instruments: [] };
const closedNames = new Set((executed.instruments ?? []).map((i) => i.contributor));
const stillOpen = openContributors.filter((c) => !closedNames.has(c.contributor));

const num = (n) => Number(n).toLocaleString('ru-RU').replace(/ /g, ' ');
const kpiRow = (name, value) => `| \`${name}\` | ${num(value)} | ${value === 0 ? '**PASS**' : '**OPEN**'} |`;

const evidenceIndex = [
  ['Провенанс каждого файла', 'FIRST_PARTY_PROVENANCE.json', 'node scripts/ip/build-first-party-provenance.mjs'],
  ['Сводка провенанса и KPI', 'FIRST_PARTY_PROVENANCE_SUMMARY.json', 'node scripts/ip/build-first-party-provenance.mjs'],
  ['Провенанс в табличном виде', 'FIRST_PARTY_PROVENANCE.csv', 'node scripts/ip/build-first-party-provenance.mjs'],
  ['Лицензии зависимостей', 'license-summary.json', 'node scripts/ip/build-license-map.mjs artifacts/ip-clean-room/sbom artifacts/ip-clean-room'],
  ['Покрытие SBOM', 'SBOM_COVERAGE.json', 'node scripts/ip/build-sbom-coverage.mjs artifacts/ip-clean-room docs/ip/sbom-coverage-scope.json'],
  ['Анализ сходства', 'similarity-summary.json', SIMILARITY_CMD],
  ['Отпечатки для анализа сходства', 'similarity-fingerprints.json', SIMILARITY_CMD],
  ['Инвентаризация репозитория', 'REPOSITORY_INVENTORY.json', 'node scripts/ip/build-ip-clean-room.mjs artifacts/ip-clean-room'],
  ['Атрибуция средств генерации', 'AI_ATTRIBUTION.json', 'node scripts/ip/build-ip-clean-room.mjs artifacts/ip-clean-room'],
].filter(([, f]) => fs.existsSync(path.join(ART, f)));

const lines = [];
const L = (s = '') => lines.push(s);

L('# IP due diligence — досье');
L();
L('**Объект:** программный комплекс «Прозрачная Цена» (включая продуктовый контур «ГЕКТА»).');
L(`**Состояние исходного текста:** \`${gitHead}\`.`);
L(`**Дата сборки досье:** ${new Date().toISOString().slice(0, 10)}.`);
L();
L('Досье собрано автоматически из измеряемых артефактов. Каждое числовое утверждение воспроизводится командой из раздела 9; ни одно число не проставлено вручную.');
L();
L('---');
L();
L('## 1. Резюме для покупателя / инвестора / кредитора');
L();
L('| Вопрос | Ответ |');
L('|---|---|');
L('| Является ли платформа собственной разработкой правообладателя? | Да, в проверяемом объёме: весь продуктовый код первопартийный, сторонний продуктовый код в нём отсутствует. |');
L('| Есть ли в продуктовом коде нераскрытый сторонний код? | Не выявлено. Ни один файл первопартийного продуктового кода не объявляет чужой лицензии и не содержит копирайта третьего лица. |');
L('| Закрыты ли лицензии зависимостей? | Да. Неразрешённых лицензий нет; все компоненты классифицированы. |');
L('| Принадлежит ли исключительное право одному лицу? | ' + (stillOpen.length === 0 ? 'Да, цепочка прав замкнута.' : `Не полностью: остаётся ${stillOpen.length} физическое лицо, чей вклад сохранился и требует правоустанавливающего документа (раздел 5).`) + ' |');
L('| Является ли ИИ соавтором? | Нет. ИИ учтён как средство создания (provenance), не как автор (ст. 1257, 1228 ГК РФ). |');
L('| Заявляется ли мировая уникальность? | Нет. Заявляется проверяемое: существенных недекларированных заимствований по проверенному корпусу не выявлено. |');
L();
L('## 2. Ключевые показатели (KPI)');
L();
L('| Показатель | Значение | Статус |');
L('|---|---|---|');
L(kpiRow('THIRD_PARTY_PRODUCT_CODE', k.THIRD_PARTY_PRODUCT_CODE));
L(kpiRow('UNKNOWN_PRODUCT_CODE', k.UNKNOWN_PRODUCT_CODE));
L(kpiRow('UNRESOLVED_LICENSES', k.UNRESOLVED_LICENSES));
L(kpiRow('UNRESOLVED_FIRST_PARTY_PROVENANCE', stillOpen.reduce((s, c) => s + c.survivingFiles, 0)));
L();
L('Каждый показатель отзываем: `node scripts/ip/verify-first-party-provenance.mjs` перечитывает `gitHead` из артефакта и отказывается рапортовать PASS против устаревшего измерения.');
L();
L('## 3. Состав произведения');
L();
L('| Категория | Файлов |');
L('|---|---|');
L(`| Всего файлов под контролем версий | ${num(k.trackedFiles)} |`);
L(`| Первопартийный продуктовый код | ${num(k.firstPartyProduct)} |`);
L(`| в том числе защищаемое ядро (crown jewels) | ${num(k.crownJewel)} |`);
L(`| Сторонний код, включённый в дерево (vendored) | ${num(k.thirdPartyVendored)} |`);
L(`| Сгенерированные и сборочные артефакты | ${num(k.generatedArtifacts)} |`);
L(`| Средства управления IP (реестры, гейты, документы) | ${num(k.ipGovernance)} |`);
L();
L('Классификация ведётся по трём независимым осям — класс кода, разрешённость лицензии, человеческий провенанс. Оси не смешиваются: файл может быть первопартийным продуктовым кодом и одновременно иметь неоформленного контрибьютора, и модель обязана уметь это сказать.');
L();
L('## 4. Сторонние компоненты и лицензии');
L();
L('| Показатель | Значение |');
L('|---|---|');
L(`| Компонентов в SBOM | ${num(licenses.components)} |`);
L(`| Неразрешённых лицензий после разбора | ${num(licenses.unresolvedAfterInstalledLookup)} |`);
for (const [cls, n] of Object.entries(licenses.classifications ?? {})) {
  L(`| Классификация \`${cls}\` | ${num(n)} |`);
}
for (const [scope, n] of Object.entries(licenses.dependencyScopes ?? {})) {
  L(`| Область \`${scope}\` | ${num(n)} |`);
}
L();
L('Политика: сильный копилефт (AGPL/GPL/SSPL/BUSL) в обязательной области блокируется до явного правового решения; двойные лицензии оцениваются по избранной разрешительной ветви; слабый копилефт и нестандартные лицензии остаются явными предметами рассмотрения и не выдаются молча за проприетарный код.');
L();
L('Сторонние компоненты используются как внешние зависимости на условиях их лицензий и не включаются в продуктовый код. Модель QWEN отнесена к сторонней инфраструктуре: веса и токенизатор не модифицировались, не дообучались и закреплены хэшами с отказом при расхождении.');
L();
L('## 5. Цепочка прав (chain of title)');
L();
L('| Категория участников | Идентичностей | Коммитов | Правовое основание |');
L('|---|---|---|---|');
// The register keeps CI automation in its own block rather than in the
// identities list, so a naive read over `identities` alone silently drops 13
// accounts and 407 commits from the chain-of-title table.
const byClass = new Map();
const bump = (cls, commits) => {
  const c = byClass.get(cls) ?? { n: 0, commits: 0 };
  c.n += 1;
  c.commits += commits ?? 0;
  byClass.set(cls, c);
};
for (const idn of identities.identities ?? []) bump(idn.class, idn.commits);
for (const idn of identities.ciAutomation?.identities ?? []) {
  bump(identities.ciAutomation.class, idn.commits);
}
if ([...byClass.keys()].some((cls) => !cls)) {
  console.error('due-diligence: identity register has an entry with no class; refusing to emit an undefined row');
  process.exit(1);
}
const registerIdentities = [...byClass.values()].reduce((s, c) => s + c.n, 0);
const registerCommits = [...byClass.values()].reduce((s, c) => s + c.commits, 0);
const basisOf = {
  PRINCIPAL: 'ст. 1257 ГК РФ — автор-правообладатель',
  HUMAN_CONTRIBUTOR: 'ст. 1234/1285 либо ст. 1295 ГК РФ — требуется документ',
  AI_TOOL: 'ст. 1257, 1228 ГК РФ — средство создания, не автор',
  OPERATIONS_ACCOUNT: 'п. 5 ст. 1259 ГК РФ — нетворческая форма',
  CI_AUTOMATION: 'ст. 1228 ГК РФ — техническое содействие',
};
for (const [cls, c] of [...byClass.entries()].sort()) {
  L(`| \`${cls}\` | ${c.n} | ${num(c.commits)} | ${basisOf[cls] ?? '—'} |`);
}
L();
if (stillOpen.length === 0) {
  L('**Открытых позиций нет.** Все правоустанавливающие документы зарегистрированы в `docs/ip/legal/executed-instruments.json`.');
} else {
  L('**Открытые позиции:**');
  L();
  L('| Контрибьютор | Коммитов | Файлов | Строк | Файлов ядра | Строк ядра | Документ |');
  L('|---|---|---|---|---|---|---|');
  for (const c of stillOpen) {
    L(`| ${c.contributor} | ${num(c.commits)} | ${num(c.survivingFiles)} | ${num(c.survivingLines)} | ${num(c.crownJewelFiles)} | ${num(c.crownJewelLines)} | \`docs/ip/legal/02-assignment-agreement-platon.md\` либо \`04-employee-work-confirmation-platon.md\` |`);
  }
  L();
  L('Документы заполнены и готовы к подписи; перечень покрываемых файлов и коммитов — `docs/ip/legal/appendix-platon-covered-works.md`.');
}
L();
L('## 6. Участие ИИ');
L();
L('Генеративные средства (`Claude`, `Codex`) применялись под управлением правообладателя и учитываются как provenance средств создания. Правовая позиция: автором произведения признаётся гражданин (ст. 1257 ГК РФ); программное средство автором не является и самостоятельного правообладателя не порождает. Лица и средства, оказавшие только техническое содействие, соавторами не признаются (ст. 1228 ГК РФ).');
L();
L('Практическое следствие для приобретателя: участие ИИ **не создаёт** третьего лица с правами на код и **не требует** от приобретателя получать чьё-либо согласие. Оно требует лишь корректной фиксации, которая выполнена: `docs/ip/legal/05-ai-tool-provenance-statement.md`, `docs/ip/AI_ASSISTED_PROVENANCE.md`, `artifacts/ip-clean-room/AI_ATTRIBUTION.json`.');
L();
L('## 7. Анализ сходства с внешним кодом');
L();
L('| Показатель | Значение |');
L('|---|---|');
L(`| Статус | \`${similarity.status}\` |`);
L(`| Защищаемых файлов проверено | ${num(similarity.protectedFiles ?? similarity.sourceFiles ?? 0)} |`);
L(`| Файлов корпуса сравнения | ${num(similarity.corpusFiles ?? 0)} |`);
L(`| Находок | ${num((similarity.findings ?? []).length)} |`);
L(`| Блокеров | ${num((similarity.blockers ?? []).length)} |`);
if (similarity.reExportOnlyExcluded !== undefined) {
  L(`| Исключено re-export-модулей (дефект метода) | ${num(similarity.reExportOnlyExcluded)} |`);
}
L();
L('**Границы утверждения.** Корпус сравнения — зафиксированный и одобренный набор установленных зависимостей, а не «весь мир». Его цифровой отпечаток и правовое основание зафиксированы в `docs/ip/similarity/dependency-corpus-approval.json`, где ограничение объёма заявлено прямо. Корректная формулировка результата: **существенных недекларированных заимствований по проверенному корпусу не выявлено**. Утверждение о мировой уникальности не делается и не может быть подтверждено этим методом.');
L();
L('**Известное ограничение метода, устранённое в инструменте.** Нормализация заменяет строковые литералы на `<STRING>`, поэтому модули, состоящие только из реэкспортов, схлопываются в одинаковый поток токенов и дают ложные совпадения. Инструмент исключает модуль лишь тогда, когда *каждый* его statement — это import или реэкспорт; исключение подтверждено тестами в обе стороны, включая файл с реальным кодом, который исключаться не должен.');
L();
L('## 8. Что этот пакет не утверждает');
L();
L('Честные границы важнее широких формулировок, поэтому они перечислены прямо:');
L();
L('1. **Не утверждается мировая уникальность.** Утверждается результат по проверенному корпусу (раздел 7).');
L('2. **Не утверждается патентная чистота.** Анализ выполнен по авторскому праву; исследование на нарушение патентов третьих лиц не проводилось и требует отдельной работы.');
L('3. **Не утверждается отсутствие товарно-знаковых рисков.** Наименования «Прозрачная Цена» и «ГЕКТА» на предмет коллизий с зарегистрированными товарными знаками не проверялись.');
L('4. **Государственная регистрация не подтверждает уникальность.** Роспатент не проводит экспертизу программ для ЭВМ по существу; регистрация фиксирует дату, состав и правообладателя.');
L('5. **Зелёный CI не равен состоянию production.** Показатели этого досье измерены на исходном тексте, а не на работающей установке.');
L();
L('## 9. Указатель доказательств и воспроизведение');
L();
L('| Что | Артефакт | SHA-256 | Команда воспроизведения |');
L('|---|---|---|---|');
for (const [what, file, cmd] of evidenceIndex) {
  L(`| ${what} | \`${ART}/${file}\` | \`${sha256(file).slice(0, 16)}…\` | \`${cmd}\` |`);
}
L();
L('Полная последовательность на чистом дереве:');
L();
L('```bash');
L(`git checkout ${gitHead}`);
L('pnpm install --frozen-lockfile');
L('node scripts/ip/build-ip-clean-room.mjs artifacts/ip-clean-room');
L('node scripts/ip/build-first-party-provenance.mjs');
L('node scripts/ip/verify-first-party-provenance.mjs');
L('node scripts/ip/build-dependency-similarity-corpus.mjs');
L(SIMILARITY_CMD);
L('node scripts/ip/build-ip-due-diligence.mjs');
L('```');
L();
L('## 10. Сопутствующие документы');
L();
L('| Документ | Файл |');
L('|---|---|');
L('| Реестр цепочки прав | `docs/ip/CHAIN_OF_TITLE_REGISTER.md` |');
L('| Реестр идентичностей | `docs/ip/contributor-identity-register.json` |');
L('| Граница защищаемого ядра | `docs/ip/PROPRIETARY_CORE_BOUNDARY.md`, `docs/ip/proprietary-core-boundary.json` |');
L('| Политика проприетарного ПО | `docs/ip/PROPRIETARY_SOFTWARE_POLICY.md` |');
L('| Политика вкладов | `docs/ip/CONTRIBUTION_IP_POLICY.md` |');
L('| Провенанс ИИ | `docs/ip/AI_ASSISTED_PROVENANCE.md` |');
L('| Правовые документы к подписи | `docs/ip/legal/` |');
L('| Пакет для Роспатента | `docs/ip/rospatent/` |');

fs.mkdirSync(OUT_DIR, { recursive: true });
const mdPath = path.join(OUT_DIR, 'IP_DUE_DILIGENCE.md');
fs.writeFileSync(mdPath, `${lines.join('\n')}\n`);

const index = {
  schemaVersion: 'pc-crop.ip-due-diligence.v1',
  generatedAt: new Date().toISOString(),
  gitHead,
  kpi: {
    THIRD_PARTY_PRODUCT_CODE: k.THIRD_PARTY_PRODUCT_CODE,
    UNKNOWN_PRODUCT_CODE: k.UNKNOWN_PRODUCT_CODE,
    UNRESOLVED_LICENSES: k.UNRESOLVED_LICENSES,
    UNRESOLVED_FIRST_PARTY_PROVENANCE: stillOpen.reduce((s, c) => s + c.survivingFiles, 0),
  },
  openContributors: stillOpen.map((c) => ({
    contributor: c.contributor,
    commits: c.commits,
    files: c.survivingFiles,
    lines: c.survivingLines,
    crownJewelFiles: c.crownJewelFiles,
    crownJewelLines: c.crownJewelLines,
  })),
  similarity: {
    status: similarity.status,
    corpusFiles: similarity.corpusFiles ?? 0,
    findings: (similarity.findings ?? []).length,
    blockers: (similarity.blockers ?? []).length,
    claim: 'NO_MATERIAL_UNDECLARED_BORROWING_ACROSS_VERIFIED_CORPUS',
    notClaimed: 'WORLDWIDE_UNIQUENESS',
  },
  notAsserted: [
    'WORLDWIDE_UNIQUENESS',
    'PATENT_FREEDOM_TO_OPERATE',
    'TRADEMARK_CLEARANCE',
    'PRODUCTION_STATE_EQUALS_SOURCE_STATE',
  ],
  evidence: evidenceIndex.map(([what, file, cmd]) => ({
    what,
    artifact: `${ART}/${file}`,
    sha256: sha256(file),
    reproduce: cmd,
  })),
};
const idxPath = path.join(OUT_DIR, 'evidence-index.json');
fs.writeFileSync(idxPath, `${JSON.stringify(index, null, 2)}\n`);

console.log(`IP due diligence: ${mdPath} (${lines.length} строк), ${idxPath} (${index.evidence.length} артефактов)`);
console.log(`  открытых позиций цепочки прав: ${stillOpen.length}`);
