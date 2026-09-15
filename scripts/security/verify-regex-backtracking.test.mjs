import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  analysePattern,
  classCharacters,
  collectPatterns,
  escapeCharacters,
  firstSet,
  normaliseExpression,
  nullable,
  parsePattern,
  reconcileConstructions,
  selectSources,
  setsOverlap,
} from './verify-regex-backtracking.mjs';

const exponential = (source, flags = '') => analysePattern(source, flags).exponential.length;
const kinds = (source) => analysePattern(source).exponential.map((hit) => hit.kind);

/* The shapes were measured before they were encoded in the detector: against a
   hostile non-matching input each of these quadruples in runtime for every two
   characters added, while the safe column below stays flat. The detector has to
   agree with the measurement in both directions - a sweep that reports nothing
   because it recognises nothing is worse than no sweep at all. */

test('the shape of the instance this repository already closed is caught', () => {
  // A key of (.*)*x compiled into a per-key RegExp did not finish against an
  // ordinary 1901-character contract in 120 seconds.
  assert.equal(exponential('(.*)*x'), 1);
  assert.deepEqual(kinds('(.*)*x'), ['nested quantifier']);
});

test('a quantifier nested directly in a quantifier is caught', () => {
  for (const source of ['(a+)+', '(a*)*', '(?:a+)+b', '(\\d+)+$', '([a-z]+)+@']) {
    assert.equal(exponential(source), 1, source);
  }
});

test('a body that reduces to one unbounded part is caught', () => {
  // \s? matching empty leaves \w+ repeated inside a repetition - the textbook case.
  assert.equal(exponential('^(\\w+\\s?)*$'), 1);
  assert.deepEqual(kinds('^(\\w+\\s?)*$'), ['nested quantifier']);
  assert.equal(exponential('(a+b?)+'), 1);
});

test('a body whose parts are all optional and one unbounded is caught', () => {
  assert.equal(exponential('(a*b*)*'), 1);
});

test('a quantified alternation whose branches can start alike is caught', () => {
  for (const source of ['(a|ab)*', '(x|x)*y']) {
    assert.deepEqual(kinds(source), ['quantified overlapping alternation'], source);
  }
});

test('a quantified alternation with an unbounded branch is caught', () => {
  assert.equal(exponential('(a+|b)*'), 1);
});

test('overlap is decided by what the classes match, not by how they are spelled', () => {
  // A dot and a literal overlap; \w and a letter overlap. Comparing the source
  // text of the two branches would see neither.
  assert.equal(exponential('(a|.)*b'), 1);
  assert.equal(exponential('(\\w|a)*b'), 1);
});

test('ordinary patterns are not reported', () => {
  for (const source of [
    '^[a-z]+$',
    '\\d{3}-\\d{4}',
    '(foo|bar)+',
    '^(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)$',
    '[^ -~]',
    'a*b*',
    '^\\/platform-v7(?:\\/|$)',
  ]) {
    assert.equal(exponential(source), 0, source);
  }
});

/* The escaped-string idiom is the case where a coarse detector is worse than
   useless: written carefully it is linear, and the careless form differs by a
   single character inside the class. Measurement: the safe column is flat, the
   unsafe column grows by about 3.4x per two characters added. */

test('the escaped-string idiom is judged by whether the class excludes the escape', () => {
  const pairs = [
    ['(?:[^"\\\\]|\\\\.)*', '(?:[^"]|\\\\.)*'],
    ['(?:\\\\.|[^\\\\)])*', '(?:\\\\.|[^)])*'],
    ['(?:[^`\\\\]|\\\\.)*', '(?:[^`]|\\\\.)*'],
  ];
  for (const [safe, unsafe] of pairs) {
    assert.equal(exponential(safe), 0, `safe: ${safe}`);
    assert.equal(exponential(unsafe), 1, `unsafe: ${unsafe}`);
  }
});

test('a negated class is a complement, not a wildcard', () => {
  assert.equal(exponential('([^a]|b)*'), 1);      // b is outside the complement: overlap
  assert.equal(exponential('([^a]|a)*'), 0);      // a is exactly what the class excludes
  assert.ok(setsOverlap(classCharacters('[^a]'), classCharacters('[b]')));
  assert.ok(!setsOverlap(classCharacters('[^a]'), classCharacters('[a]')));
  assert.ok(setsOverlap(classCharacters('[^a]'), classCharacters('[^b]')));
});

