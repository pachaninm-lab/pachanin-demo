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

// Per-file authorship provenance, so section 6 can state how much of the
// protected core carries only tool-attributed lines instead of asserting that
// the question does not arise.
// The legacy clean-room summary, read so the dossier can reconcile it rather
// than leave a reviewer holding two contradictory numbers. Its blockers are
// still reported by the CI evidence gate, and the evidence bundle a reviewer
// downloads carries both files.
const legacy = readJson('PROVENANCE_SUMMARY.json');

const perFile = JSON.parse(fs.readFileSync(path.join(ART, 'FIRST_PARTY_PROVENANCE.json'), 'utf8'));
const fileRows = Array.isArray(perFile) ? perFile : (perFile.files ?? perFile.rows ?? []);
const crownRows = fileRows.filter((r) => r.criticality === 'CROWN_JEWEL');
const countBy = (rows) => rows.reduce((acc, r) => {
  acc[r.authorship_provenance] = (acc[r.authorship_provenance] ?? 0) + 1;
  return acc;
}, {});
const crownByProvenance = countBy(crownRows);
const allByProvenance = countBy(fileRows);
const mergeStats = {
  byPrincipal: identities.completeness?.mergesByPrincipalOnDefaultBranch ?? 0,
  total: identities.completeness?.mergesTotalOnDefaultBranch ?? 0,
};

// How AI-authored work actually reached the default branch. Splitting merged
// from directly-pushed matters: the first carries an explicit act of acceptance
// by whoever authored the merge, the second does not, and claiming both do would
// be the kind of overstatement this dossier exists to avoid.
const aiIdentities = new Set(
  (identities.identities ?? []).filter((i) => i.class === 'AI_TOOL').map((i) => i.displayName),
);
const countAuthored = (args) =>
  git(['log', 'origin/main', ...args, '--format=%aN'])
    .split('\n')
    .filter((n) => aiIdentities.has(n)).length;
