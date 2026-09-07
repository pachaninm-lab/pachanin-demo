import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { CATEGORIES, inventory, trackedFiles } from './build-dangerous-functionality-inventory.mjs';

const JSON_PATH = 'docs/security/dangerous-functionality.json';
const MD_PATH = 'docs/security/DANGEROUS_FUNCTIONALITY.md';

const committed = () => JSON.parse(readFileSync(JSON_PATH, 'utf8'));

test('committed inventory is not stale', () => {
  // Тот же приём, что у крипто-описи: документ, тихо переставший описывать
  // дерево, хуже отсутствующего — его читают как актуальный.
  const files = trackedFiles();
  const fresh = inventory(files);
  const stored = committed();
  assert.equal(stored.scannedFiles, files.length, 'run node scripts/security/build-dangerous-functionality-inventory.mjs');
  for (const [index, category] of fresh.entries()) {
    assert.deepEqual(
      stored.categories[index].files,
      category.files,
      `${category.id} drifted; regenerate the inventory`,
    );
  }
});

test('the process-execution pattern does not match RegExp.prototype.exec', () => {
  // Первая версия шаблона содержала `\bexec\(` и дала 22 ложные находки на
  // строках вида /re/.exec(s). Документ утверждал бы 22 места запуска
  // процессов там, где их одно.
  const category = CATEGORIES.find((c) => c.id === 'process_execution');
  assert.equal(category.pattern.test("const m = /ERROR:\\s*(.+)/u.exec(message);"), false);
  assert.equal(category.pattern.test("import { execFile } from 'node:child_process';"), true);
});

test('the scan reaches files directly inside a root, not only its subdirectories', () => {
  // git ls-files 'apps/web/lib/**/*.ts' пропускает файлы, лежащие прямо в
  // каталоге: 32 файла с исходящими вызовами выпадали, и опись занижала
  // охват, выглядя полной.
  const files = trackedFiles();
  assert.ok(
    files.some((file) => /^apps\/web\/lib\/[^/]+\.ts$/u.test(file)),
    'a file directly under apps/web/lib must be in scope',
  );
});

test('the outbound-network category agrees with an independent scan', () => {
  const independent = execFileSync(
    'bash',
    ['-c', "grep -rl 'await fetch(' --include=*.ts apps/api/src apps/web/lib apps/web/app packages 2>/dev/null | grep -vE '\\.(spec|test)\\.' | sort"],
    { encoding: 'utf8' },
  ).split('\n').filter(Boolean);
  const stored = committed().categories.find((c) => c.id === 'outbound_network');
  assert.deepEqual([...stored.files].sort(), independent);
});

test('a category with no findings is recorded as a measured zero, not omitted', () => {
  const stored = committed();
  assert.equal(stored.categories.length, CATEGORIES.length);
  const evaluation = stored.categories.find((c) => c.id === 'dynamic_code_evaluation');
  assert.equal(evaluation.fileCount, 0);
  assert.deepEqual(evaluation.files, []);
});

test('every category carries why it is dangerous and where the check stops', () => {
  for (const category of committed().categories) {
    assert.ok(category.why && category.why.length > 40, `${category.id} needs a reason`);
    assert.ok(category.limit && category.limit.length > 30, `${category.id} needs a stated limit`);
  }
});

test('the rendered document names its limits and defers key handling elsewhere', () => {
  const markdown = readFileSync(MD_PATH, 'utf8');
  assert.match(markdown, /CRYPTOGRAPHIC_INVENTORY\.md/u);
  assert.match(markdown, /не означает дефекта/u);
  assert.match(markdown, /измеренный ноль/u);
});
