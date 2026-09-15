#!/usr/bin/env node
// ASVS V1.3.12 - the repository-wide backtracking sweep.
//
// One ReDoS instance in this application was traced and closed: a key of (.*)*x
// compiled into a per-key RegExp did not finish against an ordinary
// 1901-character contract in 120 seconds, and Node being single-threaded that
// stops every request on the pod. Closing it did not answer the requirement,
// which asks that the application's regular expressions be free of the elements
// that cause exponential backtracking - and no sweep existed to point at.
//
// This is that sweep. It parses every regular expression in the tree and looks
// for the shapes that let one input be split more than one way by a repeated
// group, which is what makes backtracking exponential:
//
//   * the body of an unbounded quantifier is itself unbounded - (a+)+, (.*)*;
//   * it reduces to one, every other part being optional - (\w+\s?)*, where
//     \s? matching empty leaves \w+ repeated inside a repetition;
//   * every part is optional and one of them is unbounded - (a*b*)*;
//   * it is an alternation whose branches can begin with the same character -
//     (a|ab)*, (a|.)*, ([^"]|\\.)* - or one of whose branches is itself
//     unbounded - (a+|b)*.
//
// Every one of those shapes was measured before it was encoded here: against a
// hostile non-matching input each quadruples in runtime for every two
// characters added, matching the closed instance, while an ordinary anchored
// pattern stays flat.
//
// Character sets are compared as sets, and a negated class as the complement it
// is, because the distinction decides real cases. The escaped-string idiom
// (?:[^"\\]|\\.)* is safe precisely because the class excludes the backslash
// the other branch begins with, so no position can be taken two ways; the same
// idiom written (?:[^"]|\\.)* is exponential. Treating a negated class as
// "matches anything" collapses that difference and reports every careful
// instance of the idiom as a finding.
//
// What it does not claim: this finds the exponential constructs, not every
// super-linear regex. Polynomial backtracking - two adjacent unbounded
// quantifiers over overlapping classes, as in \s+\s+ - is a milder class and is
// reported separately rather than failed on.
//
// Patterns compiled from a value rather than written down are counted too: a
// pattern that comes from input cannot be analysed here, and that is exactly
// the shape the closed instance had.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('../../apps/api/node_modules/typescript/lib/typescript.js');

// The sweep covers every tracked source file rather than a list of roots. A
// root list is the kind of thing that silently stops covering a directory the
// moment somebody adds one - apps/landing, workers/ and shared/ all sat outside
// an earlier allowlist while being ordinary request-path code.
//
// Test files are the one exclusion, and for a reason rather than for
// convenience: they deliberately carry hostile patterns as fixtures. This
// sweep's own test holds (.*)*x, so including them would have the guard fail on
// the fixtures that prove it works. Nothing is hidden by the exclusion - the
// excluded set was measured separately and carries no exponential pattern.
const EXCLUDED = [
  /(^|\/)(tests?|__tests__|__mocks__|e2e)\//u,
  /\.(test|spec)\.[cm]?[jt]sx?$/u,
];

export function selectSources(lsFilesOutput) {
  const files = [];
  for (const line of lsFilesOutput.split('\n')) {
    if (!line) continue;
    const match = /^(\d{6}) [0-9a-f]+ \d+\t(.+)$/u.exec(line);
    if (!match) continue;
    const [, mode, file] = match;
    if (mode === '120000') continue;                      // a tracked symlink mirror, not a real file
    if (!/\.[cm]?[jt]sx?$/u.test(file)) continue;
    if (EXCLUDED.some((pattern) => pattern.test(file))) continue;
    files.push(file);
  }
  return files;
}

/* ---------------------------------------------------------------- parsing -- */

/**
 * Consumes one escape. \uXXXX, \u{...}, \xXX and \p{...} are single atoms;
 * taking only two characters would leave their tail to be read as literals and
 * braces, which shifts the parse of everything after them.
 */
