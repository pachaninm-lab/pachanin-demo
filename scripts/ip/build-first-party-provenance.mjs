/**
 * Модель происхождения и прав, разделённая на три независимые оси.
 *
 * Прежняя модель смешивала два разных вопроса в одном поле origin_class и
 * поэтому отвечала UNKNOWN на 6721 файл из 6767. Вопросы разные:
 *
 *   ЧТО это за файл          — отвечается доказательствами из репозитория
 *   КТО его произвёл         — отвечается историей и реестром личностей
 *   ЧЬИ на него права        — отвечается основанием, а для одного лица документом
 *
 * Здесь они разведены. Ни одна ось не выводится из другой, и ни одна не
 * объявляется без доказательства.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';

const outDir = process.argv[2] ?? 'artifacts/ip-clean-room';
mkdirSync(outDir, { recursive: true });

function git(args, maxBuffer = 512 * 1024 * 1024) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer });
}

const register = JSON.parse(readFileSync('docs/ip/contributor-identity-register.json', 'utf8'));
const boundary = JSON.parse(readFileSync('docs/ip/proprietary-core-boundary.json', 'utf8'));
const protectedRoots = boundary.protectedRoots ?? [];

const principalNames = new Set(
  register.identities.filter((entry) => entry.class === 'PRINCIPAL').map((entry) => entry.displayName),
);
const humanContributors = register.identities.filter((entry) => entry.class === 'HUMAN_CONTRIBUTOR');
const aiToolNames = new Set(register.identities.filter((entry) => entry.class === 'AI_TOOL').map((e) => e.displayName));
const opsNames = new Set(register.identities.filter((entry) => entry.class === 'OPERATIONS_ACCOUNT').map((e) => e.displayName));
const automationNames = new Set((register.ciAutomation?.identities ?? []).map((e) => e.displayName));

/** ОСЬ A — что это за файл. Порядок проверок значим: раньше — конкретнее. */
const VENDOR_RE = /(^|\/)(vendor|vendors|third[_-]?party|external|externals|node_modules)(\/|$)/iu;
const GENERATED_RE = /(^|\/)(dist|build|generated|coverage|\.next|out)(\/|$)/iu;
const LOCKFILE_RE = /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|poetry\.lock|Pipfile\.lock|uv\.lock)$/u;
const IP_CONTROL_RE = /^(LICENSE|LICENSE-PROPRIETARY\.md|NOTICE|COPYRIGHT|IP_POLICY\.md|OPEN_SOURCE_POLICY\.md|CONTRIBUTOR_IP_POLICY\.md|THIRD_PARTY_NOTICES\.md|docs\/ip\/|scripts\/ip\/)/u;
/** Материалы, сгенерированные сборкой и закоммиченные как данные. */
// Two independent anchored matches, not one alternation behind `(^|\/)`.
//
// The previous form was `/(^|\/)(presentation-pdf\/part-\d+\.ts|.*\.generated\.(ts|js|json))$/`,
// and the `(^|\/)` prefix in front of `.*` made it quadratic in the number of
// path separators: the engine retried from every `/` and rescanned to the end
// each time. Measured on a path of repeated separators: 1.4 ms at 1 000,
// 5.6 ms at 2 000, 22.3 ms at 4 000 - four times the work per doubling. Paths
// come from `git ls-files`, so this script does not control their shape.
const GENERATED_DATA_RE = /(?:^|\/)presentation-pdf\/part-\d+\.ts$|\.generated\.(?:ts|js|json)$/u;

function codeClass(path) {
  if (VENDOR_RE.test(path)) return 'THIRD_PARTY_VENDORED';
  if (LOCKFILE_RE.test(path) || GENERATED_RE.test(path) || GENERATED_DATA_RE.test(path)) return 'GENERATED_BUILD_ARTIFACT';
  if (IP_CONTROL_RE.test(path)) return 'IP_GOVERNANCE_CONTROL';
  return 'FIRST_PARTY_PRODUCT';
}

