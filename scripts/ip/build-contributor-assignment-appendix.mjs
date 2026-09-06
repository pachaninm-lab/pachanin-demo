/**
 * Приложение к правоустанавливающему документу: точный перечень того, что он закрывает.
 *
 * Документ, закрывающий «весь вклад» без перечня, закрывает неизвестно что.
 * Здесь перечень собирается из замера, а не из памяти: коммиты берутся из
 * истории по адресу автора, файлы и строки — из git blame по текущему дереву.
 * Файл, который автор трогал, но чьи строки полностью переписаны позже,
 * в перечень НЕ попадает: приобретать там нечего.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * Ячейка markdown-таблицы из внешнего текста.
 *
 * Прежняя форма экранировала только трубу: `String(x).replace(/\|/gu, '\\|')`.
 * Обратный слеш при этом не экранировался, поэтому описание коммита вида
 * `a\|B|C` превращалось в `a\\|B|C`: рендерер читал `\\` как экранированный
 * слеш, а следующая труба оставалась живым разделителем. Замерено на строке
 * таблицы, где должно быть 6 ячеек:
 *
 *   слеш вплотную к трубе   было 7 ячеек   стало 6
 *   две трубы после слеша   было 7 ячеек   стало 6
 *   перевод строки          было 2 строки  стало 1
 *   возврат каретки         было 2 строки  стало 1
 *
 * Это приложение — исчерпывающий перечень произведений к договору об
 * отчуждении. Описание коммита, способное добавить столбец или целую строку,
 * меняет то, что документ заявляет переданным.
 *
 * Порядок обязателен: перевод строки убирается первым, срез идёт ДО
 * экранирования (иначе он режет экранирующую последовательность и оставляет
 * висящий слеш), слеши экранируются раньше труб.
 */
function cell(value, limit = 100) {
  return String(value)
    .replace(/[\r\n]+/gu, ' ')
    .slice(0, limit)
    .replace(/\\/gu, '\\\\')
    .replace(/\|/gu, '\\|');
}
function git(args, maxBuffer = 256 * 1024 * 1024) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer });
}

const register = JSON.parse(readFileSync('docs/ip/contributor-identity-register.json', 'utf8'));
const boundary = JSON.parse(readFileSync('docs/ip/proprietary-core-boundary.json', 'utf8'));
const roots = boundary.protectedRoots ?? [];
const criticalityOf = (path) => roots.find((r) => path === r.path || path.startsWith(`${r.path}/`))?.criticality ?? 'STANDARD';

const outDir = process.argv[2] ?? 'docs/ip/legal';
mkdirSync(outDir, { recursive: true });