function consumeEscape(source, start) {
  let index = start + 1;
  const character = source[index];
  if (character === undefined) return { text: '\\', next: index };
  index += 1;
  if (character === 'u' && source[index] === '{') {
    const close = source.indexOf('}', index);
    index = close === -1 ? index + 1 : close + 1;
  } else if (character === 'u') {
    index += 4;
  } else if (character === 'x') {
    index += 2;
  } else if (character === 'c') {
    index += 1;
  } else if ((character === 'p' || character === 'P') && source[index] === '{') {
    const close = source.indexOf('}', index);
    index = close === -1 ? index + 1 : close + 1;
  } else if (character === 'k' && source[index] === '<') {
    const close = source.indexOf('>', index);
    index = close === -1 ? index + 1 : close + 1;
  } else if (/\d/u.test(character)) {
    while (index < source.length && /\d/u.test(source[index])) index += 1;
  }
  if (index > source.length) index = source.length;
  return { text: source.slice(start, index), next: index };
}

/**
 * A deliberately small parser. It understands the constructs that decide
 * backtracking - groups, alternation, quantifiers, classes, escapes - and
 * represents everything else as an opaque atom, which is enough: an atom
 * cannot nest a quantifier inside itself.
 */
export function parsePattern(source, flags = '') {
  const dotAll = flags.includes('s');
  let index = 0;

  const parseAlternation = () => {
    const branches = [parseSequence()];
    while (source[index] === '|') { index += 1; branches.push(parseSequence()); }
    return branches.length === 1 ? branches[0] : { type: 'alternation', branches };
  };

  const parseSequence = () => {
    const items = [];
    while (index < source.length && source[index] !== '|' && source[index] !== ')') {
      const atom = parseAtom();
      if (!atom) break;
      items.push(parseQuantifier(atom));
    }
    return { type: 'sequence', items };
  };

  const parseQuantifier = (atom) => {
    const character = source[index];
    let min = null;
    let max = null;
    if (character === '*') { min = 0; max = Infinity; index += 1; }
    else if (character === '+') { min = 1; max = Infinity; index += 1; }
    else if (character === '?') { min = 0; max = 1; index += 1; }
    else if (character === '{') {
      const close = source.indexOf('}', index);
      const body = close === -1 ? null : source.slice(index + 1, close);
      const match = body === null ? null : /^(\d+)(,(\d*)?)?$/u.exec(body);
      if (!match) return atom;
      min = Number(match[1]);
      max = match[2] === undefined ? min : (match[3] ? Number(match[3]) : Infinity);
      index = close + 1;
    } else {
      return atom;
    }
    if (source[index] === '?') index += 1; // lazy: still backtracks, just from the other end
    return { type: 'quantified', min, max, body: atom };
  };

  const parseAtom = () => {
    const character = source[index];
    if (character === undefined) return null;
    if (character === '(') {
      index += 1;
      let kind = 'capturing';
      if (source[index] === '?') {
        const next = source[index + 1];
        if (next === ':') { kind = 'group'; index += 2; }
        else if (next === '=' || next === '!') { kind = 'lookahead'; index += 2; }
        else if (next === '<' && (source[index + 2] === '=' || source[index + 2] === '!')) { kind = 'lookbehind'; index += 3; }
        else if (next === '<') { const close = source.indexOf('>', index); index = close === -1 ? index + 2 : close + 1; }
      }
      const body = parseAlternation();
      if (source[index] === ')') index += 1;
      return { type: 'group', kind, body };
    }
    if (character === '[') {
      const start = index;
      index += 1;
      if (source[index] === '^') index += 1;
      if (source[index] === ']') index += 1;
      while (index < source.length && source[index] !== ']') index += (source[index] === '\\' ? 2 : 1);
      index += 1;
      return { type: 'class', text: source.slice(start, Math.min(index, source.length)) };
    }
    if (character === '\\') {
      const { text, next } = consumeEscape(source, index);
      index = next;
      return { type: 'escape', text };
    }
    if (character === '.') { index += 1; return { type: 'dot', dotAll }; }
    index += 1;
    return { type: 'literal', text: character };
  };

  return parseAlternation();
}

