#!/usr/bin/env node
/**
 * Inventory of where the application uses dangerous functionality.
 *
 * ASVS 5.0 V15.1.5 asks that documentation name where dangerous functionality
 * is used. This is generated from the tree rather than written by hand, for the
 * same reason the cryptographic inventory is: a hand-written list of file paths
 * is accurate on the day it is written and wrong by the end of the month, and a
 * document that has quietly stopped describing the code is worse than none —
 * it is read as current.
 *
 * Each category carries its own limits, printed with the result. A static scan
 * cannot tell whether a JSON.parse is fed by a request body or by a constant,
 * and saying so is part of the inventory. A category whose count is zero is
 * recorded as a measured zero, not omitted: "no dynamic code evaluation was
 * found" and "nobody looked" are different statements, and a list that only
 * shows non-empty categories cannot tell them apart.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const OUT_JSON = process.argv[2] ?? 'docs/security/dangerous-functionality.json';
const OUT_MD = process.argv[3] ?? 'docs/security/DANGEROUS_FUNCTIONALITY.md';

/**
 * Каталоги, а не глобы с `**`.
 *
 * `git ls-files 'apps/web/lib/**\/*.ts'` не берёт файлы, лежащие прямо в
 * каталоге, — 32 файла с исходящими вызовами выпадали из описи, и она
 * занижала охват, выглядя при этом полной. Расширение фильтруется в коде,
 * где поведение однозначно.
 */
const ROOTS = ['apps/api/src', 'apps/web/lib', 'apps/web/app', 'packages'];
const SCANNED_EXTENSION = /\.ts$/u;

/**
 * Категории. `limit` печатается рядом с находками, потому что охват проверки —
 * такая же часть доказательства, как её результат.
 */
