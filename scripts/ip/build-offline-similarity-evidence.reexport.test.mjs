import { strict as assert } from 'node:assert';
import test from 'node:test';
import { isReExportOnlyModule } from './build-offline-similarity-evidence.mjs';

test('чистый barrel исключается из сравнения', () => {
  assert.equal(isReExportOnlyModule("export * from './types';\nexport * from './store';\n"), true);
  assert.equal(isReExportOnlyModule("export * from './a';\n// комментарий\nexport * from './b';\n"), true);
  assert.equal(isReExportOnlyModule("/* блок */\nexport { A } from './a';\nexport * as ns from './b';\n"), true);
});

test('файл с настоящим кодом НЕ исключается — иначе исключение стало бы дырой', () => {
  assert.equal(isReExportOnlyModule("export * from './a';\nexport const rate = 0.18;\n"), false);
  assert.equal(isReExportOnlyModule("import x from './a';\nexport function f(){ return x + 1; }\n"), false);
  assert.equal(isReExportOnlyModule("export function compute(a, b) { return a - b; }\n"), false);
});

test('пустой файл исключением не считается', () => {
  assert.equal(isReExportOnlyModule(''), false);
  assert.equal(isReExportOnlyModule('   \n\n'), false);
  assert.equal(isReExportOnlyModule('// только комментарий\n'), false);
});

test('оба настоящих файла платформы распознаются, а соседний модуль с логикой — нет', async () => {
  const { readFileSync } = await import('node:fs');
  for (const path of [
    'packages/domain-core/src/execution-simulation/index.ts',
    'packages/integration-sdk/src/index.ts',
  ]) {
    assert.equal(isReExportOnlyModule(readFileSync(path, 'utf8')), true, path);
  }
  const withLogic = readFileSync('packages/integration-sdk/src/registry.ts', 'utf8');
  assert.equal(isReExportOnlyModule(withLogic), false);
});