/* ----------------------------------------------------------- character sets */

// A set of characters, or the complement of one. Modelling the complement
// rather than flattening it to "anything" is what keeps (?:[^"\\]|\\.)* apart
// from (?:[^"]|\\.)*, which is the difference between safe and exponential.
const posSet = (characters) => ({ negated: false, chars: new Set(characters) });
const negSet = (characters) => ({ negated: true, chars: new Set(characters) });
const noneSet = () => posSet([]);
const anySet = () => negSet([]);

const WORD = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';
const DIGITS = '0123456789';
const SPACE = ' \t\n\r\f\v    ﻿';
const NEWLINES = '\n\r  ';
const MAX_RANGE = 1024;

export function unionSets(a, b) {
  if (!a.negated && !b.negated) return posSet([...a.chars, ...b.chars]);
  if (a.negated && b.negated) return negSet([...a.chars].filter((value) => b.chars.has(value)));
  const negative = a.negated ? a : b;
  const positive = a.negated ? b : a;
  return negSet([...negative.chars].filter((value) => !positive.chars.has(value)));
}

/** Whether two sets share a character - the condition that gives the engine a choice. */
export function setsOverlap(a, b) {
  if (a.negated && b.negated) return true;             // both match all but a handful
  if (!a.negated && !b.negated) {
    for (const value of a.chars) if (b.chars.has(value)) return true;
    return false;
  }
  const negative = a.negated ? a : b;
  const positive = a.negated ? b : a;
  for (const value of positive.chars) if (!negative.chars.has(value)) return true;
  return false;
}

/** The characters an escape can match. null when it is not decidable. */
export function escapeCharacters(text) {
  const body = text.slice(1);
  if (body === 'd') return posSet(DIGITS);
  if (body === 'w') return posSet(WORD);
  if (body === 's') return posSet(SPACE);
  if (body === 'D') return negSet(DIGITS);
  if (body === 'W') return negSet(WORD);
  if (body === 'S') return negSet(SPACE);
  if (body === 'b' || body === 'B') return noneSet();            // zero width
  if (body.startsWith('p') || body.startsWith('P')) return anySet();
  if (/^\d/u.test(body)) return null;                            // backreference
  const named = { n: '\n', r: '\r', t: '\t', f: '\f', v: '\v', 0: '\0' };
  if (body in named) return posSet([named[body]]);
  if (body.startsWith('u') || body.startsWith('x')) {
    const hex = body.replace(/^[ux]\{?/u, '').replace(/\}$/u, '');
    const code = Number.parseInt(hex, 16);
    return Number.isFinite(code) ? posSet([String.fromCodePoint(code)]) : anySet();
  }
  return posSet([body]);                                         // escaped punctuation
}

/** The characters a class can match, as a set or the complement of one. */
export function classCharacters(text) {
  let inner = text.replace(/^\[/u, '').replace(/\]$/u, '');
  const negated = inner.startsWith('^');
  if (negated) inner = inner.slice(1);

  let accumulated = noneSet();
  let index = 0;
  while (index < inner.length) {
    let low;
    if (inner[index] === '\\') {
      const { text: escape, next } = consumeEscape(inner, index);
      index = next;
      const characters = escapeCharacters(escape);
      if (characters === null) return anySet();
      accumulated = unionSets(accumulated, characters);
      if (characters.negated || characters.chars.size !== 1) continue;
      [low] = [...characters.chars];
    } else {
      low = inner[index];
      accumulated = unionSets(accumulated, posSet([low]));
      index += 1;
    }
    if (inner[index] !== '-' || index + 1 >= inner.length) continue;

    let high;
    if (inner[index + 1] === '\\') {
      const { text: escape, next } = consumeEscape(inner, index + 1);
      const characters = escapeCharacters(escape);
      if (characters === null || characters.negated || characters.chars.size !== 1) return anySet();
      [high] = [...characters.chars];
      index = next;
    } else {
      high = inner[index + 1];
      index += 2;
    }
    const from = low.codePointAt(0);
    const to = high.codePointAt(0);
    if (from === undefined || to === undefined || to < from || to - from > MAX_RANGE) return anySet();
    const span = [];
    for (let code = from; code <= to; code += 1) span.push(String.fromCodePoint(code));
    accumulated = unionSets(accumulated, posSet(span));
  }

  if (!negated) return accumulated;
  if (accumulated.negated) return anySet();   // complement of a complement: not modelled
  return negSet(accumulated.chars);
}

