/**
 * Детерминированная сборка корпуса сравнения из установленного дерева зависимостей.
 *
 * Корпус — не «весь мир», и заявлять мировую уникальность на нём нельзя. Это
 * конкретное множество: реальный сторонний код, от которого платформа зависит и
 * который физически лежит в дереве установки. Для вопроса «нет ли в защищаемом
 * ядре недекларированных заимствований» это самый релевантный доступный корпус:
 * именно из своих зависимостей код заимствуют чаще всего, потому что он под рукой.
 *
 * Отбор объявлен явно и воспроизводим:
 *   — только node_modules/.pnpm, глубина не более шести сегментов;
 *   — расширения .ts/.tsx/.js/.mjs/.cjs;
 *   — минифицированные файлы (.min.) исключены: они не являются формой выражения,
 *     пригодной для сравнения, и раздувают корпус без пользы;
 *   — файлы крупнее 512 КБ исключены как заведомо сгенерированные бандлы;
 *   — вложенные node_modules второго уровня исключены, чтобы не считать один и
 *     тот же пакет многократно.
 *
 * Копируются настоящие файлы, а не симлинки: инструмент сравнения считает
 * нерегулярные записи блокером, и это правильно — по симлинку нельзя доказать,
 * что именно сравнивалось.
 */
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';

const outDir = process.argv[2] ?? 'artifacts/ip-clean-room/similarity-corpus';
const root = 'node_modules/.pnpm';
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const MAX_BYTES = 512 * 1024;
const MAX_DEPTH = 6;

function walk(directory, depth, files) {
  if (depth > MAX_DEPTH) return;
  let entries = [];
  try { entries = readdirSync(directory, { withFileTypes: true }); } catch { return; }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const absolute = join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) { walk(absolute, depth + 1, files); continue; }
    if (!entry.isFile()) continue;
    if (!EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
    if (entry.name.includes('.min.')) continue;
    if ((absolute.match(/\/node_modules\//gu) ?? []).length > 1) continue;
    let size = 0;
    try { size = statSync(absolute).size; } catch { continue; }
    if (size > MAX_BYTES) continue;
    files.push(absolute);
  }
}

const files = [];
walk(root, 0, files);
files.sort((left, right) => left.localeCompare(right, 'en'));

rmSync(outDir, { recursive: true, force: true });
let copied = 0;
for (const source of files) {
  const relative = source.replace(`${root}/`, '').replaceAll('/node_modules/', '/');
  const destination = join(outDir, relative);
  mkdirSync(dirname(destination), { recursive: true });
  try { copyFileSync(source, destination); copied += 1; } catch { /* пропуск нечитаемого */ }
}

console.log(`SIMILARITY_CORPUS: ${copied} файлов из ${root} → ${outDir}`);
