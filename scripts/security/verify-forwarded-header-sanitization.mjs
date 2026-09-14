#!/usr/bin/env node
// ASVS V1.3.3 - client-controlled header values are sanitized before they are
// forwarded into a dangerous context.
//
// This tier takes four values from the browser and puts them back into an
// outgoing HTTP request header: the correlation id, the idempotency key, the
// client address and the user agent. An HTTP field value is a dangerous
// context, and the runtime is a much weaker control than it looks: measured on
// Node 22, `new Headers()` refuses only NUL, CR, LF and code points above
// U+00FF, and header bytes off the wire are decoded as latin1, so they never
// reach that last case. Every other control character, DEL, and the whole
// 0x80-0xFF range is forwarded exactly as sent, at any length.
//
// So the rule here is not "no injection" - there is none to have. It is the
// requirement itself: a read of one of these headers must reach a control that
// restricts it to characters safe for the context and bounds its length.
//
// A read is accounted for when the value is handed to one of the sanitizers in
// apps/web/lib/server/forwarded-request-headers.ts, or when it is validated by
// an anchored regular expression in the same function - which is how the public
// organization-connect surface does it, with the same character class the
// sanitizer uses.
//
// Exit 0 means every such read is accounted for. Exit 1 lists those that are not.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('../../apps/api/node_modules/typescript/lib/typescript.js');

const SCAN_ROOT = 'apps/web';
const HELPER_MODULE = 'apps/web/lib/server/forwarded-request-headers.ts';
const EXCLUDED = [/^apps\/web\/tests\//u, /\.spec\.tsx?$/u, /\.test\.tsx?$/u];

/** Client-controlled, and forwarded on by this tier. */
export const GUARDED_HEADERS = new Set([
  'x-correlation-id',
  'idempotency-key',
  'user-agent',
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
  'x-nf-client-connection-ip',
]);

export const SANITIZERS = new Set([
  'safeIdentifier',
  'safeCorrelationId',
  'safeIdempotencyKey',
  'safeClientIp',
  'safeUserAgent',
  'clientIpFromRequest',
  'correlationIdFromRequest',
  'idempotencyKeyFromRequest',
  'userAgentFromRequest',
]);

/** request.headers / req.headers / headers - the inbound request, not a response we received. */
const REQUEST_RECEIVER = /^(?:request|req)$/u;

export function selectSources(lsFilesOutput) {
  const files = [];
  for (const line of lsFilesOutput.split('\n')) {
    if (!line) continue;
    const match = /^(\d{6}) [0-9a-f]+ \d+\t(.+)$/u.exec(line);
    if (!match) continue;
    const [, mode, file] = match;
    if (mode === '120000') continue;
    if (!/\.tsx?$/u.test(file)) continue;
    if (!file.startsWith(`${SCAN_ROOT}/`)) continue;
    if (file === HELPER_MODULE) continue;
    if (EXCLUDED.some((pattern) => pattern.test(file))) continue;
    files.push(file);
  }
  return files;
}

export function isRequestHeaderRead(node) {
  if (!ts.isCallExpression(node)) return null;
  const callee = node.expression;
  if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== 'get') return null;
  const jar = callee.expression;
  if (!ts.isPropertyAccessExpression(jar) || jar.name.text !== 'headers') return null;
  if (!ts.isIdentifier(jar.expression) || !REQUEST_RECEIVER.test(jar.expression.text)) return null;
  const [argument] = node.arguments;
  if (!argument || !ts.isStringLiteral(argument)) return null;
  const header = argument.text.toLowerCase();
  return GUARDED_HEADERS.has(header) ? header : null;
}

/** An anchored pattern is a validation; an unanchored one only proves a substring. */
export function isAnchoredRegex(node) {
  if (!node || !ts.isRegularExpressionLiteral(node)) return false;
  const source = node.text.replace(/^\//u, '').replace(/\/[a-z]*$/u, '');
  return source.startsWith('^') && source.endsWith('$');
}

function enclosingFunction(node) {
  let current = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) || ts.isFunctionExpression(current)
        || ts.isArrowFunction(current) || ts.isMethodDeclaration(current)) return current;
    current = current.parent;
  }
  return null;
}

/** The name the read was stored under, if it was stored at all. */
function boundName(node) {
  let current = node.parent;
  while (current && !ts.isStatement(current)) {
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) return current.name.text;
    current = current.parent;
  }
  return null;
}

function anchoredPatternNames(sourceFile) {
  const names = new Set();
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && isAnchoredRegex(node.initializer)) {
      names.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
}

export function accountedFor(read, sourceFile, anchored) {
  // Handed straight to a sanitizer.
  let parent = read.parent;
  while (parent && (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isNonNullExpression(parent))) {
    parent = parent.parent;
  }
  if (parent && ts.isCallExpression(parent) && parent.arguments.includes(read)) {
    const callee = parent.expression;
    const name = ts.isIdentifier(callee) ? callee.text : (ts.isPropertyAccessExpression(callee) ? callee.name.text : null);
    if (name && SANITIZERS.has(name)) return 'sanitizer';
  }

  // Stored first, then sanitized or validated inside the same function.
  const name = boundName(read);
  const scope = enclosingFunction(read) ?? sourceFile;
  if (!name) return null;

  let verdict = null;
  const visit = (node) => {
    if (verdict) return;
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const calleeName = ts.isIdentifier(callee) ? callee.text : (ts.isPropertyAccessExpression(callee) ? callee.name.text : null);
      const usesName = node.arguments.some((argument) => argument.getText() === name);
      if (usesName && calleeName && SANITIZERS.has(calleeName)) verdict = 'sanitizer';
      if (usesName && calleeName === 'test' && ts.isPropertyAccessExpression(callee)
          && ts.isIdentifier(callee.expression) && anchored.has(callee.expression.text)) {
        verdict = 'anchored pattern';
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(scope);
  return verdict;
}

function main() {
  const listing = execFileSync('git', ['ls-files', '-s', '--', SCAN_ROOT], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const files = selectSources(listing);
  const violations = [];
  const accounted = { sanitizer: 0, 'anchored pattern': 0 };
  let inspected = 0;

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (!text.includes('headers.get(')) continue;
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const anchored = anchoredPatternNames(sourceFile);
    const visit = (node) => {
      const header = isRequestHeaderRead(node);
      if (header) {
        inspected += 1;
        const verdict = accountedFor(node, sourceFile, anchored);
        if (verdict) accounted[verdict] += 1;
        else {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          violations.push({ file, line: line + 1, header, text: node.parent.getText().split('\n')[0].trim().slice(0, 110) });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  console.log(`forwarded-header-sanitization: ${inspected} read(s) of a client-controlled forwarded header in ${SCAN_ROOT}`);
  console.log(`  sanitized at the read     ${accounted.sanitizer}`);
  console.log(`  validated by an anchor    ${accounted['anchored pattern']}`);
  console.log(`  unaccounted for           ${violations.length}`);

  if (violations.length === 0) {
    console.log('  Every read reaches a character allowlist and a length bound.');
    return 0;
  }
  console.log('\nThese reads are forwarded without being restricted to safe characters or bounded:');
  for (const violation of violations) {
    console.log(`  ${violation.file}:${violation.line}  ${violation.header}  ${violation.text}`);
  }
  console.log('\nRead it through apps/web/lib/server/forwarded-request-headers.ts, or validate');
  console.log('it with an anchored pattern in the same function.');
  return 1;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