/* --------------------------------------------------------------- analysis -- */

const unbounded = (node) => node.type === 'quantified' && node.max === Infinity;

/** Whether a node can match the empty string. Conservative: true only when evident. */
export function nullable(node) {
  if (!node) return true;
  switch (node.type) {
    case 'quantified': return node.min === 0 || nullable(node.body);
    case 'group': return node.kind === 'lookahead' || node.kind === 'lookbehind' ? true : nullable(node.body);
    case 'sequence': return node.items.every(nullable);
    case 'alternation': return node.branches.some(nullable);
    case 'escape': return node.text === '\\b' || node.text === '\\B';
    case 'literal': return node.text === '^' || node.text === '$';
    default: return false;
  }
}

/** The characters a node can begin with, or null when unknown. */
export function firstSet(node) {
  if (!node) return null;
  switch (node.type) {
    case 'literal':
      if (node.text === '^' || node.text === '$') return noneSet();
      return posSet([node.text]);
    case 'dot': return node.dotAll ? anySet() : negSet(NEWLINES);
    case 'escape': return escapeCharacters(node.text);
    case 'class': return classCharacters(node.text);
    case 'quantified': return firstSet(node.body);
    case 'group': return node.kind === 'lookahead' || node.kind === 'lookbehind' ? noneSet() : firstSet(node.body);
    case 'alternation': {
      const sets = node.branches.map(firstSet);
      if (sets.some((set) => set === null)) return null;
      return sets.reduce(unionSets, noneSet());
    }
    case 'sequence': {
      let union = noneSet();
      for (const item of node.items) {
        const set = firstSet(item);
        if (set === null) return null;
        union = unionSets(union, set);
        if (!nullable(item)) return union;   // this one must consume; nothing later can start the match
      }
      return union;
    }
    default: return null;
  }
}

/** Two branches that can begin with the same thing give the engine a choice. */
export function branchesOverlap(branches) {
  const sets = branches.map(firstSet);
  for (let i = 0; i < sets.length; i += 1) {
    for (let j = i + 1; j < sets.length; j += 1) {
      if (!sets[i] || !sets[j]) continue;
      if (setsOverlap(sets[i], sets[j])) return true;
    }
  }
  return false;
}

/** Looks through groups and single-item sequences to the node that carries the shape. */
function lookThrough(node) {
  let current = node;
  for (;;) {
    if (!current) return current;
    if (current.type === 'group' && current.kind !== 'lookahead' && current.kind !== 'lookbehind') { current = current.body; continue; }
    if (current.type === 'sequence' && current.items.length === 1) { current = current.items[0]; continue; }
    return current;
  }
}

/**
 * Whether repeating this body lets one input be split more than one way, which
 * is the condition that makes the enclosing unbounded quantifier exponential.
 */
export function ambiguousUnderRepetition(body, found = []) {
  const node = lookThrough(body);
  if (!node) return false;
  if (unbounded(node)) { found.push({ kind: 'nested quantifier' }); return true; }
  if (node.type === 'alternation') {
    if (branchesOverlap(node.branches)) { found.push({ kind: 'quantified overlapping alternation' }); return true; }
    return node.branches.some((branch) => ambiguousUnderRepetition(branch, found));
  }
  if (node.type === 'sequence') {
    const required = node.items.filter((item) => !nullable(item));
    // Everything but one part optional: that part is repeated inside a repetition.
    if (required.length === 1) return ambiguousUnderRepetition(required[0], found);
    if (required.length === 0 && node.items.some((item) => unbounded(item))) {
      found.push({ kind: 'nested quantifier' });
      return true;
    }
    return false;
  }
  return false;
}