const CATEGORIES = [
  {
    id: 'raw_sql_execution',
    title: 'Прямое выполнение SQL',
    pattern: /\$queryRaw|\$executeRaw/u,
    why: 'Запрос, собранный строкой, обходит параметризацию ORM. Здесь используются теговые шаблоны Prisma, но охват — место, где такая ошибка вообще возможна.',
    limit: 'Считаются файлы с вызовом, а не сами вызовы; безопасность конкретного запроса отсюда не следует.',
  },
  {
    id: 'outbound_network',
    title: 'Исходящие сетевые вызовы',
    pattern: /\bawait fetch\(/u,
    why: 'Исходящий запрос уносит учётные данные и может быть уведён редиректом; см. V15.3.2.',
    limit: 'Только прямые вызовы fetch. Вызовы через клиентские библиотеки сюда не попадают.',
  },
  {
    id: 'deserialization_of_external_input',
    title: 'Разбор JSON',
    pattern: /JSON\.parse\(/u,
    why: 'Разбор недоверенного ввода — вход для подделанных структур и для ключей прототипа.',
    limit: 'СТАТИЧЕСКИЙ СКАН НЕ РАЗЛИЧАЕТ источник: сюда попадает и разбор тела запроса, и разбор собственной константы. Число завышено намеренно, потому что занизить его значило бы утверждать больше, чем измерено.',
  },
  {
    id: 'filesystem_access',
    title: 'Обращение к файловой системе',
    pattern: /readFileSync\(|writeFileSync\(|createReadStream\(|createWriteStream\(/u,
    why: 'Путь, собранный из данных, выводит чтение за пределы предполагаемого каталога.',
    limit: 'Источник пути не определяется сканом.',
  },
  {
    id: 'object_storage_presigned',
    title: 'Предподписанные ссылки объектного хранилища',
    pattern: /getPresigned|presignedUrl|presigned_url/u,
    why: 'Выданная ссылка живёт до истечения срока и работает мимо приложения: ни одна проверка запроса на неё уже не влияет.',
    limit: 'Срок жизни ссылки и её содержимое отсюда не видны.',
  },
  {
    id: 'process_execution',
    title: 'Запуск процессов',
    // `\bexec\(` здесь стоял в первой версии и дал 22 ложные находки:
    // он ловит RegExp.prototype.exec. Документ утверждал бы 22 места запуска
    // процессов там, где их ноль. Шаблон привязан к импорту child_process —
    // без него запустить процесс в Node нельзя.
    pattern: /from ['"]node:child_process['"]|from ['"]child_process['"]|execSync\(|execFileSync\(|spawnSync\(/u,
    why: 'Аргумент, собранный из данных, превращается в исполняемую команду.',
    limit: 'Привязано к импорту child_process. Скрипты сборки и инструменты вне перечисленных корней не сканируются.',
  },
  {
    id: 'dynamic_code_evaluation',
    title: 'Динамическое выполнение кода',
    pattern: /\beval\(|new Function\(|vm\.runIn/u,
    why: 'Выполнение строки как кода снимает все остальные границы разом.',
    limit: 'Ноль здесь — измеренный ноль, а не пропущенная проверка.',
  },
];

function trackedFiles() {
  return execFileSync('git', ['ls-files', ...ROOTS], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((file) => SCANNED_EXTENSION.test(file))
    .filter((file) => !/\.(?:spec|test)\.[a-z]+$/u.test(file));
}

export function inventory(files, read = (f) => readFileSync(f, 'utf8')) {
  const result = CATEGORIES.map((category) => ({ ...category, pattern: category.pattern.source, files: [] }));
  for (const file of files) {
    let text;
    try {
      text = read(file);
    } catch {
      continue;
    }
    CATEGORIES.forEach((category, index) => {
      if (category.pattern.test(text)) result[index].files.push(file);
    });
  }
  return result;
}

function markdown(report) {
  const lines = [
    '# Где применяется опасная функциональность',
    '',
    'Требование OWASP ASVS 5.0 **V15.1.5**.',
    '',
    'Файл собирается из дерева, а не пишется руками:',
    '`node scripts/security/build-dangerous-functionality-inventory.mjs`.',
    'Правка вручную бессмысленна — следующий прогон её сотрёт, а тест на устаревание',
    'уронит сборку.',
    '',
    `Source SHA: \`${report.sourceSha}\``,
    `Файлов просмотрено: ${report.scannedFiles}`,
    '',
    '## Сводка',
    '',
    '| категория | файлов |',
    '| --- | ---: |',
  ];
  for (const category of report.categories) {
    lines.push(`| ${category.title} | ${category.files.length} |`);
  }
  lines.push('', '## Категории', '');
  for (const category of report.categories) {
    lines.push(`### ${category.title}`, '');
    lines.push(`**Почему опасно.** ${category.why}`, '');
    lines.push(`**Граница проверки.** ${category.limit}`, '');
    lines.push(`**Найдено файлов: ${category.files.length}.**`, '');
    if (category.files.length === 0) {
      lines.push('Ни одного. Это измеренный ноль: категория проверялась и находок нет.', '');
    } else {
      for (const file of category.files) lines.push(`- \`${file}\``);
      lines.push('');
    }
  }
  lines.push(
    '## Чего здесь нет',
    '',
    '- Обращение с ключами шифрования ведётся отдельной описью:',
    '  `docs/security/CRYPTOGRAPHIC_INVENTORY.md`. Дублировать её здесь значило бы',
    '  завести второй источник правды, который разойдётся с первым.',
    '- Наличие файла в списке не означает дефекта. Список отвечает на вопрос «где',
    '  это применяется», а не «где это применено неправильно».',
    '- Скан читает исходники перечисленных корней. Код вне их, сгенерированный код',
    '  и зависимости в охват не входят.',
    '',
  );
  return lines.join('\n');
}

function main() {
  const files = trackedFiles();
  const categories = inventory(files);
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const report = {
    schemaVersion: 'pc-crop.dangerous-functionality.v1',
    sourceSha,
    scannedFiles: files.length,
    categories: categories.map(({ id, title, pattern, why, limit, files: found }) => ({
      id,
      title,
      pattern,
      why,
      limit,
      fileCount: found.length,
      files: found,
    })),
  };

  for (const out of [OUT_JSON, OUT_MD]) mkdirSync(dirname(out), { recursive: true });
  writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(OUT_MD, markdown(report));

  const total = report.categories.reduce((sum, c) => sum + c.fileCount, 0);
  console.log(
    `Dangerous functionality inventory: ${files.length} files scanned; `
    + `${report.categories.length} categories; ${total} category hits.`,
  );
}

export { CATEGORIES, markdown, trackedFiles };

if (import.meta.url === `file://${process.argv[1]}`) main();
