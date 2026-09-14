#!/usr/bin/env node
// ASVS V3.7.5 - one documented behaviour when the browser lacks a security
// feature, instead of a silent downgrade.
//
// Web Crypto's randomUUID and subtle are [SecureContext]: over plain HTTP, or
// in an old enough browser, they are simply absent. The identifiers built from
// them are what the API deduplicates on - a deal command id, a registration
// idempotency key - so a substitute that is merely unique-ish is not a
// substitute at all. Date.now() is public and Math.random() is not a CSPRNG;
// swapping one in turns an identifier the design assumes is unguessable into a
// predictable one, and leaves nothing in the record to say it happened.
//
// The rule: a function that reaches for Web Crypto must not also carry a
// Math.random() or Date.now() fallback. A value that genuinely is not a
// security identifier may say so with the NOT-A-SECURITY-IDENTIFIER marker at
// the site, where a reviewer sees the claim next to the code.
//
// Exit 0 means no unmarked weak fallback exists. Exit 1 lists them.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('../../apps/api/node_modules/typescript/lib/typescript.js');

const SCAN_ROOTS = ['apps/web/components', 'apps/web/app', 'apps/web/lib'];
const CAPABILITY_MODULE = 'apps/web/lib/browser-security-capabilities.ts';
const EXCLUDED = [/^apps\/web\/tests\//u, /\.spec\.tsx?$/u, /\.test\.tsx?$/u, /\/api\//u];

/** The marker a site uses to claim a value is not a security identifier. */
export const NON_SECURITY_MARKER = 'NOT-A-SECURITY-IDENTIFIER';

/**
 * Sites the rule does not apply to, stated outside the source.
 *
 * The marker above is the normal way to make that claim, because it sits next
 * to the code. Some files cannot carry it: the immutability register in
 * tests/unit/platformV7RootWorkEntry.test.ts binds a handful of public
 * surfaces to an accepted parent by SHA-256, and editing one - even to add a
 * comment - rewrites owner-accepted evidence. Those are recorded here instead,
 * with a reason long enough to be an argument rather than a label.
 */
export const EXCEPTIONS_PATH = 'docs/security/browser-security-exceptions.json';
const MIN_REASON_LENGTH = 80;

export function exceptedPaths(document) {
  const entries = Array.isArray(document?.exceptions) ? document.exceptions : [];
  const accepted = new Set();
  const rejected = [];
  for (const entry of entries) {
    const reason = typeof entry?.reason === 'string' ? entry.reason.trim() : '';
    if (typeof entry?.path !== 'string' || reason.length < MIN_REASON_LENGTH) {
      rejected.push({ path: entry?.path ?? '<missing>', reason });
      continue;
    }
    accepted.add(entry.path);
  }
  return { accepted, rejected };
}

export const WEB_CRYPTO = /\brandomUUID\b|\bcrypto\.subtle\b/u;
export const WEAK_SOURCE = /\bMath\.random\b|\bDate\.now\b/u;

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
    if (file === CAPABILITY_MODULE) continue;
    if (EXCLUDED.some((pattern) => pattern.test(file))) continue;
    files.push(file);
  }
  return files;
}

/**
 * A Web Crypto value with a weaker value standing behind it.
 *
 * Detected by shape rather than by co-occurrence inside a function. An earlier
 * version asked only whether a function mentioned both, and reported a server
 * route whose POST handler happens to call randomUUID() in one place and
 * Date.now() somewhere else entirely - a function long enough for that to be a
 * coincidence rather than a fallback.
 *
 * Three shapes are a fallback:
 *   crypto.randomUUID?.() ?? weak        - the nullish or logical alternative
 *   supported ? strong : weak            - the conditional
 *   if (supported) return strong; return weak;  - the early return
 */
