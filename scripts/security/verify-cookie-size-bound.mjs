#!/usr/bin/env node
// ASVS V3.3.5 - no cookie is written over the 4096-byte name-and-value budget.
//
// A browser that is handed a larger cookie stores nothing and reports nothing.
// The server sees a successful response, the user sees a feature that does not
// work, and nothing in either log says why. The property is therefore enforced
// where the cookie is written, not audited after the fact.
//
// The rule this checks is deliberately structural rather than a size estimate:
// a cookie value must either be a literal - whose size is fixed and visible in
// the source - or come from one of the budget-enforcing helpers in
// apps/web/lib/server/bounded-cookie.ts. An expression whose length is not
// knowable here (a token, a serialized record, anything derived from a request
// or a database row) must pass through a helper that measures it.
//
// Exit 0 means every cookie write in the scanned tree is bounded. Exit 1 lists
// the writes that are not, with the expression that is unaccounted for.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('../../apps/api/node_modules/typescript/lib/typescript.js');

const SCAN_ROOTS = ['apps/web', 'apps/api/src'];
/** Tests construct oversized cookies on purpose, to prove the budget is enforced. */
const EXCLUDED = [/^apps\/web\/tests\//u, /\.spec\.tsx?$/u, /\.test\.tsx?$/u];

export const BUDGET_HELPERS = new Set(['boundedCookieValue', 'serializeWithinCookieBudget']);
const COOKIE_JAR_IDENTIFIER = /^cookie(?:store|jar)$/iu;

/**
 * Enumerate by mode, not by pathspec.
 *
 * apps/web carries a tracked mirror directory of relative symlinks
 * (apps/web/apps/web/lib -> ../../lib and its siblings) so that tests which
 * build paths against a vitest cwd of apps/web resolve. Reading through those
 * links scans the same source a second time under a path that does not exist
 * for the bundler, which is how the first run of this guard came to report on
 * apps/web/apps/web/middleware.ts and never open apps/web/middleware.ts at all.
 * Mode 120000 is a symlink; only regular files are real source here.
 */
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

function tracked() {
  const out = execFileSync('git', ['ls-files', '-s', '--', ...SCAN_ROOTS], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return selectSources(out);
}

/** Strip the wrappers that sit between a cookie jar and the `.set` on it. */
export function unwrap(node) {
  let current = node;
  for (;;) {
    if (ts.isParenthesizedExpression(current) || ts.isAwaitExpression(current)) { current = current.expression; continue; }
    if (ts.isNonNullExpression(current) || ts.isAsExpression(current)) { current = current.expression; continue; }
    return current;
  }
}

/** True when `.set` on this receiver writes a cookie rather than touching a Map or a Set. */
export function isCookieJar(receiver) {
  const target = unwrap(receiver);
  if (ts.isPropertyAccessExpression(target)) return target.name.text === 'cookies';
  if (ts.isIdentifier(target)) return COOKIE_JAR_IDENTIFIER.test(target.text);
  if (ts.isCallExpression(target)) {
    const callee = unwrap(target.expression);
    return ts.isIdentifier(callee) && callee.text === 'cookies';
  }
  return false;
}

/**
 * Classify the expression that supplies the cookie value.
 *
 * `literal` is bounded by the source text itself. `helper` is bounded at run
 * time by bounded-cookie.ts. Everything else is unaccounted for - which is not
 * an accusation that it is too long, only that nothing here or at run time
 * establishes that it is not.
 */
export function classifyValue(node) {
  if (!node) return { verdict: 'MISSING', detail: 'no value argument' };
  const value = unwrap(node);
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) {
    return { verdict: 'LITERAL', detail: JSON.stringify(value.text) };
  }
  if (ts.isCallExpression(value)) {
    const callee = unwrap(value.expression);
    const name = ts.isIdentifier(callee)
      ? callee.text
      : (ts.isPropertyAccessExpression(callee) ? callee.name.text : null);
    if (name && BUDGET_HELPERS.has(name)) return { verdict: 'BOUNDED', detail: name };
  }
  return { verdict: 'UNBOUNDED', detail: value.getText() };
}

export function findCookieWrites(sourceFile) {
  const writes = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'set') {
      if (isCookieJar(node.expression.expression)) {
        const [first, second] = node.arguments;
        // Next.js also accepts a single { name, value, … } object.
        let nameNode = first;
        let valueNode = second;
        if (node.arguments.length === 1 && first && ts.isObjectLiteralExpression(unwrap(first))) {
          const object = unwrap(first);
          const pick = (key) => object.properties.find(
            (property) => ts.isPropertyAssignment(property) && property.name && property.name.getText() === key,
          )?.initializer;
          nameNode = pick('name');
          valueNode = pick('value');
        }
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        writes.push({
          line: line + 1,
          cookie: nameNode ? unwrap(nameNode).getText() : '<unknown>',
          ...classifyValue(valueNode),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return writes;
}

function main() {
  const files = tracked();
  const violations = [];
  let inspected = 0;
  let bounded = 0;
  let literal = 0;

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (!text.includes('.set(')) continue;
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    for (const write of findCookieWrites(sourceFile)) {
      inspected += 1;
      if (write.verdict === 'LITERAL') literal += 1;
      else if (write.verdict === 'BOUNDED') bounded += 1;
      else violations.push({ file, ...write });
    }
  }

  console.log(`cookie-size-bound: ${inspected} cookie write(s) inspected across ${SCAN_ROOTS.join(', ')}`);
  console.log(`  literal value            ${literal}`);
  console.log(`  budget-enforcing helper  ${bounded}`);
  console.log(`  unaccounted for          ${violations.length}`);

  if (violations.length === 0) {
    console.log('  Every cookie write is bounded by a literal or by bounded-cookie.ts.');
    return 0;
  }

  console.log('\nThese cookie values are neither literals nor measured at the write:');
  for (const violation of violations) {
    const detail = violation.detail.length > 120 ? `${violation.detail.slice(0, 117)}...` : violation.detail;
    console.log(`  ${violation.file}:${violation.line}  ${violation.cookie}  <- ${detail}`);
  }
  console.log('\nWrap the value in boundedCookieValue(name, value), or build it with');
  console.log('serializeWithinCookieBudget when it carries variable-length data.');
  return 1;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
