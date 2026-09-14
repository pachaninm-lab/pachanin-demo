#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ASVS 5.0 V1.1.1: input is decoded into a canonical form once.
 *
 * Next percent-decodes every dynamic route segment before a handler sees it -
 * route-matcher.js does `params[key] = match.split('/').map(decode)` for a
 * catch-all. Three proxy routes decoded again, so `%252e%252e` became `..` and
 * `%253f` became `?`. Neither was reachable, because each route runs the result
 * past an anchored allowlist whose character classes admit no `?`, `#` or `/`.
 * That is a second control cleaning up after a wrong first one: loosen a pattern,
 * add a route without one, and the same input starts injecting a query parameter
 * into an upstream request that carries the caller's bearer token.
 *
 * This refuses a decode applied to a value that arrived already decoded. It
 * follows the binding rather than matching a name, so it catches the value
 * whether it is decoded directly, destructured first, or mapped over - and it
 * does not object to decoding something that genuinely arrives encoded, such as
 * a cookie the application itself encoded.
 */

const DECODERS = new Set(['decodeURIComponent', 'decodeURI', 'unescape']);

/**
 * The identifier a value ultimately comes from, seeing through the spellings a
 * route handler actually uses: `params.path`, `(parts || [])`, `segments ?? []`
 * and parentheses around any of them. Two of the seven sites were missed until
 * this looked through `||`, which is how a catch-all array gets its default.
 */
export function rootIdentifier(node, tsApi) {
  let current = node;
  for (let step = 0; step < 8 && current; step += 1) {
    if (tsApi.isParenthesizedExpression(current)) { current = current.expression; continue; }
    if (tsApi.isBinaryExpression(current)
      && (current.operatorToken.kind === tsApi.SyntaxKind.BarBarToken
        || current.operatorToken.kind === tsApi.SyntaxKind.QuestionQuestionToken)) {
      current = current.left;
      continue;
    }
    if (tsApi.isPropertyAccessExpression(current)) { current = current.expression; continue; }
    if (tsApi.isNonNullExpression(current) || tsApi.isAsExpression(current)) { current = current.expression; continue; }
    break;
  }
  return current && tsApi.isIdentifier(current) ? current : null;
}

const ts = await import(resolve('apps/api/node_modules/typescript/lib/typescript.js'))
  .then((module) => module.default ?? module)
  .catch(() => null);

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

/**
 * Names holding a value the router already decoded: whatever `context.params`
 * was destructured into, and whatever a `.map()` over one of those binds.
 */
export function paramDerivedNames(source, tsApi) {
  const names = new Set();
  const fromParams = (node) => tsApi.isPropertyAccessExpression(node) && node.name.text === 'params';
  const record = (binding) => {
    if (!binding) return;
    if (tsApi.isIdentifier(binding)) names.add(binding.text);
    else if (tsApi.isObjectBindingPattern(binding) || tsApi.isArrayBindingPattern(binding)) {
      for (const element of binding.elements) if (element.name && tsApi.isIdentifier(element.name)) names.add(element.name.text);
    }
  };
  const visit = (node) => {
    if (tsApi.isVariableDeclaration(node) && node.initializer) {
      let initializer = node.initializer;
      if (tsApi.isAwaitExpression(initializer)) initializer = initializer.expression;
      if (fromParams(initializer)) record(node.name);
    }
    // `segments.map((part) => ...)` spreads the taint onto the callback parameter.
    if (tsApi.isCallExpression(node)
      && tsApi.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'map'
      && (() => {
        const root = rootIdentifier(node.expression.expression, tsApi);
        return Boolean(root && names.has(root.text));
      })()) {
      const callback = node.arguments[0];
      if (callback && callback.parameters?.length) record(callback.parameters[0].name);
    }
    node.forEachChild(visit);
  };
  /**
   * A helper called with a router value is a helper handling a router value.
   *
   * Five of the seven sites in this repository put the decode inside a separate
   * `normalizePath(segments)` and passed the catch-all array in, so the taint
   * arrives as a function parameter and a check that only followed declarations
   * in one scope saw nothing. That is a false negative in a guard written for
   * exactly that shape, which is worse than no guard.
   */
  const propagateThroughCalls = (node) => {
    if (tsApi.isCallExpression(node) && tsApi.isIdentifier(node.expression)) {
      const passesTainted = node.arguments.some((argument) => {
        const root = rootIdentifier(argument, tsApi);
        return Boolean(root && names.has(root.text));
      });
      if (passesTainted) {
        const callee = node.expression.text;
        const declaration = findFunction(source, callee, tsApi);
        for (const parameter of declaration?.parameters ?? []) record(parameter.name);
      }
    }
    node.forEachChild(propagateThroughCalls);
  };

  // Repeat until nothing new is learned: a `.map()` may be walked before the
  // declaration it depends on, and a helper may be tainted only after its caller.
  for (let pass = 0; pass < 4; pass += 1) {
    const before = names.size;
    source.forEachChild(visit);
    source.forEachChild(propagateThroughCalls);
    if (names.size === before && pass > 0) break;
  }
  return names;
}

/** The local declaration of a function by name, however it was written. */
export function findFunction(source, name, tsApi) {
  let found = null;
  const visit = (node) => {
    if (found) return;
    if (tsApi.isFunctionDeclaration(node) && node.name?.text === name) { found = node; return; }
    if (tsApi.isVariableDeclaration(node) && tsApi.isIdentifier(node.name) && node.name.text === name
      && node.initializer && (tsApi.isArrowFunction(node.initializer) || tsApi.isFunctionExpression(node.initializer))) {
      found = node.initializer;
      return;
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return found;
}

export function decodesOfAlreadyDecoded(source, tsApi, names) {
  const offences = [];
  const visit = (node) => {
    if (tsApi.isCallExpression(node) && tsApi.isIdentifier(node.expression) && DECODERS.has(node.expression.text)) {
      const argument = node.arguments[0];
      const target = argument ? rootIdentifier(argument, tsApi) : null;
      if (target && names.has(target.text)) {
        offences.push({ decoder: node.expression.text, name: target.text, position: node.getStart(source) });
      }
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return offences;
}

function main() {
  if (!ts) {
    console.error('decode-once: the TypeScript parser is not installed; run the workspace install first.');
    return 2;
  }
  const files = git(['ls-files', '-z']).split('\0')
    .filter((path) => /^apps\/web\/app\/.*\.tsx?$/u.test(path) && !/\.(test|spec)\./u.test(path));

  const offences = [];
  let scanned = 0;
  for (const path of files) {
    const text = readFileSync(path, 'utf8');
    if (!DECODERS.has('decodeURIComponent') || ![...DECODERS].some((name) => text.includes(name))) continue;
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    scanned += 1;
    const names = paramDerivedNames(source, ts);
    if (!names.size) continue;
    for (const offence of decodesOfAlreadyDecoded(source, ts, names)) {
      const line = source.getLineAndCharacterOfPosition(offence.position).line + 1;
      offences.push({ path, line, ...offence });
    }
  }

  console.log(`decode-once: ${scanned} route file(s) containing a decoder inspected`);
  if (!offences.length) {
    console.log('  No handler decodes a value the router had already decoded.');
    return 0;
  }
  console.error(`decode-once FAILED: ${offences.length} decode(s) applied to a value that arrived decoded`);
  for (const offence of offences) {
    console.error(`- ${offence.path}:${offence.line} ${offence.decoder}(${offence.name}) — the router decoded this already`);
  }
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
