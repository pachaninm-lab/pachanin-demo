#!/usr/bin/env node
// ASVS V1.5.3 - one parser per data type.
//
// A URL is a data type this platform already has a parser for: the WHATWG one,
// `new URL`, which is also the parser the browser, undici and Node all use when
// they finally resolve the value. A second, hand-written parser for the same
// data type is where this requirement fails, because the two do not have to
// agree - and here they did not. The public AI-grounding source boundary tested
// hrefs with an anchored prefix regex, `includes('..')` and `includes('://')`,
// while the value was rendered as `<a href>`. The WHATWG parser removes tab,
// line feed and carriage return before parsing, so `.<TAB>.` holds no `..` for
// a string test and is exactly `..` for the parser: `/platform-v7/.<TAB>./staff`
// passed every check and resolved to `/staff`.
//
// Two rules, both structural:
//   1. no hand-written URL parsing idiom in application source;
//   2. no legacy node:url parser, which splits URLs differently from `new URL`.
//
// Exit 0 means neither appears. Exit 1 lists what does.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('../../apps/api/node_modules/typescript/lib/typescript.js');

const SCAN_ROOTS = ['apps/api/src', 'apps/web'];
const EXCLUDED = [/^apps\/web\/tests\//u, /\.spec\.tsx?$/u, /\.test\.tsx?$/u];

/** String operations that stand in for parsing a URL, with the argument that gives them away. */
export const ADHOC_URL_TESTS = new Map([
  ['includes', ['..', '://', '//']],
  ['startsWith', ['http://', 'https://', '//']],
]);

/** node:url's legacy parser. domainToASCII and fileURLToPath are not parsers and stay allowed. */
export const LEGACY_URL_PARSERS = new Set(['parse', 'resolve', 'resolveObject', 'format']);

export function selectSources(lsFilesOutput) {
  const files = [];
  for (const line of lsFilesOutput.split('\n')) {
    if (!line) continue;
    const match = /^(\d{6}) [0-9a-f]+ \d+\t(.+)$/u.exec(line);
    if (!match) continue;
    const [, mode, file] = match;
    if (mode === '120000') continue;
    if (!/\.tsx?$/u.test(file)) continue;
    if (!SCAN_ROOTS.some((root) => file.startsWith(`${root}/`))) continue;
    if (EXCLUDED.some((pattern) => pattern.test(file))) continue;
    files.push(file);
  }
  return files;
}

/** `x.includes('..')` and friends - a string standing in for a URL parser. */
export function adhocUrlTest(node) {
  if (!ts.isCallExpression(node)) return null;
  const callee = node.expression;
  if (!ts.isPropertyAccessExpression(callee)) return null;
  const needles = ADHOC_URL_TESTS.get(callee.name.text);
  if (!needles) return null;
  const [argument] = node.arguments;
  if (!argument || !ts.isStringLiteral(argument)) return null;
  return needles.includes(argument.text) ? `${callee.name.text}('${argument.text}')` : null;
}

/** `url.parse(...)` where `url` came from node:url. */
export function legacyUrlParse(node, legacyNamespaces, legacyNames) {
  if (!ts.isCallExpression(node)) return null;
  const callee = node.expression;
  if (ts.isIdentifier(callee) && legacyNames.has(callee.text)) return `${callee.text}()`;
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)
      && legacyNamespaces.has(callee.expression.text) && LEGACY_URL_PARSERS.has(callee.name.text)) {
    return `${callee.expression.text}.${callee.name.text}()`;
  }
  return null;
}

function urlImports(sourceFile) {
  const namespaces = new Set();
  const names = new Set();
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)
        && /^(?:node:)?url$/u.test(node.moduleSpecifier.text)) {
      const clause = node.importClause;
      if (clause?.name) namespaces.add(clause.name.text);
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          const imported = (element.propertyName ?? element.name).text;
          if (LEGACY_URL_PARSERS.has(imported)) names.add(element.name.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { namespaces, names };
}

export function findSecondParsers(sourceFile) {
  const { namespaces, names } = urlImports(sourceFile);
  const found = [];
  const visit = (node) => {
    const adhoc = adhocUrlTest(node);
    if (adhoc) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      found.push({ line: line + 1, kind: 'hand-written URL test', detail: adhoc });
    }
    const legacy = legacyUrlParse(node, namespaces, names);
    if (legacy) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      found.push({ line: line + 1, kind: 'legacy node:url parser', detail: legacy });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function main() {
  const listing = execFileSync('git', ['ls-files', '-s', '--', ...SCAN_ROOTS], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const files = selectSources(listing);
  const violations = [];

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (!text.includes('includes(') && !text.includes('startsWith(') && !text.includes("'url'") && !text.includes("'node:url'")) continue;
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    for (const hit of findSecondParsers(sourceFile)) violations.push({ file, ...hit });
  }

  console.log(`parser-consistency: ${files.length} source file(s) inspected across ${SCAN_ROOTS.join(', ')}`);
  console.log(`  second parsers for a URL  ${violations.length}`);

  if (violations.length === 0) {
    console.log('  A URL is parsed by the WHATWG parser and nothing else.');
    return 0;
  }
  console.log('\nThese parse a URL a second way, which need not agree with new URL:');
  for (const violation of violations) {
    console.log(`  ${violation.file}:${violation.line}  ${violation.kind}: ${violation.detail}`);
  }
  console.log('\nResolve the value with new URL and apply the rule to what it produces.');
  return 1;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
