import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  OBLIGATION_TOKENS,
  collectManifests,
  evaluate,
  isDisjunction,
  normalizeKey,
  obligationsIn,
  purlFor,
} from './verify-shipped-licenses.mjs';

test('обязательство узнаётся во всех перечисленных семействах', () => {
  for (const token of OBLIGATION_TOKENS) {
    assert.deepEqual(obligationsIn(token), [token], `не распознан: ${token}`);
  }
});

test('LGPL распознаётся именно как обязательство, а не проходит мимо', () => {
  // Ровно то, что ехало в образ: 18 МБ нативной библиотеки на LGPL-3.0.
  const found = obligationsIn('LGPL-3.0-or-later');
  assert.ok(found.includes('LGPL'), 'LGPL-3.0-or-later обязан быть обязательством');
});

test('пермиссивные лицензии не поднимают ложную тревогу', () => {
  for (const license of ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', '0BSD', 'Unlicense', 'BlueOak-1.0.0']) {
    assert.deepEqual(obligationsIn(license), [], `ложное срабатывание на ${license}`);
  }
});

test('токен ищется по границам слова, а не подстрокой', () => {
  // Выдуманное имя, содержащее GPL как часть слова, обязательством не является.
  assert.deepEqual(obligationsIn('NOTGPLISH-1.0'), []);
  assert.deepEqual(obligationsIn('MITGPLX'), []);
  // А настоящее выражение с разделителями — является.
  assert.ok(obligationsIn('(MIT OR GPL-3.0-or-later)').includes('GPL'));
});

test('пустая и отсутствующая лицензия обязательством не считается', () => {
  assert.deepEqual(obligationsIn(''), []);
  assert.deepEqual(obligationsIn(undefined), []);
  assert.deepEqual(obligationsIn(null), []);
});

test('дизъюнкция распознаётся только по отдельному OR', () => {
  assert.equal(isDisjunction('(MIT OR GPL-3.0-or-later)'), true);
  assert.equal(isDisjunction('MIT'), false);
  // «OR» внутри слова не делает выражение выбором.
  assert.equal(isDisjunction('CORAL-1.0'), false);
});

test('«-or-later» не является выбором ветки', () => {
  // Регрессия: первая версия сторожа использовала \bOR\b, и дефис в
  // GPL-3.0-or-later работал границей слова. Одиночная копилефтная лицензия
  // считалась дизъюнкцией, и запись о выборе пропускала бы её насквозь.
  assert.equal(isDisjunction('GPL-3.0-or-later'), false);
  assert.equal(isDisjunction('LGPL-3.0-or-later'), false);
  assert.equal(isDisjunction('AGPL-3.0-or-later'), false);
});

test('одиночная -or-later лицензия не проходит по записанному выбору', () => {
  const elections = new Map([[purlFor('@img/sharp-libvips-linux-x64', '1.3.2'), 'MIT']]);
  const { violations } = evaluate(
    [{ name: '@img/sharp-libvips-linux-x64', version: '1.3.2', license: 'LGPL-3.0-or-later' }],
    { allowlist: new Map(), elections },
  );
  assert.equal(violations.length, 1, 'выбор нельзя объявить там, где его не предлагали');
});

test('нарушение без основания отвергается', () => {
  const { violations, accepted } = evaluate(
    [{ name: '@img/sharp-libvips-linux-x64', version: '1.3.2', license: 'LGPL-3.0-or-later' }],
    { allowlist: new Map(), elections: new Map() },
  );
  assert.equal(violations.length, 1);
  assert.equal(accepted.length, 0);
  assert.equal(violations[0].name, '@img/sharp-libvips-linux-x64');
});

test('запись в allowlist принимает обязательство и требует причину', () => {
  const allowlist = new Map([['@vercel/og@0.7.2', { package: '@vercel/og@0.7.2', reason: 'используется без изменений' }]]);
  const { violations, accepted } = evaluate(
    [{ name: '@vercel/og', version: '0.7.2', license: 'MPL-2.0' }],
    { allowlist, elections: new Map() },
  );
  assert.equal(violations.length, 0);
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].basis, 'ALLOWLIST');
});

test('allowlist привязан к версии: другая версия снова отвергается', () => {
  const allowlist = new Map([['@vercel/og@0.7.2', { package: '@vercel/og@0.7.2', reason: 'r' }]]);
  const { violations } = evaluate(
    [{ name: '@vercel/og', version: '0.9.0', license: 'MPL-2.0' }],
    { allowlist, elections: new Map() },
  );
  assert.equal(violations.length, 1, 'обновление версии обязано вернуть решение на пересмотр');
});

test('записанный выбор пермиссивной ветки принимается', () => {
  const elections = new Map([[purlFor('jszip', '3.10.1'), 'MIT']]);
  const { violations, accepted } = evaluate(
    [{ name: 'jszip', version: '3.10.1', license: '(MIT OR GPL-3.0-or-later)' }],
    { allowlist: new Map(), elections },
  );
  assert.equal(violations.length, 0);
  assert.equal(accepted[0].basis, 'ELECTION');
});

test('право выбора без записанного выбора доказательством не является', () => {
  const { violations } = evaluate(
    [{ name: 'jszip', version: '3.10.1', license: '(MIT OR GPL-3.0-or-later)' }],
    { allowlist: new Map(), elections: new Map() },
  );
  assert.equal(violations.length, 1, 'незафиксированный выбор обязан оставаться отказом');
});