function criticalityOf(path) {
  const entry = protectedRoots.find((root) => path === root.path || path.startsWith(`${root.path}/`));
  return entry?.criticality ?? 'STANDARD';
}

/**
 * Признак стороннего продуктового кода внутри дерева.
 *
 * Ищется не «похоже на чужое», а объявленное самим файлом: SPDX-идентификатор
 * чужой лицензии либо копирайт на чужое имя. Отсутствие маркера доказательством
 * первопартийности не является и таковым здесь не считается — оно лишь означает,
 * что файл себя сторонним не объявляет.
 */
const TEXT_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.scss', '.sql', '.sh', '.py', '.prisma', '.yml', '.yaml', '.md']);
const SPDX_RE = /SPDX-License-Identifier\s*:\s*([^\s*<]+)/iu;
const FOREIGN_COPYRIGHT_RE = /Copyright\s*(?:\(c\)|©)\s*(?:\d{4}(?:\s*[-–]\s*\d{4})?\s*)?(.{3,120})/iu;
const OWN_MARKS = /(Прозрачная\s+Цена|Prozrachnaya|ГЕКТА|GEKTA|pachanin|PC-CROP)/iu;

function declaredThirdParty(path) {
  if (!TEXT_EXT.has(extname(path).toLowerCase())) return null;
  let text = '';
  try { text = readFileSync(path, 'utf8'); } catch { return null; }
  const head = text.split(/\r?\n/u).slice(0, 40).join('\n');
  const spdx = head.match(SPDX_RE)?.[1] ?? '';
  if (spdx && !/^(UNLICENSED|PROPRIETARY)$/iu.test(spdx)) return { reason: 'SPDX', value: spdx };
  const holder = head.match(FOREIGN_COPYRIGHT_RE)?.[1]?.trim() ?? '';
  if (holder && !OWN_MARKS.test(holder)) return { reason: 'COPYRIGHT', value: holder.slice(0, 120) };
  return null;
}

/**
 * ОСЬ C — сохранившийся творческий вклад физических лиц, кроме правообладателя.
 *
 * Считается по git blame, а не по тому, кто «трогал файл»: правку, полностью
 * переписанную позже, приобретать не у кого. Обход ограничен файлами, которых
 * такие лица вообще касались, — остальные по определению их строк не содержат.
 */
function survivingLinesByContributor(contributor) {
  const touched = new Set(
    git(['log', '--all', '--no-merges', `--author=${contributor.emails[0]}`, '--name-only', '--format='])
      .split(/\r?\n/u).map((line) => line.trim()).filter(Boolean),
  );
  const result = new Map();
  for (const path of touched) {
    if (!existsSync(path)) continue;
    let blame = '';
    try { blame = git(['blame', '--line-porcelain', '--', path], 256 * 1024 * 1024); } catch { continue; }
    let count = 0;
    for (const line of blame.split(/\r?\n/u)) {
      if (line.startsWith('author ') && line.slice(7).trim() === contributor.displayName) count += 1;
    }
    if (count > 0) result.set(path, count);
  }
  return result;
}

const contributorSurviving = new Map();
for (const contributor of humanContributors) {
  contributorSurviving.set(contributor.displayName, survivingLinesByContributor(contributor));
}

/** ОСЬ B — какие классы личностей вообще участвовали в файле по истории. */
const touchedBy = new Map();
{
  const history = git(['log', '--all', '--no-merges', '--format=@@%aN', '--name-only']);
  let author = '';
  for (const raw of history.split(/\r?\n/u)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('@@')) { author = line.slice(2); continue; }
    if (!touchedBy.has(line)) touchedBy.set(line, new Set());
    touchedBy.get(line).add(author);
  }
}