test('a dot excludes the line terminators unless the s flag is set', () => {
  assert.ok(!setsOverlap(firstSet(parsePattern('.')), firstSet(parsePattern('\\n'))));
  assert.ok(setsOverlap(firstSet(parsePattern('.', 's')), firstSet(parsePattern('\\n'))));
  assert.equal(exponential('(.|\\n)*'), 0);
  assert.equal(exponential('(.|\\n)*', 's'), 1);
});

test('class ranges and shorthand escapes expand to the characters they match', () => {
  assert.ok(classCharacters('[a-f]').chars.has('c'));
  assert.ok(!classCharacters('[a-f]').chars.has('g'));
  assert.ok(escapeCharacters('\\d').chars.has('7'));
  assert.ok(escapeCharacters('\\D').negated);
  assert.equal(escapeCharacters('\\1'), null);           // a backreference is not decidable
  assert.equal(escapeCharacters('\\b').chars.size, 0);   // zero width
});

/* A mis-parsed escape is the quiet failure mode: taking only two characters off
   a unicode escape leaves its four hex digits to be read as literals, and a
   brace tail left behind would be read as a quantifier, shifting the parse of
   everything after it. */

test('multi-character escapes are consumed as single atoms', () => {
  assert.deepEqual(parsePattern('\\u0041').items ?? [parsePattern('\\u0041')], [{ type: 'escape', text: '\\u0041' }]);
  for (const source of ['\\u{1F600}', '\\x41', '\\p{L}', '\\cJ', '\\k<name>']) {
    const parsed = parsePattern(source);
    const items = parsed.type === 'sequence' ? parsed.items : [parsed];
    assert.equal(items.length, 1, source);
    assert.equal(items[0].text, source, source);
  }
});

test('an anchor matches the empty string and does not start the match', () => {
  assert.ok(nullable(parsePattern('^').items?.[0] ?? parsePattern('^')));
  assert.equal(firstSet(parsePattern('^a')).chars.has('a'), true);
});

test('a lazy quantifier is still unbounded', () => {
  assert.equal(exponential('(a+?)+'), 1);
  assert.equal(exponential('(.*?)*x'), 1);
});

test('a bounded quantifier is not treated as unbounded', () => {
  assert.equal(exponential('(a+){3}'), 0);
  assert.equal(exponential('(a+){1,}'), 1);   // {1,} is unbounded
});

test('every pattern in the corpus parses, so nothing is skipped silently', () => {
  for (const source of ['(.*)*x', '^(\\w+\\s?)*$', '(?:[^"\\\\]|\\\\.)*', '[]]', '[^]', 'a{2,3}', 'a{x}']) {
    assert.equal(analysePattern(source).parsed, true, source);
  }
});

/* The sweep reads git's index rather than the filesystem, because an untracked
   file is not part of the tree being assessed - and because this repository
   carries a tracked symlink mirror of apps/web under apps/web/apps/web, which
   an unguarded walk would follow instead of opening the real file. */

test('the file selection skips symlinks and test fixtures, and nothing else', () => {
  const listing = [
    '100644 aaaaaaa 0\tapps/web/lib/real.ts',
    '120000 bbbbbbb 0\tapps/web/apps/web/middleware.ts',
    '100644 ccccccc 0\tapps/web/tests/unit/thing.ts',
    '100644 ddddddd 0\tapps/api/src/main.ts',
    '100644 eeeeeee 0\tapps/api/src/thing.spec.ts',
    '100644 fffffff 0\tscripts/security/verify-regex-backtracking.test.mjs',
    '100644 1234567 0\tdocs/security/NOTES.md',
    '100644 89abcde 0\tpackages/shared/index.ts',
    // Ordinary request-path code that an allowlist of scan roots left uncovered.
    '100644 2222222 0\tapps/landing/src/page.tsx',
    '100644 3333333 0\tworkers/runtime-command.ts',
    '100644 4444444 0\tshared/role-contract.ts',
    '100644 5555555 0\tshared/role-contract.test.ts',
  ].join('\n');
  assert.deepEqual(selectSources(listing), [
    'apps/web/lib/real.ts',
    'apps/api/src/main.ts',
    'packages/shared/index.ts',
    'apps/landing/src/page.tsx',
    'workers/runtime-command.ts',
    'shared/role-contract.ts',
  ]);
});