for (const contributor of register.identities.filter((entry) => entry.class === 'HUMAN_CONTRIBUTOR')) {
  const email = contributor.emails[0];
  const commits = git(['log', '--all', '--no-merges', `--author=${email}`, '--format=%H\t%aI\t%s'])
    .split(/\r?\n/u).filter(Boolean)
    .map((line) => { const [sha, date, subject] = line.split('\t'); return { sha, date, subject }; })
    .sort((a, b) => a.date.localeCompare(b.date));

  const touched = new Set(
    git(['log', '--all', '--no-merges', `--author=${email}`, '--name-only', '--format='])
      .split(/\r?\n/u).map((line) => line.trim()).filter(Boolean),
  );

  const files = [];
  for (const path of [...touched].sort((a, b) => a.localeCompare(b, 'en'))) {
    if (!existsSync(path)) continue;
    let blame = '';
    try { blame = git(['blame', '--line-porcelain', '--', path]); } catch { continue; }
    let lines = 0;
    for (const line of blame.split(/\r?\n/u)) {
      if (line.startsWith('author ') && line.slice(7).trim() === contributor.displayName) lines += 1;
    }
    if (lines > 0) files.push({ path, lines, criticality: criticalityOf(path), blobSha: git(['rev-parse', `HEAD:${path}`]).trim() });
  }

  const crown = files.filter((f) => f.criticality === 'CROWN_JEWEL');
  const appendix = {
    schemaVersion: 'pc-crop.contributor-assignment-appendix.v1',
    generatedAt: new Date().toISOString(),
    gitHead: git(['rev-parse', 'HEAD']).trim(),
    contributor: { displayName: contributor.displayName, gitAuthorEmail: email },
    method: 'Коммиты — git log --all --no-merges по адресу автора. Файлы и строки — git blame по текущему дереву: учитывается только сохранившийся вклад, переписанное позже не включается.',
    totals: {
      commits: commits.length,
      pathsTouchedEver: touched.size,
      filesWithSurvivingLines: files.length,
      survivingLines: files.reduce((sum, item) => sum + item.lines, 0),
      crownJewelFiles: crown.length,
      crownJewelLines: crown.reduce((sum, item) => sum + item.lines, 0),
    },
    commits,
    files,
  };
  const slug = contributor.displayName.toLowerCase().replace(/[^a-z0-9]+/gu, '-');
  writeFileSync(`${outDir}/appendix-${slug}-covered-works.json`, `${JSON.stringify(appendix, null, 2)}\n`);

  const md = [
    `# Приложение № 1 — перечень передаваемых произведений`,
    ``,
    `**Автор:** ${contributor.displayName} (git-адрес \`${email}\`)`,
    `**Состояние дерева:** \`${appendix.gitHead}\``,
    `**Сформировано:** ${appendix.generatedAt}`,
    ``,
    `## Итоги`,
    ``,
    `| показатель | значение |`,
    `|---|---|`,
    `| коммитов автора | ${appendix.totals.commits} |`,
    `| путей затронуто за всю историю | ${appendix.totals.pathsTouchedEver} |`,
    `| файлов с сохранившимися строками | **${appendix.totals.filesWithSurvivingLines}** |`,
    `| сохранившихся строк | **${appendix.totals.survivingLines}** |`,
    `| из них файлов защищаемого ядра | **${appendix.totals.crownJewelFiles}** |`,
    `| из них строк защищаемого ядра | **${appendix.totals.crownJewelLines}** |`,
    ``,
    `Метод: ${appendix.method}`,
    ``,
    `## Раздел А. Файлы защищаемого ядра (CROWN_JEWEL)`,
    ``,
    `| № | файл | строк | blob SHA |`,
    `|---:|---|---:|---|`,
    ...crown.map((f, i) => `| ${i + 1} | \`${cell(f.path, 200)}\` | ${f.lines} | \`${cell(f.blobSha.slice(0, 12))}\` |`),
    ``,
    `## Раздел Б. Остальные файлы`,
    ``,
    `| № | файл | строк | категория | blob SHA |`,
    `|---:|---|---:|---|---|`,
    ...files.filter((f) => f.criticality !== 'CROWN_JEWEL')
      .map((f, i) => `| ${i + 1} | \`${cell(f.path, 200)}\` | ${f.lines} | ${cell(f.criticality)} | \`${cell(f.blobSha.slice(0, 12))}\` |`),
    ``,
    `## Раздел В. Коммиты автора`,
    ``,
    `| № | SHA | дата | описание |`,
    `|---:|---|---|---|`,
    ...commits.map((c, i) => `| ${i + 1} | \`${cell(c.sha.slice(0, 12))}\` | ${cell(c.date.slice(0, 10))} | ${cell(c.subject)} |`),
    ``,
  ].join('\n');
  writeFileSync(`${outDir}/appendix-${slug}-covered-works.md`, `${md}\n`);
  console.log(`Приложение по ${contributor.displayName}: ${appendix.totals.filesWithSurvivingLines} файлов, ${appendix.totals.survivingLines} строк, ядро ${appendix.totals.crownJewelFiles}/${appendix.totals.crownJewelLines}`);
}