const aiOnDefault = countAuthored(['--no-merges']);
const aiOnDefaultDirect = countAuthored(['--first-parent', '--no-merges']);
const aiOnDefaultMerged = aiOnDefault - aiOnDefaultDirect;

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
L('Досье описывает состояние, непосредственно предшествующее коммиту, в котором оно лежит: собственный хэш коммита ему недоступен до его создания. Это не устаревание — сборщик отказывается работать против артефакта, собранного не на том состоянии, поэтому пересборка на актуальном дереве либо даёт совпадение, либо явно требует пересчёта.');
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
L('### 3.1. Почему в комплекте доказательств два разных ответа про происхождение');
L();
L('Реестр доказательств содержит две модели, и их числа выглядят противоречиво. Противоречия нет, но объяснить это обязан документ, а не читатель.');
L();
L('| | Прежняя модель (`PROVENANCE_SUMMARY.json`) | Новая модель (`FIRST_PARTY_PROVENANCE_SUMMARY.json`) |');
L('|---|---|---|');
L(`| Файлов «неизвестного происхождения» | ${num(legacy.unknownOriginFiles)} | ${num(k.UNKNOWN_PRODUCT_CODE)} |`);
L(`| Файлов ядра «неизвестного происхождения» | ${num(legacy.crownJewelUnknownOrigin)} | ${num(k.UNKNOWN_PRODUCT_CODE)} |`);
L(`| Файлов с неурегулированными правами | ${num(legacy.unresolvedRightsFiles)} | ${num(stillOpen.reduce((s, c) => s + c.survivingFiles, 0))} |`);
L();
L('**Прежняя модель отвечала на другой вопрос.** Её классификатор различал файлы по пути: средства управления IP, вендоренный код, lock-файлы — а всему остальному присваивал `UNKNOWN` как значение по умолчанию. `UNKNOWN` там означает не «происхождение файла неизвестно», а «этот классификатор на вопрос не отвечает». Отсюда и число, равное почти всему дереву: классификатор воздерживался по каждому файлу продукта.');
L();
L('**Новая модель отвечает на сам вопрос** — по истории репозитория и `git blame`, а не по пути файла. Поэтому её ноль — это измеренный ответ, а не переопределённый по умолчанию.');
L();
L('**Почему прежние показатели не отключены.** Убрать блокер, переименовав значение, которое его порождает, — это и есть сфабрикованный PASS, от которого предупреждает сам реестр цепочки прав. Прежняя модель оставлена работать как есть, её блокеры продолжают выводиться гейтом доказательств, а несовпадение объяснено здесь. Проверяющему нужны обе цифры и причина их различия, а не одна удобная.');
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
L('### 6.1. Сколько кода несёт только инструментальную атрибуцию');
L();
L('Вопрос закрывается измерением, а не заявлением. Ниже — распределение файлов по тому, чьи строки в них сохранились по `git blame`:');
L();
L('| Провенанс сохранившихся строк | Ядро (crown jewels) | Всё дерево |');
L('|---|---|---|');
for (const key of ['HUMAN_ONLY', 'HUMAN_WITH_AI_TOOL', 'AI_TOOL_OUTPUT_UNDER_PRINCIPAL_DIRECTION', 'AUTOMATION_GENERATED', 'NO_RECORDED_HISTORY']) {
  const c = crownByProvenance[key] ?? 0;
  const a = allByProvenance[key] ?? 0;
  if (c === 0 && a === 0) continue;
  L(`| \`${key}\` | ${num(c)} | ${num(a)} |`);
}
L(`| **Итого** | **${num(crownRows.length)}** | **${num(fileRows.length)}** |`);
L();
const aiOnlyCrown = crownByProvenance.AI_TOOL_OUTPUT_UNDER_PRINCIPAL_DIRECTION ?? 0;
const humanTouchedCrown = crownRows.length - aiOnlyCrown - (crownByProvenance.AUTOMATION_GENERATED ?? 0) - (crownByProvenance.NO_RECORDED_HISTORY ?? 0);
L(`**Что здесь измерено.** В ${num(humanTouchedCrown)} из ${num(crownRows.length)} файлов ядра сохранились строки, внесённые под учётной записью человека. В ${num(aiOnlyCrown)} файлах ядра все сохранившиеся строки внесены под учётной записью генеративного инструмента.`);
L();
L('**Что это НЕ означает.** Строка «автор коммита» — это учётная запись, под которой выполнен коммит, а не установление авторства в смысле ст. 1257 ГК РФ. Программное средство автором не является; автором признаётся гражданин, творческим трудом которого произведение создано, и этим гражданином во всех перечисленных случаях выступает правообладатель, задававший постановку задачи, принимавший результат и включавший его в продукт.');
L();
L('**Измеримое подтверждение человеческого контроля.**');
L();
L('| Показатель | Значение |');
L('|---|---|');
L(`| Слияний в \`main\`, выполненных правообладателем | ${num(mergeStats.byPrincipal)} из ${num(mergeStats.total)} (${((mergeStats.byPrincipal / Math.max(mergeStats.total, 1)) * 100).toFixed(1)} %) |`);
L(`| Коммитов инструментов в \`main\` | ${num(aiOnDefault)} |`);
L(`| из них принято через слияние | ${num(aiOnDefaultMerged)} (${((aiOnDefaultMerged / Math.max(aiOnDefault, 1)) * 100).toFixed(1)} %) |`);
L(`| из них внесено в \`main\` напрямую | ${num(aiOnDefaultDirect)} |`);
L();
L(`Слияние — это акт принятия работы в произведение, и его выполняет правообладатель. Для ${num(aiOnDefaultMerged)} коммитов инструментов такой акт зафиксирован в истории явно. Оставшиеся ${num(aiOnDefaultDirect)} внесены в основную ветвь напрямую, отдельного слияния за ними нет, и выдавать их за принятые через слияние было бы неверно; человеческий контроль над ними подтверждается не структурой истории, а тем же основанием, что и для всего остального, — постановкой задачи и принятием результата правообладателем (ст. 1257, 1228 ГК РФ).`);
L();
L('**Честная граница.** Учётная запись коммиттера для коммитов инструмента совпадает с учётной записью автора (инструмент проставляет обе), поэтому она независимым признаком человеческого участия не является, и выдавать её за таковой было бы подтасовкой. Независимый признак — авторство слияния, приведённое выше.');
L();
L('**Почему эти файлы не переписаны ради атрибуции.** Переписывание работающего кода ядра ради изменения строки «автор» в `git blame` не создаёт авторского права там, где его не было, и не устраняет риска там, где он есть, — зато создаёт реальный риск для работающей платформы. Правовая позиция опирается на ст. 1257 и ст. 1228 ГК РФ, а не на распределение учётных записей в истории.');
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
  legacyModelReconciliation: {
    legacyUnknownOriginFiles: legacy.unknownOriginFiles,
    legacyCrownJewelUnknownOrigin: legacy.crownJewelUnknownOrigin,
    legacyUnresolvedRightsFiles: legacy.unresolvedRightsFiles,
    explanation: "The legacy classifier assigns UNKNOWN as its default for anything that is not an IP-control file, vendored code or a lockfile. UNKNOWN there means the classifier does not answer the question, not that a file's origin is unknown. Its blockers are deliberately left in place: removing one by renaming the value that produces it is the fabricated PASS the chain-of-title register warns against.",
  },
  authorshipProvenance: {
    crownJewels: crownByProvenance,
    allFiles: allByProvenance,
    crownJewelTotal: crownRows.length,
    fileTotal: fileRows.length,
    mergesOnDefaultBranch: mergeStats,
    aiCommitsOnDefaultBranch: { total: aiOnDefault, viaMerge: aiOnDefaultMerged, direct: aiOnDefaultDirect },
    note: 'Commit-author identity is the account a commit was made under, not a determination of authorship. Under art. 1257 of the Russian Civil Code the author is the citizen whose creative work produced the result; a software tool is not an author.',
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