test('выбор копилефтной ветки не спасает', () => {
  const elections = new Map([[purlFor('jszip', '3.10.1'), 'GPL-3.0-or-later']]);
  const { violations } = evaluate(
    [{ name: 'jszip', version: '3.10.1', license: '(MIT OR GPL-3.0-or-later)' }],
    { allowlist: new Map(), elections },
  );
  assert.equal(violations.length, 1);
});

test('выбор не применяется к конъюнкции', () => {
  // «MIT AND GPL» обязывает соблюдать обе, выбора здесь нет.
  const elections = new Map([[purlFor('both', '1.0.0'), 'MIT']]);
  const { violations } = evaluate(
    [{ name: 'both', version: '1.0.0', license: 'MIT AND GPL-3.0-or-later' }],
    { allowlist: new Map(), elections },
  );
  assert.equal(violations.length, 1, 'конъюнкция не даёт права выбрать ветку');
});

test('один и тот же пакет из разных путей считается один раз', () => {
  const { violations, inspected } = evaluate(
    [
      { name: 'dup', version: '1.0.0', license: 'GPL-3.0-only' },
      { name: 'dup', version: '1.0.0', license: 'GPL-3.0-only' },
    ],
    { allowlist: new Map(), elections: new Map() },
  );
  assert.equal(inspected, 1);
  assert.equal(violations.length, 1);
});

test('обход находит пакеты в виртуальном store и не уходит в цикл по симлинкам', () => {
  const root = mkdtempSync(join(tmpdir(), 'shipped-lic-'));
  try {
    const pkgDir = join(root, 'node_modules', '.pnpm', 'x@1.0.0', 'node_modules', 'x');
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0', license: 'MIT' }));

    // Симлинк обратно на корень: наивный обход зациклился бы здесь.
    const linked = join(root, 'node_modules', 'x');
    try {
      symlinkSync(pkgDir, linked, 'dir');
    } catch {
      /* окружение без символьных ссылок — остальная часть проверки всё равно значима */
    }

    const found = collectManifests(join(root, 'node_modules'));
    assert.ok(found.length >= 1, 'пакет в виртуальном store обязан быть найден');
    assert.ok(found.every((path) => path.endsWith('package.json')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ключ пакета — имя вместе с версией', () => {
  assert.equal(normalizeKey('@img/sharp', '1.2.3'), '@img/sharp@1.2.3');
});

test('обход не выходит наружу дерева поставки по симлинку', () => {
  // Регрессия на настоящем дереве: .pnpm/node_modules/@pc/web — ссылка ОБРАТНО
  // в рабочую копию apps/web с dev-зависимостями. Первая версия обхода уходила
  // туда и объявляла нарушением axe-core, которого в поставке нет.
  const base = mkdtempSync(join(tmpdir(), 'shipped-lic-escape-'));
  try {
    const outside = join(base, 'workspace', 'node_modules', 'devonly');
    mkdirSync(outside, { recursive: true });
    writeFileSync(
      join(outside, 'package.json'),
      JSON.stringify({ name: 'devonly', version: '1.0.0', license: 'GPL-3.0-only' }),
    );

    const tree = join(base, 'deployed');
    const shipped = join(tree, 'node_modules', '.pnpm', 'ok@1.0.0', 'node_modules', 'ok');
    mkdirSync(shipped, { recursive: true });
    writeFileSync(join(shipped, 'package.json'), JSON.stringify({ name: 'ok', version: '1.0.0', license: 'MIT' }));

    let linked = false;
    try {
      symlinkSync(join(base, 'workspace'), join(tree, 'node_modules', 'escape'), 'dir');
      linked = true;
    } catch {
      /* окружение без симлинков — проверку побега здесь не снять */
    }

    const names = collectManifests(join(tree, 'node_modules'))
      .map((path) => JSON.parse(readFileSync(path, 'utf8')).name);
    assert.ok(names.includes('ok'), 'пакет внутри поставки обязан быть найден');
    if (linked) {
      assert.ok(!names.includes('devonly'), 'то, что лежит вне дерева поставки, пользователю не уезжает');
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('обход завершается на циклической ссылке внутри дерева', () => {
  const root = mkdtempSync(join(tmpdir(), 'shipped-lic-cycle-'));
  try {
    const inner = join(root, 'node_modules', 'pkg');
    mkdirSync(inner, { recursive: true });
    writeFileSync(join(inner, 'package.json'), JSON.stringify({ name: 'pkg', version: '1.0.0', license: 'MIT' }));

    let linked = false;
    try {
      // Ссылка на собственного предка: наивный обход наматывал бы путь без конца.
      symlinkSync(join(root, 'node_modules'), join(inner, 'loop'), 'dir');
      linked = true;
    } catch {
      /* окружение без симлинков */
    }

    // Низкий предел: если цикл не разорван множеством посещённых путей,
    // обход упрётся в счётчик, а не завершится сам.
    const found = collectManifests(join(root, 'node_modules'), 50);
    assert.ok(found.length >= 1);
    if (linked) {
      assert.ok(found.length <= 4, `цикл не разорван, найдено ${found.length} манифестов`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