export function findExponentialShapes(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (unbounded(node)) ambiguousUnderRepetition(node.body, found);
  for (const key of ['body', 'items', 'branches']) {
    const child = node[key];
    if (Array.isArray(child)) for (const item of child) findExponentialShapes(item, found);
    else if (child) findExponentialShapes(child, found);
  }
  return found;
}

/** Two adjacent unbounded quantifiers over overlapping classes: slow, not exponential. */
export function findPolynomialShapes(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (node.type === 'sequence') {
    for (let i = 0; i + 1 < node.items.length; i += 1) {
      const left = node.items[i];
      const right = node.items[i + 1];
      if (unbounded(left) && unbounded(right)) {
        const a = firstSet(left.body);
        const b = firstSet(right.body);
        if (a && b && setsOverlap(a, b)) found.push({ kind: 'adjacent unbounded quantifiers' });
      }
    }
  }
  for (const key of ['body', 'items', 'branches']) {
    const child = node[key];
    if (Array.isArray(child)) for (const item of child) findPolynomialShapes(item, found);
    else if (child) findPolynomialShapes(child, found);
  }
  return found;
}

export function analysePattern(source, flags = '') {
  let root;
  try {
    root = parsePattern(source, flags);
  } catch {
    return { exponential: [], polynomial: [], parsed: false };
  }
  return { exponential: findExponentialShapes(root), polynomial: findPolynomialShapes(root), parsed: true };
}

/* ------------------------------------------------- constructed-from-a-value */

/**
 * A pattern built from a value cannot be read here, so it is held to a
 * different standard: each site is recorded with the reason it is safe, and a
 * site that appears without one fails the sweep. Identity is the file and the
 * expression rather than the line, so that moving code does not invalidate a
 * judgement and editing what gets compiled does.
 */
export function normaliseExpression(text) {
  return text.replace(/\s+/gu, ' ').trim();
}

export function reconcileConstructions(sites, baseline) {
  const recorded = new Map();
  for (const entry of baseline.sites ?? []) recorded.set(`${entry.file} ${entry.expression}`, entry);

  const seen = new Set();
  const unjudged = [];
  for (const site of sites) {
    const key = `${site.file} ${site.expression}`;
    seen.add(key);
    const entry = recorded.get(key);
    if (!entry || typeof entry.why !== 'string' || entry.why.trim().length < 20) unjudged.push(site);
  }

  const stale = (baseline.sites ?? []).filter((entry) => !seen.has(`${entry.file} ${entry.expression}`));
  return { ok: unjudged.length === 0 && stale.length === 0, unjudged, stale };
}

/* ----------------------------------------------------------------- sweep -- */

/**
 * Module-level string constants, so that a pattern assembled from them can
 * still be read. Without this, `new RegExp('market' + 'place', 'gi')` and
 * `` `(?:^|;\s*)${LOCALE_COOKIE}=([^;]+)` `` are both written down in full in
 * the source and both counted as unknowable.
 */
function stringConstants(sourceFile) {
  const constants = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      if (ts.isStringLiteral(declaration.initializer) || ts.isNoSubstitutionTemplateLiteral(declaration.initializer)) {
        constants.set(declaration.name.text, declaration.initializer.text);
      }
    }
  }
  return constants;
}