export function weakFallbackFunctions(sourceFile) {
  const found = [];

  const record = (node, name) => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    found.push({ line: line + 1, name });
  };

  const enclosingName = (node) => {
    let current = node.parent;
    while (current) {
      if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
      if (ts.isMethodDeclaration(current) && current.name) return current.name.getText(sourceFile);
      if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) return current.name.text;
      current = current.parent;
    }
    return '<anonymous>';
  };

  const marked = (node) => node.getText(sourceFile).includes(NON_SECURITY_MARKER);

  const visit = (node) => {
    if (ts.isBinaryExpression(node)
        && (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
          || node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
        && WEB_CRYPTO.test(node.left.getText(sourceFile))
        && WEAK_SOURCE.test(node.right.getText(sourceFile))) {
      record(node, enclosingName(node));
    }

    if (ts.isConditionalExpression(node)
        && WEB_CRYPTO.test(`${node.condition.getText(sourceFile)}${node.whenTrue.getText(sourceFile)}`)
        && WEAK_SOURCE.test(node.whenFalse.getText(sourceFile))) {
      record(node, enclosingName(node));
    }

    // if (webCryptoIsThere) return strong;  ...  return weak;
    const isFunction = ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)
      || ts.isArrowFunction(node) || ts.isMethodDeclaration(node);
    if (isFunction && node.body && ts.isBlock(node.body) && !marked(node)) {
      const statements = node.body.statements;
      const guarded = statements.some((statement) => ts.isIfStatement(statement)
        && WEB_CRYPTO.test(statement.expression.getText(sourceFile)));
      const weakReturn = statements.some((statement) => ts.isReturnStatement(statement)
        && statement.expression && WEAK_SOURCE.test(statement.expression.getText(sourceFile)));
      if (guarded && weakReturn) {
        const name = ts.isFunctionDeclaration(node) && node.name ? node.name.text : enclosingName(node);
        record(node, name);
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  // A marked site is a reviewed claim, not a finding.
  return found
    .filter((entry, index) => found.findIndex((other) => other.line === entry.line) === index)
    .filter((entry) => !markedLines(sourceFile).has(entry.line));
}

/** Lines inside a construct that carries the marker. */
function markedLines(sourceFile) {
  const lines = new Set();
  const text = sourceFile.getFullText();
  const visit = (node) => {
    const isFunction = ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)
      || ts.isArrowFunction(node) || ts.isMethodDeclaration(node);
    if (isFunction && node.getText(sourceFile).includes(NON_SECURITY_MARKER)) {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
      for (let line = start; line <= end; line += 1) lines.add(line + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  void text;
  return lines;
}

function main() {
  const listing = execFileSync('git', ['ls-files', '-s', '--', ...SCAN_ROOTS], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const files = selectSources(listing);
  const { accepted: excepted, rejected: malformed } = exceptedPaths(
    JSON.parse(readFileSync(EXCEPTIONS_PATH, 'utf8')),
  );
  const violations = [];
  let marked = 0;
  let inspected = 0;

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (!WEB_CRYPTO.test(text)) continue;
    inspected += 1;
    if (text.includes(NON_SECURITY_MARKER) || excepted.has(file)) marked += 1;
    if (excepted.has(file)) continue;
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    for (const hit of weakFallbackFunctions(sourceFile)) violations.push({ file, ...hit });
  }

  console.log(`browser-security-capabilities: ${inspected} file(s) using Web Crypto in ${SCAN_ROOTS.join(', ')}`);
  console.log(`  marked not-a-security-id  ${marked}`);
  console.log(`  weak fallback             ${violations.length}`);
  if (malformed.length > 0) {
    console.log('\nThese exception entries carry no usable reason and are ignored:');
    for (const entry of malformed) console.log(`  ${entry.path}`);
  }

  if (violations.length === 0 && malformed.length === 0) {
    console.log('  No Web Crypto call carries a Math.random() or Date.now() substitute.');
    return 0;
  }
  console.log('\nThese substitute a predictable value when Web Crypto is missing:');
  for (const violation of violations) {
    console.log(`  ${violation.file}:${violation.line}  ${violation.name}()`);
  }
  console.log(`\nRefuse the action instead (secureRandomId throws), or mark the value ${NON_SECURITY_MARKER}.`);
  return 1;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
