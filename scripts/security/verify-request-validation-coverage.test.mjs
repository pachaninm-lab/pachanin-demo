import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { stripComments } from './verify-request-validation-coverage.mjs';

const SCRIPT = resolve('scripts/security/verify-request-validation-coverage.mjs');

// The scanner reads tracked files, so the fixture is a real repository. Faking
// the file list instead would test a code path production never takes.
function fixture({ sources, baseline }) {
  const root = mkdtempSync(join(tmpdir(), 'request-validation-'));
  mkdirSync(join(root, 'src'), { recursive: true });
  for (const [name, body] of Object.entries(sources)) {
    writeFileSync(join(root, 'src', name), body);
  }
  writeFileSync(join(root, 'baseline.json'), JSON.stringify(baseline));
  for (const args of [['init', '-q'], ['add', '-A']]) {
    spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  }
  return root;
}

function run(root, extra = []) {
  const result = spawnSync(process.execPath, [SCRIPT, ...extra], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, REQUEST_VALIDATION_ROOT: 'src', REQUEST_VALIDATION_BASELINE: 'baseline.json' },
  });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

function withFixture(options, assertion) {
  const root = fixture(options);
  try {
    assertion(run(root), root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const inline = (n) => Array.from({ length: n }, (_, i) => `  handler${i}(@Body() body: { field: string }) {}`).join('\n');
const dto = (n) => Array.from({ length: n }, (_, i) => `  handler${i}(@Body() body: CreateThing${i}Dto) {}`).join('\n');

const AT_BASELINE = {
  sources: { 'a.controller.ts': inline(2), 'b.controller.ts': `${inline(1)}\n${dto(2)}` },
  baseline: {
    minValidatedBodyParameters: 2,
    unvalidatedBodyParametersByFile: { 'src/a.controller.ts': 2, 'src/b.controller.ts': 1 },
  },
};

test('a tree exactly at the baseline passes', () => {
  withFixture(AT_BASELINE, ({ status, out }) => {
    assert.equal(status, 0);
    assert.match(out, /WITHIN_BASELINE/u);
  });
});

test('one more unvalidated parameter in a file fails', () => {
  withFixture({ ...AT_BASELINE, sources: { ...AT_BASELINE.sources, 'a.controller.ts': inline(3) } }, ({ status, out }) => {
    assert.equal(status, 1);
    assert.match(out, /src\/a\.controller\.ts: 3 unvalidated @Body\(\) parameters, baseline allows 2/u);
  });
});

test('a brand new file with an unvalidated parameter fails, since its baseline is zero', () => {
  withFixture({ ...AT_BASELINE, sources: { ...AT_BASELINE.sources, 'c.controller.ts': inline(1) } }, ({ status, out }) => {
    assert.equal(status, 1);
    assert.match(out, /src\/c\.controller\.ts: 1 unvalidated @Body\(\) parameters, baseline allows 0/u);
  });
});

// This is the case a single global ceiling would wave through: the total is
// unchanged, so only a per-file ceiling can see it.
test('moving an unvalidated parameter into another file fails even though the total is unchanged', () => {
  withFixture({
    ...AT_BASELINE,
    sources: { 'a.controller.ts': inline(3), 'b.controller.ts': `${dto(2)}` },
  }, ({ status, out }) => {
    assert.equal(status, 1);
    assert.match(out, /src\/a\.controller\.ts: 3 unvalidated/u);
  });
});

// And this is the case a ceiling alone would wave through: a DTO is downgraded
// while an unrelated unvalidated parameter is deleted to keep counts level.
test('downgrading a DTO to an inline type fails on the floor', () => {
  withFixture({
    ...AT_BASELINE,
    sources: { 'a.controller.ts': inline(2), 'b.controller.ts': `${inline(1)}\n${dto(1)}` },
  }, ({ status, out }) => {
    assert.equal(status, 1);
    assert.match(out, /DTO-typed @Body\(\) parameters fell from 2 to 1/u);
  });
});

test('a type that erases to Object counts as unvalidated, not as a DTO', () => {
  withFixture({
    sources: { 'a.controller.ts': '  handler(@Body() body: Record<string, unknown>) {}\n  other(@Body() body: any) {}' },
    baseline: { minValidatedBodyParameters: 0, unvalidatedBodyParametersByFile: {} },
  }, ({ status, out }) => {
    assert.equal(status, 1);
    assert.match(out, /src\/a\.controller\.ts: 2 unvalidated/u);
  });
});

test('shrinking the debt passes and asks for the ratchet to be tightened', () => {
  withFixture({ ...AT_BASELINE, sources: { ...AT_BASELINE.sources, 'a.controller.ts': inline(1) } }, ({ status, out }) => {
    assert.equal(status, 0);
    assert.match(out, /file\(s\) now below baseline/u);
  });
});

test('converting an inline parameter to a DTO passes and asks for the floor to be raised', () => {
  withFixture({
    ...AT_BASELINE,
    sources: { 'a.controller.ts': `${inline(1)}\n${dto(1)}`, 'b.controller.ts': `${inline(1)}\n${dto(2)}` },
  }, ({ status, out }) => {
    assert.equal(status, 0);
    assert.match(out, /DTO-typed parameters rose to 3/u);
  });
});

test('a baseline with no floor fails closed rather than skipping the check', () => {
  withFixture({
    ...AT_BASELINE,
    baseline: { unvalidatedBodyParametersByFile: { 'src/a.controller.ts': 2, 'src/b.controller.ts': 1 } },
  }, ({ status, out }) => {
    assert.equal(status, 1);
    assert.match(out, /FAIL_CLOSED - baseline minValidatedBodyParameters is not a non-negative integer/u);
  });
});

test('a baseline with no per-file map fails closed rather than allowing everything', () => {
  withFixture({ ...AT_BASELINE, baseline: { minValidatedBodyParameters: 2 } }, ({ status, out }) => {
    assert.equal(status, 1);
    assert.match(out, /FAIL_CLOSED - baseline unvalidatedBodyParametersByFile is not an object/u);
  });
});

test('a non-integer per-file count fails closed', () => {
  withFixture({
    ...AT_BASELINE,
    baseline: { minValidatedBodyParameters: 2, unvalidatedBodyParametersByFile: { 'src/a.controller.ts': 'many' } },
  }, ({ status, out }) => {
    assert.equal(status, 1);
    assert.match(out, /FAIL_CLOSED - baseline count for src\/a\.controller\.ts is not a non-negative integer/u);
  });
});

test('an unreadable baseline fails closed', () => {
  const root = fixture(AT_BASELINE);
  try {
    const result = spawnSync(process.execPath, [SCRIPT], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, REQUEST_VALIDATION_ROOT: 'src', REQUEST_VALIDATION_BASELINE: 'absent.json' },
    });
    assert.equal(result.status, 1);
    assert.match(`${result.stdout}${result.stderr}`, /FAIL_CLOSED - cannot read baseline/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an untracked file is not scanned, matching what the pipe would see after a checkout', () => {
  const root = fixture(AT_BASELINE);
  try {
    writeFileSync(join(root, 'src', 'untracked.controller.ts'), inline(9));
    const { status } = run(root);
    assert.equal(status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Гейт считает код, а не прозу. Дефект был настоящий: DTO-файл кабинета Гекты
 * объясняет в комментарии, что `@Body() body: { … }` стирается до Object, и
 * гейт засчитал это объяснение как непроверенное тело — то есть файл, который
 * ДОКУМЕНТИРУЕТ дефект, был обвинён в том, что его несёт.
 */
test('a body pattern inside a comment is documentation, not an endpoint', () => {
  withFixture(
    {
      sources: {
        'a.controller.ts': inline(2),
        'b.controller.ts': [
          '/**',
          ' * Инлайн-тип @Body() body: { field: string } стирается до Object.',
          ' */',
          '// @Body() body: { legacy: string } — так было раньше',
          inline(1),
          dto(2),
        ].join('\n'),
      },
      baseline: {
        minValidatedBodyParameters: 2,
        unvalidatedBodyParametersByFile: { 'src/a.controller.ts': 2, 'src/b.controller.ts': 1 },
      },
    },
    ({ status, out }) => {
      assert.equal(status, 0, out);
      assert.match(out, /3 unvalidated @Body\(\) parameters/u);
    },
  );
});

/**
 * Обратная сторона: снятие комментариев не должно прятать настоящий параметр.
 * Строчный комментарий снимается только целой строкой, поэтому `//` внутри
 * строкового литерала не обрезает код, который идёт следом.
 */
test('a // inside a string literal does not hide the code after it', () => {
  withFixture(
    {
      sources: {
        'a.controller.ts': [
          "  readonly docs = 'https://example.invalid/guide';",
          inline(2),
        ].join('\n'),
      },
      baseline: {
        minValidatedBodyParameters: 0,
        unvalidatedBodyParametersByFile: { 'src/a.controller.ts': 2 },
      },
    },
    ({ status, out }) => {
      assert.equal(status, 0, out);
      assert.match(out, /2 unvalidated @Body\(\) parameters/u);
    },
  );
});

/**
 * Разбор комментариев проверяется на самой функции, а не только через фикстуру:
 * дыру, найденную ревью, фикстура бы не показала — там не было ни строкового
 * литерала с `/*`, ни регулярного выражения.
 *
 * Первая версия снимала комментарии регулярным выражением
 * /\/\*[\s\S]*?\*\// и на файле с `const start = "/*";` … `const end = "*\/";`
 * съедала всё между литералами вместе с настоящими обработчиками: счёт
 * непроверенных тел падал с двух до нуля. Это был молчаливый обход гейта.
 *
 * Правило разбора одно: сомневаешься — не снимай. Лишний закомментированный
 * @Body() посчитается как непроверенное тело (ложное срабатывание, гейт
 * закрывается); пропущенный настоящий @Body() был бы обходом.
 */
const HANDLER = 'handler(@Body() body: { field: string }) {}';
const bodiesIn = (source) => [...stripComments(source).matchAll(/@Body\(([^)]*)\)\s*([A-Za-z_$][\w$]*)\s*:\s*/gu)].length;

const SCANNER_CASES = [
  ['a string literal containing /* and */ does not swallow the handlers between them',
    ['const a = "/*";', HANDLER, 'const b = "*/";'], 1],
  ['the same in single quotes',
    ["const a = '/*';", HANDLER, "const b = '*/';"], 1],
  ['the same in a template literal',
    ['const a = `/*`;', HANDLER, 'const b = `*/`;'], 1],
  ['a template with ${ } interpolation',
    ['const a = `x${ 1 + 2 }/*`;', HANDLER, 'const b = `*/`;'], 1],
  ['a regular expression whose character class contains /*',
    ['const r = /[/*]/u;', HANDLER], 1],
  ['a // inside a string literal does not truncate the line',
    [`const docs = "https://example.invalid"; ${HANDLER}`], 1],
  ['a JSDoc block that documents the pattern is not an endpoint',
    ['/**', ' * @Body() body: { x: string } erases to Object.', ' */', HANDLER], 1],
  ['a whole-line // comment that documents the pattern is not an endpoint',
    ['// @Body() body: { legacy: string }', HANDLER], 1],
  ['a handler genuinely commented out is not counted',
    ['/*', HANDLER, '*/'], 0],
  ['an unterminated block comment does not swallow the rest of the file',
    ['const a = 1; /* opened and never closed', HANDLER], 1],
  ['division is not mistaken for a regular expression',
    ['const x = a / b / c;', HANDLER], 1],
  ['an escaped quote inside a string does not end it early',
    ['const a = "he said \\" /*";', HANDLER, 'const b = "*/";'], 1],
];

for (const [name, lines, expected] of SCANNER_CASES) {
  test(`comment stripping: ${name}`, () => {
    assert.equal(bodiesIn(lines.join('\n')), expected);
  });
}