/* A pattern assembled from literals is still written down in the source, and
   reading it is the difference between analysing it and filing it away as
   unknowable. The tree had twenty such sites. */

const { createRequire } = await import('node:module');
const ts = createRequire(import.meta.url)('../../apps/api/node_modules/typescript/lib/typescript.js');
const parse = (source) => ts.createSourceFile('probe.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

test('a pattern assembled from literals and module constants is read, not filed away', () => {
  const found = collectPatterns(parse([
    "const NAME = 'pc-v7-locale';",
    "const a = new RegExp('market' + 'place', 'gi');",
    "const b = new RegExp(`(?:^|;\\\\s*)${NAME}=([^;]+)`);",
    'const c = new RegExp(someValue);',
  ].join('\n')));
  const byOrigin = (origin) => found.filter((p) => p.origin === origin).map((p) => p.source);
  assert.deepEqual(byOrigin('constructed'), ['marketplace', '(?:^|;\\s*)pc-v7-locale=([^;]+)']);
  assert.equal(found.find((p) => p.origin === 'computed').expression, 'someValue');
});

test('flags are carried through so the s flag is not lost', () => {
  const [pattern] = collectPatterns(parse("const a = /a.b/su;"));
  assert.equal(pattern.flags, 'su');
});

/* The sites that cannot be read are held to a recorded judgement instead. The
   instance behind this requirement was exactly that shape - a key from a
   request compiled into a per-key RegExp - so a new one appearing unexplained
   has to stop the sweep. */

const site = (file, expression) => ({ file, expression, line: 1 });
const entry = (file, expression) => ({ file, expression, why: 'a reason long enough to count as one' });

test('a construction site with no recorded reason fails', () => {
  const result = reconcileConstructions([site('a.ts', 'value')], { sites: [] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.unjudged.map((s) => s.file), ['a.ts']);
});

test('a recorded reason that says nothing does not count as one', () => {
  const result = reconcileConstructions(
    [site('a.ts', 'value')],
    { sites: [{ file: 'a.ts', expression: 'value', why: 'safe' }] },
  );
  assert.equal(result.ok, false);
  assert.equal(result.unjudged.length, 1);
});

test('a recorded site that is gone fails, so the file cannot fall behind', () => {
  const result = reconcileConstructions([], { sites: [entry('gone.ts', 'value')] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.stale.map((s) => s.file), ['gone.ts']);
});

test('changing what gets compiled asks for the judgement again', () => {
  const baseline = { sites: [entry('a.ts', 'oldValue')] };
  assert.equal(reconcileConstructions([site('a.ts', 'oldValue')], baseline).ok, true);
  const moved = reconcileConstructions([site('a.ts', 'newValue')], baseline);
  assert.equal(moved.ok, false);
  assert.equal(moved.unjudged.length, 1);   // the new expression is unexplained
  assert.equal(moved.stale.length, 1);      // the old one is gone
});

test('moving code keeps the judgement, because identity is not the line', () => {
  const baseline = { sites: [entry('a.ts', 'value')] };
  assert.equal(reconcileConstructions([{ ...site('a.ts', 'value'), line: 999 }], baseline).ok, true);
});

test('expression identity ignores reformatting', () => {
  assert.equal(normaliseExpression('foo(\n  bar,\n  baz,\n)'), 'foo( bar, baz, )');
});

test('the baseline that ships with the sweep explains every site it records', () => {
  const baseline = JSON.parse(readFileSync(new URL('../../docs/security/regex-construction-baseline.json', import.meta.url), 'utf8'));
  assert.ok(baseline.sites.length > 0);
  for (const recorded of baseline.sites) {
    assert.equal(typeof recorded.file, 'string', JSON.stringify(recorded));
    assert.equal(typeof recorded.expression, 'string', recorded.file);
    assert.ok(recorded.why.trim().length >= 20, `${recorded.file}: ${recorded.why}`);
  }
});