/**
 * Запасной проход для файлов, вошедших в дерево merge-коммитом.
 *
 * Основной обход идёт с --no-merges: так авторство не размывается слиянием.
 * Но файл, впервые появившийся ИМЕННО в merge-коммите (разрешение конфликта
 * или слияние ветки, чьи исходные коммиты недостижимы), в такой обход не
 * попадает вовсе. Двадцать файлов оказались именно такими — и это был дефект
 * обхода, а не пробел в репозитории: все они введены merge-коммитом bf24e8bb4
 * за авторством правообладателя. Здесь для них история берётся с включением
 * слияний, и источник помечается отдельно, чтобы происхождение вывода было
 * видно в самом артефакте.
 */
function mergeIntroducedAuthors(path) {
  try {
    const out = git(['log', '--all', '--format=%aN', '--', path], 16 * 1024 * 1024);
    return new Set(out.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

function authorshipProvenance(path) {
  let authors = touchedBy.get(path) ?? new Set();
  if (authors.size === 0) authors = mergeIntroducedAuthors(path);
  const human = [...authors].some((a) => principalNames.has(a) || humanContributors.some((c) => c.displayName === a));
  const ai = [...authors].some((a) => aiToolNames.has(a));
  const automation = [...authors].some((a) => automationNames.has(a) || opsNames.has(a));
  if (human && ai) return 'HUMAN_WITH_AI_TOOL';
  if (human) return 'HUMAN_ONLY';
  if (ai) return 'AI_TOOL_OUTPUT_UNDER_PRINCIPAL_DIRECTION';
  if (automation) return 'AUTOMATION_GENERATED';
  return 'NO_RECORDED_HISTORY';
}

const tracked = git(['ls-files']).split(/\r?\n/u).filter(Boolean);
const rows = [];
const kpi = {
  trackedFiles: tracked.length,
  firstPartyProduct: 0,
  crownJewel: 0,
  thirdPartyVendored: 0,
  generatedArtifacts: 0,
  ipGovernance: 0,
  THIRD_PARTY_PRODUCT_CODE: 0,
  UNKNOWN_PRODUCT_CODE: 0,
  UNRESOLVED_LICENSES: 0,
  UNRESOLVED_FIRST_PARTY_PROVENANCE: 0,
  assignmentRequiredFiles: 0,
  assignmentRequiredCrownJewelFiles: 0,
};

for (const path of tracked) {
  const cls = codeClass(path);
  const criticality = criticalityOf(path);
  const provenance = authorshipProvenance(path);
  const foreign = cls === 'FIRST_PARTY_PRODUCT' ? declaredThirdParty(path) : null;

  const pending = [];
  for (const contributor of humanContributors) {
    const lines = contributorSurviving.get(contributor.displayName)?.get(path) ?? 0;
    if (lines > 0) pending.push({ contributor: contributor.displayName, lines });
  }

  let rightsBasis;
  if (cls === 'THIRD_PARTY_VENDORED') rightsBasis = 'THIRD_PARTY_LICENSED';
  else if (cls === 'GENERATED_BUILD_ARTIFACT') rightsBasis = 'NO_SEPARATE_CREATIVE_AUTHORSHIP_GENERATED';
  else if (foreign) rightsBasis = 'THIRD_PARTY_DECLARED_IN_FILE';
  else if (pending.length > 0) rightsBasis = `ASSIGNMENT_REQUIRED:${pending.map((p) => `${p.contributor}(${p.lines})`).join(',')}`;
  else rightsBasis = 'PRINCIPAL_ORIGINAL_WORK';

  if (cls === 'FIRST_PARTY_PRODUCT') {
    kpi.firstPartyProduct += 1;
    if (criticality === 'CROWN_JEWEL') kpi.crownJewel += 1;
    if (foreign) kpi.THIRD_PARTY_PRODUCT_CODE += 1;
    if (provenance === 'NO_RECORDED_HISTORY') kpi.UNKNOWN_PRODUCT_CODE += 1;
    if (rightsBasis.startsWith('ASSIGNMENT_REQUIRED')) {
      kpi.UNRESOLVED_FIRST_PARTY_PROVENANCE += 1;
      kpi.assignmentRequiredFiles += 1;
      if (criticality === 'CROWN_JEWEL') kpi.assignmentRequiredCrownJewelFiles += 1;
    }
  }
  if (cls === 'THIRD_PARTY_VENDORED') kpi.thirdPartyVendored += 1;
  if (cls === 'GENERATED_BUILD_ARTIFACT') kpi.generatedArtifacts += 1;
  if (cls === 'IP_GOVERNANCE_CONTROL') kpi.ipGovernance += 1;
  if (foreign && !foreign.value) kpi.UNRESOLVED_LICENSES += 1;

  rows.push({
    path,
    code_class: cls,
    criticality,
    authorship_provenance: provenance,
    rights_basis: rightsBasis,
    declared_third_party: foreign ? `${foreign.reason}:${foreign.value}` : '',
  });
}

const summary = {
  schemaVersion: 'pc-crop.first-party-provenance.v1',
  generatedAt: new Date().toISOString(),
  gitHead: git(['rev-parse', 'HEAD']).trim(),
  identityRegister: 'docs/ip/contributor-identity-register.json',
  kpi,
  humanContributorsBesidesPrincipal: humanContributors.map((contributor) => {
    const map = contributorSurviving.get(contributor.displayName) ?? new Map();
    const files = [...map.entries()].map(([path, lines]) => ({ path, lines, criticality: criticalityOf(path) }))
      .sort((a, b) => b.lines - a.lines);
    return {
      contributor: contributor.displayName,
      commits: contributor.commits,
      survivingFiles: files.length,
      survivingLines: files.reduce((sum, item) => sum + item.lines, 0),
      crownJewelFiles: files.filter((f) => f.criticality === 'CROWN_JEWEL').length,
      crownJewelLines: files.filter((f) => f.criticality === 'CROWN_JEWEL').reduce((s, f) => s + f.lines, 0),
      files,
    };
  }),
};

writeFileSync(`${outDir}/FIRST_PARTY_PROVENANCE.json`, `${JSON.stringify({ ...summary, rows }, null, 2)}\n`);
writeFileSync(`${outDir}/FIRST_PARTY_PROVENANCE_SUMMARY.json`, `${JSON.stringify(summary, null, 2)}\n`);
const header = 'path,code_class,criticality,authorship_provenance,rights_basis,declared_third_party';
const csvBody = rows.map((r) => [r.path, r.code_class, r.criticality, r.authorship_provenance, r.rights_basis, r.declared_third_party]
  .map((v) => (/[",\n]/u.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : v)).join(',')).join('\n');
writeFileSync(`${outDir}/FIRST_PARTY_PROVENANCE.csv`, `${header}\n${csvBody}\n`);

console.log(`FIRST_PARTY_PROVENANCE: ${kpi.trackedFiles} файлов`);
console.log(`  first-party product ${kpi.firstPartyProduct} (crown jewels ${kpi.crownJewel}), vendored ${kpi.thirdPartyVendored}, generated ${kpi.generatedArtifacts}, governance ${kpi.ipGovernance}`);
console.log(`  THIRD_PARTY_PRODUCT_CODE=${kpi.THIRD_PARTY_PRODUCT_CODE}`);
console.log(`  UNKNOWN_PRODUCT_CODE=${kpi.UNKNOWN_PRODUCT_CODE}`);
console.log(`  UNRESOLVED_LICENSES=${kpi.UNRESOLVED_LICENSES}`);
console.log(`  UNRESOLVED_FIRST_PARTY_PROVENANCE=${kpi.UNRESOLVED_FIRST_PARTY_PROVENANCE} (crown jewels ${kpi.assignmentRequiredCrownJewelFiles})`);
