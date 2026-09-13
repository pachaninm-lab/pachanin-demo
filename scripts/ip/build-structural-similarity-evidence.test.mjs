import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { jaccard, typescriptShape, winnowShape } from './build-structural-similarity-evidence.mjs';

const ORIGINAL = `
export class DealPricing {
  private readonly floor: number;
  constructor(floor: number) { this.floor = floor; }
  apply(amount: number): number {
    if (amount < this.floor) { return this.floor; }
    for (let step = 0; step < 3; step += 1) { amount = amount - 1; }
    return amount;
  }
}
`;
/** The same file after one editor command. Nothing but names has changed. */
const RENAMED = `
export class q_DealPricing {
  private readonly q_floor: number;
  constructor(q_floor: number) { this.q_floor = q_floor; }
  q_apply(q_amount: number): number {
    if (q_amount < this.q_floor) { return this.q_floor; }
    for (let q_step = 0; q_step < 3; q_step += 1) { q_amount = q_amount - 1; }
    return q_amount;
  }
}
`;
/** Same names, different code. */
const DIFFERENT = `
export class DealPricing {
  private readonly floor: number;
  constructor(floor: number) { this.floor = floor; }
  apply(amount: number): number {
    return Math.max(amount, this.floor);
  }
}
`;

/**
 * The reason this tool exists.
 *
 * The token screening publishes a measured blind spot: a verbatim 1838-line copy
 * with every identifier renamed is not detected by any of its three methods,
 * because normalisation replaces strings, numbers and whitespace but not names.
 * If shape did not survive renaming, this tool would close nothing.
 */
test('renaming every identifier does not change the shape', () => {
  const original = typescriptShape(ORIGINAL, 'a.ts');
  const renamed = typescriptShape(RENAMED, 'b.ts');
  assert.equal(original.parseErrors, 0);
  assert.equal(renamed.parseErrors, 0);
  assert.deepEqual(renamed.shape, original.shape);
});

test('changing the code does change the shape, so the comparison is not vacuous', () => {
  const original = typescriptShape(ORIGINAL, 'a.ts');
  const different = typescriptShape(DIFFERENT, 'c.ts');
  assert.notDeepEqual(different.shape, original.shape);
});

test('literal values are invisible to the shape, and literal kinds are not', () => {
  const one = typescriptShape('const a = 1; const b = "x";', 'a.ts').shape;
  const two = typescriptShape('const c = 9999; const d = "yyyy";', 'b.ts').shape;
  const three = typescriptShape('const c = "9999"; const d = "yyyy";', 'c.ts').shape;
  assert.deepEqual(two, one, 'the value of a literal is not part of the shape');
  assert.notDeepEqual(three, one, 'a number replaced by a string is a change of shape');
});

/**
 * A file the parser could not read must never reach the comparison. A garbage
 * shape compares as a shape, and the run would report a result for a file it
 * never understood.
 */
test('an unparseable file is reported as unparseable rather than shaped', () => {
  const broken = typescriptShape('class { function ( ] => >>>', 'broken.ts');
  assert.ok(broken.parseErrors > 0, 'parse errors must be visible to the caller');
});

test('a shape shorter than one gram produces no fingerprints', () => {
  assert.deepEqual(winnowShape([1, 2, 3], 30, 12), []);
  assert.ok(winnowShape(Array.from({ length: 400 }, (_, index) => index % 37), 30, 12).length > 0);
});

test('winnowing is stable: the same shape yields the same fingerprints', () => {
  const shape = Array.from({ length: 600 }, (_, index) => (index * 7) % 41);
  assert.deepEqual(winnowShape(shape), winnowShape([...shape]));
});

test('Jaccard is 1 for identical sets, 0 for disjoint, and 0 when either side is empty', () => {
  assert.equal(jaccard([1, 2, 3], [1, 2, 3]), 1);
  assert.equal(jaccard([1, 2, 3], [4, 5, 6]), 0);
  assert.equal(jaccard([], [1]), 0);
  assert.equal(jaccard([1, 2], [2, 3]), 1 / 3);
});

/**
 * TypeScript node kinds are small integers and Python node types are mapped to
 * ids of our own. Without an offset the two vocabularies would overlap and a
 * Python file could share a gram with a TypeScript file for no reason at all.
 */
test('Python shape ids cannot collide with TypeScript node kinds', async () => {
  const source = await import('node:fs').then((fs) => fs.readFileSync(fileURLToPath(new URL('./build-structural-similarity-evidence.mjs', import.meta.url)), 'utf8'));
  const offset = Number(/const PYTHON_KIND_OFFSET = ([\d_]+);/u.exec(source)?.[1]?.replaceAll('_', ''));
  assert.ok(Number.isFinite(offset));
  const highestTypeScriptKind = typescriptShape(ORIGINAL, 'a.ts').shape.reduce((left, right) => Math.max(left, right), 0);
  assert.ok(offset > highestTypeScriptKind * 10, 'the offset must clear the whole SyntaxKind enum, not just the kinds this file uses');
});

test('the Python shape emitter reports a file it cannot parse instead of dropping it', () => {
  const helper = fileURLToPath(new URL('./structural-python-shape.py', import.meta.url));
  const result = spawnSync('python3', [helper], { input: '/definitely/not/here.py\n', encoding: 'utf8' });
  assert.equal(result.status, 0, 'one bad path must not kill the run');
  const record = JSON.parse(result.stdout.trim());
  assert.equal(record.path, '/definitely/not/here.py');
  assert.equal(record.error, 'FileNotFoundError');
});

/**
 * The scope switch is refused rather than silently defaulted.
 *
 * A typo in IP_STRUCTURAL_SCOPE that fell back to 'core' would produce a clean
 * run over the boundary and a record claiming the whole repository - the
 * coverage overstatement this programme already made once, in a new costume.
 */
test('an unrecognised scope is refused, not silently narrowed', async () => {
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath: toPath } = await import('node:url');
  const script = toPath(new URL('./build-structural-similarity-evidence.mjs', import.meta.url));
  assert.throws(
    () => execFileSync('node', [script], { env: { ...process.env, IP_STRUCTURAL_SCOPE: 'everything' }, stdio: 'pipe' }),
    (error) => String(error.stderr).includes("IP_STRUCTURAL_SCOPE must be 'core' or 'all-tracked'"),
  );
});

test('the two valid scopes are accepted', async () => {
  const source = await import('node:fs').then((fs) => fs.readFileSync(fileURLToPath(new URL('./build-structural-similarity-evidence.mjs', import.meta.url)), 'utf8'));
  assert.match(source, /\['core', 'all-tracked'\]\.includes\(scope\)/u);
  assert.match(source, /scope === 'all-tracked' \? \[\] : protectedRoots/u,
    'all-tracked must widen the pathspec to everything, not merely rename the core run');
});
