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
    ...crown.map((f, i) => `| ${i + 1} | \`${f.path}\` | ${f.lines} | \`${f.blobSha.slice(0, 12)}\` |`),
    ``,
    `## Раздел Б. Остальные файлы`,
    ``,
    `| № | файл | строк | категория | blob SHA |`,
    `|---:|---|---:|---|---|`,
    ...files.filter((f) => f.criticality !== 'CROWN_JEWEL')
      .map((f, i) => `| ${i + 1} | \`${f.path}\` | ${f.lines} | ${f.criticality} | \`${f.blobSha.slice(0, 12)}\` |`),
    ``,
    `## Раздел В. Коммиты автора`,
    ``,
    `| № | SHA | дата | описание |`,
    `|---:|---|---|---|`,
    ...commits.map((c, i) => `| ${i + 1} | \`${c.sha.slice(0, 12)}\` | ${c.date.slice(0, 10)} | ${String(c.subject).replace(/\|/gu, '\\|').slice(0, 100)} |`),
    ``,
  ].join('\n');
  writeFileSync(`${outDir}/appendix-${slug}-covered-works.md`, `${md}\n`);
  console.log(`Приложение по ${contributor.displayName}: ${appendix.totals.filesWithSurvivingLines} файлов, ${appendix.totals.survivingLines} строк, ядро ${appendix.totals.crownJewelFiles}/${appendix.totals.crownJewelLines}`);
}
