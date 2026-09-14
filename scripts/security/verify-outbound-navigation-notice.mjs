#!/usr/bin/env node
// ASVS V3.7.3 - the person is told before the application takes them somewhere
// it does not control, and can decline.
//
// An anchor that opens a new tab is the shape that does this. Two of them are
// acceptable without a notice:
//   * an href written in the source as a same-origin path - its destination is
//     fixed and visible to the reviewer, so there is nothing to warn about;
//   * one that goes through the confirmed-outbound path, which marks itself
//     with data-outbound and does not navigate until the notice is answered.
// Anything else opens a destination decided at run time with no notice, which
// is exactly what this requirement forbids.
//
// Exit 0 means every new-tab anchor is one of the two. Exit 1 lists the rest.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('../../apps/api/node_modules/typescript/lib/typescript.js');

const SCAN_ROOT = 'apps/web';
const EXCLUDED = [/^apps\/web\/tests\//u, /\.spec\.tsx?$/u, /\.test\.tsx?$/u];

/** The attribute the confirmed-outbound path marks itself with. */
export const CONFIRMED_ATTRIBUTE = 'data-outbound';

/** The component that shows the notice and holds the navigation until it is answered. */
export const CONFIRMED_COMPONENT = 'OutboundLink';

export function selectSources(lsFilesOutput) {
  const files = [];
  for (const line of lsFilesOutput.split('\n')) {
    if (!line) continue;
    const match = /^(\d{6}) [0-9a-f]+ \d+\t(.+)$/u.exec(line);
    if (!match) continue;
    const [, mode, file] = match;
    if (mode === '120000') continue;
    if (!/\.tsx$/u.test(file)) continue;
    if (!file.startsWith(`${SCAN_ROOT}/`)) continue;
    if (EXCLUDED.some((pattern) => pattern.test(file))) continue;
    files.push(file);
  }
  return files;
}

function attributes(node) {
  const found = new Map();
  for (const attribute of node.attributes.properties) {
    if (!ts.isJsxAttribute(attribute) || !attribute.name) continue;
    found.set(attribute.name.getText(), attribute.initializer ?? null);
  }
  return found;
}

/** A literal same-origin path: fixed at review time, so it needs no notice. */
export function isLiteralSameOriginHref(initializer) {
  if (!initializer) return false;
  let node = initializer;
  if (ts.isJsxExpression(node)) node = node.expression;
  if (!node) return false;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    const value = node.text;
    // A path, not a protocol-relative URL - "//evil" is another origin.
    return value.startsWith('/') && !value.startsWith('//');
  }
  return false;
}

export function opensNewTab(attrs) {
  const target = attrs.get('target');
  if (!target) return false;
  let node = target;
  if (ts.isJsxExpression(node)) node = node.expression;
  if (!node) return false;
  return (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && node.text === '_blank';
}

/**
 * An href bound to a field the stream contract guarantees is absolute.
 *
 * ai-assistant-stream.contract.ts requires a citation `uri` to match
 * ^https?:// , so a link bound to one leaves this origin by construction, new
 * tab or not. It is deliberately the field name and not "anything called
 * citation": the same components also render citation.href, which comes from a
 * fixed catalogue of /platform-v7 paths and is same-origin. Flagging that would
 * push an internal link through an external-link component for nothing.
 */
export const CONTRACT_ABSOLUTE_FIELDS = new Set(['uri']);

export function bindsAContractAbsoluteUri(attrs) {
  const href = attrs.get('href') ?? attrs.get('uri');
  if (!href) return false;
  let node = href;
  if (ts.isJsxExpression(node)) node = node.expression;
  if (!node) return false;
  if (!ts.isPropertyAccessExpression(node)) return false;
  return CONTRACT_ABSOLUTE_FIELDS.has(node.name.text);
}

export function findNewTabAnchors(sourceFile) {
  const anchors = [];
  const visit = (node) => {
    const opening = ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node) ? node : null;
    if (opening) {
      const tag = opening.tagName.getText();
      if (tag === CONFIRMED_COMPONENT) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile));
        anchors.push({ line: line + 1, tag, literalSameOrigin: false, confirmed: true });
      }
      if (tag === 'a' || tag === 'Link') {
        const attrs = attributes(opening);
        // Two shapes need a notice: one that opens a new tab, and one bound to
        // a field the contract guarantees is an absolute URL - that leaves this
        // origin whether or not it opens a new tab.
        if (opensNewTab(attrs) || bindsAContractAbsoluteUri(attrs)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile));
          anchors.push({
            line: line + 1,
            tag,
            literalSameOrigin: isLiteralSameOriginHref(attrs.get('href')),
            confirmed: attrs.has(CONFIRMED_ATTRIBUTE),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return anchors;
}

function main() {
  const listing = execFileSync('git', ['ls-files', '-s', '--', SCAN_ROOT], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const files = selectSources(listing);
  const violations = [];
  let literal = 0;
  let confirmed = 0;
  let inspected = 0;

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (!text.includes('_blank') && !text.includes(CONFIRMED_COMPONENT) && !/citation|source/iu.test(text)) continue;
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    for (const anchor of findNewTabAnchors(sourceFile)) {
      inspected += 1;
      if (anchor.literalSameOrigin) literal += 1;
      else if (anchor.confirmed) confirmed += 1;
      else violations.push({ file, ...anchor });
    }
  }

  console.log(`outbound-navigation-notice: ${inspected} anchor(s) needing a notice in ${SCAN_ROOT}`);
  console.log(`  literal same-origin path  ${literal}`);
  console.log(`  confirmed before leaving  ${confirmed}`);
  console.log(`  unannounced               ${violations.length}`);

  if (violations.length === 0) {
    console.log('  Nothing opens a run-time destination without telling the person first.');
    return 0;
  }
  console.log('\nThese open a destination decided at run time with no notice:');
  for (const violation of violations) {
    console.log(`  ${violation.file}:${violation.line}  <${violation.tag} target='_blank'>`);
  }
  console.log(`\nGive it a literal same-origin href, or route it through the notice and mark it ${CONFIRMED_ATTRIBUTE}.`);
  return 1;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
