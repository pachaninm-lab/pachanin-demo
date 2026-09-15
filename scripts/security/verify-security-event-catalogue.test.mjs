import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import {
  CATALOGUE, DOCUMENT, declaredEvents, documentedEvents, documentedControls, emittersFor,
} from './verify-security-event-catalogue.mjs';

const SCRIPT = resolve('scripts/security/verify-security-event-catalogue.mjs');

/* ---------------- reading each side ---------------- */

test('the declared events are read from the frozen object', () => {
  const source = [
    'export const SECURITY_EVENTS = Object.freeze({',
    "  A_THING: 'security.a.thing',",
    "  ANOTHER: 'security.b.other',",
    '});',
  ].join('\n');
  assert.deepEqual(declaredEvents(source), [
    { key: 'A_THING', value: 'security.a.thing' },
    { key: 'ANOTHER', value: 'security.b.other' },
  ]);
});

test('an object that stopped being frozen is reported, not silently read as empty', () => {
  // Returning [] here would make every check vacuously pass.
  assert.equal(declaredEvents('export const SECURITY_EVENTS = { A: \'x\' };'), null);
});

test('documented events and their controls are read from the headings', () => {
  const markdown = [
    '### `security.a.thing`', '', '- **Control**: `ThingGuard`', '',
    '### `security.b.other`', '', '- **Control**: `OtherGuard`', '',
  ].join('\n');
  assert.deepEqual(documentedEvents(markdown), ['security.a.thing', 'security.b.other']);
  assert.equal(documentedControls(markdown).get('security.a.thing'), 'ThingGuard');
});

test('an emitter is found only where the event is actually passed', () => {
  const sources = [
    ['a.ts', 'recordSecurityEvent(this.logger, SECURITY_EVENTS.A_THING, { control: "x" });'],
    ['b.ts', '// SECURITY_EVENTS.A_THING is mentioned here but nothing emits it'],
  ];
  const found = emittersFor(sources, ['A_THING']);
  assert.deepEqual(found.get('A_THING'), ['a.ts']);
});

/* ---------------- the gate as it runs ---------------- */

const CODE = (events) => [
  'export const SECURITY_EVENTS = Object.freeze({',
  ...events.map(([key, value]) => `  ${key}: '${value}',`),
  '});',
].join('\n');

const DOC = (sections) => sections
  .map(([name, control]) => `### \`${name}\`\n\n- **Control**: \`${control}\`\n`)
  .join('\n');

function withFixture({ code, doc, emitters = {} }, assertion) {
  const root = mkdtempSync(join(tmpdir(), 'security-events-'));
  try {
    const write = (rel, body) => {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), body);
    };
    write(CATALOGUE, code);
    write(DOCUMENT, doc);
    for (const [rel, body] of Object.entries(emitters)) write(`apps/api/src/${rel}`, body);
    for (const args of [['init', '-q'], ['add', '-A']]) spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    const r = spawnSync(process.execPath, [SCRIPT], { cwd: root, encoding: 'utf8' });
    assertion({ status: r.status, out: `${r.stdout}${r.stderr}` });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const emitter = (key) => `export class ThingGuard {}\nrecordSecurityEvent(l, SECURITY_EVENTS.${key}, { control: 'ThingGuard' });\n`;

test('a documented, declared and emitted event passes', () => {
  withFixture({
    code: CODE([['A_THING', 'security.a.thing']]),
    doc: DOC([['security.a.thing', 'ThingGuard']]),
    emitters: { 'guards/thing.guard.ts': emitter('A_THING') },
  }, (r) => assert.equal(r.status, 0, r.out));
});

test('an event declared in code but missing from the document fails', () => {
  withFixture({
    code: CODE([['A_THING', 'security.a.thing'], ['B', 'security.b.other']]),
    doc: DOC([['security.a.thing', 'ThingGuard']]),
    emitters: { 'guards/thing.guard.ts': `${emitter('A_THING')}${emitter('B')}` },
  }, (r) => {
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /declared but not documented: security\.b\.other/u);
  });
});

test('an event the document describes but the code no longer has fails', () => {
  // Worse than never documenting it: a reader believes the control exists.
  withFixture({
    code: CODE([['A_THING', 'security.a.thing']]),
    doc: DOC([['security.a.thing', 'ThingGuard'], ['security.gone.away', 'ThingGuard']]),
    emitters: { 'guards/thing.guard.ts': emitter('A_THING') },
  }, (r) => {
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /documented but not declared: security\.gone\.away/u);
  });
});

test('an event that is documented and declared but emitted nowhere fails', () => {
  withFixture({
    code: CODE([['A_THING', 'security.a.thing']]),
    doc: DOC([['security.a.thing', 'ThingGuard']]),
    emitters: { 'guards/thing.guard.ts': 'export class ThingGuard {}\n' },
  }, (r) => {
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /emitted nowhere/u);
  });
});

test('an emitter that exists only in a test does not count', () => {
  withFixture({
    code: CODE([['A_THING', 'security.a.thing']]),
    doc: DOC([['security.a.thing', 'ThingGuard']]),
    emitters: { 'guards/thing.guard.ts': 'export class ThingGuard {}\n', 'guards/thing.guard.spec.ts': emitter('A_THING') },
  }, (r) => {
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /emitted nowhere/u);
  });
});

test('a catalogue entry naming a control that does not exist fails', () => {
  withFixture({
    code: CODE([['A_THING', 'security.a.thing']]),
    doc: DOC([['security.a.thing', 'NoSuchGuard']]),
    emitters: { 'guards/thing.guard.ts': emitter('A_THING') },
  }, (r) => {
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /names a control that does not exist/u);
  });
});

test('a catalogue that stopped being a frozen literal fails the gate itself', () => {
  // Without this the null guard in main() is unreachable from any fixture, so
  // deleting it changed nothing and every test still passed. An unfrozen
  // catalogue must fail loudly: read as empty, it makes every other check
  // vacuously true and the gate reports success while checking nothing.
  withFixture({
    code: "export const SECURITY_EVENTS = { A_THING: 'security.a.thing' };",
    doc: DOC([['security.a.thing', 'ThingGuard']]),
    emitters: { 'guards/thing.guard.ts': emitter('A_THING') },
  }, (r) => {
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /not a frozen object literal/u);
  });
});

test('a key that is a prefix of another key does not match it', () => {
  const sources = [['a.ts', 'recordSecurityEvent(l, SECURITY_EVENTS.A_THING_EXTENDED, {});']];
  const found = emittersFor(sources, ['A_THING', 'A_THING_EXTENDED']);
  assert.deepEqual(found.get('A_THING'), []);
  assert.deepEqual(found.get('A_THING_EXTENDED'), ['a.ts']);
});

test('the event named in a later statement is not read as a call that passes it', () => {
  const sources = [['a.ts', 'recordSecurityEvent(l, SECURITY_EVENTS.OTHER, {});\nconst x = SECURITY_EVENTS.A_THING;']];
  assert.deepEqual(emittersFor(sources, ['A_THING']).get('A_THING'), []);
});