/** The string a node evaluates to when that is decidable from the source alone. */
export function staticString(node, constants = new Map()) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isIdentifier(node)) return constants.has(node.text) ? constants.get(node.text) : null;
  if (ts.isParenthesizedExpression(node)) return staticString(node.expression, constants);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticString(node.left, constants);
    const right = staticString(node.right, constants);
    return left === null || right === null ? null : left + right;
  }
  if (ts.isTemplateExpression(node)) {
    let text = node.head.text;
    for (const span of node.templateSpans) {
      const value = staticString(span.expression, constants);
      if (value === null) return null;
      text += value + span.literal.text;
    }
    return text;
  }
  return null;
}

export function collectPatterns(sourceFile) {
  const patterns = [];
  const constants = stringConstants(sourceFile);
  const visit = (node) => {
    if (ts.isRegularExpressionLiteral(node)) {
      const text = node.getText(sourceFile);
      const end = text.lastIndexOf('/');
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      patterns.push({ line: line + 1, source: text.slice(1, end), flags: text.slice(end + 1), origin: 'literal' });
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'RegExp') {
      const argument = node.arguments?.[0];
      const second = node.arguments?.[1];
      const flags = staticString(second, constants) ?? '';
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const resolved = staticString(argument, constants);
      if (resolved !== null) {
        patterns.push({ line: line + 1, source: resolved, flags, origin: 'constructed' });
      } else {
        patterns.push({ line: line + 1, source: null, flags, origin: 'computed', expression: normaliseExpression(argument ? argument.getText(sourceFile) : '') });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return patterns;
}

const BASELINE = 'docs/security/regex-construction-baseline.json';

function main() {
  const listing = execFileSync('git', ['ls-files', '-s'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const files = selectSources(listing);

  let analysed = 0;
  let unparsed = 0;
  let scanned = 0;
  const constructions = [];
  const exponential = [];
  const polynomial = [];

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (!text.includes('RegExp') && !text.includes('/')) continue;
    scanned += 1;
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    for (const pattern of collectPatterns(sourceFile)) {
      if (pattern.origin === 'computed') { constructions.push({ file, ...pattern }); continue; }
      const result = analysePattern(pattern.source, pattern.flags);
      if (!result.parsed) { unparsed += 1; continue; }
      analysed += 1;
      for (const hit of result.exponential) exponential.push({ file, ...pattern, ...hit });
      for (const hit of result.polynomial) polynomial.push({ file, ...pattern, ...hit });
    }
  }

  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const judged = reconcileConstructions(constructions, baseline);

  console.log(`regex backtracking sweep: ${analysed} pattern(s) analysed in ${scanned} of ${files.length} tracked source file(s)`);
  console.log(`  compiled from a value     ${constructions.length} (${judged.unjudged.length} without a recorded reason)`);
  console.log(`  unparsed                  ${unparsed}`);
  console.log(`  polynomial (reported)     ${polynomial.length}`);
  console.log(`  exponential               ${exponential.length}`);

  for (const hit of polynomial.slice(0, 10)) {
    console.log(`    slow: ${hit.file}:${hit.line}  /${hit.source.slice(0, 60)}/`);
  }

  let failed = false;

  if (exponential.length > 0) {
    failed = true;
    console.log('\nThese carry an element that causes exponential backtracking:');
    for (const hit of exponential) {
      console.log(`  ${hit.file}:${hit.line}  ${hit.kind}\n    /${hit.source.slice(0, 100)}/`);
    }
  } else {
    console.log('\n  No written pattern carries a shape that lets one input be split more than one way.');
  }

  if (judged.unjudged.length > 0) {
    failed = true;
    console.log(`\nThese build a regular expression from a value with no recorded reason it is safe.`);
    console.log(`Read what can reach the value, then record it in ${BASELINE}:`);
    for (const site of judged.unjudged) {
      console.log(`  ${site.file}:${site.line}\n    new RegExp(${site.expression.slice(0, 100)})`);
    }
  }

  if (judged.stale.length > 0) {
    failed = true;
    console.log(`\n${BASELINE} records sites that are no longer there. Remove them:`);
    for (const entry of judged.stale) console.log(`  ${entry.file}  new RegExp(${entry.expression.slice(0, 80)})`);
  }

  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
